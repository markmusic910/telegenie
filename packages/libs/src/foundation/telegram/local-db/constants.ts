/** IndexedDB name prefix; full name is `${DB_NAME_PREFIX}${accountSlot}`. */
export const DB_NAME_PREFIX = 'telegenie-foundation_';

/** Schema version for fixed object stores. */
export const LOCAL_DB_VERSION = 1;

/** userFull / channelFull lazy TTL (ms). */
export const FULL_INFO_TTL_MS = 60_000;

export const STORE = {
  users: 'users',
  chats: 'chats',
  channels: 'channels',
  userFull: 'userFull',
  chatFull: 'chatFull',
  channelFull: 'channelFull',
  minContexts: 'minContexts',
  meta: 'meta',
  channelStates: 'channelStates',
  msgIdRanges: 'msgIdRanges',
  randomIds: 'randomIds',
  fileRefs: 'fileRefs',
  fileSources: 'fileSources',
  encryptedChats: 'encryptedChats',
  encryptedChatKeys: 'encryptedChatKeys',
} as const;

export const META_KEY_COMMON_STATE = 'commonState';

/** Message-id range box for private chats + basic groups. */
export const MSG_ID_BOX_COMMON = 'common';
