import type {
  TypeDraftMessage,
  TypeFolder,
  TypePeerNotifySettings,
} from '@telegenie/libs/foundation/telegram/types/api-types';

/**
 * @see https://core.telegram.org/constructor/dialog
 * @see https://core.telegram.org/constructor/dialogFolder
 */
export type DialogEntity = {
  id: string;
  /** Bot API / TDLib dialog id (derived from peer; raw TypePeer not stored) */
  peerId: string;
  pinned?: boolean;
  unreadMark?: boolean;
  viewForumAsMessages?: boolean;
  topMessageId: string;
  readInboxMaxId?: number;
  readOutboxMaxId?: number;
  unreadCount: number;
  unreadMentionsCount?: number;
  unreadReactionsCount?: number;
  notifySettings?: TypePeerNotifySettings;
  pts?: number;
  draft?: TypeDraftMessage;
  folderId?: number;
  ttlPeriod?: number;
  /** True when this entry represents a DialogFolder (archived/folder peer) */
  isFolder: boolean;
  /** Folder object (when isFolder=true) */
  folder?: TypeFolder;
  /** Folder display title (populated when isFolder=true) */
  folderTitle?: string;
  unreadMutedPeersCount?: number;
  unreadUnmutedPeersCount?: number;
  unreadMutedMessagesCount?: number;
  unreadUnmutedMessagesCount?: number;
};
