 
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// Auto-generated types from api.d.ts namespace: messages
// Generated on 2025-09-13T14:20:50.989Z

import type {
  Page,
  Photo,
  TypeAvailableEffect,
  TypeAvailableReaction,
  TypeBotApp,
  TypeBotInlineResult,
  TypeChat,
  TypeChatAdminWithInvites,
  TypeChatFull,
  TypeChatInviteImporter,
  TypeDialog,
  TypeDialogFilter,
  TypeDocument,
  TypeEmojiGroup,
  TypeEncryptedFile,
  TypeExportedChatInvite,
  TypeForumTopic,
  TypeHighScore,
  TypeInlineBotSwitchPM,
  TypeInlineBotWebView,
  TypeInlineQueryPeerType,
  TypeMessage,
  TypeMessageMedia,
  TypeMessagePeerReaction,
  TypeMessagePeerVote,
  TypeMessagesFilter,
  TypeMissingInvitee,
  TypePeerSettings,
  TypeQuickReply,
  TypeReaction,
  TypeSavedDialog,
  TypeSavedReactionTag,
  TypeSearchResultsCalendarPeriod,
  TypeSearchResultsPosition,
  TypeSponsoredMessage,
  TypeStickerKeyword,
  TypeStickerPack,
  TypeStickerSetCovered,
  TypeTextWithEntities,
  TypeUpdates,
  TypeUser,
  TypeWebPageAttribute,
} from './api-types';
import type { TypeState } from './updates';

export type AffectedFoundMessages = {
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
  offset: number; // int -> number;
  messages: number[]; // int[] -> number[];
};

export type AffectedHistory = {
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
  offset: number; // int -> number;
};

export type AffectedMessages = {
  pts: number; // int -> number;
  ptsCount: number; // int -> number;
};

export type AllStickers = {
  hash: string; // long -> string;
  sets: TypeStickerSet[]; // Api.TypeStickerSet[] -> TypeStickerSet[];
};

export type ArchivedStickers = {
  count: number; // int -> number;
  sets: TypeStickerSetCovered[]; // Api.TypeStickerSetCovered[] -> TypeStickerSetCovered[];
};

export type AvailableEffects = {
  hash: number; // int -> number;
  effects: TypeAvailableEffect[]; // Api.TypeAvailableEffect[] -> TypeAvailableEffect[];
  documents: TypeDocument[]; // Api.TypeDocument[] -> TypeDocument[];
};

export type AvailableReactions = {
  hash: number; // int -> number;
  reactions: TypeAvailableReaction[]; // Api.TypeAvailableReaction[] -> TypeAvailableReaction[];
};

/** messages.BotApp — wrapper; TL constructor `botApp` stays in api-types. */
export type MessagesBotApp = {
  // flags: null // null;
  inactive?: boolean; // boolean;
  requestWriteAccess?: boolean; // boolean;
  hasSettings?: boolean; // boolean;
  app: TypeBotApp; // Api.TypeBotApp -> TypeBotApp;
};

export type BotCallbackAnswer = {
  // flags: null // null;
  alert?: boolean; // boolean;
  hasUrl?: boolean; // boolean;
  nativeUi?: boolean; // boolean;
  message?: string; // string;
  url?: string; // string;
  cacheTime: number; // int -> number;
};

export type BotPreparedInlineMessage = {
  id: string; // string;
  expireDate: number; // int -> number;
};

export type BotResults = {
  // flags: null // null;
  gallery?: boolean; // boolean;
  queryId: string; // long -> string;
  nextOffset?: string; // string;
  switchPm?: TypeInlineBotSwitchPM; // Api.TypeInlineBotSwitchPM -> TypeInlineBotSwitchPM;
  switchWebview?: TypeInlineBotWebView; // Api.TypeInlineBotWebView -> TypeInlineBotWebView;
  results: TypeBotInlineResult[]; // Api.TypeBotInlineResult[] -> TypeBotInlineResult[];
  cacheTime: number; // int -> number;
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type ChannelMessages = {
  // flags: null // null;
  inexact?: boolean; // boolean;
  pts: number; // int -> number;
  count: number; // int -> number;
  offsetIdOffset?: number; // int -> number;
  messages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  topics: TypeForumTopic[]; // Api.TypeForumTopic[] -> TypeForumTopic[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type ChatAdminsWithInvites = {
  admins: TypeChatAdminWithInvites[]; // Api.TypeChatAdminWithInvites[] -> TypeChatAdminWithInvites[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

/** messages.ChatFull — wrapper; TL constructors chatFull/channelFull stay in api-types. */
export type MessagesChatFull = {
  fullChat: TypeChatFull; // Api.TypeChatFull -> TypeChatFull;
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type ChatInviteImporters = {
  count: number; // int -> number;
  importers: TypeChatInviteImporter[]; // Api.TypeChatInviteImporter[] -> TypeChatInviteImporter[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type Chats = {
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
};

export type ChatsSlice = {
  count: number; // int -> number;
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
};

export type CheckedHistoryImportPeer = {
  confirmText: string; // string;
};

export type DhConfig = {
  g: number; // int -> number;
  p: Uint8Array; // bytes -> Uint8Array;
  version: number; // int -> number;
  random: Uint8Array; // bytes -> Uint8Array;
};

export type DhConfigNotModified = {
  random: Uint8Array; // bytes -> Uint8Array;
};

export type DialogFilters = {
  // flags: null // null;
  tagsEnabled?: boolean; // boolean;
  filters: TypeDialogFilter[]; // Api.TypeDialogFilter[] -> TypeDialogFilter[];
};

export type Dialogs = {
  dialogs: TypeDialog[]; // Api.TypeDialog[] -> TypeDialog[];
  messages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type DialogsNotModified = {
  count: number; // int -> number;
};

export type DialogsSlice = {
  count: number; // int -> number;
  dialogs: TypeDialog[]; // Api.TypeDialog[] -> TypeDialog[];
  messages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type DiscussionMessage = {
  // flags: null // null;
  messages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  maxId?: number; // int -> number;
  readInboxMaxId?: number; // int -> number;
  readOutboxMaxId?: number; // int -> number;
  unreadCount: number; // int -> number;
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type EmojiGroups = {
  hash: number; // int -> number;
  groups: TypeEmojiGroup[]; // Api.TypeEmojiGroup[] -> TypeEmojiGroup[];
};

/** messages.ExportedChatInvite — wrapper; constructor is ChatInviteExported in chats.ts */
export type MessagesExportedChatInvite = {
  invite: TypeExportedChatInvite; // Api.TypeExportedChatInvite -> TypeExportedChatInvite;
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type MessagesExportedChatInviteReplaced = {
  invite: TypeExportedChatInvite; // Api.TypeExportedChatInvite -> TypeExportedChatInvite;
  newInvite: TypeExportedChatInvite; // Api.TypeExportedChatInvite -> TypeExportedChatInvite;
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type ExportedChatInvites = {
  count: number; // int -> number;
  invites: TypeExportedChatInvite[]; // Api.TypeExportedChatInvite[] -> TypeExportedChatInvite[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type FavedStickers = {
  hash: string; // long -> string;
  packs: TypeStickerPack[]; // Api.TypeStickerPack[] -> TypeStickerPack[];
  stickers: TypeDocument[]; // Api.TypeDocument[] -> TypeDocument[];
};

export type FeaturedStickers = {
  // flags: null // null;
  premium?: boolean; // boolean;
  hash: string; // long -> string;
  count: number; // int -> number;
  sets: TypeStickerSetCovered[]; // Api.TypeStickerSetCovered[] -> TypeStickerSetCovered[];
  unread: string[]; // long[] -> string[];
};

export type FeaturedStickersNotModified = {
  count: number; // int -> number;
};

export type ForumTopics = {
  // flags: null // null;
  orderByCreateDate?: boolean; // boolean;
  count: number; // int -> number;
  topics: TypeForumTopic[]; // Api.TypeForumTopic[] -> TypeForumTopic[];
  messages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
  pts: number; // int -> number;
};

export type FoundStickers = {
  // flags: null // null;
  nextOffset?: number; // int -> number;
  hash: string; // long -> string;
  stickers: TypeDocument[]; // Api.TypeDocument[] -> TypeDocument[];
};

export type FoundStickerSets = {
  hash: string; // long -> string;
  sets: TypeStickerSetCovered[]; // Api.TypeStickerSetCovered[] -> TypeStickerSetCovered[];
};

export type FoundStickersNotModified = {
  // flags: null // null;
  nextOffset?: number; // int -> number;
};

export type HighScores = {
  scores: TypeHighScore[]; // Api.TypeHighScore[] -> TypeHighScore[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type HistoryImport = {
  id: string; // long -> string;
};

export type HistoryImportParsed = {
  // flags: null // null;
  pm?: boolean; // boolean;
  group?: boolean; // boolean;
  title?: string; // string;
};

export type InactiveChats = {
  dates: number[]; // int[] -> number[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type InvitedUsers = {
  updates: TypeUpdates; // Api.TypeUpdates -> TypeUpdates;
  missingInvitees: TypeMissingInvitee[]; // Api.TypeMissingInvitee[] -> TypeMissingInvitee[];
};

export type MessageEditData = {
  // flags: null // null;
  caption?: boolean; // boolean;
};

export type MessageReactionsList = {
  // flags: null // null;
  count: number; // int -> number;
  reactions: TypeMessagePeerReaction[]; // Api.TypeMessagePeerReaction[] -> TypeMessagePeerReaction[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
  nextOffset?: string; // string;
};

export type Messages = {
  messages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type MessagesNotModified = {
  count: number; // int -> number;
};

export type MessagesSlice = {
  // flags: null // null;
  inexact?: boolean; // boolean;
  count: number; // int -> number;
  nextRate?: number; // int -> number;
  offsetIdOffset?: number; // int -> number;
  messages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type MessageViews = {
  views: TypeMessageViews[]; // Api.TypeMessageViews[] -> TypeMessageViews[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type MyStickers = {
  count: number; // int -> number;
  sets: TypeStickerSetCovered[]; // Api.TypeStickerSetCovered[] -> TypeStickerSetCovered[];
};

export type PeerDialogs = {
  dialogs: TypeDialog[]; // Api.TypeDialog[] -> TypeDialog[];
  messages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
  state: TypeState; // updates.TypeState;
};

/** messages.PeerSettings — wrapper; TL constructor peerSettings stays in api-types. */
export type MessagesPeerSettings = {
  settings: TypePeerSettings; // Api.TypePeerSettings -> TypePeerSettings;
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type PreparedInlineMessage = {
  queryId: string; // long -> string;
  result: TypeBotInlineResult; // Api.TypeBotInlineResult -> TypeBotInlineResult;
  peerTypes: TypeInlineQueryPeerType[]; // Api.TypeInlineQueryPeerType[] -> TypeInlineQueryPeerType[];
  cacheTime: number; // int -> number;
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type QuickReplies = {
  quickReplies: TypeQuickReply[]; // Api.TypeQuickReply[] -> TypeQuickReply[];
  messages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type Reactions = {
  hash: string; // long -> string;
  reactions: TypeReaction[]; // Api.TypeReaction[] -> TypeReaction[];
};

export type RecentStickers = {
  hash: string; // long -> string;
  packs: TypeStickerPack[]; // Api.TypeStickerPack[] -> TypeStickerPack[];
  stickers: TypeDocument[]; // Api.TypeDocument[] -> TypeDocument[];
  dates: number[]; // int[] -> number[];
};

export type SavedDialogs = {
  dialogs: TypeSavedDialog[]; // Api.TypeSavedDialog[] -> TypeSavedDialog[];
  messages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type SavedDialogsNotModified = {
  count: number; // int -> number;
};

export type SavedDialogsSlice = {
  count: number; // int -> number;
  dialogs: TypeSavedDialog[]; // Api.TypeSavedDialog[] -> TypeSavedDialog[];
  messages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type SavedGifs = {
  hash: string; // long -> string;
  gifs: TypeDocument[]; // Api.TypeDocument[] -> TypeDocument[];
};

export type SavedReactionTags = {
  tags: TypeSavedReactionTag[]; // Api.TypeSavedReactionTag[] -> TypeSavedReactionTag[];
  hash: string; // long -> string;
};

export type SearchCounter = {
  // flags: null // null;
  inexact?: boolean; // boolean;
  filter: TypeMessagesFilter; // Api.TypeMessagesFilter -> TypeMessagesFilter;
  count: number; // int -> number;
};

export type SearchResultsCalendar = {
  // flags: null // null;
  inexact?: boolean; // boolean;
  count: number; // int -> number;
  minDate: number; // int -> number;
  minMsgId: number; // int -> number;
  offsetIdOffset?: number; // int -> number;
  periods: TypeSearchResultsCalendarPeriod[]; // Api.TypeSearchResultsCalendarPeriod[] -> TypeSearchResultsCalendarPeriod[];
  messages: TypeMessage[]; // Api.TypeMessage[] -> TypeMessage[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type SearchResultsPositions = {
  count: number; // int -> number;
  positions: TypeSearchResultsPosition[]; // Api.TypeSearchResultsPosition[] -> TypeSearchResultsPosition[];
};

export type SentEncryptedFile = {
  date: number; // int -> number;
  file: TypeEncryptedFile; // Api.TypeEncryptedFile -> TypeEncryptedFile;
};

export type SentEncryptedMessage = {
  date: number; // int -> number;
};

export type SponsoredMessages = {
  // flags: null // null;
  postsBetween?: number; // int -> number;
  messages: TypeSponsoredMessage[]; // Api.TypeSponsoredMessage[] -> TypeSponsoredMessage[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type Stickers = {
  hash: string; // long -> string;
  stickers: TypeDocument[]; // Api.TypeDocument[] -> TypeDocument[];
};

export type StickerSet = {
  set: TypeStickerSet; // Api.TypeStickerSet -> TypeStickerSet;
  packs: TypeStickerPack[]; // Api.TypeStickerPack[] -> TypeStickerPack[];
  keywords: TypeStickerKeyword[]; // Api.TypeStickerKeyword[] -> TypeStickerKeyword[];
  documents: TypeDocument[]; // Api.TypeDocument[] -> TypeDocument[];
};

export type StickerSetInstallResultArchive = {
  sets: TypeStickerSetCovered[]; // Api.TypeStickerSetCovered[] -> TypeStickerSetCovered[];
};

export type TranscribedAudio = {
  // flags: null // null;
  pending?: boolean; // boolean;
  transcriptionId: string; // long -> string;
  text: string; // string;
  trialRemainsNum?: number; // int -> number;
  trialRemainsUntilDate?: number; // int -> number;
};

export type TranslateResult = {
  result: TypeTextWithEntities[]; // Api.TypeTextWithEntities[] -> TypeTextWithEntities[];
};

export type VotesList = {
  // flags: null // null;
  count: number; // int -> number;
  votes: TypeMessagePeerVote[]; // Api.TypeMessagePeerVote[] -> TypeMessagePeerVote[];
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
  nextOffset?: string; // string;
};

export type WebPage = {
  webpage: TypeWebPage; // Api.TypeWebPage -> TypeWebPage;
  chats: TypeChat[]; // Api.TypeChat[] -> TypeChat[];
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type WebPagePreview = {
  media: TypeMessageMedia; // Api.TypeMessageMedia -> TypeMessageMedia;
  users: TypeUser[]; // Api.TypeUser[] -> TypeUser[];
};

export type TypeAffectedFoundMessages = AffectedFoundMessages; // messages.AffectedFoundMessages

export type TypeAffectedHistory = AffectedHistory; // messages.AffectedHistory

export type TypeAffectedMessages = AffectedMessages; // messages.AffectedMessages

export type TypeAllStickers = AllStickersNotModified | AllStickers; // messages.AllStickersNotModified | messages.AllStickers

export type TypeArchivedStickers = ArchivedStickers; // messages.ArchivedStickers

export type TypeAvailableEffects = AvailableEffectsNotModified | AvailableEffects; // messages.AvailableEffectsNotModified | messages.AvailableEffects

export type TypeAvailableReactions = AvailableReactionsNotModified | AvailableReactions; // messages.AvailableReactionsNotModified | messages.AvailableReactions

export type TypeMessagesBotApp = MessagesBotApp; // messages.BotApp

export type TypeBotCallbackAnswer = BotCallbackAnswer; // messages.BotCallbackAnswer

export type TypeBotPreparedInlineMessage = BotPreparedInlineMessage; // messages.BotPreparedInlineMessage

export type TypeBotResults = BotResults; // messages.BotResults

export type TypeChatAdminsWithInvites = ChatAdminsWithInvites; // messages.ChatAdminsWithInvites

export type TypeMessagesChatFull = MessagesChatFull; // messages.ChatFull

export type TypeChatInviteImporters = ChatInviteImporters; // messages.ChatInviteImporters

export type TypeChats = Chats | ChatsSlice; // messages.Chats | messages.ChatsSlice

export type TypeCheckedHistoryImportPeer = CheckedHistoryImportPeer; // messages.CheckedHistoryImportPeer

export type TypeDhConfig = DhConfigNotModified | DhConfig; // messages.DhConfigNotModified | messages.DhConfig

export type TypeDialogFilters = DialogFilters; // messages.DialogFilters

export type TypeDialogs = Dialogs | DialogsSlice | DialogsNotModified; // messages.Dialogs | messages.DialogsSlice | messages.DialogsNotModified

export type TypeDiscussionMessage = DiscussionMessage; // messages.DiscussionMessage

export type TypeEmojiGroups = EmojiGroupsNotModified | EmojiGroups; // messages.EmojiGroupsNotModified | messages.EmojiGroups

export type TypeMessagesExportedChatInvite =
  | MessagesExportedChatInvite
  | MessagesExportedChatInviteReplaced; // messages.ExportedChatInvite | messages.ExportedChatInviteReplaced

export type TypeExportedChatInvites = ExportedChatInvites; // messages.ExportedChatInvites

export type TypeFavedStickers = FavedStickersNotModified | FavedStickers; // messages.FavedStickersNotModified | messages.FavedStickers

export type TypeFeaturedStickers = FeaturedStickersNotModified | FeaturedStickers; // messages.FeaturedStickersNotModified | messages.FeaturedStickers

export type TypeForumTopics = ForumTopics; // messages.ForumTopics

export type TypeFoundStickers = FoundStickersNotModified | FoundStickers; // messages.FoundStickersNotModified | messages.FoundStickers

export type TypeFoundStickerSets = FoundStickerSetsNotModified | FoundStickerSets; // messages.FoundStickerSetsNotModified | messages.FoundStickerSets

export type TypeHighScores = HighScores; // messages.HighScores

export type TypeHistoryImport = HistoryImport; // messages.HistoryImport

export type TypeHistoryImportParsed = HistoryImportParsed; // messages.HistoryImportParsed

export type TypeInactiveChats = InactiveChats; // messages.InactiveChats

export type TypeInvitedUsers = InvitedUsers; // messages.InvitedUsers

export type TypeMessageEditData = MessageEditData; // messages.MessageEditData

export type TypeMessageReactionsList = MessageReactionsList; // messages.MessageReactionsList

export type TypeMessages = Messages | MessagesSlice | ChannelMessages | MessagesNotModified; // messages.Messages | messages.MessagesSlice | messages.ChannelMessages | messages.MessagesNotModified

export type TypeMessageViews = MessageViews; // messages.MessageViews

export type TypeMyStickers = MyStickers; // messages.MyStickers

export type TypePeerDialogs = PeerDialogs; // messages.PeerDialogs

export type TypeMessagesPeerSettings = MessagesPeerSettings; // messages.PeerSettings

export type TypePreparedInlineMessage = PreparedInlineMessage; // messages.PreparedInlineMessage

export type TypeQuickReplies = QuickReplies | QuickRepliesNotModified; // messages.QuickReplies | messages.QuickRepliesNotModified

export type TypeReactions = ReactionsNotModified | Reactions; // messages.ReactionsNotModified | messages.Reactions

export type TypeRecentStickers = RecentStickersNotModified | RecentStickers; // messages.RecentStickersNotModified | messages.RecentStickers

export type TypeSavedDialogs = SavedDialogs | SavedDialogsSlice | SavedDialogsNotModified; // messages.SavedDialogs | messages.SavedDialogsSlice | messages.SavedDialogsNotModified

export type TypeSavedGifs = SavedGifsNotModified | SavedGifs; // messages.SavedGifsNotModified | messages.SavedGifs

export type TypeSavedReactionTags = SavedReactionTagsNotModified | SavedReactionTags; // messages.SavedReactionTagsNotModified | messages.SavedReactionTags

export type TypeSearchCounter = SearchCounter; // messages.SearchCounter

export type TypeSearchResultsCalendar = SearchResultsCalendar; // messages.SearchResultsCalendar

export type TypeSearchResultsPositions = SearchResultsPositions; // messages.SearchResultsPositions

export type TypeSentEncryptedMessage = SentEncryptedMessage | SentEncryptedFile; // messages.SentEncryptedMessage | messages.SentEncryptedFile

export type TypeSponsoredMessages = SponsoredMessages | SponsoredMessagesEmpty; // messages.SponsoredMessages | messages.SponsoredMessagesEmpty

export type TypeStickers = StickersNotModified | Stickers; // messages.StickersNotModified | messages.Stickers

export type TypeStickerSet = StickerSet | StickerSetNotModified; // messages.StickerSet | messages.StickerSetNotModified

export type TypeStickerSetInstallResult =
  | StickerSetInstallResultSuccess
  | StickerSetInstallResultArchive; // messages.StickerSetInstallResultSuccess | messages.StickerSetInstallResultArchive

export type TypeTranscribedAudio = TranscribedAudio; // messages.TranscribedAudio

export type TypeTranslatedText = TranslateResult; // messages.TranslateResult

export type TypeVotesList = VotesList; // messages.VotesList

export type TypeWebPage = {
  hasLargeMedia?: boolean;
  id: string;
  url: string;
  displayUrl: string;
  hash: number;
  type?: string;
  siteName?: string;
  title?: string;
  description?: string;
  photo?: Photo;
  embedUrl?: string;
  embedType?: string;
  embedWidth?: number;
  embedHeight?: number;
  duration?: number;
  author?: string;
  document?: Document;
  cachedPage?: Page;
  attributes?: TypeWebPageAttribute[];
}; // messages.WebPage

export type TypeWebPagePreview = WebPagePreview; // messages.WebPagePreview
