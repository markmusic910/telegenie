import { Log, Recover } from '@telegenie/decorators';
import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { base64ToFileRef } from '../file-ref/bytes';
import { decodeFileId } from '../file-ref/file-id';
import type { LocalDb } from '../local-db/local-db';
import { toApiInputPeer } from '../local-db/to-api-input-peer';
import { FileRefEngine, parseFileRefError } from '../file-ref/engine';
import type {
  FileDownloadItem,
  FileDownloadResult,
  FileGetPartParams,
  FileGetPartResult,
  FilePeerPhotoItem,
} from '../worker/telegram.api';
import type { TransportService } from './transport.service';

type UploadProgress = ((progress: number) => void) & { isCanceled?: boolean };

type DownloadProgress = ((
  downloaded: bigint | { toJSNumber?: () => number },
  fullSize: bigint | { toJSNumber?: () => number },
  ...args: unknown[]
) => void) & { isCanceled?: boolean; acceptsBuffer?: boolean };

export type FileUploadParams = {
  file: File;
  onProgress?: UploadProgress;
};

/** In-worker download request; wire RPC uses {@link FileDownloadItem} without callbacks. */
export type FileDownloadRequest = FileDownloadItem & {
  progressCallback?: DownloadProgress;
  signal?: AbortSignal;
  requestTimeout?: number;
};

type FileServiceOptions = {
  debug?: boolean;
  transportService: TransportService;
  localDb: LocalDb;
  fileRefEngine?: FileRefEngine;
};

function toArrayBuffer(data: Buffer | string): ArrayBuffer {
  const buf = typeof data === 'string' ? Buffer.from(data) : data;
  const copy = new Uint8Array(buf.byteLength);
  copy.set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  return copy.buffer;
}

/** Returns the largest power-of-2 that divides `n` (i.e. the lowest set bit). */
function lowestBit(n: number): number {
  if (n <= 0) return 4096;
  if (n < 0x40000000) {
    return n & (-n);
  }
  for (let size = 512 * 1024; size >= 4096; size /= 2) {
    if (n % size === 0) return size;
  }
  return 4096;
}

/**
 * Wraps teleproto high-level upload/download APIs (MediaScheduler-backed).
 * Batch entrypoints run items concurrently; teleproto owns session parallelism.
 */
export class FileService {
  private debug: boolean;
  transportService: TransportService;
  localDb: LocalDb;
  fileRefEngine?: FileRefEngine;

  constructor({ debug, transportService, localDb, fileRefEngine }: FileServiceOptions) {
    this.transportService = transportService;
    this.localDb = localDb;
    this.debug = debug ?? false;
    this.fileRefEngine = fileRefEngine;
  }

  get client() {
    return this.transportService?.client ?? null;
  }

  uploadFiles = async (
    items: FileUploadParams[],
  ): Promise<(Api.InputFile | Api.InputFileBig)[]> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const client = this.client;
    return Promise.all(
      items.map(({ file, onProgress }) =>
        client.uploadFile({
          file,
          onProgress,
        }),
      ),
    );
  };

  /**
   * Full-file download by location params (SW `/media` and in-worker batches).
   * Resolves `file_reference` from LocalDb; uses `client.downloadFile`.
   * Automatically refreshes expired file reference tokens via FileRefEngine.
   */
  downloadFiles = async (items: FileDownloadRequest[]): Promise<FileDownloadResult[]> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const client = this.client;
    return Promise.all(
      items.map(async (item) => {
        let location = await this.resolveFileLocation(item);
        let retries = 0;
        const maxRetries = 2;

        while (true) {
          try {
            const data = await client.downloadFile(location, {
              dcId: item.dcId,
              fileSize: item.fullSize != null ? bigInt(item.fullSize) : undefined,
              progressCallback: item.progressCallback as never,
              signal: item.signal,
              requestTimeout: item.requestTimeout,
            });
            if (data == null) {
              throw new Error(`Failed to download file ${item.fileId}`);
            }
            const arrayBuffer = toArrayBuffer(data);
            return {
              arrayBuffer,
              mimeType: item.mimeType ?? 'application/octet-stream',
              fullSize: item.fullSize ?? arrayBuffer.byteLength,
            };
          } catch (err) {
            const isFileRefErr = parseFileRefError(err);
            if (isFileRefErr && retries < maxRetries && this.fileRefEngine) {
              retries++;
              console.warn(
                `[FileService.downloadFiles] File reference expired for ${item.fileId}, refreshing (attempt ${retries}/${maxRetries})...`,
              );
              const refreshed = await this.fileRefEngine.refreshFileId(item.fileId, {
                peerId: item.peerId,
                messageId: item.messageId,
              });
              if (refreshed) {
                location = await this.resolveFileLocation(item);
                continue;
              }
            }
            throw err;
          }
        }
      }),
    );
  };

  /**
   * Profile-photo download for SW `/avatar/` (InputPeerPhotoFileLocation).
   * Resolves the owner peer from LocalDb; no photo `file_reference`.
   */
  downloadPeerPhotos = async (items: FilePeerPhotoItem[]): Promise<FileDownloadResult[]> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const client = this.client;
    return Promise.all(
      items.map(async (item) => {
        const resolved = await this.localDb.resolveInputPeer(item.peerId);
        const peer = toApiInputPeer(resolved);
        if (!peer) {
          throw new Error(`Failed to resolve peer ${item.peerId}`);
        }
        const location = new Api.InputPeerPhotoFileLocation({
          peer,
          photoId: bigInt(item.photoId),
          big: item.isBig || undefined,
        });
        const data = await client.downloadFile(location, {
          dcId: item.dcId,
        });
        if (data == null) {
          throw new Error(`Failed to download peer photo ${item.peerId}/${item.photoId}`);
        }
        const arrayBuffer = toArrayBuffer(data);
        return {
          arrayBuffer,
          mimeType: item.mimeType ?? 'image/jpeg',
          fullSize: arrayBuffer.byteLength,
        };
      }),
    );
  };

  /**
   * TODO: verify if it's single threaded or not.
   * Download a closed byte range for progressive/download SW fetches.
   * Resolves `file_reference` from LocalDb via `fileId`; builds Input*FileLocation from params.
   */
  @Log()
  @Recover()
  async getPart(params: FileGetPartParams): Promise<FileGetPartResult> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    let location = await this.resolveFileLocation(params);

    const byteCount = Math.max(0, params.end - params.start + 1);
    const alignedStart = Math.floor(params.start / 4096) * 4096;
    const skipLeading = params.start - alignedStart;
    const totalToFetch = skipLeading + byteCount;

    // Telegram upload.GetFile requires `offset % limit === 0`. iterDownload passes
    // `requestSize` directly as `limit`. We must pick a power-of-2 request size that
    // the offset is aligned to. telegram-genie solves this via getDownloadPartSize()
    // which returns power-of-2 KB values (64,128,256,512,1024) that naturally align
    // with typical offsets. We use `offset & -offset` to find the largest power-of-2
    // dividing the offset, then cap between 4KB and 512KB.
    const MAX_REQUEST = 512 * 1024;
    const MIN_REQUEST = 4096;
    const requestSize = alignedStart === 0
      ? MAX_REQUEST
      : Math.min(MAX_REQUEST, Math.max(MIN_REQUEST, lowestBit(alignedStart)));

    const effectiveDcId = params.dcId || (this.client as any).session?.dcId || 2;

    let retries = 0;
    const maxRetries = 2;

    while (true) {
      try {
        const chunks: Buffer[] = [];
        let downloaded = 0;
        for await (const chunk of this.client.iterDownload(location, {
          offset: alignedStart,
          limit: totalToFetch,
          dcId: effectiveDcId,
          requestSize: requestSize,
        })) {
          chunks.push(Buffer.from(chunk));
          downloaded += chunk.length;
          if (downloaded >= totalToFetch) break;
        }

        const combined = Buffer.concat(chunks);
        const sliced = combined.subarray(skipLeading, skipLeading + byteCount);
        const arrayBuffer = sliced.buffer.slice(
          sliced.byteOffset,
          sliced.byteOffset + sliced.byteLength,
        );

        return {
          arrayBuffer,
          mimeType: params.mimeType ?? 'application/octet-stream',
          fullSize: params.fullSize ?? downloaded,
        };
      } catch (err) {
        const isFileRefErr = parseFileRefError(err);
        if (isFileRefErr && retries < maxRetries && this.fileRefEngine) {
          retries++;
          console.warn(
            `[FileService.getPart] File reference expired for ${params.fileId}, refreshing (attempt ${retries}/${maxRetries})...`,
          );
          const refreshed = await this.fileRefEngine.refreshFileId(params.fileId, {
            peerId: params.peerId,
            messageId: params.messageId,
          });
          if (refreshed) {
            location = await this.resolveFileLocation(params);
            continue;
          }
        }
        throw err;
      }
    }
  }

  private async resolveFileLocation(params: {
    fileId: string;
    accessHash: string;
    thumbSize?: string;
  }): Promise<Api.InputDocumentFileLocation | Api.InputPhotoFileLocation> {
    const decoded = decodeFileId(params.fileId);
    if (!decoded) {
      console.error(`[FileService.resolveFileLocation] Invalid fileId: ${params.fileId}`);
      throw new Error(`Invalid fileId: ${params.fileId}`);
    }

    const row = await this.localDb.getFileRef(params.fileId);
    if (!row) {
      console.warn(`[FileService.resolveFileLocation] No fileRef in localDb for "${params.fileId}", using empty fileReference`);
    } else {
      console.log(`[FileService.resolveFileLocation] Found fileRef in localDb for "${params.fileId}"`);
    }
    const fileReference = row?.fileReference ? base64ToFileRef(row.fileReference) : Buffer.alloc(0);

    if (decoded.kind === 'document') {
      return new Api.InputDocumentFileLocation({
        id: bigInt(decoded.id),
        accessHash: bigInt(params.accessHash),
        fileReference,
        thumbSize: params.thumbSize ?? '',
      });
    }

    return new Api.InputPhotoFileLocation({
      id: bigInt(decoded.id),
      accessHash: bigInt(params.accessHash),
      fileReference,
      thumbSize: params.thumbSize ?? 'y',
    });
  }
}
