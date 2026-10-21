import { yieldToMain } from '@telegenie/libs/utils/scheduler';
import {
  CLEARABLE_CACHE_NAMES,
  DEFAULT_ACCESS_THROTTLE,
  DEFAULT_CACHE_TTL,
  DEFAULT_CLEANUP_INTERVAL,
  LANG_CACHE_NAME,
  LAST_ACCESS_HEADER,
} from './constants';
import {
  CacheDataType,
  type CacheCleanupOptions,
  type CacheClearOptions,
  type CacheFetchOptions,
  type CacheManagerOptions,
  type CacheRemoveOptions,
  type CacheSaveOptions,
} from './types';

/**
 * Manages the browser Cache API.
 *
 * Primary surface is Request-keyed {@link match} / {@link put} / {@link delete}.
 * String-key {@link save} / {@link fetch} / {@link remove} are deprecated wrappers.
 * TTL eviction runs via {@link cleanup} using the `X-Last-Access` header.
 */
export class CacheManager {
  private cacheApi = typeof self !== 'undefined' ? self.caches : undefined;
  private isSupportedCached: boolean | undefined;
  private cleanupIntervalId: any;

  private clearableCacheNames: string[];
  private cacheTtl: number;
  /** Min interval between X-Last-Access rewrites on cache hits (avoids put-per-read). */
  private accessThrottle: number;
  private cleanupInterval: number;
  private cacheKeyBase: string;

  constructor(options: CacheManagerOptions = {}) {
    this.clearableCacheNames = options.clearableCacheNames ?? CLEARABLE_CACHE_NAMES;
    this.cacheTtl = options.cacheTtl ?? DEFAULT_CACHE_TTL;
    this.accessThrottle = options.accessThrottle ?? DEFAULT_ACCESS_THROTTLE;
    this.cleanupInterval = options.cleanupInterval ?? DEFAULT_CLEANUP_INTERVAL;

    // Default Cache Key Base (string-key wrappers only)
    let defaultBase = 'http://localhost/';
    if (typeof self !== 'undefined' && self.location && self.location.origin) {
      defaultBase = `${self.location.origin}/`;
    }
    this.cacheKeyBase = options.cacheKeyBase ?? defaultBase;

    // Start cleanup scheduler if supported and interval is non-zero
    if (this.cacheApi && this.cleanupInterval > 0) {
      // Run initial cleanup lazily after instantiation
      setTimeout(() => {
        this.cleanup(this.clearableCacheNames).catch((err) => {
          console.warn('CacheManager initial cleanup failed:', err);
        });
      }, 1000);

      this.cleanupIntervalId = setInterval(() => {
        this.cleanup(this.clearableCacheNames).catch((err) => {
          console.warn('CacheManager scheduled cleanup failed:', err);
        });
      }, this.cleanupInterval);
    }
  }

  public destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }
  }

  public async isCacheApiSupported(): Promise<boolean> {
    if (!this.cacheApi) return false;

    if (this.isSupportedCached === undefined) {
      try {
        this.isSupportedCached = await this.cacheApi
          .has('test')
          .then(() => true)
          .catch(() => false);
      } catch {
        this.isSupportedCached = false;
      }
    }
    return this.isSupportedCached;
  }

  private getCacheName(cacheName: string, accountSlot?: string): string {
    if (cacheName === LANG_CACHE_NAME) return cacheName;

    const suffix = accountSlot ? `_${accountSlot}` : '';
    return `${cacheName}${suffix}`;
  }

  /** @deprecated String-key helpers only — prefer a real Request. */
  private buildCacheRequest(key: string): Request {
    // Replace colons to avoid "Request scheme 'webdocument' is unsupported"
    const normalizedKey = key.replace(/:/g, '_');
    return new Request(new URL(normalizedKey, this.cacheKeyBase));
  }

  private toRequest(request: RequestInfo): Request {
    return request instanceof Request ? request : new Request(request);
  }

  private withLastAccess(response: Response): Response {
    const headers = new Headers(response.headers);
    headers.set(LAST_ACCESS_HEADER, Date.now().toString());
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  private async updateAccessTime(
    cache: Cache,
    request: Request,
    response: Response,
  ): Promise<void> {
    try {
      await cache.put(request, this.withLastAccess(response.clone()));
    } catch (err) {
      console.warn('Failed to update cache access time:', err);
    }
  }

  private maybeRefreshAccessTime(cache: Cache, request: RequestInfo, response: Response): void {
    const lastAccess = Number(response.headers.get(LAST_ACCESS_HEADER));
    const now = Date.now();
    if (!lastAccess || now - lastAccess > this.accessThrottle) {
      this.updateAccessTime(cache, this.toRequest(request), response).catch((err) => {
        console.warn('Non-blocking access time update failed:', err);
      });
    }
  }

  /**
   * Primary read: Cache API match by Request.
   * Refreshes `X-Last-Access` (throttled) so TTL cleanup keeps hot entries.
   */
  public async match(
    cacheName: string,
    request: RequestInfo,
    options?: CacheFetchOptions,
  ): Promise<Response | undefined> {
    if (!this.cacheApi) {
      return undefined;
    }

    try {
      const { accountSlot } = options || {};
      const cache = await this.cacheApi.open(this.getCacheName(cacheName, accountSlot));
      const response = await cache.match(request);
      if (!response) {
        return undefined;
      }

      this.maybeRefreshAccessTime(cache, request, response);
      return response;
    } catch (err) {
      console.warn(`CacheManager match failed in cache "${cacheName}":`, err);
      return undefined;
    }
  }

  /**
   * Primary write: Cache API put by Request.
   * Stamps `X-Last-Access` for TTL eviction. Callers that still need the body
   * should pass `response.clone()`.
   */
  public async put(
    cacheName: string,
    request: RequestInfo,
    response: Response,
    options?: CacheSaveOptions,
  ): Promise<boolean> {
    if (!this.cacheApi) {
      return false;
    }

    try {
      const { accountSlot } = options || {};
      const cache = await this.cacheApi.open(this.getCacheName(cacheName, accountSlot));
      await cache.put(request, this.withLastAccess(response));
      return true;
    } catch (err) {
      console.warn(`CacheManager put failed in cache "${cacheName}":`, err);
      return false;
    }
  }

  /**
   * Primary delete: Cache API delete by Request.
   */
  public async delete(
    cacheName: string,
    request: RequestInfo,
    options?: CacheRemoveOptions,
  ): Promise<boolean | undefined> {
    if (!this.cacheApi) {
      return undefined;
    }

    try {
      const { accountSlot } = options || {};
      const cache = await this.cacheApi.open(this.getCacheName(cacheName, accountSlot));
      return await cache.delete(request);
    } catch (err) {
      console.warn(`CacheManager delete failed in cache "${cacheName}":`, err);
      return undefined;
    }
  }

  /**
   * @deprecated Prefer {@link match} with a Request key.
   */
  public async fetch<T = any>(
    cacheName: string,
    key: string,
    type: CacheDataType,
    options?: CacheFetchOptions,
  ): Promise<T | undefined> {
    if (!this.cacheApi) {
      return undefined;
    }

    try {
      const { isHtmlAllowed = false } = options || {};
      const response = await this.match(cacheName, this.buildCacheRequest(key), options);
      if (!response) {
        return undefined;
      }

      const contentType = response.headers.get('Content-Type');

      switch (type) {
        case CacheDataType.Text:
          return (await response.text()) as unknown as T;
        case CacheDataType.Blob: {
          // Ignore deprecated data-uri avatars
          if (key.startsWith('avatar') && contentType && contentType.startsWith('text')) {
            return undefined;
          }

          const blob = await response.blob();
          const shouldRecreate = !blob.type || (!isHtmlAllowed && blob.type.includes('html'));
          let resolvedType = blob.type || contentType || '';

          if (!(shouldRecreate && resolvedType)) {
            return blob as unknown as T;
          }

          // Prevent HTML-in-video attacks
          if (!isHtmlAllowed) {
            resolvedType = resolvedType.replace(/html/gi, '');
          }

          return new Blob([blob], { type: resolvedType }) as unknown as T;
        }
        case CacheDataType.Json:
          return (await response.json()) as T;
        case CacheDataType.ArrayBuffer:
          return (await response.arrayBuffer()) as unknown as T;
        default:
          return undefined;
      }
    } catch (err) {
      console.warn(`CacheManager fetch failed for key "${key}" in cache "${cacheName}":`, err);
      return undefined;
    }
  }

  /**
   * @deprecated Prefer {@link put} with a Request key.
   */
  public async save(
    cacheName: string,
    key: string,
    data: string | Blob | ArrayBuffer | Record<string, any> | any[],
    options?: CacheSaveOptions,
  ): Promise<boolean> {
    if (!this.cacheApi) {
      return false;
    }

    try {
      const cacheData =
        typeof data === 'string' || data instanceof Blob || data instanceof ArrayBuffer
          ? data
          : JSON.stringify(data);

      const response = new Response(cacheData);

      // Ensure Content-Type header is preserved if we are saving a Blob
      if (data instanceof Blob && data.type) {
        response.headers.set('Content-Type', data.type);
      } else if (typeof data === 'object' && !(data instanceof ArrayBuffer)) {
        response.headers.set('Content-Type', 'application/json');
      }

      return await this.put(cacheName, this.buildCacheRequest(key), response, options);
    } catch (err) {
      console.warn(`CacheManager save failed for key "${key}" in cache "${cacheName}":`, err);
      return false;
    }
  }

  /**
   * @deprecated Prefer {@link delete} with a Request key.
   */
  public async remove(
    cacheName: string,
    key: string,
    options?: CacheRemoveOptions,
  ): Promise<boolean | undefined> {
    return this.delete(cacheName, this.buildCacheRequest(key), options);
  }

  public async clear(cacheName: string, options?: CacheClearOptions): Promise<boolean | undefined> {
    if (!this.cacheApi) {
      return undefined;
    }

    try {
      const { accountSlot } = options || {};
      return await this.cacheApi.delete(this.getCacheName(cacheName, accountSlot));
    } catch (err) {
      console.warn(`CacheManager clear failed for cache "${cacheName}":`, err);
      return undefined;
    }
  }

  public async cleanup(cacheNames: string[], options?: CacheCleanupOptions): Promise<void> {
    if (!this.cacheApi) return;

    try {
      const { accountSlot } = options || {};
      for (const cacheName of cacheNames) {
        const cache = await this.cacheApi.open(this.getCacheName(cacheName, accountSlot));
        const keys = await cache.keys();
        const now = Date.now();

        for (const request of keys) {
          await yieldToMain();
          const response = await cache.match(request);
          if (!response) continue;

          const lastAccess = Number(response.headers.get(LAST_ACCESS_HEADER));
          if (lastAccess && now - lastAccess > this.cacheTtl) {
            await cache.delete(request);
          }
        }
      }
    } catch (err) {
      console.warn('CacheManager cleanup failed:', err);
    }
  }

  public purgeClearableCache(options?: CacheClearOptions): void {
    const { accountSlot } = options || {};
    this.clearableCacheNames.forEach((cacheName) => {
      this.clear(cacheName, { accountSlot }).catch((err) => {
        console.warn(`Failed to clear cache "${cacheName}" during purge:`, err);
      });
    });
  }
}

// Export default instance
export const cacheManager = new CacheManager();
