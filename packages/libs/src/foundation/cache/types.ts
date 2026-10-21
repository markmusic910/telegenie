export enum CacheDataType {
  Text = 0,
  Blob = 1,
  Json = 2,
  ArrayBuffer = 3,
}

// Alias for compatibility with reference code
export type Type = CacheDataType;
export const Type = CacheDataType;

export interface CacheManagerOptions {
  clearableCacheNames?: string[];
  cacheTtl?: number;
  accessThrottle?: number;
  cleanupInterval?: number;
  cacheKeyBase?: string;
}

export interface CacheFetchOptions {
  accountSlot?: string;
  isHtmlAllowed?: boolean;
}

export interface CacheSaveOptions {
  accountSlot?: string;
}

export interface CacheRemoveOptions {
  accountSlot?: string;
}

export interface CacheClearOptions {
  accountSlot?: string;
}

export interface CacheCleanupOptions {
  accountSlot?: string;
}
