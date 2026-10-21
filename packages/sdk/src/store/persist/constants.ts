import type { IdbStoreSchema } from '@telegenie/libs/foundation/idb';

export const SDK_CACHE_DB_PREFIX = 'telegenie-sdk-cache_';
export const SDK_CACHE_DB_VERSION = 1;

export const SDK_CACHE_STORE = {
  dialog: 'dialog',
  dialogFilter: 'dialogFilter',
  message: 'message',
  customEmoji: 'customEmoji',
  global: 'global',
} as const;

export const GLOBAL_CACHE_ROW_ID = 'global';

export const SDK_CACHE_STORES: IdbStoreSchema[] = [
  { name: SDK_CACHE_STORE.dialog, keyPath: 'id' },
  { name: SDK_CACHE_STORE.dialogFilter, keyPath: 'id' },
  { name: SDK_CACHE_STORE.customEmoji, keyPath: 'id' },
  {
    name: SDK_CACHE_STORE.message,
    keyPath: 'cacheKey',
    indexes: [{ name: 'peerId', keyPath: 'peerId' }],
  },
  { name: SDK_CACHE_STORE.global, keyPath: 'id' },
];

export function messageCacheKey(peerId: string, messageId: string): string {
  return `${peerId}:${messageId}`;
}

export function sdkCacheDbName(accountSlot: string): string {
  return `${SDK_CACHE_DB_PREFIX}${accountSlot}`;
}
