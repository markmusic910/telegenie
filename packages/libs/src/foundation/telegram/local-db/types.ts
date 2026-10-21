import type { IdbStoreSchema } from '../../idb/types';
import type {
  Channel,
  ChannelForbidden,
  ChannelFull,
  Chat,
  ChatEmpty,
  ChatForbidden,
  ChatFull,
  TypeEncryptedChat,
} from '../types/api-types';
import type { User, UserEmpty, UserFull } from '../types/users';
import { META_KEY_COMMON_STATE, STORE } from './constants';

export type LocalDbEntityStore =
  | 'users'
  | 'chats'
  | 'channels'
  | 'userFull'
  | 'chatFull'
  | 'channelFull'
  | 'encryptedChats';

export type LocalDbEntityChange =
  | { store: 'users'; kind: 'put'; entities: Array<User | UserEmpty> }
  | { store: 'users'; kind: 'delete'; ids: string[] }
  | { store: 'chats'; kind: 'put'; entities: Array<Chat | ChatEmpty | ChatForbidden> }
  | { store: 'chats'; kind: 'delete'; ids: string[] }
  | { store: 'channels'; kind: 'put'; entities: Array<Channel | ChannelForbidden> }
  | { store: 'channels'; kind: 'delete'; ids: string[] }
  | { store: 'userFull'; kind: 'put'; entities: UserFull[] }
  | { store: 'userFull'; kind: 'invalidate'; ids: string[] }
  | { store: 'chatFull'; kind: 'put'; entities: ChatFull[] }
  | { store: 'chatFull'; kind: 'invalidate'; ids: string[] }
  | { store: 'channelFull'; kind: 'put'; entities: ChannelFull[] }
  | { store: 'channelFull'; kind: 'invalidate'; ids: string[] }
  | { store: 'encryptedChats'; kind: 'put'; entities: TypeEncryptedChat[] }
  | { store: 'encryptedChats'; kind: 'delete'; ids: string[] };

export type LocalDbEntityChangeNotifier = (change: LocalDbEntityChange) => void;

export type LocalDbOptions = {
  accountSlot: string;
  factory?: IDBFactory;
  flushDelayMs?: number;
  maxBatchSize?: number;
  /** Override full-info TTL (ms); default 60_000. */
  fullInfoTtlMs?: number;
  /** Optional notifier for peer/full put & invalidate (no public subscribe API). */
  onEntityChange?: LocalDbEntityChangeNotifier;
};

export type PeerInfoRow<T> = {
  id: string;
  entity: T;
  /** Derived; always false for chats. */
  minAccessHash: boolean;
  updatedAt: number;
};

export type FullInfoRow<T> = {
  id: string;
  entity: T;
  storedAt: number;
};

export type MinContextRow = {
  peerId: string;
  seenInPeerId: string;
  msgId: number;
  updatedAt: number;
};

export type CommonUpdateState = {
  pts: number;
  qts: number;
  seq: number;
  date: number;
  updatedAt: number;
};

export type ChannelUpdateState = {
  channelId: string;
  pts: number;
  updatedAt: number;
};

export type MsgIdRange = {
  start: number;
  end: number;
};

export type MsgIdRangeBox = {
  boxId: string; // the box id is the peer id of the chat or channel
  pending: boolean; // true if the box is pending to be filled, that means the box is not yet filled with the messages
  ranges: MsgIdRange[]; // the ranges of the box, that means the range of the messages are valid message ids in the chat or channel
  updatedAt: number;
};

export type RandomIdRow = {
  randomId: string;
  peerId: string;
  messageId?: number;
  createdAt: number;
  updatedAt: number;
};

export type FileRefKind = 'photo' | 'document';

/** file_reference table row: FileId → bytes (base64). */
export type FileRefRow = {
  /** `p:{id}` or `d:{id}` */
  fileId: string;
  kind: FileRefKind;
  /** Decimal photo/document id. */
  id: string;
  /** Base64-encoded file_reference bytes. */
  fileReference: string;
  updatedAt: number;
};

/**
 * One file source for a FileId. Compound key `${fileId}|${sourceKind}`
 * so each constructor type is stored at most once per file.
 */
export type FileSourceRow = {
  key: string;
  fileId: string;
  sourceKind: string;
  source: FileSourceRecord;
  updatedAt: number;
};

/** JSON record matching map `db_schema` FileSource fields (snake_case). */
export type FileSourceRecord = {
  kind: string;
  [field: string]: unknown;
};

export type MetaRow = {
  key: string;
  value: unknown;
};

export type ApplyResult = 'apply' | 'skip' | 'gap';

export type ResolvedInputPeer =
  | { type: 'user'; userId: string; accessHash: string }
  | { type: 'userFromMessage'; userId: string; seenInPeerId: string; msgId: number }
  | { type: 'channel'; channelId: string; accessHash: string }
  | { type: 'channelFromMessage'; channelId: string; seenInPeerId: string; msgId: number }
  | { type: 'chat'; chatId: string }
  | { type: 'unavailable'; peerId: string };

export type UserPeerRow = PeerInfoRow<User>;
export type ChatPeerRow = PeerInfoRow<Chat>;
export type ChannelPeerRow = PeerInfoRow<Channel>;
export type UserFullRow = FullInfoRow<UserFull>;
export type ChatFullRow = FullInfoRow<ChatFull>;
export type ChannelFullRow = FullInfoRow<ChannelFull>;

export type EncryptedChatPeerRow = {
  id: string;
  entity: TypeEncryptedChat;
  updatedAt: number;
};

export type EncryptedChatKeyRow = {
  id: string;
  dhPrivate?: Uint8Array;
  authKey?: Uint8Array;
  keyFingerprint?: string;
  updatedAt: number;
};

export type MergeUserResult = {
  row: UserPeerRow;
  invalidateFull: boolean;
};

export type MergeChannelResult = {
  row: ChannelPeerRow;
  invalidateFull: boolean;
};

/** Fixed object-store schema for LocalDb. */
export function buildLocalDbStores(): IdbStoreSchema[] {
  return [
    {
      name: STORE.users,
      keyPath: 'id',
      indexes: [{ name: 'byUsername', keyPath: 'entity.username' }],
    },
    { name: STORE.chats, keyPath: 'id' },
    {
      name: STORE.channels,
      keyPath: 'id',
      indexes: [{ name: 'byUsername', keyPath: 'entity.username' }],
    },
    { name: STORE.userFull, keyPath: 'id' },
    { name: STORE.chatFull, keyPath: 'id' },
    { name: STORE.channelFull, keyPath: 'id' },
    { name: STORE.minContexts, keyPath: 'peerId' },
    { name: STORE.meta, keyPath: 'key' },
    { name: STORE.channelStates, keyPath: 'channelId' },
    { name: STORE.msgIdRanges, keyPath: 'boxId' },
    {
      name: STORE.randomIds,
      keyPath: 'randomId',
      indexes: [{ name: 'byPeerId', keyPath: 'peerId' }],
    },
    { name: STORE.fileRefs, keyPath: 'fileId' },
    {
      name: STORE.fileSources,
      keyPath: 'key',
      indexes: [{ name: 'byFileId', keyPath: 'fileId' }],
    },
    { name: STORE.encryptedChats, keyPath: 'id' },
    { name: STORE.encryptedChatKeys, keyPath: 'id' },
  ];
}

export { META_KEY_COMMON_STATE };
