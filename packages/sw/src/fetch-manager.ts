import {
  ASSET_CACHE_NAME,
  CacheManager,
  MEDIA_CACHE_MAX_BYTES,
  MEDIA_CACHE_NAME,
  MEDIA_CACHE_NAME_AVATARS,
  MEDIA_PROGRESSIVE_CACHE_DISABLED,
  MEDIA_PROGRESSIVE_CACHE_NAME,
} from '@telegenie/libs/foundation/cache';
import { parsePeerAvatarUrl } from '@telegenie/libs/foundation/telegram/media/peer-avatar-url';
import type {
  FileDownloadItem,
  FileDownloadResult,
  FileGetPartResult,
  FilePeerPhotoItem,
  TelegramWorkerApi,
  TelegramWorkerEvents,
} from '@telegenie/libs/foundation/telegram/worker';
import type { WorkerClient } from '@telegenie/libs/foundation/worker-rpc';
import { sleep } from '@telegenie/libs/utils/scheduler';

import { DEBUG } from './constants';
import { respondForShare } from './share';

declare const self: ServiceWorkerGlobalScope;

const RE_NETWORK_FIRST_ASSETS = /\.(wasm|html)$/;
const RE_CACHE_FIRST_ASSETS = /[\da-f]{20}.*\.(js|css|woff2?|svg|png|jpg|jpeg|tgs|json|wasm)$/;

/**
 * Cache Storage rejects `cache.put` when the request carries `Range`.
 * Video stickers are loaded with `<video>`, which always sends that header,
 * so those responses were downloaded and then dropped.
 * Lookup uses the same URL-only request so the stored entry still matches.
 */
function cacheableMediaRequest(request: Request): Request {
  if (!request.headers.has('range')) return request;
  const headers = new Headers(request.headers);
  headers.delete('range');
  return new Request(request.url, { method: 'GET', headers });
}

/** Set on every response the SW served out of Cache Storage (value is the cache name). */
export const CACHE_HIT_HEADER = 'X-TG-Cache';

/**
 * Clone a Cache Storage hit with `X-TG-Cache`. `cache.match` responses can have
 * immutable headers, so we rebuild the Response and reuse the body stream.
 */
function withCacheHitHeader(cached: Response, cacheName: string): Response {
  const headers = new Headers(cached.headers);
  headers.set(CACHE_HIT_HEADER, cacheName);
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

/** iOS hang guard for Cache API / network races. */
const ASSET_TIMEOUT = 3000;

const MB = 1024 * 1024;
const DEFAULT_PART_SIZE = 0.5 * MB;
const MAX_END_TO_CACHE = 5 * MB - 1;
const DOWNLOAD_PART_SIZE = 1024 * 1024;
const TEST_PART_SIZE = 64 * 1024;
const DOWNLOAD_QUEUE_SIZE = 8;

export type FetchManagerOptions = {
  getTelegramRpc: () => WorkerClient<TelegramWorkerApi, TelegramWorkerEvents> | undefined;
};

class FilePartQueue<T> {
  queue: Promise<T>[] = [];

  push(task: Promise<T>) {
    this.queue.push(task);
  }

  async pop(): Promise<T> {
    return this.queue.shift()!;
  }

  get size() {
    return this.queue.length;
  }
}

/**
 * Owns SW fetch routing: assets, progressive/download media (via Telegram
 * SharedWorker `file.getPart`), full-blob `/media` (via `file.downloadFiles`),
 * `/avatar/` (via `file.downloadPeerPhotos`), and share dispatch.
 */
export class FetchManager {
  private readonly getTelegramRpc: FetchManagerOptions['getTelegramRpc'];
  private readonly assetCacheManager = new CacheManager({ cleanupInterval: 0 });
  private readonly progressiveCacheManager = new CacheManager();
  private readonly mediaCacheManager = new CacheManager();

  constructor(options: FetchManagerOptions) {
    this.getTelegramRpc = options.getTelegramRpc;
  }

  init(): void {
    self.addEventListener('fetch', (e) => this.handleFetch(e));
  }

  clearAssetCache(): Promise<boolean | undefined> {
    return this.assetCacheManager.clear(ASSET_CACHE_NAME);
  }

  private handleFetch(e: FetchEvent): void {
    const { url } = e.request;
    const { scope } = self.registration;
    if (!url.startsWith(scope)) {
      return;
    }

    const { pathname, protocol } = new URL(url);
    const { pathname: scopePathname } = new URL(scope);
    const scopePrefix = scopePathname.endsWith('/') ? scopePathname : `${scopePathname}/`;

    if (pathname.startsWith(`${scopePrefix}progressive/`)) {
      e.respondWith(this.respondForProgressive(e));
      return;
    }

    if (pathname.startsWith(`${scopePrefix}media/`)) {
      e.respondWith(this.respondForCachedMedia(e, MEDIA_CACHE_NAME));
      return;
    }

    if (pathname.startsWith(`${scopePrefix}avatar/`)) {
      e.respondWith(this.respondForCachedAvatar(e));
      return;
    }

    if (pathname.startsWith(`${scopePrefix}download/`)) {
      e.respondWith(this.respondForDownload(e));
      return;
    }

    if (pathname.startsWith(`${scopePrefix}share/`)) {
      e.respondWith(respondForShare(e));
    }

    if (protocol === 'http:' || protocol === 'https:') {
      if (pathname === scopePathname || pathname.match(RE_NETWORK_FIRST_ASSETS)) {
        e.respondWith(this.respondWithCacheNetworkFirst(e));
        return;
      }

      if (pathname.match(RE_CACHE_FIRST_ASSETS)) {
        e.respondWith(this.respondWithCache(e));
      }
    }
  }

  // --- Telegram-backed part fetch ------------------------------------------------

  private async requestPart(params: {
    url: string;
    start: number;
    end: number;
  }): Promise<FileGetPartResult | undefined> {
    const rpc = this.getTelegramRpc();
    if (!rpc) {
      console.error('[SW] requestPart: Telegram RPC is not connected (sw-telegram bridge missing)');
      return undefined;
    }

    const parsed = new URL(params.url);
    const fileId = parsed.searchParams.get('fileId');
    const accessHash = parsed.searchParams.get('accessHash');
    const dcIdParam = parsed.searchParams.get('dcId');
    if (!fileId || !accessHash || !dcIdParam) {
      console.error('[SW] requestPart: Missing required params (fileId, accessHash, or dcId)', {
        fileId,
        accessHash,
        dcIdParam,
        url: params.url,
      });
      return undefined;
    }

    const dcId = Number(dcIdParam);
    if (!Number.isFinite(dcId)) {
      console.error('[SW] requestPart: Invalid dcId', dcIdParam);
      return undefined;
    }

    const mimeType = parsed.searchParams.get('mimeType') ?? undefined;
    const fileSizeParam = parsed.searchParams.get('fileSize');
    const fullSize = fileSizeParam ? Number(fileSizeParam) : undefined;
    const thumbSize = parsed.searchParams.get('thumbSize') ?? undefined;
    const peerId = parsed.searchParams.get('peerId') ?? undefined;
    const messageIdParam = parsed.searchParams.get('messageId');
    const messageId = messageIdParam ? Number(messageIdParam) : undefined;

    if (DEBUG) {
      console.log('[SW] requestPart: calling file.getPart via Telegram SharedWorker RPC', {
        fileId,
        start: params.start,
        end: params.end,
        dcId,
        mimeType,
        fullSize,
      });
    }

    try {
      const res = await rpc.call('file.getPart', [
        {
          fileId,
          start: params.start,
          end: params.end,
          accessHash,
          dcId,
          mimeType,
          fullSize: fullSize && Number.isFinite(fullSize) ? fullSize : undefined,
          thumbSize: thumbSize ?? undefined,
          peerId,
          messageId: messageId && Number.isFinite(messageId) ? messageId : undefined,
        },
      ]);
      if (DEBUG) {
        console.log('[SW] requestPart: file.getPart succeeded', {
          fileId,
          bytesReceived: res?.arrayBuffer?.byteLength,
          fullSize: res?.fullSize,
          mimeType: res?.mimeType,
        });
      }
      return res;
    } catch (err) {
      console.error('[SW] requestPart: file.getPart failed:', err, {
        fileId,
        start: params.start,
        end: params.end,
        dcId,
      });
      return undefined;
    }
  }

  // --- Cached full media / avatars -----------------------------------------------

  private parseDownloadItem(url: string): FileDownloadItem | undefined {
    const parsed = new URL(url);
    const fileId = parsed.searchParams.get('fileId');
    const accessHash = parsed.searchParams.get('accessHash');
    const dcIdParam = parsed.searchParams.get('dcId');
    if (!fileId || !accessHash || !dcIdParam) {
      return undefined;
    }

    const dcId = Number(dcIdParam);
    if (!Number.isFinite(dcId)) {
      return undefined;
    }

    const mimeType = parsed.searchParams.get('mimeType') ?? undefined;
    const fileSizeParam = parsed.searchParams.get('fileSize');
    const fullSize = fileSizeParam ? Number(fileSizeParam) : undefined;
    const thumbSize = parsed.searchParams.get('thumbSize') ?? undefined;
    const peerId = parsed.searchParams.get('peerId') ?? undefined;
    const messageIdParam = parsed.searchParams.get('messageId');
    const messageId = messageIdParam ? Number(messageIdParam) : undefined;

    return {
      fileId,
      accessHash,
      dcId,
      mimeType,
      fullSize: fullSize && Number.isFinite(fullSize) ? fullSize : undefined,
      thumbSize: thumbSize ?? undefined,
      peerId,
      messageId: messageId && Number.isFinite(messageId) ? messageId : undefined,
    };
  }

  private async requestDownloadFiles(
    items: FileDownloadItem[],
  ): Promise<FileDownloadResult[] | undefined> {
    const rpc = this.getTelegramRpc();
    if (!rpc) {
      return undefined;
    }

    try {
      return await rpc.call('file.downloadFiles', [items]);
    } catch (err) {
      if (DEBUG) {
        console.error('FETCH file.downloadFiles', err);
      }
      return undefined;
    }
  }

  private async requestDownloadPeerPhotos(
    items: FilePeerPhotoItem[],
  ): Promise<FileDownloadResult[] | undefined> {
    const rpc = this.getTelegramRpc();
    if (!rpc) {
      return undefined;
    }

    try {
      return await rpc.call('file.downloadPeerPhotos', [items]);
    } catch (err) {
      if (DEBUG) {
        console.error('FETCH file.downloadPeerPhotos', err);
      }
      return undefined;
    }
  }

  private async respondWithDownloadedBlob(
    e: FetchEvent,
    cacheName: string,
    downloaded: FileDownloadResult,
  ): Promise<Response> {
    const { arrayBuffer, mimeType } = downloaded;
    const response = new Response(arrayBuffer, {
      status: 200,
      statusText: 'OK',
      headers: [
        ['Content-Type', mimeType],
        ['Content-Length', String(arrayBuffer.byteLength)],
      ],
    });

    if (arrayBuffer.byteLength <= MEDIA_CACHE_MAX_BYTES) {
      // `<video>` sticker requests include Range. Cache.put throws on that header,
      // so the write never landed and every replay downloaded again.
      const write = this.mediaCacheManager.put(
        cacheName,
        cacheableMediaRequest(e.request),
        response.clone(),
      );
      e.waitUntil(write);
    }

    return response;
  }

  private async respondForCachedMedia(e: FetchEvent, cacheName: string): Promise<Response> {
    const cached = await this.mediaCacheManager.match(cacheName, cacheableMediaRequest(e.request));
    if (cached) {
      return withCacheHitHeader(cached, cacheName);
    }

    const item = this.parseDownloadItem(e.request.url);
    if (!item) {
      return new Response('', {
        status: 400,
        statusText: 'Missing media location params',
      });
    }

    const results = await this.requestDownloadFiles([item]);
    const downloaded = results?.[0];
    if (!downloaded) {
      return new Response('', {
        status: 500,
        statusText: 'Failed to download media',
      });
    }

    return this.respondWithDownloadedBlob(e, cacheName, downloaded);
  }

  private async respondForCachedAvatar(e: FetchEvent): Promise<Response> {
    const cached = await this.mediaCacheManager.match(MEDIA_CACHE_NAME_AVATARS, e.request);
    if (cached) {
      return withCacheHitHeader(cached, MEDIA_CACHE_NAME_AVATARS);
    }

    const item = parsePeerAvatarUrl(e.request.url);
    if (!item) {
      return new Response('', {
        status: 400,
        statusText: 'Missing media location params',
      });
    }

    const results = await this.requestDownloadPeerPhotos([item]);
    const downloaded = results?.[0];
    if (!downloaded) {
      return new Response('', {
        status: 500,
        statusText: 'Failed to download media',
      });
    }

    return this.respondWithDownloadedBlob(e, MEDIA_CACHE_NAME_AVATARS, downloaded);
  }

  // --- Progressive media ---------------------------------------------------------

  private async respondForProgressive(e: FetchEvent): Promise<Response> {
    const { url } = e.request;
    const accountSlot = undefined;
    const range = e.request.headers.get('range');

    let start = 0;
    let originalEnd: number | undefined;
    if (range) {
      const match = /^bytes=(\d+)-(\d+)?$/.exec(range);
      if (match) {
        start = Number(match[1]);
        if (match[2]) {
          originalEnd = Number(match[2]);
        }
      }
    }

    let end = originalEnd;
    if (!end || end - start + 1 > DEFAULT_PART_SIZE) {
      end = start + DEFAULT_PART_SIZE - 1;
    }

    const parsedUrl = new URL(url);

    // Clamp end to fileSize - 1 so we never request bytes past EOF.
    // Mirrors telegram-genie downloadFile.ts: `end = end && end < fileSize ? end : fileSize - 1`
    const fileSizeStr = parsedUrl.searchParams.get('fileSize');
    const fileSize = fileSizeStr ? Number(fileSizeStr) : undefined;
    if (fileSize && Number.isFinite(fileSize) && fileSize > 0) {
      end = Math.min(end, fileSize - 1);
    }

    if (DEBUG) {
      console.log(
        `[SW] respondForProgressive: start=${start}, end=${end}, originalEnd=${originalEnd}, range="${range}"`,
        url,
      );
    }

    // Optimization for Safari
    if (start === 0 && end === 1) {
      const fileSizeParam = parsedUrl.searchParams.get('fileSize');
      const fileSize = fileSizeParam && Number(fileSizeParam);
      const mimeType = parsedUrl.searchParams.get('mimeType');

      if (fileSize && mimeType) {
        if (DEBUG) {
          console.log(`[SW] respondForProgressive Safari probe (0-1), returning 206 for ${url}`);
        }
        return new Response(new Uint8Array(2).buffer, {
          status: 206,
          statusText: 'Partial Content',
          headers: [
            ['Content-Range', `bytes 0-1/${fileSize}`],
            ['Accept-Ranges', 'bytes'],
            ['Content-Length', '2'],
            ['Content-Type', mimeType],
          ],
        });
      }
    }

    parsedUrl.searchParams.set('start', String(start));
    parsedUrl.searchParams.set('end', String(end));
    const cacheKey = parsedUrl.href;
    const cachedResponse = !MEDIA_PROGRESSIVE_CACHE_DISABLED
      ? await this.fetchProgressiveFromCache(accountSlot, cacheKey)
      : undefined;

    if (DEBUG) {
      console.log(
        `[SW] FETCH PROGRESSIVE ${cacheKey} (request: ${start}-${originalEnd}) CACHED: ${Boolean(cachedResponse)}`,
      );
    }

    if (cachedResponse) {
      const cachedBuffer = await cachedResponse.arrayBuffer();
      // If client requested a specific sub-range that ends before cached chunk
      const requestedEnd = originalEnd != null ? Math.min(originalEnd, end) : end;
      const requestedLength = requestedEnd - start + 1;
      const servesSlice = requestedLength < cachedBuffer.byteLength;
      const body = servesSlice ? cachedBuffer.slice(0, requestedLength) : cachedBuffer;

      const responseHeaders = new Headers(cachedResponse.headers);
      responseHeaders.set(CACHE_HIT_HEADER, MEDIA_PROGRESSIVE_CACHE_NAME);
      if (servesSlice) {
        const fullSize = responseHeaders.get('Content-Range')?.split('/')?.[1] ?? '*';
        responseHeaders.set('Content-Range', `bytes ${start}-${requestedEnd}/${fullSize}`);
        responseHeaders.set('Content-Length', String(body.byteLength));
      }

      return new Response(body, {
        status: 206,
        statusText: 'Partial Content',
        headers: responseHeaders,
      });
    }

    let partInfo: FileGetPartResult | undefined;
    try {
      partInfo = await this.requestPart({ url, start, end });
    } catch (err) {
      console.error('[SW] FETCH PROGRESSIVE requestPart error:', err);
    }

    if (!partInfo) {
      console.error('[SW] Failed to fetch progressive part, returning 500 for:', url);
      return new Response('', {
        status: 500,
        statusText: 'Failed to fetch progressive part',
      });
    }

    const { arrayBuffer, fullSize, mimeType } = partInfo;

    const partSize = Math.min(end - start + 1, arrayBuffer.byteLength);
    end = start + partSize - 1;
    const arrayBufferPart = arrayBuffer.slice(0, partSize);
    const headers: [string, string][] = [
      ['Content-Range', `bytes ${start}-${end}/${fullSize}`],
      ['Accept-Ranges', 'bytes'],
      ['Content-Length', String(partSize)],
      ['Content-Type', mimeType],
    ];

    if (
      !MEDIA_PROGRESSIVE_CACHE_DISABLED &&
      partSize <= MEDIA_CACHE_MAX_BYTES &&
      end < MAX_END_TO_CACHE
    ) {
      parsedUrl.searchParams.set('end', String(end));
      const actualCacheKey = parsedUrl.href;
      void this.saveProgressiveToCache(accountSlot, actualCacheKey, arrayBufferPart, headers);
    }

    return new Response(arrayBufferPart, {
      status: 206,
      statusText: 'Partial Content',
      headers,
    });
  }

  // Cache API forbids status 206 responses, but allows status 200 with custom headers.
  private async fetchProgressiveFromCache(
    accountSlot: number | undefined,
    cacheKey: string,
  ): Promise<Response | undefined> {
    const options = accountSlot != null ? { accountSlot: String(accountSlot) } : undefined;

    try {
      const cached = await this.progressiveCacheManager.match(
        MEDIA_PROGRESSIVE_CACHE_NAME,
        new Request(cacheKey),
        options,
      );
      if (cached) {
        return cached;
      }
    } catch (err) {
      console.warn('[SW] fetchProgressiveFromCache error:', err);
    }
    return undefined;
  }

  private async saveProgressiveToCache(
    accountSlot: number | undefined,
    cacheKey: string,
    arrayBuffer: ArrayBuffer,
    headers: [string, string][],
  ) {
    const options = accountSlot != null ? { accountSlot: String(accountSlot) } : undefined;

    // Save as status 200 with headers attached directly (Cache API allows 200, rejects 206)
    const response200 = new Response(arrayBuffer, {
      status: 200,
      statusText: 'OK',
      headers,
    });

    return this.progressiveCacheManager.put(
      MEDIA_PROGRESSIVE_CACHE_NAME,
      new Request(cacheKey),
      response200,
      options,
    );
  }

  // --- Full-file download stream -------------------------------------------------

  private async respondForDownload(e: FetchEvent): Promise<Response> {
    const { url } = e.request;

    let partInfo: FileGetPartResult | undefined;
    try {
      partInfo = await this.requestPart({ url, start: 0, end: TEST_PART_SIZE });
    } catch (err) {
      if (DEBUG) {
        console.error('FETCH DOWNLOAD', err);
      }
    }

    if (!partInfo) {
      return new Response('', {
        status: 500,
        statusText: 'Failed to fetch file to download',
      });
    }

    const matchedFilename = e.request.url.match(/filename=(.*)/);
    const filenameHeader = matchedFilename
      ? `filename="${decodeURIComponent(matchedFilename[1])}"`
      : '';
    const { fullSize, mimeType } = partInfo;

    const headers: [string, string][] = [
      ['Content-Length', String(fullSize)],
      ['Content-Type', mimeType],
      ['Content-Disposition', `attachment; ${filenameHeader}`],
    ];

    const queue = new FilePartQueue<ArrayBuffer | undefined>();
    const enqueue = (offset: number) => {
      queue.push(
        this.requestPart({
          url,
          start: offset,
          end: offset + DOWNLOAD_PART_SIZE - 1,
        }).then((part) => part?.arrayBuffer),
      );
      return offset + DOWNLOAD_PART_SIZE;
    };
    let lastOffset = 0;
    const stream = new ReadableStream({
      start() {
        for (let i = 0; i < DOWNLOAD_QUEUE_SIZE; i++) {
          if (lastOffset >= fullSize) break;
          lastOffset = enqueue(lastOffset);
        }
      },

      async pull(controller) {
        const buffer = await queue.pop();
        if (!buffer) {
          controller.close();
          return;
        }
        controller.enqueue(new Uint8Array(buffer));

        if (buffer.byteLength < DOWNLOAD_PART_SIZE) {
          controller.close();
          return;
        }

        if (lastOffset < fullSize) {
          lastOffset = enqueue(lastOffset);
        }
      },
    });

    return new Response(stream, {
      status: 200,
      statusText: 'OK',
      headers,
    });
  }

  // --- Asset cache strategies ----------------------------------------------------

  private async respondWithCacheNetworkFirst(e: FetchEvent): Promise<Response> {
    const remote = await this.withTimeout(() => fetch(e.request), ASSET_TIMEOUT);
    if (!remote?.ok) {
      return this.respondWithCache(e);
    }

    const toCache = remote.clone();
    void this.assetCacheManager.put(ASSET_CACHE_NAME, e.request, toCache);

    return remote;
  }

  private async respondWithCache(e: FetchEvent): Promise<Response> {
    const cacheResult = await this.withTimeout(async () => {
      const cached = await this.assetCacheManager.match(ASSET_CACHE_NAME, e.request);
      return { cached, ready: true as const };
    }, ASSET_TIMEOUT);

    const cached = cacheResult?.cached;

    if (cached) {
      if (cached.ok) {
        return withCacheHitHeader(cached, ASSET_CACHE_NAME);
      }

      await this.assetCacheManager.delete(ASSET_CACHE_NAME, e.request);
    }

    const remote = await fetch(e.request);

    // Only write when the cache API responded within the timeout (iOS hang guard).
    if (remote.ok && cacheResult?.ready) {
      void this.assetCacheManager.put(ASSET_CACHE_NAME, e.request, remote.clone());
    }

    return remote;
  }

  private async withTimeout<T>(cb: () => Promise<T>, timeout: number) {
    let isResolved = false;

    try {
      return await Promise.race([
        sleep(timeout).then(() => (isResolved ? undefined : Promise.reject(new Error('TIMEOUT')))),
        cb(),
      ]);
    } catch (err) {
      console.error(err);
      return undefined;
    } finally {
      isResolved = true;
    }
  }
}
