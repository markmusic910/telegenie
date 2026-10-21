export * from '@telegenie/libs/foundation/cache';
export {
  buildDownloadUrl,
  buildMediaUrl,
  buildProgressiveUrl,
  type DownloadMediaUrlParams,
  type MessageMediaUrlParams,
  type ProgressiveMediaUrlParams,
} from '@telegenie/libs/foundation/telegram/media/message-media-url';
export {
  buildPeerAvatarUrl,
  parsePeerAvatarUrl,
  type PeerAvatarUrlParams,
} from '@telegenie/libs/foundation/telegram/media/peer-avatar-url';
export type {
  CustomEmojiEntity,
  SendStickerDocument,
} from '@telegenie/libs/foundation/telegram/services/message.service';
export type {
  FeaturedStickerSet,
  GifSearchHit,
} from '@telegenie/libs/foundation/telegram/services/sticker.service';
export type {
  Document,
  DocumentAttributeSticker,
  TypeInputStickerSet,
} from '@telegenie/libs/foundation/telegram/types/file';
export {
  GET_HISTORY_LIMIT,
  GET_MESSAGES_FILL_LIMIT,
} from '@telegenie/libs/foundation/telegram/worker';
export { IS_SERVICE_WORKER_SUPPORTED, SERVICE_NOTIFICATIONS_USER_ID } from './consts';
export {
  ALL_CHATS_FOLDER_ID,
  DEFAULT_FOLDER_IDS,
} from './modules/dialog-filter/dialog-filter.constants';
export {
  ARCHIVE_FOLDER_ID,
  buildFolderRule,
  folderIncludesArchived,
  isUnreadFolder,
  matchesFolder,
  matchesFolderRule,
  orderFolderIds,
  type FolderCandidate,
  type FolderPeerKind,
  type FolderRule,
} from './modules/dialog-filter/dialog-filter.matcher';
export {
  EDIT_TIME_LIMIT_SEC,
  canCopyMessage,
  canDeleteForAll,
  canDeleteMessage,
  canEditTextMessage,
  canForwardMessage,
  canNotifyPin,
  canPinMessage,
  canUnpinMessage,
  messageMenuActions,
  selectionMenuActions,
  type MessageActionChat,
  type MessageActionInput,
  type MessageActionPeerKind,
  type MessageActionTarget,
  type MessageMenuActions,
  type SelectionMenuActions,
} from './modules/message/can-message-actions';
export { messageCopyText } from './modules/message/message-copy-text';
export type { ToggleSelectionInput } from './modules/message/message-select.controller';
export type {
  FocusMessageOptions,
  FocusNextReplyResult,
  LoadHistoryOptions,
  LoadHistoryResult,
} from './modules/message/message-load.controller';
export type {
  MessageReactionListResult,
  RecentReactionMessage,
} from './modules/message/message-reaction.controller';
export type {
  SendFileOptions,
  SendMediaGroupItem,
  SendMediaGroupOptions,
  SendTextResult,
} from './modules/message/message-send.controller';
export type {
  SendMediaWorkerPayload,
  SendMediaWorkerProgressEvent,
  SendMultiMediaWorkerItem,
  SendMultiMediaWorkerPayload,
  SendMultiMediaWorkerProgressEvent,
} from '@telegenie/libs/foundation/telegram/worker';
export {
  GlobalStore,
  StoreCache,
  StoreManager,
  messageCacheKey,
  type AuthSliceView,
  type AuthStep,
  type ChannelFullStore,
  type ChannelStore,
  type ChatFullStore,
  type ChatStore,
  type DialogFilterStore,
  type DialogStore,
  type EntityStoreView,
  type GlobalStoreView,
  type LeaderSliceView,
  type MessageStore,
  type NavSliceView,
  type StickersSliceView,
  type StoreManagerView,
  type StoreMap,
  type StoreMapView,
  type StoreName,
  type UserFullStore,
  type UserStore,
} from './store';
export { ChannelFull } from './store/entity/models/channel-full.model';
export { Channel } from './store/entity/models/channel.model';
export { ChatFull } from './store/entity/models/chat-full.model';
export { Chat } from './store/entity/models/chat.model';
export { CustomEmojiDocument } from './store/entity/models/custom-emoji.model';
export { DialogFilterModel } from './store/entity/models/dialog-filter.model';
export { Dialog } from './store/entity/models/dialog.model';
export {
  Message,
  albumPreviewPlaceholder,
  collectAlbumPreview,
  collectMessagePreview,
  formatDialogPreviewText,
  previewKindFromMedia,
  previewThumbFromMedia,
  replaceSelfMentionsInText,
  type DialogPreviewOptions,
  type MessageOutgoingStatus,
  type MessagePreviewContent,
  type MessagePreviewKind,
} from './store/entity/models/message.model';
export { UserFull } from './store/entity/models/user-full.model';
export { User } from './store/entity/models/user.model';
export { type DialogUIState } from './store/global/models/dialog.state';
export {
  MAIN_THREAD_ID,
  type MessageDraft,
  type StagedForward,
  type ThreadUIState,
} from './store/global/models/thread.state';
export type { DialogFilterEntity } from './store/types';
export { findFlatMessageIndex } from './store/utils/find-flat-message-index';
export {
  LISTED_WINDOW_MAX,
  MESSAGE_LIST_SLICE,
  MESSAGE_LIST_VIEWPORT_LIMIT,
  findClosestIndex,
  getViewportSlice,
  listedIdsFromMessages,
  listedWindowMatchesScrollAnchor,
  mergeListedIds,
  removeListedIds,
  sortMessageIds,
  trimListedWindow,
  type LoadMoreDirection,
  type ViewportSliceResult,
} from './store/utils/listed-message-ids';
export {
  coerceMessageCacheIndex,
  emptyMessageCacheIndex,
  type MessageCacheIndex,
  type MessageCacheKind,
} from './store/utils/message-cache-index';
export {
  buildFlatMessageItems,
  formatMessageDateHeader,
  getSenderId,
  groupMessages,
  isActionMessage,
  type AlbumType,
  type BuildFlatMessageItemsOptions,
  type FlatListItem,
  type MessageAlbum,
  type MessageDateGroup,
  type SenderGroup,
} from './store/utils/message-grouper';
export {
  anchorScrollTop,
  clampOffsetInItem,
  findScrollAnchorIndex,
  findVisibleItemIndex,
  itemOffsetInScroller,
  listedWindowIdentityEquals,
  messageScrollAnchorFromThread,
  pickMessageScrollAnchor,
  pickScrollAnchorIndex,
  type ListedWindowIdentity,
  type MessageScrollAnchor,
  type ScrollAnchorListItem,
} from './store/utils/message-scroll-anchor';
export {
  fallbackPeerDisplay,
  initialsFromName,
  peerActionName,
  peerColorIndex,
  peerProfileDisplay,
  type DialogPeerKind,
  type PeerDisplay,
} from './store/utils/peer-display';
export {
  TeleGenieSDK,
  messageStoreName,
  peerIdFromMessageStoreName,
  type FoundationDebugStore,
  type TeleGenieSDKInitOptions,
  type TeleGenieSDKOptions,
  type TeleGenieSDKView,
} from './telegenie.sdk';
