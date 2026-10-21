import type { FileRefEngine } from '../file-ref/engine';
import type { LocalDb } from '../local-db/local-db';
import type { TransportService } from '../services/transport.service';
import type {
  TypeChat,
  TypeUpdate,
  TypeUpdates,
  TypeUser,
  UpdateAttachMenuBots,
  UpdateAutoSaveSettings,
  UpdateBotBusinessConnect,
  UpdateBotCallbackQuery,
  UpdateBotChatBoost,
  UpdateBotChatInviteRequester,
  UpdateBotCommands,
  UpdateBotDeleteBusinessMessage,
  UpdateBotEditBusinessMessage,
  UpdateBotInlineQuery,
  UpdateBotInlineSend,
  UpdateBotMenuButton,
  UpdateBotMessageReaction,
  UpdateBotMessageReactions,
  UpdateBotNewBusinessMessage,
  UpdateBotPrecheckoutQuery,
  UpdateBotPurchasedPaidMedia,
  UpdateBotShippingQuery,
  UpdateBotStopped,
  UpdateBotWebhookJSON,
  UpdateBotWebhookJSONQuery,
  UpdateBroadcastRevenueTransactions,
  UpdateBusinessBotCallbackQuery,
  UpdateChannel,
  UpdateChannelAvailableMessages,
  UpdateChannelMessageForwards,
  UpdateChannelMessageViews,
  UpdateChannelParticipant,
  UpdateChannelPinnedTopic,
  UpdateChannelPinnedTopics,
  UpdateChannelReadMessagesContents,
  UpdateChannelTooLong,
  UpdateChannelUserTyping,
  UpdateChannelViewForumAsMessages,
  UpdateChannelWebPage,
  UpdateChat,
  UpdateChatDefaultBannedRights,
  UpdateChatParticipant,
  UpdateChatParticipantAdd,
  UpdateChatParticipantAdmin,
  UpdateChatParticipantDelete,
  UpdateChatParticipants,
  UpdateChatUserTyping,
  UpdateConfig,
  UpdateContactsReset,
  UpdateDcOptions,
  UpdateDeleteChannelMessages,
  UpdateDeleteMessages,
  UpdateDeleteQuickReply,
  UpdateDeleteQuickReplyMessages,
  UpdateDeleteScheduledMessages,
  UpdateDialogFilter,
  UpdateDialogFilterOrder,
  UpdateDialogFilters,
  UpdateDialogPinned,
  UpdateDialogUnreadMark,
  UpdateDraftMessage,
  UpdateEditChannelMessage,
  UpdateEditMessage,
  UpdateEncryptedChatTyping,
  UpdateEncryptedMessagesRead,
  UpdateEncryption,
  UpdateFavedStickers,
  UpdateFolderPeers,
  UpdateGeoLiveViewed,
  UpdateGroupCall,
  UpdateGroupCallConnection,
  UpdateGroupCallParticipants,
  UpdateInlineBotCallbackQuery,
  UpdateLangPack,
  UpdateLangPackTooLong,
  UpdateLoginToken,
  UpdateMessageExtendedMedia,
  UpdateMessageID,
  UpdateMessagePoll,
  UpdateMessagePollVote,
  UpdateMessageReactions,
  UpdateMoveStickerSetToTop,
  UpdateNewAuthorization,
  UpdateNewChannelMessage,
  UpdateNewEncryptedMessage,
  UpdateNewMessage,
  UpdateNewQuickReply,
  UpdateNewScheduledMessage,
  UpdateNewStickerSet,
  UpdateNewStoryReaction,
  UpdateNotifySettings,
  UpdatePaidReactionPrivacy,
  UpdatePeerBlocked,
  UpdatePeerHistoryTTL,
  UpdatePeerLocated,
  UpdatePeerSettings,
  UpdatePeerWallpaper,
  UpdatePendingJoinRequests,
  UpdatePhoneCall,
  UpdatePhoneCallSignalingData,
  UpdatePinnedChannelMessages,
  UpdatePinnedDialogs,
  UpdatePinnedMessages,
  UpdatePinnedSavedDialogs,
  UpdatePrivacy,
  UpdatePtsChanged,
  UpdateQuickReplies,
  UpdateQuickReplyMessage,
  UpdateReadChannelDiscussionInbox,
  UpdateReadChannelDiscussionOutbox,
  UpdateReadChannelInbox,
  UpdateReadChannelOutbox,
  UpdateReadFeaturedEmojiStickers,
  UpdateReadFeaturedStickers,
  UpdateReadHistoryInbox,
  UpdateReadHistoryOutbox,
  UpdateReadMessagesContents,
  UpdateReadStories,
  UpdateRecentEmojiStatuses,
  UpdateRecentReactions,
  UpdateRecentStickers,
  Updates,
  UpdateSavedDialogPinned,
  UpdateSavedGifs,
  UpdateSavedReactionTags,
  UpdateSavedRingtones,
  UpdatesCombined,
  UpdateSentStoryReaction,
  UpdateServiceNotification,
  UpdateShort,
  UpdateShortChatMessage,
  UpdateShortMessage,
  UpdateShortSentMessage,
  UpdateSmsJob,
  UpdateStarsBalance,
  UpdateStarsRevenueStatus,
  UpdateStickerSets,
  UpdateStickerSetsOrder,
  UpdatesTooLong,
  UpdateStoriesStealthMode,
  UpdateStory,
  UpdateStoryID,
  UpdateTheme,
  UpdateTranscribedAudio,
  UpdateUser,
  UpdateUserEmojiStatus,
  UpdateUserName,
  UpdateUserPhone,
  UpdateUserStatus,
  UpdateUserTyping,
  UpdateWebPage,
  UpdateWebViewResultSent,
} from '../types/api-types';
import type { UpdateEventKey } from './update-keys';

export type {
  TypeChat,
  TypeUpdate,
  TypeUpdates,
  TypeUser,
  Updates,
  UpdatesCombined,
  UpdateShort,
  UpdateShortChatMessage,
  UpdateShortMessage,
  UpdateShortSentMessage,
  UpdatesTooLong,
};

export type UpdateEventMap = {
  UpdateNewMessage: UpdateNewMessage;
  UpdateMessageID: UpdateMessageID;
  UpdateDeleteMessages: UpdateDeleteMessages;
  UpdateUserTyping: UpdateUserTyping;
  UpdateChatUserTyping: UpdateChatUserTyping;
  UpdateChatParticipants: UpdateChatParticipants;
  UpdateUserStatus: UpdateUserStatus;
  UpdateUserName: UpdateUserName;
  UpdateNewAuthorization: UpdateNewAuthorization;
  UpdateNewEncryptedMessage: UpdateNewEncryptedMessage;
  UpdateEncryptedChatTyping: UpdateEncryptedChatTyping;
  UpdateEncryption: UpdateEncryption;
  UpdateEncryptedMessagesRead: UpdateEncryptedMessagesRead;
  UpdateChatParticipantAdd: UpdateChatParticipantAdd;
  UpdateChatParticipantDelete: UpdateChatParticipantDelete;
  UpdateDcOptions: UpdateDcOptions;
  UpdateNotifySettings: UpdateNotifySettings;
  UpdateServiceNotification: UpdateServiceNotification;
  UpdatePrivacy: UpdatePrivacy;
  UpdateUserPhone: UpdateUserPhone;
  UpdateReadHistoryInbox: UpdateReadHistoryInbox;
  UpdateReadHistoryOutbox: UpdateReadHistoryOutbox;
  UpdateWebPage: UpdateWebPage;
  UpdateReadMessagesContents: UpdateReadMessagesContents;
  UpdateChannelTooLong: UpdateChannelTooLong;
  UpdateChannel: UpdateChannel;
  UpdateNewChannelMessage: UpdateNewChannelMessage;
  UpdateReadChannelInbox: UpdateReadChannelInbox;
  UpdateDeleteChannelMessages: UpdateDeleteChannelMessages;
  UpdateChannelMessageViews: UpdateChannelMessageViews;
  UpdateChatParticipantAdmin: UpdateChatParticipantAdmin;
  UpdateNewStickerSet: UpdateNewStickerSet;
  UpdateStickerSetsOrder: UpdateStickerSetsOrder;
  UpdateStickerSets: UpdateStickerSets;
  UpdateSavedGifs: UpdateSavedGifs;
  UpdateBotInlineQuery: UpdateBotInlineQuery;
  UpdateBotInlineSend: UpdateBotInlineSend;
  UpdateEditChannelMessage: UpdateEditChannelMessage;
  UpdateBotCallbackQuery: UpdateBotCallbackQuery;
  UpdateEditMessage: UpdateEditMessage;
  UpdateInlineBotCallbackQuery: UpdateInlineBotCallbackQuery;
  UpdateReadChannelOutbox: UpdateReadChannelOutbox;
  UpdateDraftMessage: UpdateDraftMessage;
  UpdateReadFeaturedStickers: UpdateReadFeaturedStickers;
  UpdateRecentStickers: UpdateRecentStickers;
  UpdateConfig: UpdateConfig;
  UpdatePtsChanged: UpdatePtsChanged;
  UpdateChannelWebPage: UpdateChannelWebPage;
  UpdateDialogPinned: UpdateDialogPinned;
  UpdatePinnedDialogs: UpdatePinnedDialogs;
  UpdateBotWebhookJSON: UpdateBotWebhookJSON;
  UpdateBotWebhookJSONQuery: UpdateBotWebhookJSONQuery;
  UpdateBotShippingQuery: UpdateBotShippingQuery;
  UpdateBotPrecheckoutQuery: UpdateBotPrecheckoutQuery;
  UpdatePhoneCall: UpdatePhoneCall;
  UpdateLangPackTooLong: UpdateLangPackTooLong;
  UpdateLangPack: UpdateLangPack;
  UpdateFavedStickers: UpdateFavedStickers;
  UpdateChannelReadMessagesContents: UpdateChannelReadMessagesContents;
  UpdateContactsReset: UpdateContactsReset;
  UpdateChannelAvailableMessages: UpdateChannelAvailableMessages;
  UpdateDialogUnreadMark: UpdateDialogUnreadMark;
  UpdateMessagePoll: UpdateMessagePoll;
  UpdateChatDefaultBannedRights: UpdateChatDefaultBannedRights;
  UpdateFolderPeers: UpdateFolderPeers;
  UpdatePeerSettings: UpdatePeerSettings;
  UpdatePeerLocated: UpdatePeerLocated;
  UpdateNewScheduledMessage: UpdateNewScheduledMessage;
  UpdateDeleteScheduledMessages: UpdateDeleteScheduledMessages;
  UpdateTheme: UpdateTheme;
  UpdateGeoLiveViewed: UpdateGeoLiveViewed;
  UpdateLoginToken: UpdateLoginToken;
  UpdateMessagePollVote: UpdateMessagePollVote;
  UpdateDialogFilter: UpdateDialogFilter;
  UpdateDialogFilterOrder: UpdateDialogFilterOrder;
  UpdateDialogFilters: UpdateDialogFilters;
  UpdatePhoneCallSignalingData: UpdatePhoneCallSignalingData;
  UpdateChannelMessageForwards: UpdateChannelMessageForwards;
  UpdateReadChannelDiscussionInbox: UpdateReadChannelDiscussionInbox;
  UpdateReadChannelDiscussionOutbox: UpdateReadChannelDiscussionOutbox;
  UpdatePeerBlocked: UpdatePeerBlocked;
  UpdateChannelUserTyping: UpdateChannelUserTyping;
  UpdatePinnedMessages: UpdatePinnedMessages;
  UpdatePinnedChannelMessages: UpdatePinnedChannelMessages;
  UpdateChat: UpdateChat;
  UpdateGroupCallParticipants: UpdateGroupCallParticipants;
  UpdateGroupCall: UpdateGroupCall;
  UpdatePeerHistoryTTL: UpdatePeerHistoryTTL;
  UpdateChatParticipant: UpdateChatParticipant;
  UpdateChannelParticipant: UpdateChannelParticipant;
  UpdateBotStopped: UpdateBotStopped;
  UpdateGroupCallConnection: UpdateGroupCallConnection;
  UpdateBotCommands: UpdateBotCommands;
  UpdatePendingJoinRequests: UpdatePendingJoinRequests;
  UpdateBotChatInviteRequester: UpdateBotChatInviteRequester;
  UpdateMessageReactions: UpdateMessageReactions;
  UpdateAttachMenuBots: UpdateAttachMenuBots;
  UpdateWebViewResultSent: UpdateWebViewResultSent;
  UpdateBotMenuButton: UpdateBotMenuButton;
  UpdateSavedRingtones: UpdateSavedRingtones;
  UpdateTranscribedAudio: UpdateTranscribedAudio;
  UpdateReadFeaturedEmojiStickers: UpdateReadFeaturedEmojiStickers;
  UpdateUserEmojiStatus: UpdateUserEmojiStatus;
  UpdateRecentEmojiStatuses: UpdateRecentEmojiStatuses;
  UpdateRecentReactions: UpdateRecentReactions;
  UpdateMoveStickerSetToTop: UpdateMoveStickerSetToTop;
  UpdateMessageExtendedMedia: UpdateMessageExtendedMedia;
  UpdateChannelPinnedTopic: UpdateChannelPinnedTopic;
  UpdateChannelPinnedTopics: UpdateChannelPinnedTopics;
  UpdateUser: UpdateUser;
  UpdateAutoSaveSettings: UpdateAutoSaveSettings;
  UpdateStory: UpdateStory;
  UpdateReadStories: UpdateReadStories;
  UpdateStoryID: UpdateStoryID;
  UpdateStoriesStealthMode: UpdateStoriesStealthMode;
  UpdateSentStoryReaction: UpdateSentStoryReaction;
  UpdateBotChatBoost: UpdateBotChatBoost;
  UpdateChannelViewForumAsMessages: UpdateChannelViewForumAsMessages;
  UpdatePeerWallpaper: UpdatePeerWallpaper;
  UpdateBotMessageReaction: UpdateBotMessageReaction;
  UpdateBotMessageReactions: UpdateBotMessageReactions;
  UpdateSavedDialogPinned: UpdateSavedDialogPinned;
  UpdatePinnedSavedDialogs: UpdatePinnedSavedDialogs;
  UpdateSavedReactionTags: UpdateSavedReactionTags;
  UpdateSmsJob: UpdateSmsJob;
  UpdateQuickReplies: UpdateQuickReplies;
  UpdateNewQuickReply: UpdateNewQuickReply;
  UpdateDeleteQuickReply: UpdateDeleteQuickReply;
  UpdateQuickReplyMessage: UpdateQuickReplyMessage;
  UpdateDeleteQuickReplyMessages: UpdateDeleteQuickReplyMessages;
  UpdateBotBusinessConnect: UpdateBotBusinessConnect;
  UpdateBotNewBusinessMessage: UpdateBotNewBusinessMessage;
  UpdateBotEditBusinessMessage: UpdateBotEditBusinessMessage;
  UpdateBotDeleteBusinessMessage: UpdateBotDeleteBusinessMessage;
  UpdateNewStoryReaction: UpdateNewStoryReaction;
  UpdateBroadcastRevenueTransactions: UpdateBroadcastRevenueTransactions;
  UpdateStarsBalance: UpdateStarsBalance;
  UpdateBusinessBotCallbackQuery: UpdateBusinessBotCallbackQuery;
  UpdateStarsRevenueStatus: UpdateStarsRevenueStatus;
  UpdateBotPurchasedPaidMedia: UpdateBotPurchasedPaidMedia;
  UpdatePaidReactionPrivacy: UpdatePaidReactionPrivacy;
};

export type UpdateSource = 'socket' | 'difference' | 'channelDifference' | 'rpc';

export type UpdateContext = {
  users: TypeUser[];
  chats: TypeChat[];
  source: UpdateSource;
};

export type UpdateHandler<K extends keyof UpdateEventMap> = (
  update: UpdateEventMap[K],
  ctx: UpdateContext,
) => void | Promise<void>;

export type AnyUpdateHandler = (
  event: UpdateEventKey,
  update: TypeUpdate,
  ctx: UpdateContext,
) => void | Promise<void>;

export type ControlEvent =
  | 'updatesTooLong'
  | 'gap'
  | 'differenceTooLong'
  | 'channelDifferenceTooLong'
  | 'channelTooLong'
  | 'watchLimitReached'
  | 'batchEnd';

export type ControlPayloadMap = {
  updatesTooLong: Record<string, never>;
  gap: {
    sequence: 'common' | 'seq' | 'qts' | { channelId: string };
    pts?: number;
    ptsCount?: number;
  };
  differenceTooLong: { pts: number };
  channelDifferenceTooLong: { channelId: string };
  channelTooLong: { channelId: string; pts?: number };
  watchLimitReached: { channelId: string; maxWatchedChannels: number };
  /** Fired after an UpdateManager.process() envelope has dispatched its updates. */
  batchEnd: Record<string, never>;
};

export type ControlHandler<K extends ControlEvent> = (
  payload: ControlPayloadMap[K],
) => void | Promise<void>;

export type UpdateManagerOptions = {
  debug?: boolean;
  transportService: TransportService;
  localDb: LocalDb;
  /** Optional file-reference store (incoming traversal of updates). */
  fileRefEngine?: FileRefEngine;
  /** Wait before fetching difference on gap (ms). Default 500. */
  gapWaitMs?: number;
  /** pts_total_limit for updates.getDifference. Default 10_000. */
  ptsTotalLimit?: number;
  /** limit for updates.getChannelDifference. Default 100. */
  channelDiffLimit?: number;
  /** Max concurrent channel short-polls. Default 10. */
  maxWatchedChannels?: number;
};

export type SequenceKey = 'common' | `channel:${string}`;

export type ChannelDiffResult = {
  final: boolean;
  timeoutSec?: number;
};

export type PendingUpdate = {
  update: unknown;
  ctx: UpdateContext;
};
