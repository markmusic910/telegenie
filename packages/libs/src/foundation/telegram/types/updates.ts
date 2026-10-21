/**
 * Updates Telegram types.
 * Canonical home for Update* / Updates* constructors and updates.* namespace results.
 */

import type {
  TypeBoost,
  TypeBotBusinessConnection,
  TypeBotCommand,
  TypeBotMenuButton,
  TypeBroadcastRevenueBalances,
  TypeDataJSON,
  TypeDcOption,
  TypeDialogFilter,
  TypeDialogPeer,
  TypeDraftMessage,
  TypeDialog,
  TypeEmojiStatus,
  TypeEncryptedChat,
  TypeEncryptedMessage,
  TypeExportedChatInvite,
  TypeFolderPeer,
  TypeGeoPoint,
  TypeGroupCall,
  TypeGroupCallParticipant,
  TypeInlineQueryPeerType,
  TypeInputBotInlineMessageID,
  TypeInputGroupCall,
  TypeLangPackDifference,
  TypeMessage,
  TypeMessageEntity,
  TypeMessageExtendedMedia,
  TypeMessageFwdHeader,
  TypeMessageMedia,
  TypeMessageReactions,
  TypeMessageReplyHeader,
  TypeNotifyPeer,
  TypePaymentRequestedInfo,
  TypePeer,
  TypePeerLocated,
  TypePeerNotifySettings,
  TypePeerSettings,
  TypePhoneCall,
  TypePoll,
  TypePollResults,
  TypePostAddress,
  TypePrivacyKey,
  TypePrivacyRule,
  TypeQuickReply,
  TypeReaction,
  TypeReactionCount,
  TypeSendMessageAction,
  TypeStarsAmount,
  TypeStarsRevenueStatus,
  TypeStickerSet,
  TypeStoriesStealthMode,
  TypeStoryItem,
  TypeTheme,
  TypeWallPaper,
  TypeWebPage,
} from './api-types';

import type { TypeChannelParticipant } from './channels';
import type {
  TypeChat,
  TypeChatBannedRights,
  TypeChatParticipant,
  TypeChatParticipants,
} from './chats';

import type {
  TypeUser,
  TypeUserStatus,
  TypeUsername,
} from './users';

// --- Update / Updates constructors ---

export type UpdateAttachMenuBots = Record<string, never>;

export type UpdateAutoSaveSettings = Record<string, never>;

export type UpdateBotBusinessConnect = {
  connection: TypeBotBusinessConnection; // Api.TypeBotBusinessConnection -> TypeBotBusinessConnection;
  qts: number; // int -> number;
};

export type UpdateBotCallbackQuery = {
  // flags: null // null;
  queryId: string; // long -> string;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  msgId: number; // int -> number;
  chatInstance: string; // long -> string;
  data?: Uint8Array; // bytes -> Uint8Array;
  gameShortName?: string; // string;
};

export type UpdateBotChatBoost = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  boost: TypeBoost; // Api.TypeBoost -> TypeBoost;
  qts: number; // int -> number;
};

export type UpdateBotChatInviteRequester = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  date: number; // int -> number;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  about: string; // string;
  invite: TypeExportedChatInvite; // Api.TypeExportedChatInvite -> TypeExportedChatInvite;
  qts: number; // int -> number;
};

export type UpdateBotCommands = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  botId: string; // long -> string;
  commands: TypeBotCommand; // Api.TypeBotCommand[];
};

export type UpdateBotDeleteBusinessMessage = {
  connectionId: string; // string;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  messages: number[]; // int[] -> number[];
  qts: number; // int -> number;
};

export type UpdateBotEditBusinessMessage = {
  // flags: null // null;
  connectionId: string; // string;
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
  replyToMessage?: TypeMessage; // Api.TypeMessage -> TypeMessage;
  qts: number; // int -> number;
};

export type UpdateBotInlineQuery = {
  // flags: null // null;
  queryId: string; // long -> string;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  query: string; // string;
  geo?: TypeGeoPoint; // Api.TypeGeoPoint -> TypeGeoPoint;
  peerType?: TypeInlineQueryPeerType; // Api.TypeInlineQueryPeerType -> TypeInlineQueryPeerType;
  offset: string; // string;
};

export type UpdateBotInlineSend = {
  // flags: null // null;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  query: string; // string;
  geo?: TypeGeoPoint; // Api.TypeGeoPoint -> TypeGeoPoint;
  id: string; // string;
  msgId?: TypeInputBotInlineMessageID; // Api.TypeInputBotInlineMessageID -> TypeInputBotInlineMessageID;
};

export type UpdateBotMenuButton = {
  botId: string; // long -> string;
  button: TypeBotMenuButton; // Api.TypeBotMenuButton -> TypeBotMenuButton;
};

export type UpdateBotMessageReaction = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  msgId: number; // int -> number;
  date: number; // int -> number;
  actor: TypePeer; // Api.TypePeer -> TypePeer;
  oldReactions: TypeReaction[]; // Api.TypeReaction[];
  newReactions: TypeReaction[]; // Api.TypeReaction[];
  qts: number; // int -> number;
};

export type UpdateBotMessageReactions = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  msgId: number; // int -> number;
  date: number; // int -> number;
  reactions: TypeReactionCount[]; // Api.TypeReactionCount[];
  qts: number; // int -> number;
};

export type UpdateBotNewBusinessMessage = {
  // flags: null // null;
  connectionId: string; // string;
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
  replyToMessage?: TypeMessage; // Api.TypeMessage -> TypeMessage;
  qts: number; // int -> number;
};

export type UpdateBotPrecheckoutQuery = {
  // flags: null // null;
  queryId: string; // long -> string;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  payload: Uint8Array; // bytes -> Uint8Array;
  info?: TypePaymentRequestedInfo; // Api.TypePaymentRequestedInfo -> TypePaymentRequestedInfo;
  shippingOptionId?: string; // string;
  currency: string; // string;
  totalAmount: string; // long -> string;
};

export type UpdateBotPurchasedPaidMedia = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  payload: string; // string;
  qts: number; // int -> number;
};

export type UpdateBotShippingQuery = {
  queryId: string; // long -> string;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  payload: Uint8Array; // bytes -> Uint8Array;
  shippingAddress: TypePostAddress; // Api.TypePostAddress -> TypePostAddress;
};

export type UpdateBotStopped = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  date: number; // int -> number;
  stopped: boolean; // Bool -> boolean;
  qts: number; // int -> number;
};

export type UpdateBotWebhookJSON = {
  data: TypeDataJSON; // Api.TypeDataJSON -> TypeDataJSON;
};

export type UpdateBotWebhookJSONQuery = {
  queryId: string; // long -> string;
  data: TypeDataJSON; // Api.TypeDataJSON -> TypeDataJSON;
  timeout: number; // int -> number;
};

export type UpdateBroadcastRevenueTransactions = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  balances: TypeBroadcastRevenueBalances; // Api.TypeBroadcastRevenueBalances -> TypeBroadcastRevenueBalances;
};

export type UpdateBusinessBotCallbackQuery = {
  // flags: null // null;
  queryId: string; // long -> string;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  connectionId: string; // string;
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
  replyToMessage?: TypeMessage; // Api.TypeMessage -> TypeMessage;
  chatInstance: string; // long -> string;
  data?: Uint8Array; // bytes -> Uint8Array;
};

export type UpdateChannel = {
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
};

export type UpdateChannelAvailableMessages = {
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  availableMinId: number; // int -> number;
};

export type UpdateChannelMessageForwards = {
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  id: number; // int -> number;
  forwards: number; // int -> number;
};

export type UpdateChannelMessageViews = {
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  id: number; // int -> number;
  views: number; // int -> number;
};

export type UpdateChannelParticipant = {
  // flags: null // null;
  viaChatlist?: boolean; // boolean;
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  date: number; // int -> number;
  actorId: string; // long -> string;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  prevParticipant?: TypeChannelParticipant; // Api.TypeChannelParticipant -> TypeChannelParticipant;
  newParticipant?: TypeChannelParticipant; // Api.TypeChannelParticipant -> TypeChannelParticipant;
  invite?: TypeExportedChatInvite; // Api.TypeExportedChatInvite -> TypeExportedChatInvite;
  qts: number; // int -> number;
};

export type UpdateChannelPinnedTopic = {
  // flags: null // null;
  pinned?: boolean; // boolean;
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  topicId: number; // int -> number;
};

export type UpdateChannelPinnedTopics = {
  // flags: null // null;
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  order?: number[]; // int[] -> number[];
};

export type UpdateChannelReadMessagesContents = {
  // flags: null // null;
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  topMsgId?: number; // int -> number;
  messages: number[]; // int[] -> number[];
};

export type UpdateChannelTooLong = {
  // flags: null // null;
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  pts?: number; // int -> number;
};

export type UpdateChannelUserTyping = {
  // flags: null // null;
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  topMsgId?: number; // int -> number;
  fromId: TypePeer; // Api.TypePeer -> TypePeer;
  action: TypeSendMessageAction; // Api.TypeSendMessageAction -> TypeSendMessageAction;
};

export type UpdateChannelViewForumAsMessages = {
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  enabled: boolean; // Bool -> boolean;
};

export type UpdateChannelWebPage = {
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  webpage: TypeWebPage; // Api.TypeWebPage -> TypeWebPage;
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
};

export type UpdateChat = {
  chatId: string; // long -> string;
};

export type UpdateChatDefaultBannedRights = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  defaultBannedRights: TypeChatBannedRights; // Api.TypeChatBannedRights -> TypeChatBannedRights;
  version: number; // int -> number;
};

export type UpdateChatParticipant = {
  // flags: null // null;
  chatId: string; // long -> string;
  date: number; // int -> number;
  actorId: string; // long -> string;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  prevParticipant?: TypeChatParticipant; // Api.TypeChatParticipant -> TypeChatParticipant;
  newParticipant?: TypeChatParticipant; // Api.TypeChatParticipant -> TypeChatParticipant;
  invite?: TypeExportedChatInvite; // Api.TypeExportedChatInvite -> TypeExportedChatInvite;
  qts: number; // int -> number;
};

export type UpdateChatParticipantAdd = {
  chatId: string; // long -> string;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  inviterId: string; // long -> string;
  date: number; // int -> number;
  version: number; // int -> number;
};

export type UpdateChatParticipantAdmin = {
  chatId: string; // long -> string;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  isAdmin: boolean; // Bool -> boolean;
  version: number; // int -> number;
};

export type UpdateChatParticipantDelete = {
  chatId: string; // long -> string;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  version: number; // int -> number;
};

export type UpdateChatParticipants = {
  participants: TypeChatParticipants; // Api.TypeChatParticipants -> TypeChatParticipants;
};

export type UpdateChatUserTyping = {
  chatId: string; // long -> string;
  fromId: TypePeer; // Api.TypePeer -> TypePeer;
  action: TypeSendMessageAction; // Api.TypeSendMessageAction -> TypeSendMessageAction;
};

export type UpdateConfig = Record<string, never>;

export type UpdateContactsReset = Record<string, never>;

export type UpdateDcOptions = {
  dcOptions: TypeDcOption[]; // Api.TypeDcOption[];
};

export type UpdateDeleteChannelMessages = {
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  messages: number[]; // int[] -> number[];
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
};

export type UpdateDeleteMessages = {
  messages: number[]; // int[] -> number[];
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
};

export type UpdateDeleteQuickReply = {
  shortcutId: number; // int -> number;
};

export type UpdateDeleteQuickReplyMessages = {
  shortcutId: number; // int -> number;
  messages: number[]; // int[] -> number[];
};

export type UpdateDeleteScheduledMessages = {
  // flags: null // null;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  messages: number[]; // int[] -> number[];
  sentMessages?: number[]; // int[] -> number[];
};

export type UpdateDialogFilter = {
  // flags: null // null;
  id: number; // int -> number;
  filter?: TypeDialogFilter; // Api.TypeDialogFilter -> TypeDialogFilter;
};

export type UpdateDialogFilterOrder = {
  order: number[]; // int[] -> number[];
};

export type UpdateDialogFilters = Record<string, never>;

export type UpdateDialogPinned = {
  // flags: null // null;
  pinned?: boolean; // boolean;
  folderId?: number; // int -> number;
  peer: TypeDialogPeer; // Api.TypeDialogPeer -> TypeDialogPeer;
};

export type UpdateDialogUnreadMark = {
  // flags: null // null;
  unread?: boolean; // boolean;
  peer: TypeDialogPeer; // Api.TypeDialogPeer -> TypeDialogPeer;
};

export type UpdateDraftMessage = {
  // flags: null // null;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  topMsgId?: number; // int -> number;
  draft: TypeDraftMessage; // Api.TypeDraftMessage -> TypeDraftMessage;
};

export type UpdateEditChannelMessage = {
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
};

export type UpdateEditMessage = {
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
};

export type UpdateEncryptedChatTyping = {
  chatId: number; // Bot API / TDLib dialog id (see peer-id.helper)
};

export type UpdateEncryptedMessagesRead = {
  chatId: number; // Bot API / TDLib dialog id (see peer-id.helper)
  maxDate: number; // int -> number;
  date: number; // int -> number;
};

export type UpdateEncryption = {
  chat: TypeEncryptedChat; // Api.TypeEncryptedChat -> TypeEncryptedChat;
  date: number; // int -> number;
};

export type UpdateFavedStickers = Record<string, never>;

export type UpdateFolderPeers = {
  folderPeers: TypeFolderPeer[]; // Api.TypeFolderPeer[];
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
};

export type UpdateGeoLiveViewed = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  msgId: number; // int -> number;
};

export type UpdateGroupCall = {
  // flags: null // null;
  chatId?: string; // long -> string;
  call: TypeGroupCall; // Api.TypeGroupCall -> TypeGroupCall;
};

export type UpdateGroupCallConnection = {
  // flags: null // null;
  presentation?: boolean; // boolean;
  params: TypeDataJSON; // Api.TypeDataJSON -> TypeDataJSON;
};

export type UpdateGroupCallParticipants = {
  call: TypeInputGroupCall; // Api.TypeInputGroupCall -> TypeInputGroupCall;
  participants: TypeGroupCallParticipant[]; // Api.TypeGroupCallParticipant[];
  version: number; // int -> number;
};

export type UpdateInlineBotCallbackQuery = {
  // flags: null // null;
  queryId: string; // long -> string;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  msgId: TypeInputBotInlineMessageID; // Api.TypeInputBotInlineMessageID -> TypeInputBotInlineMessageID;
  chatInstance: string; // long -> string;
  data?: Uint8Array; // bytes -> Uint8Array;
  gameShortName?: string; // string;
};

export type UpdateLangPack = {
  difference: TypeLangPackDifference; // Api.TypeLangPackDifference -> TypeLangPackDifference;
};

export type UpdateLangPackTooLong = {
  langCode: string; // string;
};

export type UpdateLoginToken = Record<string, never>;

export type UpdateMessageExtendedMedia = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  msgId: number; // int -> number;
  extendedMedia: TypeMessageExtendedMedia[]; // Api.TypeMessageExtendedMedia[];
};

export type UpdateMessageID = {
  id: number; // int -> number;
  randomId?: string; // long -> string;
};

export type UpdateMessagePoll = {
  // flags: null // null;
  pollId: string; // long -> string;
  poll?: TypePoll; // Api.TypePoll -> TypePoll;
  results: TypePollResults; // Api.TypePollResults -> TypePollResults;
};

export type UpdateMessagePollVote = {
  pollId: string; // long -> string;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  options: Uint8Array[]; // bytes[] -> Uint8Array[];
  qts: number; // int -> number;
};

export type UpdateMessageReactions = {
  // flags: null // null;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  msgId: number; // int -> number;
  topMsgId?: number; // int -> number;
  reactions: TypeMessageReactions; // Api.TypeMessageReactions -> TypeMessageReactions;
};

export type UpdateMoveStickerSetToTop = {
  // flags: null // null;
  masks?: boolean; // boolean;
  emojis?: boolean; // boolean;
  stickerset: string; // long -> string;
};

export type UpdateNewAuthorization = {
  // flags: null // null;
  unconfirmed?: boolean; // boolean;
  hash: string; // long -> string;
  date?: number; // int -> number;
  device?: string; // string;
  location?: string; // string;
};

export type UpdateNewChannelMessage = {
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
};

export type UpdateNewEncryptedMessage = {
  message: TypeEncryptedMessage; // Api.TypeEncryptedMessage -> TypeEncryptedMessage;
  qts: number; // int -> number;
};

export type UpdateNewMessage = {
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
};

export type UpdateNewQuickReply = {
  quickReply: TypeQuickReply; // Api.TypeQuickReply -> TypeQuickReply;
};

export type UpdateNewScheduledMessage = {
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
};

export type UpdateNewStickerSet = {
  stickerset: TypeStickerSet; // messages.TypeStickerSet;
};

export type UpdateNewStoryReaction = {
  storyId: number; // int -> number;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  reaction: TypeReaction; // Api.TypeReaction -> TypeReaction;
};

export type UpdateNotifySettings = {
  peer: TypeNotifyPeer; // Api.TypeNotifyPeer -> TypeNotifyPeer;
  notifySettings: TypePeerNotifySettings; // Api.TypePeerNotifySettings -> TypePeerNotifySettings;
};

export type UpdatePaidReactionPrivacy = {
  private: boolean; // Bool -> boolean;
};

export type UpdatePeerBlocked = {
  // flags: null // null;
  blocked?: boolean; // boolean;
  blockedMyStoriesFrom?: boolean; // boolean;
  peerId: TypePeer; // Api.TypePeer -> TypePeer;
};

export type UpdatePeerHistoryTTL = {
  // flags: null // null;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  ttlPeriod?: number; // int -> number;
};

export type UpdatePeerLocated = {
  peers: TypePeerLocated[]; // Api.TypePeerLocated[];
};

export type UpdatePeerSettings = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  settings: TypePeerSettings; // Api.TypePeerSettings -> TypePeerSettings;
};

export type UpdatePeerWallpaper = {
  // flags: null // null;
  wallpaperOverridden?: boolean; // boolean;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  wallpaper?: TypeWallPaper; // Api.TypeWallPaper -> TypeWallPaper;
};

export type UpdatePendingJoinRequests = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  requestsPending: number; // int -> number;
  recentRequesters: string[]; // long[] -> string[];
};

export type UpdatePhoneCall = {
  phoneCall: TypePhoneCall; // Api.TypePhoneCall -> TypePhoneCall;
};

export type UpdatePhoneCallSignalingData = {
  phoneCallId: string; // long -> string;
  data: Uint8Array; // bytes -> Uint8Array;
};

export type UpdatePinnedChannelMessages = {
  // flags: null // null;
  pinned?: boolean; // boolean;
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  messages: number[]; // int[] -> number[];
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
};

export type UpdatePinnedDialogs = {
  // flags: null // null;
  folderId?: number; // int -> number;
  order?: TypeDialogPeer[]; // Api.TypeDialogPeer[];
};

export type UpdatePinnedMessages = {
  // flags: null // null;
  pinned?: boolean; // boolean;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  messages: number[]; // int[] -> number[];
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
};

export type UpdatePinnedSavedDialogs = {
  // flags: null // null;
  order?: TypeDialogPeer[]; // Api.TypeDialogPeer[];
};

export type UpdatePrivacy = {
  key: TypePrivacyKey; // Api.TypePrivacyKey -> TypePrivacyKey;
  rules: TypePrivacyRule[]; // Api.TypePrivacyRule[];
};

export type UpdatePtsChanged = Record<string, never>;

export type UpdateQuickReplies = {
  quickReplies: TypeQuickReply[]; // Api.TypeQuickReply[];
};

export type UpdateQuickReplyMessage = {
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
};

export type UpdateReadChannelDiscussionInbox = {
  // flags: null // null;
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  topMsgId: number; // int -> number;
  readMaxId: number; // int -> number;
  broadcastId?: string; // long -> string;
  broadcastPost?: number; // int -> number;
};

export type UpdateReadChannelDiscussionOutbox = {
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  topMsgId: number; // int -> number;
  readMaxId: number; // int -> number;
};

export type UpdateReadChannelInbox = {
  // flags: null // null;
  folderId?: number; // int -> number;
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  maxId: number; // int -> number;
  stillUnreadCount: number; // int -> number;
  pts: number; // int -> number;
};

export type UpdateReadChannelOutbox = {
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  maxId: number; // int -> number;
};

export type UpdateReadFeaturedEmojiStickers = Record<string, never>;

export type UpdateReadFeaturedStickers = Record<string, never>;

export type UpdateReadHistoryInbox = {
  // flags: null // null;
  folderId?: number; // int -> number;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  maxId: number; // int -> number;
  stillUnreadCount: number; // int -> number;
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
};

export type UpdateReadHistoryOutbox = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  maxId: number; // int -> number;
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
};

export type UpdateReadMessagesContents = {
  // flags: null // null;
  messages: number[]; // int[] -> number[];
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
  date?: number; // int -> number;
};

export type UpdateReadStories = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  maxId: number; // int -> number;
};

export type UpdateRecentEmojiStatuses = Record<string, never>;

export type UpdateRecentReactions = Record<string, never>;

export type UpdateRecentStickers = Record<string, never>;

export type Updates = {
  updates: TypeUpdate[]; // Api.TypeUpdate[];
  users: TypeUser[]; // Api.TypeUser[];
  chats: TypeChat[]; // Api.TypeChat[];
  date: number; // int -> number;
  seq: number; // int -> number;
};

export type UpdatesTooLong = Record<string, never>;

export type UpdateSavedDialogPinned = {
  // flags: null // null;
  pinned?: boolean; // boolean;
  peer: TypeDialogPeer; // Api.TypeDialogPeer -> TypeDialogPeer;
};

export type UpdateSavedGifs = Record<string, never>;

export type UpdateSavedReactionTags = Record<string, never>;

export type UpdateSavedRingtones = Record<string, never>;

export type UpdatesCombined = {
  updates: TypeUpdate[]; // Api.TypeUpdate[];
  users: TypeUser[]; // Api.TypeUser[];
  chats: TypeChat[]; // Api.TypeChat[];
  date: number; // int -> number;
  seqStart: number; // int -> number;
  seq: number; // int -> number;
};

export type UpdateSentStoryReaction = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  storyId: number; // int -> number;
  reaction: TypeReaction; // Api.TypeReaction -> TypeReaction;
};

export type UpdateServiceNotification = {
  // flags: null // null;
  popup?: boolean; // boolean;
  invertMedia?: boolean; // boolean;
  inboxDate?: number; // int -> number;
  type: string; // string;
  message: string; // string;
  media: TypeMessageMedia; // Api.TypeMessageMedia -> TypeMessageMedia;
  entities: TypeMessageEntity[]; // Api.TypeMessageEntity[];
};

export type UpdateShort = {
  update: TypeUpdate; // Api.TypeUpdate -> TypeUpdate;
  date: number; // int -> number;
};

export type UpdateShortChatMessage = {
  // flags: null // null;
  out?: boolean; // boolean;
  mentioned?: boolean; // boolean;
  mediaUnread?: boolean; // boolean;
  silent?: boolean; // boolean;
  id: number; // int -> number;
  fromId: string; // long -> string;
  chatId: string; // long -> string;
  message: string; // string;
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
  date: number; // int -> number;
  fwdFrom?: TypeMessageFwdHeader; // Api.TypeMessageFwdHeader -> TypeMessageFwdHeader;
  viaBotId?: string; // long -> string;
  replyTo?: TypeMessageReplyHeader; // Api.TypeMessageReplyHeader -> TypeMessageReplyHeader;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  ttlPeriod?: number; // int -> number;
};

export type UpdateShortMessage = {
  // flags: null // null;
  out?: boolean; // boolean;
  mentioned?: boolean; // boolean;
  mediaUnread?: boolean; // boolean;
  silent?: boolean; // boolean;
  id: number; // int -> number;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  message: string; // string;
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
  date: number; // int -> number;
  fwdFrom?: TypeMessageFwdHeader; // Api.TypeMessageFwdHeader -> TypeMessageFwdHeader;
  viaBotId?: string; // long -> string;
  replyTo?: TypeMessageReplyHeader; // Api.TypeMessageReplyHeader -> TypeMessageReplyHeader;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  ttlPeriod?: number; // int -> number;
};

export type UpdateShortSentMessage = {
  // flags: null // null;
  out?: boolean; // boolean;
  id: number; // int -> number;
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
  date: number; // int -> number;
  media?: TypeMessageMedia; // Api.TypeMessageMedia -> TypeMessageMedia;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  ttlPeriod?: number; // int -> number;
};

export type UpdateSmsJob = {
  jobId: string; // string;
};

export type UpdateStarsBalance = {
  balance: TypeStarsAmount; // Api.TypeStarsAmount -> TypeStarsAmount;
};

export type UpdateStarsRevenueStatus = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  status: TypeStarsRevenueStatus; // Api.TypeStarsRevenueStatus -> TypeStarsRevenueStatus;
};

export type UpdateStickerSets = {
  // flags: null // null;
  masks?: boolean; // boolean;
  emojis?: boolean; // boolean;
};

export type UpdateStickerSetsOrder = {
  // flags: null // null;
  masks?: boolean; // boolean;
  emojis?: boolean; // boolean;
  order: string[]; // long[] -> string[];
};

export type UpdateStoriesStealthMode = {
  stealthMode: TypeStoriesStealthMode; // Api.TypeStoriesStealthMode -> TypeStoriesStealthMode;
};

export type UpdateStory = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  story: TypeStoryItem; // Api.TypeStoryItem -> TypeStoryItem;
};

export type UpdateStoryID = {
  id: number; // int -> number;
  randomId?: string; // long -> string;
};

export type UpdateTheme = {
  theme: TypeTheme; // Api.TypeTheme -> TypeTheme;
};

export type UpdateTranscribedAudio = {
  // flags: null // null;
  pending?: boolean; // boolean;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  msgId: number; // int -> number;
  transcriptionId: string; // long -> string;
  text: string; // string;
};

export type UpdateUser = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
};

export type UpdateUserEmojiStatus = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  emojiStatus: TypeEmojiStatus; // Api.TypeEmojiStatus -> TypeEmojiStatus;
};

export type UpdateUserName = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  firstName: string; // string;
  lastName: string; // string;
  usernames: TypeUsername[]; // Api.TypeUsername[];
};

export type UpdateUserPhone = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  phone: string; // string;
};

export type UpdateUserStatus = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  status: TypeUserStatus; // Api.TypeUserStatus -> TypeUserStatus;
};

export type UpdateUserTyping = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  action: TypeSendMessageAction; // Api.TypeSendMessageAction -> TypeSendMessageAction;
};

export type UpdateWebPage = {
  webpage: TypeWebPage; // Api.TypeWebPage -> TypeWebPage;
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
};

export type UpdateWebViewResultSent = {
  queryId: string; // long -> string;
};

// --- Type* unions ---

export type TypeUpdate =
  | UpdateNewMessage
  | UpdateMessageID
  | UpdateDeleteMessages
  | UpdateUserTyping
  | UpdateChatUserTyping
  | UpdateChatParticipants
  | UpdateUserStatus
  | UpdateUserName
  | UpdateNewAuthorization
  | UpdateNewEncryptedMessage
  | UpdateEncryptedChatTyping
  | UpdateEncryption
  | UpdateEncryptedMessagesRead
  | UpdateChatParticipantAdd
  | UpdateChatParticipantDelete
  | UpdateDcOptions
  | UpdateNotifySettings
  | UpdateServiceNotification
  | UpdatePrivacy
  | UpdateUserPhone
  | UpdateReadHistoryInbox
  | UpdateReadHistoryOutbox
  | UpdateWebPage
  | UpdateReadMessagesContents
  | UpdateChannelTooLong
  | UpdateChannel
  | UpdateNewChannelMessage
  | UpdateReadChannelInbox
  | UpdateDeleteChannelMessages
  | UpdateChannelMessageViews
  | UpdateChatParticipantAdmin
  | UpdateNewStickerSet
  | UpdateStickerSetsOrder
  | UpdateStickerSets
  | UpdateSavedGifs
  | UpdateBotInlineQuery
  | UpdateBotInlineSend
  | UpdateEditChannelMessage
  | UpdateBotCallbackQuery
  | UpdateEditMessage
  | UpdateInlineBotCallbackQuery
  | UpdateReadChannelOutbox
  | UpdateDraftMessage
  | UpdateReadFeaturedStickers
  | UpdateRecentStickers
  | UpdateConfig
  | UpdatePtsChanged
  | UpdateChannelWebPage
  | UpdateDialogPinned
  | UpdatePinnedDialogs
  | UpdateBotWebhookJSON
  | UpdateBotWebhookJSONQuery
  | UpdateBotShippingQuery
  | UpdateBotPrecheckoutQuery
  | UpdatePhoneCall
  | UpdateLangPackTooLong
  | UpdateLangPack
  | UpdateFavedStickers
  | UpdateChannelReadMessagesContents
  | UpdateContactsReset
  | UpdateChannelAvailableMessages
  | UpdateDialogUnreadMark
  | UpdateMessagePoll
  | UpdateChatDefaultBannedRights
  | UpdateFolderPeers
  | UpdatePeerSettings
  | UpdatePeerLocated
  | UpdateNewScheduledMessage
  | UpdateDeleteScheduledMessages
  | UpdateTheme
  | UpdateGeoLiveViewed
  | UpdateLoginToken
  | UpdateMessagePollVote
  | UpdateDialogFilter
  | UpdateDialogFilterOrder
  | UpdateDialogFilters
  | UpdatePhoneCallSignalingData
  | UpdateChannelMessageForwards
  | UpdateReadChannelDiscussionInbox
  | UpdateReadChannelDiscussionOutbox
  | UpdatePeerBlocked
  | UpdateChannelUserTyping
  | UpdatePinnedMessages
  | UpdatePinnedChannelMessages
  | UpdateChat
  | UpdateGroupCallParticipants
  | UpdateGroupCall
  | UpdatePeerHistoryTTL
  | UpdateChatParticipant
  | UpdateChannelParticipant
  | UpdateBotStopped
  | UpdateGroupCallConnection
  | UpdateBotCommands
  | UpdatePendingJoinRequests
  | UpdateBotChatInviteRequester
  | UpdateMessageReactions
  | UpdateAttachMenuBots
  | UpdateWebViewResultSent
  | UpdateBotMenuButton
  | UpdateSavedRingtones
  | UpdateTranscribedAudio
  | UpdateReadFeaturedEmojiStickers
  | UpdateUserEmojiStatus
  | UpdateRecentEmojiStatuses
  | UpdateRecentReactions
  | UpdateMoveStickerSetToTop
  | UpdateMessageExtendedMedia
  | UpdateChannelPinnedTopic
  | UpdateChannelPinnedTopics
  | UpdateUser
  | UpdateAutoSaveSettings
  | UpdateStory
  | UpdateReadStories
  | UpdateStoryID
  | UpdateStoriesStealthMode
  | UpdateSentStoryReaction
  | UpdateBotChatBoost
  | UpdateChannelViewForumAsMessages
  | UpdatePeerWallpaper
  | UpdateBotMessageReaction
  | UpdateBotMessageReactions
  | UpdateSavedDialogPinned
  | UpdatePinnedSavedDialogs
  | UpdateSavedReactionTags
  | UpdateSmsJob
  | UpdateQuickReplies
  | UpdateNewQuickReply
  | UpdateDeleteQuickReply
  | UpdateQuickReplyMessage
  | UpdateDeleteQuickReplyMessages
  | UpdateBotBusinessConnect
  | UpdateBotNewBusinessMessage
  | UpdateBotEditBusinessMessage
  | UpdateBotDeleteBusinessMessage
  | UpdateNewStoryReaction
  | UpdateBroadcastRevenueTransactions
  | UpdateStarsBalance
  | UpdateBusinessBotCallbackQuery
  | UpdateStarsRevenueStatus
  | UpdateBotPurchasedPaidMedia
  | UpdatePaidReactionPrivacy; // UpdateNewMessage | UpdateMessageID | UpdateDeleteMessages | UpdateUserTyping | UpdateChatUserTyping | UpdateChatParticipants | UpdateUserStatus | UpdateUserName | UpdateNewAuthorization | UpdateNewEncryptedMessage | UpdateEncryptedChatTyping | UpdateEncryption | UpdateEncryptedMessagesRead | UpdateChatParticipantAdd | UpdateChatParticipantDelete | UpdateDcOptions | UpdateNotifySettings | UpdateServiceNotification | UpdatePrivacy | UpdateUserPhone | UpdateReadHistoryInbox | UpdateReadHistoryOutbox | UpdateWebPage | UpdateReadMessagesContents | UpdateChannelTooLong | UpdateChannel | UpdateNewChannelMessage | UpdateReadChannelInbox | UpdateDeleteChannelMessages | UpdateChannelMessageViews | UpdateChatParticipantAdmin | UpdateNewStickerSet | UpdateStickerSetsOrder | UpdateStickerSets | UpdateSavedGifs | UpdateBotInlineQuery | UpdateBotInlineSend | UpdateEditChannelMessage | UpdateBotCallbackQuery | UpdateEditMessage | UpdateInlineBotCallbackQuery | UpdateReadChannelOutbox | UpdateDraftMessage | UpdateReadFeaturedStickers | UpdateRecentStickers | UpdateConfig | UpdatePtsChanged | UpdateChannelWebPage | UpdateDialogPinned | UpdatePinnedDialogs | UpdateBotWebhookJSON | UpdateBotWebhookJSONQuery | UpdateBotShippingQuery | UpdateBotPrecheckoutQuery | UpdatePhoneCall | UpdateLangPackTooLong | UpdateLangPack | UpdateFavedStickers | UpdateChannelReadMessagesContents | UpdateContactsReset | UpdateChannelAvailableMessages | UpdateDialogUnreadMark | UpdateMessagePoll | UpdateChatDefaultBannedRights | UpdateFolderPeers | UpdatePeerSettings | UpdatePeerLocated | UpdateNewScheduledMessage | UpdateDeleteScheduledMessages | UpdateTheme | UpdateGeoLiveViewed | UpdateLoginToken | UpdateMessagePollVote | UpdateDialogFilter | UpdateDialogFilterOrder | UpdateDialogFilters | UpdatePhoneCallSignalingData | UpdateChannelMessageForwards | UpdateReadChannelDiscussionInbox | UpdateReadChannelDiscussionOutbox | UpdatePeerBlocked | UpdateChannelUserTyping | UpdatePinnedMessages | UpdatePinnedChannelMessages | UpdateChat | UpdateGroupCallParticipants | UpdateGroupCall | UpdatePeerHistoryTTL | UpdateChatParticipant | UpdateChannelParticipant | UpdateBotStopped | UpdateGroupCallConnection | UpdateBotCommands | UpdatePendingJoinRequests | UpdateBotChatInviteRequester | UpdateMessageReactions | UpdateAttachMenuBots | UpdateWebViewResultSent | UpdateBotMenuButton | UpdateSavedRingtones | UpdateTranscribedAudio | UpdateReadFeaturedEmojiStickers | UpdateUserEmojiStatus | UpdateRecentEmojiStatuses | UpdateRecentReactions | UpdateMoveStickerSetToTop | UpdateMessageExtendedMedia | UpdateChannelPinnedTopic | UpdateChannelPinnedTopics | UpdateUser | UpdateAutoSaveSettings | UpdateStory | UpdateReadStories | UpdateStoryID | UpdateStoriesStealthMode | UpdateSentStoryReaction | UpdateBotChatBoost | UpdateChannelViewForumAsMessages | UpdatePeerWallpaper | UpdateBotMessageReaction | UpdateBotMessageReactions | UpdateSavedDialogPinned | UpdatePinnedSavedDialogs | UpdateSavedReactionTags | UpdateSmsJob | UpdateQuickReplies | UpdateNewQuickReply | UpdateDeleteQuickReply | UpdateQuickReplyMessage | UpdateDeleteQuickReplyMessages | UpdateBotBusinessConnect | UpdateBotNewBusinessMessage | UpdateBotEditBusinessMessage | UpdateBotDeleteBusinessMessage | UpdateNewStoryReaction | UpdateBroadcastRevenueTransactions | UpdateStarsBalance | UpdateBusinessBotCallbackQuery | UpdateStarsRevenueStatus | UpdateBotPurchasedPaidMedia | UpdatePaidReactionPrivacy

export type TypeUpdates =
  | UpdatesTooLong
  | UpdateShortMessage
  | UpdateShortChatMessage
  | UpdateShort
  | UpdatesCombined
  | Updates
  | UpdateShortSentMessage; // UpdatesTooLong | UpdateShortMessage | UpdateShortChatMessage | UpdateShort | UpdatesCombined | Updates | UpdateShortSentMessage

// --- updates.* namespace results ---

export type ChannelDifference = {
  // flags: null // null;
  final?: boolean; // boolean;
  pts: number; // int -> number;
  timeout?: number; // int -> number;
  newMessages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  otherUpdates: TypeUpdate[]; // Api.TypeUpdate[] -> TypeUpdate[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type ChannelDifferenceEmpty = {
  // flags: null // null;
  final?: boolean; // boolean;
  pts: number; // int -> number;
  timeout?: number; // int -> number;
};

export type ChannelDifferenceTooLong = {
  // flags: null // null;
  final?: boolean; // boolean;
  timeout?: number; // int -> number;
  dialog: TypeDialog; // Api.TypeDialog -> TypeDialog;
  messages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type Difference = {
  newMessages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  newEncryptedMessages: TypeEncryptedMessage[]; // Api.TypeEncryptedMessage[] -> TypeEncryptedMessage[];
  otherUpdates: TypeUpdate[]; // Api.TypeUpdate[] -> TypeUpdate[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
  state: TypeState; // updates.TypeState;
};

export type DifferenceEmpty = {
  date: number; // int -> number;
  seq: number; // int -> number;
};

export type DifferenceSlice = {
  newMessages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  newEncryptedMessages: TypeEncryptedMessage[]; // Api.TypeEncryptedMessage[] -> TypeEncryptedMessage[];
  otherUpdates: TypeUpdate[]; // Api.TypeUpdate[] -> TypeUpdate[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
  intermediateState: TypeState; // updates.TypeState;
};

export type DifferenceTooLong = {
  pts: number; // int -> number;
};

export type State = {
  pts: number; // int -> number;
  qts: number; // int -> number;
  date: number; // int -> number;
  seq: number; // int -> number;
  unreadCount: number; // int -> number;
};

export type TypeChannelDifference =
  | ChannelDifferenceEmpty
  | ChannelDifferenceTooLong
  | ChannelDifference; // updates.ChannelDifferenceEmpty | updates.ChannelDifferenceTooLong | updates.ChannelDifference

export type TypeDifference = DifferenceEmpty | Difference | DifferenceSlice | DifferenceTooLong; // updates.DifferenceEmpty | updates.Difference | updates.DifferenceSlice | updates.DifferenceTooLong

export type TypeState = State; // updates.State
