import type { LocalDbEntityChange, ResolvedInputPeer } from '../local-db/types';
import type { PlainAvailableReaction } from '../services/converters/message.converter';
import type {
  CustomEmojiEntity,
  ForwardMessagesOptions,
  SendStickerDocument,
  UpdatePinnedMessageOptions,
} from '../services/message.service';
import type {
  FeaturedStickerKind,
  FeaturedStickerSet,
  GifSearchHit,
  InstalledStickerSet,
  StickerSetContents,
} from '../services/sticker.service';
import type { Document } from '../types/file';
import type { DialogFilterBatch } from '../services/converters/dialog-filter.converter';
import type { ApiChatReactions } from '../types';
import type { TelegramOpenAccountOptions } from '../telegram';
import type {
  Channel,
  ChannelForbidden,
  ChannelFull,
  Chat,
  ChatEmpty,
  ChatForbidden,
  ChatFull,
  Dialog,
  DialogFolder,
  MessageEmpty,
  MissingInvitee,
  TypeEncryptedChat,
  TypeReaction,
  User,
  UserFull,
} from '../types/api-types';
import type { Message, MessageReactionsList, MessageService } from '../types/message';
import type { TelegramCredentials } from '../utils';
import type { DialogOrderPayload, StoreSyncPayload } from './store-sync';

export type LoadHistoryDirection = 'around' | 'backwards' | 'forwards';

/** Telegram getHistory typical max (TDLib hard-caps at 100). */
export const GET_HISTORY_LIMIT = 50;
/** Official getMessages / channels.getMessages batch size for displayed-range fill. */
export const GET_MESSAGES_FILL_LIMIT = 200;

export type LoadHistoryOptions = {
  offsetId?: number;
  direction: LoadHistoryDirection;
  limit?: number;
};

export type LoadHistoryResult = {
  messages: Message[];
  messageServices: MessageService[];
  users: User[];
  chats: Chat[];
  channels: Channel[];
  emptyMessages?: MessageEmpty[];
  count?: number;
};

export type PinnedMessagesResult = {
  messages: Message[];
  messageServices: MessageService[];
  users: User[];
  chats: Chat[];
  channels: Channel[];
  emptyMessages?: MessageEmpty[];
  count: number;
};


export type PeerIdAccessHash = {
  id: string;
  accessHash?: string;
};

export type PeerIdAccessHashRequired = {
  id: string;
  accessHash: string;
};

export type SendCodeResult = {
  phoneCodeHash: string;
  isCodeViaApp: boolean;
};

export type DialogBatch = {
  dialogs: Dialog[];
  dialogFolders: DialogFolder[];
  users: User[];
  chats: Chat[];
  channels: Channel[];
  forbiddenChats: ChatForbidden[];
  forbiddenChannels: ChannelForbidden[];
  emptyChats: ChatEmpty[];
  messages: Message[];
  emptyMessages: MessageEmpty[];
  messageServices: MessageService[];
  count: number;
  /** Telegram folder this page was queried from: 0 = main list, 1 = archive. */
  folderId: number;
};

export type MessagesByIdsResult = {
  messages: Message[];
  messageServices: MessageService[];
  emptyMessages?: MessageEmpty[];
};

export type FullChatBundle = {
  fullChats: Record<string, ChatFull>;
  chats: Record<string, Chat>;
  channels: Record<string, Channel>;
  users: Record<string, User>;
};

export type FullChannelBundle = {
  fullChannels: Record<string, ChannelFull>;
  chats: Record<string, Chat>;
  channels: Record<string, Channel>;
  users: Record<string, User>;
};

export type FullUserBundle = {
  fullUsers: Record<string, UserFull>;
  chats: Record<string, Chat>;
  channels: Record<string, Channel>;
  users: Record<string, User>;
};

/** File payload transferred from main → worker for uploads. */
export type WorkerFilePayload = {
  name: string;
  type: string;
  buffer: ArrayBuffer;
};

export type SendMediaWorkerProgressEvent =
  | { stage: 'uploading_cover'; progress: number }
  | { stage: 'uploading'; progress: number }
  | { stage: 'sending'; progress: number }
  | { stage: 'done'; messageId: number };

export type SendMediaWorkerPayload = {
  peerId: string;
  file: WorkerFilePayload;
  message: string;
  accessHash?: string;
  scheduleTime?: number;
  replyToMsgId?: number;
  forceDocument?: boolean;
  spoiler?: boolean;
  invertMedia?: boolean;
  videoCover?: WorkerFilePayload;
  entities?: CustomEmojiEntity[];
  uploadId?: string;
  width?: number;
  height?: number;
  duration?: number;
};

export type SendMultiMediaWorkerItem = {
  file: WorkerFilePayload;
  videoCover?: WorkerFilePayload;
  spoiler?: boolean;
  uploadId?: string;
  forceDocument?: boolean;
  width?: number;
  height?: number;
  duration?: number;
};

export type SendMultiMediaWorkerProgressEvent =
  | { uploadId: string; stage: 'uploading_cover' | 'uploading' | 'sending'; progress: number }
  | { stage: 'done'; messageIds: number[] };

export type SendMultiMediaWorkerPayload = {
  peerId: string;
  items: SendMultiMediaWorkerItem[];
  message?: string;
  accessHash?: string;
  scheduleTime?: number;
  replyToMsgId?: number;
  invertMedia?: boolean;
  entities?: CustomEmojiEntity[];
};

/**
 * Flat RPC surface for the Telegram dedicated worker.
 * Args/results must be structured-cloneable.
 */
export type TelegramWorkerApi = {
  'account.open': { args: [TelegramOpenAccountOptions]; result: void };
  'account.close': { args: []; result: void };
  'updates.start': { args: []; result: void };
  'updates.stop': { args: []; result: void };

  'auth.configure': { args: [TelegramCredentials]; result: void };
  'auth.prepareClient': { args: [session?: string]; result: void };
  'auth.isAuthorized': { args: []; result: boolean };
  'auth.sendCode': { args: [phone: string]; result: SendCodeResult };
  'auth.signIn': {
    args: [phone: string, phoneCodeHash: string, phoneCode: string];
    result: User;
  };
  'auth.signInWithPassword': { args: [password: string]; result: User };
  'auth.getPasswordHint': { args: []; result: string | undefined };
  'auth.getSessionString': { args: []; result: string };

  /**
   * Streamed: each chunk is one dialog page (AsyncIterable).
   * `folderId` is the Telegram folder to page through — 0 (default) for the
   * main list, 1 for the archive.
   */
  'dialog.getAllDialogs': { args: [folderId?: number]; result: DialogBatch };
  /** Full pinned order for a folder (`messages.reorderPinnedDialogs`, force). */
  'dialog.reorderPinned': { args: [peerIds: string[], folderId?: number]; result: void };

  /** Chat folder definitions (`messages.getDialogFilters`). */
  'dialogFilter.getAll': { args: []; result: DialogFilterBatch };
  /** Folder order (`messages.updateDialogFiltersOrder`); ids are server folder ids. */
  'dialogFilter.reorder': { args: [order: number[]]; result: void };

  'chat.getChatsByIds': { args: [ids: string[]]; result: Record<string, Chat> };
  'chat.getFullChatByIds': { args: [ids: string[]]; result: FullChatBundle };
  'chat.createBasicGroup': {
    args: [title: string, users: PeerIdAccessHash[]];
    result: { chat: Chat; missingInvitees: MissingInvitee[] };
  };

  'channel.getChannelsByIds': { args: [ids: string[]]; result: Record<string, Channel> };
  'channel.getFullChannelByIds': {
    args: [options: PeerIdAccessHashRequired[]];
    result: FullChannelBundle;
  };
  'channel.createGroup': {
    args: [title: string, about?: string, users?: PeerIdAccessHash[]];
    result: Channel;
  };
  'channel.createChannel': {
    args: [
      title: string,
      about?: string,
      options?: {
        isPublic?: boolean;
        username?: string;
        restrictSavingContent?: boolean;
      },
      users?: PeerIdAccessHash[],
    ];
    result: Channel;
  };
  'channel.exportInviteLink': {
    args: [channelId: string, accessHash?: string];
    result: string;
  };

  'user.getMe': { args: []; result: User };
  'user.getContacts': { args: []; result: Record<string, User> };
  'user.getUsers': { args: [options: PeerIdAccessHash[]]; result: Record<string, User> };
  'user.getUsersByIds': { args: [ids: string[]]; result: Record<string, User> };
  'user.getFullUsers': { args: [options: PeerIdAccessHash[]]; result: FullUserBundle };
  'user.getFullUsersByIds': { args: [ids: string[]]; result: FullUserBundle };
  'user.resolveUsername': {
    args: [username: string];
    result:
      | {
          peerId: string;
          users: User[];
          chats: Chat[];
          channels: Channel[];
        }
      | undefined;
  };

  'message.getMessages': { args: [chatId: string]; result: [Message[], number] };
  'message.getMessagesByIds': {
    args: [peerId: string, ids: number[]];
    result: MessagesByIdsResult;
  };
  'message.loadHistory': {
    args: [chatId: string, opts: LoadHistoryOptions];
    result: LoadHistoryResult;
  };
  'message.getPinnedMessages': {
    args: [peerId: string, limit?: number, offsetId?: number];
    result: PinnedMessagesResult;
  };
  'message.unpinAllMessages': { args: [peerId: string]; result: void };
  'message.findGapInDisplayedRange': {
    args: [peerId: string, from: number, to: number];
    result: [number, number] | null;
  };
  'message.markMessageListRead': { args: [chatId: string, maxId: number]; result: void };
  'message.markMentionsRead': { args: [peerId: string, messageIds: number[]]; result: void };
  'message.getUnreadMentions': {
    args: [peerId: string, opts?: { offsetId?: number; limit?: number }];
    result: LoadHistoryResult & { messageIds: string[] };
  };
  'message.readAllMentions': { args: [peerId: string]; result: void };
  'message.sendMessage': {
    args: [
      peerId: string,
      message: string,
      accessHash?: string,
      scheduleTime?: number,
      replyToMsgId?: number,
      entities?: CustomEmojiEntity[],
    ];
    result: number;
  };
  'message.editMessage': {
    args: [peerId: string, messageId: number, message: string, accessHash?: string];
    result: void;
  };
  'message.forwardMessages': {
    args: [
      fromPeerId: string,
      toPeerId: string,
      ids: number[],
      fromAccessHash?: string,
      toAccessHash?: string,
      options?: ForwardMessagesOptions,
    ];
    result: void;
  };
  'message.deleteMessages': {
    args: [peerId: string, ids: number[], revoke: boolean, accessHash?: string];
    result: void;
  };
  'message.updatePinnedMessage': {
    args: [
      peerId: string,
      messageId: number,
      options: UpdatePinnedMessageOptions | undefined,
      accessHash?: string,
    ];
    result: void;
  };
  /** Empty `message` clears the server draft. The SDK debounces this from `setDraft`. */
  'message.saveDraft': {
    args: [
      peerId: string,
      message: string,
      accessHash?: string,
      replyToMsgId?: number,
      entities?: CustomEmojiEntity[],
    ];
    result: void;
  };
  'message.sendSticker': {
    args: [
      peerId: string,
      document: SendStickerDocument,
      accessHash?: string,
      replyToMsgId?: number,
    ];
    result: number;
  };
  'message.sendGifResult': {
    args: [
      peerId: string,
      queryId: string,
      resultId: string,
      accessHash?: string,
      replyToMsgId?: number,
    ];
    result: number;
  };
  'message.sendMedia': {
    args: [
      peerId: string,
      file: WorkerFilePayload,
      message: string,
      accessHash?: string,
      scheduleTime?: number,
      replyToMsgId?: number,
      forceDocument?: boolean,
    ];
    result: number;
  };
  'message.sendMediaProgress': {
    args: [payload: SendMediaWorkerPayload];
    result: SendMediaWorkerProgressEvent;
  };
  'message.sendMultiMediaProgress': {
    args: [payload: SendMultiMediaWorkerPayload];
    result: SendMultiMediaWorkerProgressEvent;
  };
  'message.cancelSendMedia': {
    args: [uploadId: string];
    result: boolean;
  };
  'message.sendReaction': {
    args: [
      peerId: string,
      messageId: number,
      reactions: TypeReaction[],
      accessHash?: string,
      addToRecent?: boolean,
    ];
    result: void;
  };
  'message.refreshReactions': {
    args: [peerId: string, messageIds: number[]];
    result: void;
  };
  'message.getDefaultReaction': { args: []; result: { emoticon: string } };
  'message.getUnreadReactions': {
    args: [peerId: string, opts?: { offsetId?: number; limit?: number }];
    result: LoadHistoryResult & { messageIds: string[] };
  };
  'message.readAllReactions': { args: [peerId: string]; result: void };
  'message.emitNotification': { args: [payload: MessageNotificationPayload]; result: void };
  'message.getMessageReactionsList': {
    args: [
      peerId: string,
      messageId: number,
      accessHash?: string,
      options?: { offset?: string; limit?: number; reaction?: TypeReaction },
    ];
    result: MessageReactionsList;
  };
  'message.getAvailableReactions': { args: []; result: PlainAvailableReaction[] };
  'message.getTopReactions': { args: [limit?: number]; result: string[] };
  'message.getRecentReactions': { args: [limit?: number]; result: string[] };
  'message.clearRecentReactions': { args: []; result: void };
  'message.setDefaultReaction': { args: [emoticon: string]; result: void };

  'chat.setAvailableReactions': {
    args: [
      peerId: string,
      availableReactions: ApiChatReactions | 'none',
      reactionsLimit?: number,
      accessHash?: string,
    ];
    result: void;
  };

  'sticker.getInstalledSets': { args: []; result: InstalledStickerSet[] };
  'sticker.getInstalledEmojiSets': { args: []; result: InstalledStickerSet[] };
  'sticker.getSet': { args: [id: string, accessHash: string]; result: StickerSetContents };
  'sticker.uninstallSet': { args: [id: string, accessHash: string]; result: void };
  'sticker.getRecentStickers': { args: []; result: Document[] };
  'sticker.clearRecentStickers': { args: []; result: void };
  'sticker.getFeaturedSets': {
    args: [kind: FeaturedStickerKind];
    result: FeaturedStickerSet[];
  };
  'sticker.installSet': { args: [id: string, accessHash: string]; result: void };
  'sticker.searchStickers': { args: [query: string]; result: Document[] };
  'sticker.searchEmoji': { args: [query: string]; result: Document[] };
  'sticker.getSavedGifs': { args: []; result: Document[] };
  'sticker.searchGifs': {
    args: [peerId: string, query: string, accessHash?: string];
    result: GifSearchHit[];
  };
  'sticker.getStickersForEmoji': { args: [emoticon: string]; result: Document[] };
  'sticker.searchCustomEmoji': { args: [emoticon: string]; result: Document[] };
  'sticker.getCustomEmojiDocuments': { args: [ids: string[]]; result: Document[] };

  'peers.resolveInputPeer': { args: [peerId: string]; result: ResolvedInputPeer };
  'peers.editPhoto': {
    args: [peerId: string, file: WorkerFilePayload, accessHash?: string];
    result: void;
  };

  'encryptedChat.create': {
    args: [userId: string, accessHash?: string];
    result: TypeEncryptedChat;
  };
  'encryptedChat.accept': { args: [chatId: number]; result: TypeEncryptedChat };

  /**
   * Byte-range media fetch for SW progressive/download.
   * `fileId` looks up `file_reference` in LocalDb; `accessHash` / `dcId` come from the media URL.
   */
  'file.getPart': { args: [FileGetPartParams]; result: FileGetPartResult };

  /**
   * Full-file download for SW `/media` (and in-worker batches).
   * Same location params as {@link FileGetPartParams} without a byte range.
   */
  'file.downloadFiles': { args: [items: FileDownloadItem[]]; result: FileDownloadResult[] };

  /** Profile-photo download for SW `/avatar/` via InputPeerPhotoFileLocation. */
  'file.downloadPeerPhotos': {
    args: [items: FilePeerPhotoItem[]];
    result: FileDownloadResult[];
  };

  /**
   * Debug: drop one LocalDb peer row and fan out the matching entity change.
   * `chats` / `channels` delete the peer; `chatFull` / `channelFull` invalidate full info.
   */
  'debug.deleteLocalEntity': {
    args: [store: FoundationDebugStore, id: string];
    result: void;
  };
};

/** LocalDb object stores the store debugger can delete by id. */
export type FoundationDebugStore = 'chats' | 'chatFull' | 'channels' | 'channelFull';

/** Params for {@link TelegramWorkerApi} `file.getPart`. */
export type FileGetPartParams = {
  fileId: string;
  start: number;
  end: number;
  /** Required to build Input*FileLocation (not stored on FileRefRow). */
  accessHash: string;
  dcId: number;
  mimeType?: string;
  /** Known full file size (e.g. from URL `fileSize`); falls back to bytes received. */
  fullSize?: number;
  thumbSize?: string;
  peerId?: string;
  messageId?: number;
};

export type FileGetPartResult = {
  arrayBuffer: ArrayBuffer;
  mimeType: string;
  fullSize: number;
};

/** Location-based full download item (SW `/media`). */
export type FileDownloadItem = {
  fileId: string;
  accessHash: string;
  dcId: number;
  mimeType?: string;
  fullSize?: number;
  thumbSize?: string;
  peerId?: string;
  messageId?: number;
};

/** Peer profile photo (SW `/avatar/`). Uses InputPeerPhotoFileLocation, not photo accessHash. */
export type FilePeerPhotoItem = {
  peerId: string;
  photoId: string;
  dcId: number;
  isBig?: boolean;
  mimeType?: string;
};

export type FileDownloadResult = {
  arrayBuffer: ArrayBuffer;
  mimeType: string;
  fullSize: number;
};

/** Payload for OS / SW notification fan-out from the Telegram SharedWorker. */
export type MessageNotificationPayload = {
  chatId: string;
  messageId: number;
  title: string;
  body: string;
  isSilent?: boolean;
  /** When set, SW skips the default message sound (reaction alert). */
  reaction?: string;
};

export type TelegramWorkerEvents = {
  entityChange: LocalDbEntityChange;
  messageNotification: MessageNotificationPayload;
  storeUpdate: StoreSyncPayload;
  dialogOrder: DialogOrderPayload;
};

export type {
  DialogFilterBatch,
  FolderFilter,
} from '../services/converters/dialog-filter.converter';
export type { DialogOrderPayload, StoreSyncPayload } from './store-sync';

export const SESSION_PASSWORD_NEEDED_CODE = 'SESSION_PASSWORD_NEEDED' as const;
