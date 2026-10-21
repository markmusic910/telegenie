 
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { WebPagePreview } from './messages';
import { MegagroupStats } from './stats';
import type {
  TypeUser,
  TypeUsername,
  TypeUserProfilePhoto,
  TypeUserStatus,
} from './users';

export type {
  User,
  UserEmpty,
  UserFull,
  Username,
  UserProfilePhoto,
  UserStatusEmpty,
  UserStatusLastMonth,
  UserStatusLastWeek,
  UserStatusOffline,
  UserStatusOnline,
  UserStatusRecently,
  UserFullResult,
  Users,
  UsersSlice,
  TypeUser,
  TypeUserFull,
  TypeUsername,
  TypeUserProfilePhoto,
  TypeUsers,
  TypeUserStatus,
} from './users';

export type {
  Document,
  DocumentEmpty,
  DocumentAttributeAudio,
  DocumentAttributeCustomEmoji,
  DocumentAttributeFilename,
  DocumentAttributeImageSize,
  DocumentAttributeSticker,
  DocumentAttributeVideo,
  DocumentAttributeAnimated,
  DocumentAttributeHasStickers,
  TypeDocument,
  TypeDocumentAttribute,
  MaskCoords,
  TypeMaskCoords,
  Photo,
  PhotoEmpty,
  PhotoCachedSize,
  PhotoPathSize,
  PhotoSize,
  PhotoSizeEmpty,
  PhotoSizeProgressive,
  PhotoStrippedSize,
  TypePhoto,
  TypePhotoSize,
  VideoSize,
  VideoSizeEmojiMarkup,
  VideoSizeStickerMarkup,
  TypeVideoSize,
  InputStickerSetDice,
  InputStickerSetID,
  InputStickerSetShortName,
  InputStickerSetEmpty,
  InputStickerSetAnimatedEmoji,
  InputStickerSetAnimatedEmojiAnimations,
  InputStickerSetPremiumGifts,
  InputStickerSetEmojiGenericAnimations,
  InputStickerSetEmojiDefaultStatuses,
  InputStickerSetEmojiDefaultTopicIcons,
  InputStickerSetEmojiChannelDefaultStatuses,
  TypeInputStickerSet,
} from './file';

export type {
  ChatEmpty,
  Chat,
  ChatForbidden,
  ChatFull,
  ChatPhoto,
  ChatPhotoEmpty,
  ChatAdminRights,
  ChatBannedRights,
  ChatAdminWithInvites,
  ChatParticipant,
  ChatParticipantAdmin,
  ChatParticipantCreator,
  ChatParticipants,
  ChatParticipantsForbidden,
  ChatInvite,
  ChatInviteAlready,
  ChatInvitePeek,
  ChatInviteExported,
  ChatInviteImporter,
  ChatOnlines,
  ChatReactionsAll,
  ChatReactionsSome,
  ChatReactionsNone,
  ChatTheme,
  TypeChat,
  TypeChatFull,
  TypeChatPhoto,
  TypeChatAdminRights,
  TypeChatBannedRights,
  TypeChatAdminWithInvites,
  TypeChatParticipant,
  TypeChatParticipants,
  TypeChatInvite,
  TypeChatInviteImporter,
  TypeChatInviteExported,
  TypeChatOnlines,
  TypeChatReactions,
  TypeChatTheme,
} from './chats';

export type {
  Channel,
  ChannelForbidden,
  ChannelFull,
  ChannelLocation,
  ChannelLocationEmpty,
  ChannelMessagesFilter,
  ChannelMessagesFilterEmpty,
  ChannelParticipant,
  ChannelParticipantAdmin,
  ChannelParticipantBanned,
  ChannelParticipantCreator,
  ChannelParticipantLeft,
  ChannelParticipantSelf,
  ChannelParticipantsBanned,
  ChannelParticipantsContacts,
  ChannelParticipantsKicked,
  ChannelParticipantsMentions,
  ChannelParticipantsSearch,
  ChannelParticipantsRecent,
  ChannelParticipantsAdmins,
  ChannelParticipantsBots,
  TypeChannel,
  TypeChannelFull,
  TypeChannelLocation,
  TypeChannelMessagesFilter,
  TypeChannelParticipant,
  TypeChannelParticipantsFilter,
  ChannelAdminLogEvent,
  ChannelAdminLogEventActionChangeAbout,
  ChannelAdminLogEventActionChangeAvailableReactions,
  ChannelAdminLogEventActionChangeEmojiStatus,
  ChannelAdminLogEventActionChangeEmojiStickerSet,
  ChannelAdminLogEventActionChangeHistoryTTL,
  ChannelAdminLogEventActionChangeLinkedChat,
  ChannelAdminLogEventActionChangeLocation,
  ChannelAdminLogEventActionChangePeerColor,
  ChannelAdminLogEventActionChangePhoto,
  ChannelAdminLogEventActionChangeProfilePeerColor,
  ChannelAdminLogEventActionChangeStickerSet,
  ChannelAdminLogEventActionChangeTitle,
  ChannelAdminLogEventActionChangeUsername,
  ChannelAdminLogEventActionChangeUsernames,
  ChannelAdminLogEventActionChangeWallpaper,
  ChannelAdminLogEventActionCreateTopic,
  ChannelAdminLogEventActionDefaultBannedRights,
  ChannelAdminLogEventActionDeleteMessage,
  ChannelAdminLogEventActionDeleteTopic,
  ChannelAdminLogEventActionDiscardGroupCall,
  ChannelAdminLogEventActionEditMessage,
  ChannelAdminLogEventActionEditTopic,
  ChannelAdminLogEventActionExportedInviteDelete,
  ChannelAdminLogEventActionExportedInviteEdit,
  ChannelAdminLogEventActionExportedInviteRevoke,
  ChannelAdminLogEventActionParticipantInvite,
  ChannelAdminLogEventActionParticipantJoin,
  ChannelAdminLogEventActionParticipantJoinByInvite,
  ChannelAdminLogEventActionParticipantJoinByRequest,
  ChannelAdminLogEventActionParticipantLeave,
  ChannelAdminLogEventActionParticipantMute,
  ChannelAdminLogEventActionParticipantSubExtend,
  ChannelAdminLogEventActionParticipantToggleAdmin,
  ChannelAdminLogEventActionParticipantToggleBan,
  ChannelAdminLogEventActionParticipantUnmute,
  ChannelAdminLogEventActionParticipantVolume,
  ChannelAdminLogEventActionPinTopic,
  ChannelAdminLogEventActionSendMessage,
  ChannelAdminLogEventActionStartGroupCall,
  ChannelAdminLogEventActionStopPoll,
  ChannelAdminLogEventActionToggleAntiSpam,
  ChannelAdminLogEventActionToggleForum,
  ChannelAdminLogEventActionToggleGroupCallSetting,
  ChannelAdminLogEventActionToggleInvites,
  ChannelAdminLogEventActionToggleNoForwards,
  ChannelAdminLogEventActionTogglePreHistoryHidden,
  ChannelAdminLogEventActionToggleSignatureProfiles,
  ChannelAdminLogEventActionToggleSignatures,
  ChannelAdminLogEventActionToggleSlowMode,
  ChannelAdminLogEventActionUpdatePinned,
  ChannelAdminLogEventsFilter,
  TypeChannelAdminLogEvent,
  TypeChannelAdminLogEventAction,
  TypeChannelAdminLogEventsFilter,
  TypeChannelParticipants,
  TypeAdminLogResults,
  TypeChannelsChannelParticipant,
  TypeSendAsPeers,
  TypeSponsoredMessageReportResult,
} from './channels';


export type {
  InputPeerEmpty,
  InputPeerSelf,
  InputPeerChat,
  InputPeerUser,
  InputPeerChannel,
  InputPeerUserFromMessage,
  InputPeerChannelFromMessage,
  TypeInputPeer,
  InputUserEmpty,
  InputUserSelf,
  InputUser,
  InputUserFromMessage,
  TypeInputUser,
  InputPhoneContact,
  TypeInputContact,
  InputFile,
  InputFileBig,
  InputFileStoryDocument,
  TypeInputFile,
  InputPhotoEmpty,
  InputPhoto,
  TypeInputPhoto,
  InputDocumentEmpty,
  InputDocument,
  TypeInputDocument,
  InputGeoPointEmpty,
  InputGeoPoint,
  TypeInputGeoPoint,
  InputChatPhotoEmpty,
  InputChatUploadedPhoto,
  InputChatPhoto,
  TypeInputChatPhoto,
  InputMediaUploadedPhoto,
  InputMediaPhoto,
  InputMediaGeoPoint,
  InputMediaContact,
  InputMediaUploadedDocument,
  InputMediaDocument,
  InputMediaVenue,
  InputMediaPhotoExternal,
  InputMediaDocumentExternal,
  InputMediaGame,
  InputMediaInvoice,
  InputMediaGeoLive,
  InputMediaPoll,
  InputMediaDice,
  InputMediaStory,
  InputMediaWebPage,
  InputMediaPaidMedia,
  TypeInputMedia,
  InputFileLocation,
  InputEncryptedFileLocation,
  InputDocumentFileLocation,
  InputSecureFileLocation,
  InputTakeoutFileLocation,
  InputPhotoFileLocation,
  InputPhotoLegacyFileLocation,
  InputPeerPhotoFileLocation,
  InputStickerSetThumb,
  InputGroupCallStream,
  TypeInputFileLocation,
} from './input';


export type AccessPointRule = {
  phonePrefixRules: string; // string;
  dcId: number; // int -> number;
  ips: TypeIpPort; // Api.TypeIpPort[];
};

export type AccountDaysTTL = {
  days: number; // int -> number;
};

export type AttachMenuBot = {
  // flags: null // null;
  inactive?: boolean; // boolean;
  hasSettings?: boolean; // boolean;
  requestWriteAccess?: boolean; // boolean;
  showInAttachMenu?: boolean; // boolean;
  showInSideMenu?: boolean; // boolean;
  sideMenuDisclaimerNeeded?: boolean; // boolean;
  botId: string; // long -> string;
  shortName: string; // string;
  peerTypes?: TypeAttachMenuPeerType; // Api.TypeAttachMenuPeerType[];
  icons: TypeAttachMenuBotIcon; // Api.TypeAttachMenuBotIcon[];
};

export type AttachMenuBotIcon = {
  // flags: null // null;
  name: string; // string;
  icon: TypeDocument; // Api.TypeDocument -> TypeDocument;
  colors?: TypeAttachMenuBotIconColor; // Api.TypeAttachMenuBotIconColor[];
};

export type AttachMenuBotIconColor = {
  name: string; // string;
  color: number; // int -> number;
};

export type AttachMenuBots = {
  hash: string; // long -> string;
  bots: TypeAttachMenuBot; // Api.TypeAttachMenuBot[];
  users: TypeUser; // Api.TypeUser[];
};

export type AttachMenuBotsBot = {
  bot: TypeAttachMenuBot; // Api.TypeAttachMenuBot -> TypeAttachMenuBot;
  users: TypeUser; // Api.TypeUser[];
};

export type AutoDownloadSettings = {
  // flags: null // null;
  disabled?: boolean; // boolean;
  videoPreloadLarge?: boolean; // boolean;
  audioPreloadNext?: boolean; // boolean;
  phonecallsLessData?: boolean; // boolean;
  storiesPreload?: boolean; // boolean;
  photoSizeMax: number; // int -> number;
  videoSizeMax: string; // long -> string;
  fileSizeMax: string; // long -> string;
  videoUploadMaxbitrate: number; // int -> number;
  smallQueueActiveOperationsMax: number; // int -> number;
  largeQueueActiveOperationsMax: number; // int -> number;
};

export type AutoSaveException = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  settings: TypeAutoSaveSettings; // Api.TypeAutoSaveSettings -> TypeAutoSaveSettings;
};

export type AutoSaveSettings = {
  // flags: null // null;
  photos?: boolean; // boolean;
  videos?: boolean; // boolean;
  videoMaxSize?: string; // long -> string;
};

export type AvailableEffect = {
  // flags: null // null;
  premiumRequired?: boolean; // boolean;
  id: string; // long -> string;
  emoticon: string; // string;
  staticIconId?: string; // long -> string;
  effectStickerId: string; // long -> string;
  effectAnimationId?: string; // long -> string;
};

export type AvailableReaction = {
  // flags: null // null;
  inactive?: boolean; // boolean;
  premium?: boolean; // boolean;
  reaction: string; // string;
  title: string; // string;
  staticIcon: TypeDocument; // Api.TypeDocument -> TypeDocument;
  appearAnimation: TypeDocument; // Api.TypeDocument -> TypeDocument;
  selectAnimation: TypeDocument; // Api.TypeDocument -> TypeDocument;
  activateAnimation: TypeDocument; // Api.TypeDocument -> TypeDocument;
  effectAnimation: TypeDocument; // Api.TypeDocument -> TypeDocument;
  aroundAnimation?: TypeDocument; // Api.TypeDocument -> TypeDocument;
  centerIcon?: TypeDocument; // Api.TypeDocument -> TypeDocument;
};

export type BadMsgNotification = {
  badMsgId: string; // long -> string;
  badMsgSeqno: number; // int -> number;
  errorCode: number; // int -> number;
};

export type BadServerSalt = {
  badMsgId: string; // long -> string;
  badMsgSeqno: number; // int -> number;
  errorCode: number; // int -> number;
  newServerSalt: string; // long -> string;
};

export type BankCardOpenUrl = {
  url: string; // string;
  name: string; // string;
};

export type BindAuthKeyInner = {
  nonce: string; // long -> string;
  tempAuthKeyId: string; // long -> string;
  permAuthKeyId: string; // long -> string;
  tempSessionId: string; // long -> string;
  expiresAt: number; // int -> number;
};

export type Birthday = {
  // flags: null // null;
  day: number; // int -> number;
  month: number; // int -> number;
  year?: number; // int -> number;
};

export type Boost = {
  // flags: null // null;
  gift?: boolean; // boolean;
  giveaway?: boolean; // boolean;
  unclaimed?: boolean; // boolean;
  id: string; // string;
  userId?: string; // long -> string;
  giveawayMsgId?: number; // int -> number;
  date: number; // int -> number;
  expires: number; // int -> number;
  usedGiftSlug?: string; // string;
  multiplier?: number; // int -> number;
  stars?: string; // long -> string;
};

export type BotApp = {
  // flags: null // null;
  id: string; // long -> string;
  accessHash: string; // long -> string;
  shortName: string; // string;
  title: string; // string;
  description: string; // string;
  photo: TypePhoto; // Api.TypePhoto -> TypePhoto;
  document?: TypeDocument; // Api.TypeDocument -> TypeDocument;
  hash: string; // long -> string;
};

export type BotAppSettings = {
  // flags: null // null;
  placeholderPath?: Uint8Array; // bytes -> Uint8Array;
  backgroundColor?: number; // int -> number;
  backgroundDarkColor?: number; // int -> number;
  headerColor?: number; // int -> number;
  headerDarkColor?: number; // int -> number;
};

export type BotBusinessConnection = {
  // flags: null // null;
  canReply?: boolean; // boolean;
  disabled?: boolean; // boolean;
  connectionId: string; // string;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  dcId: number; // int -> number;
  date: number; // int -> number;
};

export type BotCommand = {
  command: string; // string;
  description: string; // string;
};

export type BotCommandScopePeer = {
  peer: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
};

export type BotCommandScopePeerAdmins = {
  peer: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
};

export type BotCommandScopePeerUser = {
  peer: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
  userId: TypeInputUser; // Api.TypeInputUser -> TypeInputUser;
};

export type BotInfo = {
  // flags: null // null;
  hasPreviewMedias?: boolean; // boolean;
  userId?: string; // long -> string;
  description?: string; // string;
  descriptionPhoto?: TypePhoto; // Api.TypePhoto -> TypePhoto;
  descriptionDocument?: TypeDocument; // Api.TypeDocument -> TypeDocument;
  commands?: TypeBotCommand[]; // Api.TypeBotCommand[];
  menuButton?: TypeBotMenuButton; // Api.TypeBotMenuButton -> TypeBotMenuButton;
  privacyPolicyUrl?: string; // string;
  appSettings?: TypeBotAppSettings; // Api.TypeBotAppSettings -> TypeBotAppSettings;
  verifierSettings?: TypeBotVerifierSettings; // Api.TypeBotVerifierSettings -> TypeBotVerifierSettings;
};

export type BotInlineMediaResult = {
  // flags: null // null;
  id: string; // string;
  type: string; // string;
  photo?: TypePhoto; // Api.TypePhoto -> TypePhoto;
  document?: TypeDocument; // Api.TypeDocument -> TypeDocument;
  title?: string; // string;
  description?: string; // string;
  sendMessage: TypeBotInlineMessage; // Api.TypeBotInlineMessage -> TypeBotInlineMessage;
};

export type BotInlineMessageMediaAuto = {
  // flags: null // null;
  invertMedia?: boolean; // boolean;
  message: string; // string;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  replyMarkup?: TypeReplyMarkup; // Api.TypeReplyMarkup -> TypeReplyMarkup;
};

export type BotInlineMessageMediaContact = {
  // flags: null // null;
  phoneNumber: string; // string;
  firstName: string; // string;
  lastName: string; // string;
  vcard: string; // string;
  replyMarkup?: TypeReplyMarkup; // Api.TypeReplyMarkup -> TypeReplyMarkup;
};

export type BotInlineMessageMediaGeo = {
  // flags: null // null;
  geo: TypeGeoPoint; // Api.TypeGeoPoint -> TypeGeoPoint;
  heading?: number; // int -> number;
  period?: number; // int -> number;
  proximityNotificationRadius?: number; // int -> number;
  replyMarkup?: TypeReplyMarkup; // Api.TypeReplyMarkup -> TypeReplyMarkup;
};

export type BotInlineMessageMediaInvoice = {
  // flags: null // null;
  shippingAddressRequested?: boolean; // boolean;
  test?: boolean; // boolean;
  title: string; // string;
  description: string; // string;
  photo?: TypeWebDocument; // Api.TypeWebDocument -> TypeWebDocument;
  currency: string; // string;
  totalAmount: string; // long -> string;
  replyMarkup?: TypeReplyMarkup; // Api.TypeReplyMarkup -> TypeReplyMarkup;
};

export type BotInlineMessageMediaVenue = {
  // flags: null // null;
  geo: TypeGeoPoint; // Api.TypeGeoPoint -> TypeGeoPoint;
  title: string; // string;
  address: string; // string;
  provider: string; // string;
  venueId: string; // string;
  venueType: string; // string;
  replyMarkup?: TypeReplyMarkup; // Api.TypeReplyMarkup -> TypeReplyMarkup;
};

export type BotInlineMessageMediaWebPage = {
  // flags: null // null;
  invertMedia?: boolean; // boolean;
  forceLargeMedia?: boolean; // boolean;
  forceSmallMedia?: boolean; // boolean;
  manual?: boolean; // boolean;
  safe?: boolean; // boolean;
  message: string; // string;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  url: string; // string;
  replyMarkup?: TypeReplyMarkup; // Api.TypeReplyMarkup -> TypeReplyMarkup;
};

export type BotInlineMessageText = {
  // flags: null // null;
  noWebpage?: boolean; // boolean;
  invertMedia?: boolean; // boolean;
  message: string; // string;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  replyMarkup?: TypeReplyMarkup; // Api.TypeReplyMarkup -> TypeReplyMarkup;
};

export type BotInlineResult = {
  // flags: null // null;
  id: string; // string;
  type: string; // string;
  title?: string; // string;
  description?: string; // string;
  url?: string; // string;
  thumb?: TypeWebDocument; // Api.TypeWebDocument -> TypeWebDocument;
  content?: TypeWebDocument; // Api.TypeWebDocument -> TypeWebDocument;
  sendMessage: TypeBotInlineMessage; // Api.TypeBotInlineMessage -> TypeBotInlineMessage;
};

export type BotMenuButton = {
  text: string; // string;
  url: string; // string;
};

export type BotPreviewMedia = {
  date: number; // int -> number;
  media: TypeMessageMedia; // Api.TypeMessageMedia -> TypeMessageMedia;
};

export type BotVerification = {
  botId: string; // long -> string;
  icon: string; // long -> string;
  description: string; // string;
};

export type BotVerifierSettings = {
  // flags: null // null;
  canModifyCustomDescription?: boolean; // boolean;
  icon: string; // long -> string;
  company: string; // string;
  customDescription?: string; // string;
};

export type BroadcastRevenueBalances = {
  // flags: null // null;
  withdrawalEnabled?: boolean; // boolean;
  currentBalance: string; // long -> string;
  availableBalance: string; // long -> string;
  overallRevenue: string; // long -> string;
};

export type BroadcastRevenueTransactionProceeds = {
  amount: string; // long -> string;
  fromDate: number; // int -> number;
  toDate: number; // int -> number;
};

export type BroadcastRevenueTransactionRefund = {
  amount: string; // long -> string;
  date: number; // int -> number;
  provider: string; // string;
};

export type BroadcastRevenueTransactionWithdrawal = {
  // flags: null // null;
  pending?: boolean; // boolean;
  failed?: boolean; // boolean;
  amount: string; // long -> string;
  date: number; // int -> number;
  provider: string; // string;
  transactionDate?: number; // int -> number;
  transactionUrl?: string; // string;
};

export type BusinessAwayMessage = {
  // flags: null // null;
  offlineOnly?: boolean; // boolean;
  shortcutId: number; // int -> number;
  schedule: TypeBusinessAwayMessageSchedule; // Api.TypeBusinessAwayMessageSchedule -> TypeBusinessAwayMessageSchedule;
  recipients: TypeBusinessRecipients; // Api.TypeBusinessRecipients -> TypeBusinessRecipients;
};

export type BusinessAwayMessageScheduleCustom = {
  startDate: number; // int -> number;
  endDate: number; // int -> number;
};

export type BusinessBotRecipients = {
  // flags: null // null;
  existingChats?: boolean; // boolean;
  newChats?: boolean; // boolean;
  contacts?: boolean; // boolean;
  nonContacts?: boolean; // boolean;
  excludeSelected?: boolean; // boolean;
  users?: string[]; // long[] -> string[];
  excludeUsers?: string[]; // long[] -> string[];
};

export type BusinessChatLink = {
  // flags: null // null;
  link: string; // string;
  message: string; // string;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  title?: string; // string;
  views: number; // int -> number;
};

export type BusinessGreetingMessage = {
  shortcutId: number; // int -> number;
  recipients: TypeBusinessRecipients; // Api.TypeBusinessRecipients -> TypeBusinessRecipients;
  noActivityDays: number; // int -> number;
};

export type BusinessIntro = {
  // flags: null // null;
  title: string; // string;
  description: string; // string;
  sticker?: TypeDocument; // Api.TypeDocument -> TypeDocument;
};

export type BusinessLocation = {
  // flags: null // null;
  geoPoint?: TypeGeoPoint; // Api.TypeGeoPoint -> TypeGeoPoint;
  address: string; // string;
};

export type BusinessRecipients = {
  // flags: null // null;
  existingChats?: boolean; // boolean;
  newChats?: boolean; // boolean;
  contacts?: boolean; // boolean;
  nonContacts?: boolean; // boolean;
  excludeSelected?: boolean; // boolean;
  users?: string[]; // long[] -> string[];
};

export type BusinessWeeklyOpen = {
  startMinute: number; // int -> number;
  endMinute: number; // int -> number;
};

export type BusinessWorkHours = {
  // flags: null // null;
  openNow?: boolean; // boolean;
  timezoneId: string; // string;
  weeklyOpen: TypeBusinessWeeklyOpen[]; // Api.TypeBusinessWeeklyOpen[];
};

export type CdnConfig = {
  publicKeys: TypeCdnPublicKey[]; // Api.TypeCdnPublicKey[];
};

export type CdnPublicKey = {
  dcId: number; // int -> number;
  publicKey: string; // string;
};

export type ClientDHInnerData = {
  nonce: string; // int128 -> string;
  serverNonce: string; // int128 -> string;
  retryId: string; // long -> string;
  gB: Uint8Array; // bytes -> Uint8Array;
};

export type CodeSettings = {
  // flags: null // null;
  allowFlashcall?: boolean; // boolean;
  currentNumber?: boolean; // boolean;
  allowAppHash?: boolean; // boolean;
  allowMissedCall?: boolean; // boolean;
  allowFirebase?: boolean; // boolean;
  unknownNumber?: boolean; // boolean;
  logoutTokens?: Uint8Array[]; // bytes[] -> Uint8Array[];
  token?: string; // string;
  appSandbox?: boolean; // Bool -> boolean;
};

export type Config = {
  // flags: null // null;
  defaultP2pContacts?: boolean; // boolean;
  preloadFeaturedStickers?: boolean; // boolean;
  revokePmInbox?: boolean; // boolean;
  blockedMode?: boolean; // boolean;
  forceTryIpv6?: boolean; // boolean;
  date: number; // int -> number;
  expires: number; // int -> number;
  testMode: boolean; // Bool -> boolean;
  thisDc: number; // int -> number;
  dcOptions: TypeDcOption[]; // Api.TypeDcOption[];
  dcTxtDomainName: string; // string;
  chatSizeMax: number; // int -> number;
  megagroupSizeMax: number; // int -> number;
  forwardedCountMax: number; // int -> number;
  onlineUpdatePeriodMs: number; // int -> number;
  offlineBlurTimeoutMs: number; // int -> number;
  offlineIdleTimeoutMs: number; // int -> number;
  onlineCloudTimeoutMs: number; // int -> number;
  notifyCloudDelayMs: number; // int -> number;
  notifyDefaultDelayMs: number; // int -> number;
  pushChatPeriodMs: number; // int -> number;
  pushChatLimit: number; // int -> number;
  editTimeLimit: number; // int -> number;
  revokeTimeLimit: number; // int -> number;
  revokePmTimeLimit: number; // int -> number;
  ratingEDecay: number; // int -> number;
  stickersRecentLimit: number; // int -> number;
  channelsReadMediaPeriod: number; // int -> number;
  tmpSessions?: number; // int -> number;
  callReceiveTimeoutMs: number; // int -> number;
  callRingTimeoutMs: number; // int -> number;
  callConnectTimeoutMs: number; // int -> number;
  callPacketTimeoutMs: number; // int -> number;
  meUrlPrefix: string; // string;
  autoupdateUrlPrefix?: string; // string;
  gifSearchUsername?: string; // string;
  venueSearchUsername?: string; // string;
  imgSearchUsername?: string; // string;
  staticMapsProvider?: string; // string;
  captionLengthMax: number; // int -> number;
  messageLengthMax: number; // int -> number;
  webfileDcId: number; // int -> number;
  suggestedLangCode?: string; // string;
  langPackVersion?: number; // int -> number;
  baseLangPackVersion?: number; // int -> number;
  reactionsDefault?: TypeReaction; // Api.TypeReaction -> TypeReaction;
  autologinToken?: string; // string;
};

export type ConnectedBot = {
  // flags: null // null;
  canReply?: boolean; // boolean;
  botId: string; // long -> string;
  recipients: TypeBusinessBotRecipients; // Api.TypeBusinessBotRecipients -> TypeBusinessBotRecipients;
};

export type ConnectedBotStarRef = {
  // flags: null // null;
  revoked?: boolean; // boolean;
  url: string; // string;
  date: number; // int -> number;
  botId: string; // long -> string;
  commissionPermille: number; // int -> number;
  durationMonths?: number; // int -> number;
  participants: string; // long -> string;
  revenue: string; // long -> string;
};

export type Contact = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  mutual: boolean; // Bool -> boolean;
};

export type ContactBirthday = {
  contactId: string; // long -> string;
  birthday: TypeBirthday; // Api.TypeBirthday -> TypeBirthday;
};

export type ContactStatus = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  status: TypeUserStatus; // Api.TypeUserStatus -> TypeUserStatus;
};

export type DataJSON = {
  data: string; // string;
};

export type DcOption = {
  // flags: null // null;
  ipv6?: boolean; // boolean;
  mediaOnly?: boolean; // boolean;
  tcpoOnly?: boolean; // boolean;
  cdn?: boolean; // boolean;
  static?: boolean; // boolean;
  thisPortOnly?: boolean; // boolean;
  id: number; // int -> number;
  ipAddress: string; // string;
  port: number; // int -> number;
  secret?: Uint8Array; // bytes -> Uint8Array;
};

export type DefaultHistoryTTL = {
  period: number; // int -> number;
};

export type DestroySessionNone = {
  sessionId: string; // long -> string;
};

export type DestroySessionOk = {
  sessionId: string; // long -> string;
};

export type DhGenFail = {
  nonce: string; // int128 -> string;
  serverNonce: string; // int128 -> string;
  newNonceHash3: string; // int128 -> string;
};

export type DhGenOk = {
  nonce: string; // int128 -> string;
  serverNonce: string; // int128 -> string;
  newNonceHash1: string; // int128 -> string;
};

export type DhGenRetry = {
  nonce: string; // int128 -> string;
  serverNonce: string; // int128 -> string;
  newNonceHash2: string; // int128 -> string;
};

export type Dialog = {
  // flags: null // null;
  pinned?: boolean; // boolean;
  unreadMark?: boolean; // boolean;
  viewForumAsMessages?: boolean; // boolean;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  topMessage: number; // int -> number;
  readInboxMaxId: number; // int -> number;
  readOutboxMaxId: number; // int -> number;
  unreadCount: number; // int -> number;
  unreadMentionsCount: number; // int -> number;
  unreadReactionsCount: number; // int -> number;
  notifySettings: TypePeerNotifySettings; // Api.TypePeerNotifySettings -> TypePeerNotifySettings;
  pts?: number; // int -> number;
  draft?: TypeDraftMessage; // Api.TypeDraftMessage -> TypeDraftMessage;
  folderId?: number; // int -> number;
  ttlPeriod?: number; // int -> number;
};

export type DialogFilter = {
  // flags: null // null;
  contacts?: boolean; // boolean;
  nonContacts?: boolean; // boolean;
  groups?: boolean; // boolean;
  broadcasts?: boolean; // boolean;
  bots?: boolean; // boolean;
  excludeMuted?: boolean; // boolean;
  excludeRead?: boolean; // boolean;
  excludeArchived?: boolean; // boolean;
  titleNoanimate?: boolean; // boolean;
  id: number; // int -> number;
  title: TypeTextWithEntities; // Api.TypeTextWithEntities -> TypeTextWithEntities;
  emoticon?: string; // string;
  color?: number; // int -> number;
  pinnedPeers: TypeInputPeer[]; // Api.TypeInputPeer[];
  includePeers: TypeInputPeer[]; // Api.TypeInputPeer[];
  excludePeers: TypeInputPeer[]; // Api.TypeInputPeer[];
};

export type DialogFilterChatlist = {
  // flags: null // null;
  hasMyInvites?: boolean; // boolean;
  titleNoanimate?: boolean; // boolean;
  id: number; // int -> number;
  title: TypeTextWithEntities; // Api.TypeTextWithEntities -> TypeTextWithEntities;
  emoticon?: string; // string;
  color?: number; // int -> number;
  pinnedPeers: TypeInputPeer[]; // Api.TypeInputPeer[];
  includePeers: TypeInputPeer[]; // Api.TypeInputPeer[];
};

export type DialogFilterSuggested = {
  filter: TypeDialogFilter; // Api.TypeDialogFilter -> TypeDialogFilter;
  description: string; // string;
};

export type DialogFolder = {
  // flags: null // null;
  pinned?: boolean; // boolean;
  folder: TypeFolder; // Api.TypeFolder -> TypeFolder;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  topMessage: number; // int -> number;
  unreadMutedPeersCount: number; // int -> number;
  unreadUnmutedPeersCount: number; // int -> number;
  unreadMutedMessagesCount: number; // int -> number;
  unreadUnmutedMessagesCount: number; // int -> number;
};

export type DialogPeer = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
};

export type DialogPeerFolder = {
  folderId: number; // int -> number;
};

export type DisallowedGiftsSettings = {
  // flags: null // null;
  disallowUnlimitedStargifts?: boolean; // boolean;
  disallowLimitedStargifts?: boolean; // boolean;
  disallowUniqueStargifts?: boolean; // boolean;
  disallowPremiumGifts?: boolean; // boolean;
};

export type DraftMessage = {
  // flags: null // null;
  noWebpage?: boolean; // boolean;
  invertMedia?: boolean; // boolean;
  replyTo?: TypeInputReplyTo; // Api.TypeInputReplyTo -> TypeInputReplyTo;
  message: string; // string;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  media?: TypeInputMedia; // Api.TypeInputMedia -> TypeInputMedia;
  date: number; // int -> number;
  effect?: string; // long -> string;
};

export type DraftMessageEmpty = {
  // flags: null // null;
  date?: number; // int -> number;
};

export type EmailVerificationApple = {
  token: string; // string;
};

export type EmailVerificationCode = {
  code: string; // string;
};

export type EmailVerificationGoogle = {
  token: string; // string;
};

export type EmailVerifyPurposeLoginSetup = {
  phoneNumber: string; // string;
  phoneCodeHash: string; // string;
};

export type EmojiGroup = {
  title: string; // string;
  iconEmojiId: string; // long -> string;
  emoticons: string[]; // string[];
};

export type EmojiGroupGreeting = {
  title: string; // string;
  iconEmojiId: string; // long -> string;
  emoticons: string[]; // string[];
};

export type EmojiGroupPremium = {
  title: string; // string;
  iconEmojiId: string; // long -> string;
};

export type EmojiKeyword = {
  keyword: string; // string;
  emoticons: string[]; // string[];
};

export type EmojiKeywordDeleted = {
  keyword: string; // string;
  emoticons: string[]; // string[];
};

export type EmojiKeywordsDifference = {
  langCode: string; // string;
  fromVersion: number; // int -> number;
  version: number; // int -> number;
  keywords: TypeEmojiKeyword[]; // Api.TypeEmojiKeyword[];
};

export type EmojiLanguage = {
  langCode: string; // string;
};

export type EmojiList = {
  hash: string; // long -> string;
  documentId: string[]; // long[] -> string[];
};

export type EmojiStatus = {
  // flags: null // null;
  documentId: string; // long -> string;
  until?: number; // int -> number;
};

export type EmojiStatusCollectible = {
  // flags: null // null;
  collectibleId: string; // long -> string;
  documentId: string; // long -> string;
  title: string; // string;
  slug: string; // string;
  patternDocumentId: string; // long -> string;
  centerColor: number; // int -> number;
  edgeColor: number; // int -> number;
  patternColor: number; // int -> number;
  textColor: number; // int -> number;
  until?: number; // int -> number;
};

export type EmojiURL = {
  url: string; // string;
};

export type EncryptedChat = {
  id: number; // int -> number;
  accessHash: string; // long -> string;
  date: number; // int -> number;
  adminId: string; // long -> string;
  participantId: string; // long -> string;
  gAOrB: Uint8Array; // bytes -> Uint8Array;
  keyFingerprint: string; // long -> string;
};

export type EncryptedChatDiscarded = {
  // flags: null // null;
  historyDeleted?: boolean; // boolean;
  id: number; // int -> number;
};

export type EncryptedChatEmpty = {
  id: number; // int -> number;
};

export type EncryptedChatRequested = {
  // flags: null // null;
  folderId?: number; // int -> number;
  id: number; // int -> number;
  accessHash: string; // long -> string;
  date: number; // int -> number;
  adminId: string; // long -> string;
  participantId: string; // long -> string;
  gA: Uint8Array; // bytes -> Uint8Array;
};

export type EncryptedChatWaiting = {
  id: number; // int -> number;
  accessHash: string; // long -> string;
  date: number; // int -> number;
  adminId: string; // long -> string;
  participantId: string; // long -> string;
};

export type EncryptedFile = {
  id: string; // long -> string;
  accessHash: string; // long -> string;
  size: string; // long -> string;
  dcId: number; // int -> number;
  keyFingerprint: number; // int -> number;
};

export type EncryptedMessage = {
  randomId?: string; // long -> string;
  chatId: number; // Bot API / TDLib dialog id (see peer-id.helper)
  date: number; // int -> number;
  bytes: Uint8Array; // bytes -> Uint8Array;
  file: TypeEncryptedFile; // Api.TypeEncryptedFile -> TypeEncryptedFile;
};

export type EncryptedMessageService = {
  randomId?: string; // long -> string;
  chatId: number; // Bot API / TDLib dialog id (see peer-id.helper)
  date: number; // int -> number;
  bytes: Uint8Array; // bytes -> Uint8Array;
};

export type ExportedChatlistInvite = {
  // flags: null // null;
  title: string; // string;
  url: string; // string;
  peers: TypePeer[]; // Api.TypePeer[];
};

export type ExportedContactToken = {
  url: string; // string;
  expires: number; // int -> number;
};

export type ExportedMessageLink = {
  link: string; // string;
  html: string; // string;
};

export type ExportedStoryLink = {
  link: string; // string;
};

export type FactCheck = {
  // flags: null // null;
  needCheck?: boolean; // boolean;
  country?: string; // string;
  text?: TypeTextWithEntities; // Api.TypeTextWithEntities -> TypeTextWithEntities;
  hash: string; // long -> string;
};

export type FileHash = {
  offset: string; // long -> string;
  limit: number; // int -> number;
  hash: Uint8Array; // bytes -> Uint8Array;
};

export type Folder = {
  // flags: null // null;
  autofillNewBroadcasts?: boolean; // boolean;
  autofillPublicGroups?: boolean; // boolean;
  autofillNewCorrespondents?: boolean; // boolean;
  id: number; // int -> number;
  title: string; // string;
  photo?: TypeChatPhoto; // Api.TypeChatPhoto -> TypeChatPhoto;
};

export type FolderPeer = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  folderId: number; // int -> number;
};

export type ForumTopic = {
  // flags: null // null;
  my?: boolean; // boolean;
  closed?: boolean; // boolean;
  pinned?: boolean; // boolean;
  short?: boolean; // boolean;
  hidden?: boolean; // boolean;
  id: number; // int -> number;
  date: number; // int -> number;
  title: string; // string;
  iconColor: number; // int -> number;
  iconEmojiId?: string; // long -> string;
  topMessage: number; // int -> number;
  readInboxMaxId: number; // int -> number;
  readOutboxMaxId: number; // int -> number;
  unreadCount: number; // int -> number;
  unreadMentionsCount: number; // int -> number;
  unreadReactionsCount: number; // int -> number;
  fromId: TypePeer; // Api.TypePeer -> TypePeer;
  notifySettings: TypePeerNotifySettings; // Api.TypePeerNotifySettings -> TypePeerNotifySettings;
  draft?: TypeDraftMessage; // Api.TypeDraftMessage -> TypeDraftMessage;
};

export type ForumTopicDeleted = {
  id: number; // int -> number;
};

export type FoundStory = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  story: TypeStoryItem; // Api.TypeStoryItem -> TypeStoryItem;
};

export type FutureSalt = {
  validSince: number; // int -> number;
  validUntil: number; // int -> number;
  salt: string; // long -> string;
};

export type FutureSalts = {
  reqMsgId: string; // long -> string;
  now: number; // int -> number;
  salts: FutureSalt[]; // FutureSalt[];
};

export type Game = {
  // flags: null // null;
  id: string; // long -> string;
  accessHash: string; // long -> string;
  shortName: string; // string;
  title: string; // string;
  description: string; // string;
  photo: TypePhoto; // Api.TypePhoto -> TypePhoto;
  document?: TypeDocument; // Api.TypeDocument -> TypeDocument;
};

export type GeoPoint = {
  // flags: null // null;
  long: number; // double -> number;
  lat: number; // double -> number;
  accessHash: string; // long -> string;
  accuracyRadius?: number; // int -> number;
};

export type GeoPointAddress = {
  // flags: null // null;
  countryIso2: string; // string;
  state?: string; // string;
  city?: string; // string;
  street?: string; // string;
};

export type GlobalPrivacySettings = {
  // flags: null // null;
  archiveAndMuteNewNoncontactPeers?: boolean; // boolean;
  keepArchivedUnmuted?: boolean; // boolean;
  keepArchivedFolders?: boolean; // boolean;
  hideReadMarks?: boolean; // boolean;
  newNoncontactPeersRequirePremium?: boolean; // boolean;
};

export type GroupCall = {
  // flags: null // null;
  joinMuted?: boolean; // boolean;
  canChangeJoinMuted?: boolean; // boolean;
  joinDateAsc?: boolean; // boolean;
  scheduleStartSubscribed?: boolean; // boolean;
  canStartVideo?: boolean; // boolean;
  recordVideoActive?: boolean; // boolean;
  rtmpStream?: boolean; // boolean;
  listenersHidden?: boolean; // boolean;
  id: string; // long -> string;
  accessHash: string; // long -> string;
  participantsCount: number; // int -> number;
  title?: string; // string;
  streamDcId?: number; // int -> number;
  recordStartDate?: number; // int -> number;
  scheduleDate?: number; // int -> number;
  unmutedVideoCount?: number; // int -> number;
  unmutedVideoLimit: number; // int -> number;
  version: number; // int -> number;
  conferenceFromCall?: string; // long -> string;
};

export type GroupCallDiscarded = {
  id: string; // long -> string;
  accessHash: string; // long -> string;
  duration: number; // int -> number;
};

export type GroupCallParticipant = {
  // flags: null // null;
  muted?: boolean; // boolean;
  left?: boolean; // boolean;
  canSelfUnmute?: boolean; // boolean;
  justJoined?: boolean; // boolean;
  versioned?: boolean; // boolean;
  min?: boolean; // boolean;
  mutedByYou?: boolean; // boolean;
  volumeByAdmin?: boolean; // boolean;
  self?: boolean; // boolean;
  videoJoined?: boolean; // boolean;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  date: number; // int -> number;
  activeDate?: number; // int -> number;
  source: number; // int -> number;
  volume?: number; // int -> number;
  about?: string; // string;
  raiseHandRating?: string; // long -> string;
  video?: TypeGroupCallParticipantVideo; // Api.TypeGroupCallParticipantVideo -> TypeGroupCallParticipantVideo;
  presentation?: TypeGroupCallParticipantVideo; // Api.TypeGroupCallParticipantVideo -> TypeGroupCallParticipantVideo;
};

export type GroupCallParticipantVideo = {
  // flags: null // null;
  paused?: boolean; // boolean;
  endpoint: string; // string;
  sourceGroups: TypeGroupCallParticipantVideoSourceGroup[]; // Api.TypeGroupCallParticipantVideoSourceGroup[];
  audioSource?: number; // int -> number;
};

export type GroupCallParticipantVideoSourceGroup = {
  semantics: string; // string;
  sources: number[]; // int[] -> number[];
};

export type GroupCallStreamChannel = {
  channel: number; // int -> number;
  scale: number; // int -> number;
  lastTimestampMs: string; // long -> string;
};

export type HighScore = {
  pos: number; // int -> number;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  score: number; // int -> number;
};

export type HttpWait = {
  maxDelay: number; // int -> number;
  waitAfter: number; // int -> number;
  maxWait: number; // int -> number;
};

export type ImportedContact = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  clientId: string; // long -> string;
};

export type InlineBotSwitchPM = {
  text: string; // string;
  startParam: string; // string;
};

export type InlineBotWebView = {
  text: string; // string;
  url: string; // string;
};

export type InputAppEvent = {
  time: number; // double -> number;
  type: string; // string;
  peer: string; // long -> string;
  data: TypeJSONValue; // Api.TypeJSONValue -> TypeJSONValue;
};

export type InputBotAppID = {
  id: string; // long -> string;
  accessHash: string; // long -> string;
};

export type InputBotAppShortName = {
  botId: TypeInputUser; // Api.TypeInputUser -> TypeInputUser;
  shortName: string; // string;
};

export type InputBotInlineMessageGame = {
  // flags: null // null;
  replyMarkup?: TypeReplyMarkup; // Api.TypeReplyMarkup -> TypeReplyMarkup;
};

export type InputBotInlineMessageID = {
  dcId: number; // int -> number;
  id: string; // long -> string;
  accessHash: string; // long -> string;
};

export type InputBotInlineMessageID64 = {
  dcId: number; // int -> number;
  ownerId: string; // long -> string;
  id: number; // int -> number;
  accessHash: string; // long -> string;
};

export type InputBotInlineMessageMediaAuto = {
  // flags: null // null;
  invertMedia?: boolean; // boolean;
  message: string; // string;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  replyMarkup?: TypeReplyMarkup; // Api.TypeReplyMarkup -> TypeReplyMarkup;
};

export type InputBotInlineMessageMediaContact = {
  // flags: null // null;
  phoneNumber: string; // string;
  firstName: string; // string;
  lastName: string; // string;
  vcard: string; // string;
  replyMarkup?: TypeReplyMarkup; // Api.TypeReplyMarkup -> TypeReplyMarkup;
};

export type InputBotInlineMessageMediaGeo = {
  // flags: null // null;
  geoPoint: TypeInputGeoPoint; // Api.TypeInputGeoPoint -> TypeInputGeoPoint;
  heading?: number; // int -> number;
  period?: number; // int -> number;
  proximityNotificationRadius?: number; // int -> number;
  replyMarkup?: TypeReplyMarkup; // Api.TypeReplyMarkup -> TypeReplyMarkup;
};

export type InputBotInlineMessageMediaInvoice = {
  // flags: null // null;
  title: string; // string;
  description: string; // string;
  photo?: TypeInputWebDocument; // Api.TypeInputWebDocument -> TypeInputWebDocument;
  invoice: TypeInvoice; // Api.TypeInvoice -> TypeInvoice;
  payload: Uint8Array; // bytes -> Uint8Array;
  provider: string; // string;
  providerData: TypeDataJSON; // Api.TypeDataJSON -> TypeDataJSON;
  replyMarkup?: TypeReplyMarkup; // Api.TypeReplyMarkup -> TypeReplyMarkup;
};

export type InputBotInlineMessageMediaVenue = {
  // flags: null // null;
  geoPoint: TypeInputGeoPoint; // Api.TypeInputGeoPoint -> TypeInputGeoPoint;
  title: string; // string;
  address: string; // string;
  provider: string; // string;
  venueId: string; // string;
  venueType: string; // string;
  replyMarkup?: TypeReplyMarkup; // Api.TypeReplyMarkup -> TypeReplyMarkup;
};

export type InputBotInlineMessageMediaWebPage = {
  // flags: null // null;
  invertMedia?: boolean; // boolean;
  forceLargeMedia?: boolean; // boolean;
  forceSmallMedia?: boolean; // boolean;
  optional?: boolean; // boolean;
  message: string; // string;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  url: string; // string;
  replyMarkup?: TypeReplyMarkup; // Api.TypeReplyMarkup -> TypeReplyMarkup;
};

export type InputBotInlineMessageText = {
  // flags: null // null;
  noWebpage?: boolean; // boolean;
  invertMedia?: boolean; // boolean;
  message: string; // string;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  replyMarkup?: TypeReplyMarkup; // Api.TypeReplyMarkup -> TypeReplyMarkup;
};

export type InputBotInlineResult = {
  // flags: null // null;
  id: string; // string;
  type: string; // string;
  title?: string; // string;
  description?: string; // string;
  url?: string; // string;
  thumb?: TypeInputWebDocument; // Api.TypeInputWebDocument -> TypeInputWebDocument;
  content?: TypeInputWebDocument; // Api.TypeInputWebDocument -> TypeInputWebDocument;
  sendMessage: TypeInputBotInlineMessage; // Api.TypeInputBotInlineMessage -> TypeInputBotInlineMessage;
};

export type InputBotInlineResultDocument = {
  // flags: null // null;
  id: string; // string;
  type: string; // string;
  title?: string; // string;
  description?: string; // string;
  document: TypeInputDocument; // Api.TypeInputDocument -> TypeInputDocument;
  sendMessage: TypeInputBotInlineMessage; // Api.TypeInputBotInlineMessage -> TypeInputBotInlineMessage;
};

export type InputBotInlineResultGame = {
  id: string; // string;
  shortName: string; // string;
  sendMessage: TypeInputBotInlineMessage; // Api.TypeInputBotInlineMessage -> TypeInputBotInlineMessage;
};

export type InputBotInlineResultPhoto = {
  id: string; // string;
  type: string; // string;
  photo: TypeInputPhoto; // Api.TypeInputPhoto -> TypeInputPhoto;
  sendMessage: TypeInputBotInlineMessage; // Api.TypeInputBotInlineMessage -> TypeInputBotInlineMessage;
};

export type InputBusinessAwayMessage = {
  // flags: null // null;
  offlineOnly?: boolean; // boolean;
  shortcutId: number; // int -> number;
  schedule: TypeBusinessAwayMessageSchedule; // Api.TypeBusinessAwayMessageSchedule -> TypeBusinessAwayMessageSchedule;
  recipients: TypeInputBusinessRecipients; // Api.TypeInputBusinessRecipients -> TypeInputBusinessRecipients;
};

export type InputBusinessBotRecipients = {
  // flags: null // null;
  existingChats?: boolean; // boolean;
  newChats?: boolean; // boolean;
  contacts?: boolean; // boolean;
  nonContacts?: boolean; // boolean;
  excludeSelected?: boolean; // boolean;
  users?: TypeInputUser[]; // Api.TypeInputUser[]
  excludeUsers?: TypeInputUser[]; // Api.TypeInputUser[]
};

export type InputBusinessChatLink = {
  // flags: null // null;
  message: string; // string;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  title?: string; // string;
};

export type InputBusinessGreetingMessage = {
  shortcutId: number; // int -> number;
  recipients: TypeInputBusinessRecipients; // Api.TypeInputBusinessRecipients -> TypeInputBusinessRecipients;
  noActivityDays: number; // int -> number;
};

export type InputBusinessIntro = {
  // flags: null // null;
  title: string; // string;
  description: string; // string;
  sticker?: TypeInputDocument; // Api.TypeInputDocument -> TypeInputDocument;
};

export type InputBusinessRecipients = {
  // flags: null // null;
  existingChats?: boolean; // boolean;
  newChats?: boolean; // boolean;
  contacts?: boolean; // boolean;
  nonContacts?: boolean; // boolean;
  excludeSelected?: boolean; // boolean;
  users?: TypeInputUser[]; // Api.TypeInputUser[]
};

export type InputChannel = {
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  accessHash: string; // long -> string;
};

export type InputChannelFromMessage = {
  peer: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
  msgId: number; // int -> number;
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
};

export type InputChatlistDialogFilter = {
  filterId: number; // int -> number;
};

export type InputCheckPasswordSRP = {
  srpId: string; // long -> string;
  A: Uint8Array; // bytes -> Uint8Array;
  M1: Uint8Array; // bytes -> Uint8Array;
};

export type InputClientProxy = {
  address: string; // string;
  port: number; // int -> number;
};

export type InputCollectiblePhone = {
  phone: string; // string;
};

export type InputCollectibleUsername = {
  username: string; // string;
};

export type InputDialogPeer = {
  peer: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
};

export type InputDialogPeerFolder = {
  folderId: number; // int -> number;
};

export type InputEmojiStatusCollectible = {
  // flags: null // null;
  collectibleId: string; // long -> string;
  until?: number; // int -> number;
};

export type InputEncryptedChat = {
  chatId: number; // Bot API / TDLib dialog id (see peer-id.helper)
  accessHash: string; // long -> string;
};

export type InputEncryptedFile = {
  id: string; // long -> string;
  accessHash: string; // long -> string;
};

export type InputEncryptedFileBigUploaded = {
  id: string; // long -> string;
  parts: number; // int -> number;
  keyFingerprint: number; // int -> number;
};

export type InputEncryptedFileUploaded = {
  id: string; // long -> string;
  parts: number; // int -> number;
  md5Checksum: string; // string;
  keyFingerprint: number; // int -> number;
};

export type InputFolderPeer = {
  peer: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
  folderId: number; // int -> number;
};

export type InputGameID = {
  id: string; // long -> string;
  accessHash: string; // long -> string;
};

export type InputGameShortName = {
  botId: TypeInputUser; // Api.TypeInputUser -> TypeInputUser;
  shortName: string; // string;
};

export type InputGroupCall = {
  id: string; // long -> string;
  accessHash: string; // long -> string;
};

export type InputInvoiceChatInviteSubscription = {
  hash: string; // string;
};

export type InputInvoiceMessage = {
  peer: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
  msgId: number; // int -> number;
};

export type InputInvoicePremiumGiftCode = {
  purpose: TypeInputStorePaymentPurpose; // Api.TypeInputStorePaymentPurpose -> TypeInputStorePaymentPurpose;
  option: TypePremiumGiftCodeOption; // Api.TypePremiumGiftCodeOption -> TypePremiumGiftCodeOption;
};

export type InputInvoiceSlug = {
  slug: string; // string;
};

export type InputInvoiceStarGift = {
  // flags: null // null;
  hideName?: boolean; // boolean;
  includeUpgrade?: boolean; // boolean;
  peer: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
  giftId: string; // long -> string;
  message?: TypeTextWithEntities; // Api.TypeTextWithEntities -> TypeTextWithEntities;
};

export type InputInvoiceStarGiftTransfer = {
  stargift: TypeInputSavedStarGift; // Api.TypeInputSavedStarGift -> TypeInputSavedStarGift;
  toId: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
};

export type InputInvoiceStarGiftUpgrade = {
  // flags: null // null;
  keepOriginalDetails?: boolean; // boolean;
  stargift: TypeInputSavedStarGift; // Api.TypeInputSavedStarGift -> TypeInputSavedStarGift;
};

export type InputInvoiceStars = {
  purpose: TypeInputStorePaymentPurpose; // Api.TypeInputStorePaymentPurpose -> TypeInputStorePaymentPurpose;
};

export type InputKeyboardButtonRequestPeer = {
  // flags: null // null;
  nameRequested?: boolean; // boolean;
  usernameRequested?: boolean; // boolean;
  photoRequested?: boolean; // boolean;
  text: string; // string;
  buttonId: number; // int -> number;
  peerType: TypeRequestPeerType; // Api.TypeRequestPeerType -> TypeRequestPeerType;
  maxQuantity: number; // int -> number;
};

export type InputKeyboardButtonUrlAuth = {
  // flags: null // null;
  requestWriteAccess?: boolean; // boolean;
  text: string; // string;
  fwdText?: string; // string;
  url: string; // string;
  bot: TypeInputUser; // Api.TypeInputUser -> TypeInputUser;
};

export type InputKeyboardButtonUserProfile = {
  text: string; // string;
  userId: TypeInputUser; // Api.TypeInputUser -> TypeInputUser;
};

export type InputMediaAreaChannelPost = {
  coordinates: TypeMediaAreaCoordinates; // Api.TypeMediaAreaCoordinates -> TypeMediaAreaCoordinates;
  channel: TypeInputChannel; // Api.TypeInputChannel -> TypeInputChannel;
  msgId: number; // int -> number;
};

export type InputMediaAreaVenue = {
  coordinates: TypeMediaAreaCoordinates; // Api.TypeMediaAreaCoordinates -> TypeMediaAreaCoordinates;
  queryId: string; // long -> string;
  resultId: string; // string;
};

export type InputMessageCallbackQuery = {
  id: number; // int -> number;
  queryId: string; // long -> string;
};

export type InputMessageEntityMentionName = {
  offset: number; // int -> number;
  length: number; // int -> number;
  userId: TypeInputUser; // Api.TypeInputUser -> TypeInputUser;
};

export type InputMessageID = {
  id: number; // int -> number;
};

export type InputMessageReplyTo = {
  id: number; // int -> number;
};

export type InputMessagesFilterPhoneCalls = {
  // flags: null // null;
  missed?: boolean; // boolean;
};

export type InputNotifyForumTopic = {
  peer: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
  topMsgId: number; // int -> number;
};

export type InputNotifyPeer = {
  peer: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
};

export type InputPaymentCredentials = {
  // flags: null // null;
  save?: boolean; // boolean;
  data: TypeDataJSON; // Api.TypeDataJSON -> TypeDataJSON;
};

export type InputPaymentCredentialsApplePay = {
  paymentData: TypeDataJSON; // Api.TypeDataJSON -> TypeDataJSON;
};

export type InputPaymentCredentialsGooglePay = {
  paymentToken: TypeDataJSON; // Api.TypeDataJSON -> TypeDataJSON;
};

export type InputPaymentCredentialsSaved = {
  id: string; // string;
  tmpPassword: Uint8Array; // bytes -> Uint8Array;
};

export type InputPeerNotifySettings = {
  // flags: null // null;
  showPreviews?: boolean; // Bool -> boolean;
  silent?: boolean; // Bool -> boolean;
  muteUntil?: number; // int -> number;
  sound?: TypeNotificationSound; // Api.TypeNotificationSound -> TypeNotificationSound;
  storiesMuted?: boolean; // Bool -> boolean;
  storiesHideSender?: boolean; // Bool -> boolean;
  storiesSound?: TypeNotificationSound; // Api.TypeNotificationSound -> TypeNotificationSound;
};

export type InputPhoneCall = {
  id: string; // long -> string;
  accessHash: string; // long -> string;
};

export type InputPrivacyValueAllowChatParticipants = {
  chats: string[]; // long[] -> string[];
};

export type InputPrivacyValueAllowUsers = {
  users: TypeInputUser[]; // Api.TypeInputUser[]
};

export type InputPrivacyValueDisallowChatParticipants = {
  chats: string[]; // long[] -> string[];
};

export type InputPrivacyValueDisallowUsers = {
  users: TypeInputUser[]; // Api.TypeInputUser[]
};

export type InputQuickReplyShortcut = {
  shortcut: string; // string;
};

export type InputQuickReplyShortcutId = {
  shortcutId: number; // int -> number;
};

export type InputReplyToMessage = {
  // flags: null // null;
  replyToMsgId: number; // int -> number;
  topMsgId?: number; // int -> number;
  replyToPeerId?: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
  quoteText?: string; // string;
  quoteEntities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  quoteOffset?: number; // int -> number;
};

export type InputReplyToStory = {
  peer: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
  storyId: number; // int -> number;
};

export type InputSavedStarGiftChat = {
  peer: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
  savedId: string; // long -> string;
};

export type InputSavedStarGiftUser = {
  msgId: number; // int -> number;
};

export type InputSecureFile = {
  id: string; // long -> string;
  accessHash: string; // long -> string;
};

export type InputSecureFileUploaded = {
  id: string; // long -> string;
  parts: number; // int -> number;
  md5Checksum: string; // string;
  fileHash: Uint8Array; // bytes -> Uint8Array;
  secret: Uint8Array; // bytes -> Uint8Array;
};

export type InputSecureValue = {
  // flags: null // null;
  type: TypeSecureValueType; // Api.TypeSecureValueType -> TypeSecureValueType;
  data?: TypeSecureData; // Api.TypeSecureData -> TypeSecureData;
  frontSide?: TypeInputSecureFile; // Api.TypeInputSecureFile -> TypeInputSecureFile;
  reverseSide?: TypeInputSecureFile; // Api.TypeInputSecureFile -> TypeInputSecureFile;
  selfie?: TypeInputSecureFile; // Api.TypeInputSecureFile -> TypeInputSecureFile;
  translation?: TypeInputSecureFile[]; // Api.TypeInputSecureFile[];
  files?: TypeInputSecureFile[]; // Api.TypeInputSecureFile[];
  plainData?: TypeSecurePlainData; // Api.TypeSecurePlainData -> TypeSecurePlainData;
};

export type InputSingleMedia = {
  // flags: null // null;
  media: TypeInputMedia; // Api.TypeInputMedia -> TypeInputMedia;
  randomId?: string; // long -> string;
  message: string; // string;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
};

export type InputStarsTransaction = {
  // flags: null // null;
  refund?: boolean; // boolean;
  id: string; // string;
};

export type InputStickeredMediaDocument = {
  id: TypeInputDocument; // Api.TypeInputDocument -> TypeInputDocument;
};

export type InputStickeredMediaPhoto = {
  id: TypeInputPhoto; // Api.TypeInputPhoto -> TypeInputPhoto;
};

export type InputStickerSetItem = {
  // flags: null // null;
  document: TypeInputDocument; // Api.TypeInputDocument -> TypeInputDocument;
  emoji: string; // string;
  maskCoords?: TypeMaskCoords; // Api.TypeMaskCoords -> TypeMaskCoords;
  keywords?: string; // string;
};

export type InputStorePaymentGiftPremium = {
  userId: TypeInputUser; // Api.TypeInputUser -> TypeInputUser;
  currency: string; // string;
  amount: string; // long -> string;
};

export type InputStorePaymentPremiumGiftCode = {
  // flags: null // null;
  users: TypeInputUser[]; // Api.TypeInputUser[]
  boostPeer?: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
  currency: string; // string;
  amount: string; // long -> string;
  message?: TypeTextWithEntities; // Api.TypeTextWithEntities -> TypeTextWithEntities;
};

export type InputStorePaymentPremiumGiveaway = {
  // flags: null // null;
  onlyNewSubscribers?: boolean; // boolean;
  winnersAreVisible?: boolean; // boolean;
  boostPeer: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
  additionalPeers?: TypeInputPeer[]; // Api.TypeInputPeer[];
  countriesIso2?: string[]; // string[];
  prizeDescription?: string; // string;
  randomId?: string; // long -> string;
  untilDate: number; // int -> number;
  currency: string; // string;
  amount: string; // long -> string;
};

export type InputStorePaymentPremiumSubscription = {
  // flags: null // null;
  restore?: boolean; // boolean;
  upgrade?: boolean; // boolean;
};

export type InputStorePaymentStarsGift = {
  userId: TypeInputUser; // Api.TypeInputUser -> TypeInputUser;
  stars: string; // long -> string;
  currency: string; // string;
  amount: string; // long -> string;
};

export type InputStorePaymentStarsGiveaway = {
  // flags: null // null;
  onlyNewSubscribers?: boolean; // boolean;
  winnersAreVisible?: boolean; // boolean;
  stars: string; // long -> string;
  boostPeer: TypeInputPeer; // Api.TypeInputPeer -> TypeInputPeer;
  additionalPeers?: TypeInputPeer[]; // Api.TypeInputPeer[];
  countriesIso2?: string[]; // string[];
  prizeDescription?: string; // string;
  randomId?: string; // long -> string;
  untilDate: number; // int -> number;
  currency: string; // string;
  amount: string; // long -> string;
  users: number; // int -> number;
};

export type InputStorePaymentStarsTopup = {
  stars: string; // long -> string;
  currency: string; // string;
  amount: string; // long -> string;
};

export type InputTheme = {
  id: string; // long -> string;
  accessHash: string; // long -> string;
};

export type InputThemeSettings = {
  // flags: null // null;
  messageColorsAnimated?: boolean; // boolean;
  baseTheme: TypeBaseTheme; // Api.TypeBaseTheme -> TypeBaseTheme;
  accentColor: number; // int -> number;
  outboxAccentColor?: number; // int -> number;
  messageColors?: number[]; // int[] -> number[];
  wallpaper?: TypeInputWallPaper; // Api.TypeInputWallPaper -> TypeInputWallPaper;
  wallpaperSettings?: TypeWallPaperSettings; // Api.TypeWallPaperSettings -> TypeWallPaperSettings;
};

export type InputThemeSlug = {
  slug: string; // string;
};

export type InputWallPaper = {
  id: string; // long -> string;
  accessHash: string; // long -> string;
};

export type InputWallPaperNoFile = {
  id: string; // long -> string;
};

export type InputWallPaperSlug = {
  slug: string; // string;
};

export type InputWebDocument = {
  url: string; // string;
  size: number; // int -> number;
  mimeType: string; // string;
  attributes: TypeDocumentAttribute[]; // Api.TypeDocumentAttribute[];
};

export type InputWebFileAudioAlbumThumbLocation = {
  // flags: null // null;
  small?: boolean; // boolean;
  document?: TypeInputDocument; // Api.TypeInputDocument -> TypeInputDocument;
  title?: string; // string;
  performer?: string; // string;
};

export type InputWebFileGeoPointLocation = {
  geoPoint: TypeInputGeoPoint; // Api.TypeInputGeoPoint -> TypeInputGeoPoint;
  accessHash: string; // long -> string;
  w: number; // int -> number;
  h: number; // int -> number;
  zoom: number; // int -> number;
  scale: number; // int -> number;
};

export type InputWebFileLocation = {
  url: string; // string;
  accessHash: string; // long -> string;
};

export type Invoice = {
  // flags: null // null;
  test?: boolean; // boolean;
  nameRequested?: boolean; // boolean;
  phoneRequested?: boolean; // boolean;
  emailRequested?: boolean; // boolean;
  shippingAddressRequested?: boolean; // boolean;
  flexible?: boolean; // boolean;
  phoneToProvider?: boolean; // boolean;
  emailToProvider?: boolean; // boolean;
  recurring?: boolean; // boolean;
  currency: string; // string;
  prices: TypeLabeledPrice[]; // Api.TypeLabeledPrice[];
  maxTipAmount?: string; // long -> string;
  suggestedTipAmounts?: string[]; // long[] -> string[];
  termsUrl?: string; // string;
  subscriptionPeriod?: number; // int -> number;
};

export type IpPort = {
  ipv4: number; // int -> number;
  port: number; // int -> number;
};

export type IpPortSecret = {
  ipv4: number; // int -> number;
  port: number; // int -> number;
  secret: Uint8Array; // bytes -> Uint8Array;
};

export type JsonArray = {
  value: TypeJSONValue[]; // Api.TypeJSONValue[];
};

export type JsonBool = {
  value: boolean; // Bool -> boolean;
};

export type JsonNumber = {
  value: number; // double -> number;
};

export type JsonObject = {
  value: TypeJSONObjectValue[]; // Api.TypeJSONObjectValue[];
};

export type JsonObjectValue = {
  key: string; // string;
  value: TypeJSONValue; // Api.TypeJSONValue -> TypeJSONValue;
};

export type JsonString = {
  value: string; // string;
};

export type KeyboardButton = {
  text: string; // string;
};

export type KeyboardButtonBuy = {
  text: string; // string;
};

export type KeyboardButtonCallback = {
  // flags: null // null;
  requiresPassword?: boolean; // boolean;
  text: string; // string;
  data: Uint8Array; // bytes -> Uint8Array;
};

export type KeyboardButtonCopy = {
  text: string; // string;
  copyText: string; // string;
};

export type KeyboardButtonGame = {
  text: string; // string;
};

export type KeyboardButtonRequestGeoLocation = {
  text: string; // string;
};

export type KeyboardButtonRequestPeer = {
  text: string; // string;
  buttonId: number; // int -> number;
  peerType: TypeRequestPeerType; // Api.TypeRequestPeerType -> TypeRequestPeerType;
  maxQuantity: number; // int -> number;
};

export type KeyboardButtonRequestPhone = {
  text: string; // string;
};

export type KeyboardButtonRequestPoll = {
  // flags: null // null;
  quiz?: boolean; // Bool -> boolean;
  text: string; // string;
};

export type KeyboardButtonRow = {
  buttons: TypeKeyboardButton[]; // Api.TypeKeyboardButton[];
};

export type KeyboardButtonSimpleWebView = {
  text: string; // string;
  url: string; // string;
};

export type KeyboardButtonSwitchInline = {
  // flags: null // null;
  samePeer?: boolean; // boolean;
  text: string; // string;
  query: string; // string;
  peerTypes?: TypeInlineQueryPeerType[]; // Api.TypeInlineQueryPeerType[];
};

export type KeyboardButtonUrl = {
  text: string; // string;
  url: string; // string;
};

export type KeyboardButtonUrlAuth = {
  // flags: null // null;
  text: string; // string;
  fwdText?: string; // string;
  url: string; // string;
  buttonId: number; // int -> number;
};

export type KeyboardButtonUserProfile = {
  text: string; // string;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
};

export type KeyboardButtonWebView = {
  text: string; // string;
  url: string; // string;
};

export type LabeledPrice = {
  label: string; // string;
  amount: string; // long -> string;
};

export type LangPackDifference = {
  langCode: string; // string;
  fromVersion: number; // int -> number;
  version: number; // int -> number;
  strings: TypeLangPackString[]; // Api.TypeLangPackString[];
};

export type LangPackLanguage = {
  // flags: null // null;
  official?: boolean; // boolean;
  rtl?: boolean; // boolean;
  beta?: boolean; // boolean;
  name: string; // string;
  nativeName: string; // string;
  langCode: string; // string;
  baseLangCode?: string; // string;
  pluralCode: string; // string;
  stringsCount: number; // int -> number;
  translatedCount: number; // int -> number;
  translationsUrl: string; // string;
};

export type LangPackString = {
  key: string; // string;
  value: string; // string;
};

export type LangPackStringDeleted = {
  key: string; // string;
};

export type LangPackStringPluralized = {
  // flags: null // null;
  key: string; // string;
  zeroValue?: string; // string;
  oneValue?: string; // string;
  twoValue?: string; // string;
  fewValue?: string; // string;
  manyValue?: string; // string;
  otherValue: string; // string;
};

export type MediaAreaChannelPost = {
  coordinates: TypeMediaAreaCoordinates; // Api.TypeMediaAreaCoordinates -> TypeMediaAreaCoordinates;
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  msgId: number; // int -> number;
};

export type MediaAreaCoordinates = {
  // flags: null // null;
  x: number; // double -> number;
  y: number; // double -> number;
  w: number; // double -> number;
  h: number; // double -> number;
  rotation: number; // double -> number;
  radius?: number; // double -> number;
};

export type MediaAreaGeoPoint = {
  // flags: null // null;
  coordinates: TypeMediaAreaCoordinates; // Api.TypeMediaAreaCoordinates -> TypeMediaAreaCoordinates;
  geo: TypeGeoPoint; // Api.TypeGeoPoint -> TypeGeoPoint;
  address?: TypeGeoPointAddress; // Api.TypeGeoPointAddress -> TypeGeoPointAddress;
};

export type MediaAreaStarGift = {
  coordinates: TypeMediaAreaCoordinates; // Api.TypeMediaAreaCoordinates -> TypeMediaAreaCoordinates;
  slug: string; // string;
};

export type MediaAreaSuggestedReaction = {
  // flags: null // null;
  dark?: boolean; // boolean;
  flipped?: boolean; // boolean;
  coordinates: TypeMediaAreaCoordinates; // Api.TypeMediaAreaCoordinates -> TypeMediaAreaCoordinates;
  reaction: TypeReaction; // Api.TypeReaction -> TypeReaction;
};

export type MediaAreaUrl = {
  coordinates: TypeMediaAreaCoordinates; // Api.TypeMediaAreaCoordinates -> TypeMediaAreaCoordinates;
  url: string; // string;
};

export type MediaAreaVenue = {
  coordinates: TypeMediaAreaCoordinates; // Api.TypeMediaAreaCoordinates -> TypeMediaAreaCoordinates;
  geo: TypeGeoPoint; // Api.TypeGeoPoint -> TypeGeoPoint;
  title: string; // string;
  address: string; // string;
  provider: string; // string;
  venueId: string; // string;
  venueType: string; // string;
};

export type MediaAreaWeather = {
  coordinates: TypeMediaAreaCoordinates; // Api.TypeMediaAreaCoordinates -> TypeMediaAreaCoordinates;
  emoji: string; // string;
  temperatureC: number; // double -> number;
  color: number; // int -> number;
};

export type MessageActionBoostApply = {
  type?: 'boostApply';
  boosts: number; // int -> number;
};

export type MessageActionBotAllowed = {
  // flags: null // null;
  attachMenu?: boolean; // boolean;
  fromRequest?: boolean; // boolean;
  domain?: string; // string;
  app?: TypeBotApp; // Api.TypeBotApp -> TypeBotApp;
};

export type MessageActionChannelCreate = {
  title: string; // string;
};

export type MessageActionChannelMigrateFrom = {
  title: string; // string;
  chatId: string; // long -> string;
};

export type MessageActionChatAddUser = {
  users: string[]; // long[] -> string[];
};

export type MessageActionChatCreate = {
  title: string; // string;
  users: string[]; // long[] -> string[];
};

export type MessageActionChatDeleteUser = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
};

export type MessageActionChatEditPhoto = {
  photo: TypePhoto; // Api.TypePhoto -> TypePhoto;
};

export type MessageActionChatEditTitle = {
  title: string; // string;
};

export type MessageActionChatJoinedByLink = {
  inviterId: string; // long -> string;
};

export type MessageActionChatMigrateTo = {
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
};

export type MessageActionCustomAction = {
  message: string; // string;
};

export type MessageActionPinMessage = {
  type?: 'pinMessage';
  isPin?: boolean;
};

export type MessageActionGameScore = {
  gameId: string; // long -> string;
  score: number; // int -> number;
};

export type MessageActionGeoProximityReached = {
  fromId: TypePeer; // Api.TypePeer -> TypePeer;
  toId: TypePeer; // Api.TypePeer -> TypePeer;
  distance: number; // int -> number;
};

export type MessageActionGiftCode = {
  // flags: null // null;
  viaGiveaway?: boolean; // boolean;
  unclaimed?: boolean; // boolean;
  boostPeer?: TypePeer; // Api.TypePeer -> TypePeer;
  months: number; // int -> number;
  slug: string; // string;
  currency?: string; // string;
  amount?: string; // long -> string;
  cryptoCurrency?: string; // string;
  cryptoAmount?: string; // long -> string;
  message?: TypeTextWithEntities; // Api.TypeTextWithEntities -> TypeTextWithEntities;
};

export type MessageActionGiftPremium = {
  // flags: null // null;
  currency: string; // string;
  amount: string; // long -> string;
  months: number; // int -> number;
  cryptoCurrency?: string; // string;
  cryptoAmount?: string; // long -> string;
  message?: TypeTextWithEntities; // Api.TypeTextWithEntities -> TypeTextWithEntities;
};

export type MessageActionGiftStars = {
  // flags: null // null;
  currency: string; // string;
  amount: string; // long -> string;
  stars: string; // long -> string;
  cryptoCurrency?: string; // string;
  cryptoAmount?: string; // long -> string;
  transactionId?: string; // string;
};

export type MessageActionGiveawayLaunch = {
  // flags: null // null;
  stars?: string; // long -> string;
};

export type MessageActionGiveawayResults = {
  // flags: null // null;
  stars?: boolean; // boolean;
  winnersCount: number; // int -> number;
  unclaimedCount: number; // int -> number;
};

export type MessageActionGroupCall = {
  // flags: null // null;
  call: TypeInputGroupCall; // Api.TypeInputGroupCall -> TypeInputGroupCall;
  duration?: number; // int -> number;
};

export type MessageActionGroupCallScheduled = {
  call: TypeInputGroupCall; // Api.TypeInputGroupCall -> TypeInputGroupCall;
  scheduleDate: number; // int -> number;
};

export type MessageActionInviteToGroupCall = {
  call: TypeInputGroupCall; // Api.TypeInputGroupCall -> TypeInputGroupCall;
  users: string[]; // long[] -> string[];
};

export type MessageActionPaymentRefunded = {
  // flags: null // null;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  currency: string; // string;
  totalAmount: string; // long -> string;
  payload?: Uint8Array; // bytes -> Uint8Array;
  charge: TypePaymentCharge; // Api.TypePaymentCharge -> TypePaymentCharge;
};

export type MessageActionPaymentSent = {
  // flags: null // null;
  recurringInit?: boolean; // boolean;
  recurringUsed?: boolean; // boolean;
  currency: string; // string;
  totalAmount: string; // long -> string;
  invoiceSlug?: string; // string;
  subscriptionUntilDate?: number; // int -> number;
};

export type MessageActionPaymentSentMe = {
  // flags: null // null;
  recurringInit?: boolean; // boolean;
  recurringUsed?: boolean; // boolean;
  currency: string; // string;
  totalAmount: string; // long -> string;
  payload: Uint8Array; // bytes -> Uint8Array;
  info?: TypePaymentRequestedInfo; // Api.TypePaymentRequestedInfo -> TypePaymentRequestedInfo;
  shippingOptionId?: string; // string;
  charge: TypePaymentCharge; // Api.TypePaymentCharge -> TypePaymentCharge;
  subscriptionUntilDate?: number; // int -> number;
};

export type MessageActionPhoneCall = {
  // flags: null // null;
  video?: boolean; // boolean;
  callId: string; // long -> string;
  reason?: TypePhoneCallDiscardReason; // Api.TypePhoneCallDiscardReason -> TypePhoneCallDiscardReason;
  duration?: number; // int -> number;
};

export type MessageActionPrizeStars = {
  // flags: null // null;
  unclaimed?: boolean; // boolean;
  stars: string; // long -> string;
  transactionId: string; // string;
  boostPeer: TypePeer; // Api.TypePeer -> TypePeer;
  giveawayMsgId: number; // int -> number;
};

export type MessageActionRequestedPeer = {
  buttonId: number; // int -> number;
  peers: TypePeer[]; // Api.TypePeer[];
};

export type MessageActionRequestedPeerSentMe = {
  buttonId: number; // int -> number;
  peers: TypeRequestedPeer[]; // Api.TypeRequestedPeer[];
};

export type MessageActionSecureValuesSent = {
  types: TypeSecureValueType[]; // Api.TypeSecureValueType[]
};

export type MessageActionSecureValuesSentMe = {
  values: TypeSecureValue[]; // Api.TypeSecureValue[];
  credentials: TypeSecureCredentialsEncrypted; // Api.TypeSecureCredentialsEncrypted -> TypeSecureCredentialsEncrypted;
};

export type MessageActionSetChatTheme = {
  emoticon: string; // string;
};

export type MessageActionSetChatWallPaper = {
  // flags: null // null;
  same?: boolean; // boolean;
  forBoth?: boolean; // boolean;
  wallpaper: TypeWallPaper; // Api.TypeWallPaper -> TypeWallPaper;
};

export type MessageActionSetMessagesTTL = {
  // flags: null // null;
  period: number; // int -> number;
  autoSettingFrom?: string; // long -> string;
};

export type MessageActionStarGift = {
  // flags: null // null;
  nameHidden?: boolean; // boolean;
  saved?: boolean; // boolean;
  converted?: boolean; // boolean;
  upgraded?: boolean; // boolean;
  refunded?: boolean; // boolean;
  canUpgrade?: boolean; // boolean;
  gift: TypeStarGift; // Api.TypeStarGift -> TypeStarGift;
  message?: TypeTextWithEntities; // Api.TypeTextWithEntities -> TypeTextWithEntities;
  convertStars?: string; // long -> string;
  upgradeMsgId?: number; // int -> number;
  upgradeStars?: string; // long -> string;
  fromId?: TypePeer; // Api.TypePeer -> TypePeer;
  peer?: TypePeer; // Api.TypePeer -> TypePeer;
  savedId?: string; // long -> string;
};

export type MessageActionStarGiftUnique = {
  // flags: null // null;
  upgrade?: boolean; // boolean;
  transferred?: boolean; // boolean;
  saved?: boolean; // boolean;
  refunded?: boolean; // boolean;
  gift: TypeStarGift; // Api.TypeStarGift -> TypeStarGift;
  canExportAt?: number; // int -> number;
  transferStars?: string; // long -> string;
  fromId?: TypePeer; // Api.TypePeer -> TypePeer;
  peer?: TypePeer; // Api.TypePeer -> TypePeer;
  savedId?: string; // long -> string;
};

export type MessageActionSuggestProfilePhoto = {
  photo: TypePhoto; // Api.TypePhoto -> TypePhoto;
};

export type MessageActionTopicCreate = {
  // flags: null // null;
  title: string; // string;
  iconColor: number; // int -> number;
  iconEmojiId?: string; // long -> string;
};

export type MessageActionTopicEdit = {
  // flags: null // null;
  title?: string; // string;
  iconEmojiId?: string; // long -> string;
  closed?: boolean; // Bool -> boolean;
  hidden?: boolean; // Bool -> boolean;
};

export type MessageActionWebViewDataSent = {
  text: string; // string;
};

export type MessageActionWebViewDataSentMe = {
  text: string; // string;
  data: string; // string;
};

export type MessageEmpty = {
  // flags: null // null;
  id: number; // int -> number;
  peerId?: TypePeer; // Api.TypePeer -> TypePeer;
};

export type MessageEntityBankCard = {
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageEntityBlockquote = {
  // flags: null // null;
  collapsed?: boolean; // boolean;
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageEntityBold = {
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageEntityBotCommand = {
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageEntityCashtag = {
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageEntityCode = {
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageEntityCustomEmoji = {
  offset: number; // int -> number;
  length: number; // int -> number;
  documentId: string; // long -> string;
};

export type MessageEntityEmail = {
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageEntityHashtag = {
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageEntityItalic = {
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageEntityMention = {
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageEntityMentionName = {
  offset: number; // int -> number;
  length: number; // int -> number;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
};

export type MessageEntityPhone = {
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageEntityPre = {
  offset: number; // int -> number;
  length: number; // int -> number;
  language: string; // string;
};

export type MessageEntitySpoiler = {
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageEntityStrike = {
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageEntityTextUrl = {
  offset: number; // int -> number;
  length: number; // int -> number;
  url: string; // string;
};

export type MessageEntityUnderline = {
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageEntityUnknown = {
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageEntityUrl = {
  offset: number; // int -> number;
  length: number; // int -> number;
};

export type MessageExtendedMedia = {
  media: TypeMessageMedia; // Api.TypeMessageMedia -> TypeMessageMedia;
};

export type MessageExtendedMediaPreview = {
  // flags: null // null;
  w?: number; // int -> number;
  h?: number; // int -> number;
  thumb?: TypePhotoSize; // Api.TypePhotoSize -> TypePhotoSize;
  videoDuration?: number; // int -> number;
};

export type MessageFwdHeader = {
  // flags: null // null;
  imported?: boolean; // boolean;
  savedOut?: boolean; // boolean;
  fromId?: TypePeer; // Api.TypePeer -> TypePeer;
  fromName?: string; // string;
  date: number; // int -> number;
  channelPost?: number; // int -> number;
  postAuthor?: string; // string;
  savedFromPeer?: TypePeer; // Api.TypePeer -> TypePeer;
  savedFromMsgId?: number; // int -> number;
  savedFromId?: TypePeer; // Api.TypePeer -> TypePeer;
  savedFromName?: string; // string;
  savedDate?: number; // int -> number;
  psaType?: string; // string;
};

export type MessageMediaContact = {
  phoneNumber: string; // string;
  firstName: string; // string;
  lastName: string; // string;
  vcard: string; // string;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
};

export type MessageMediaDice = {
  value: number; // int -> number;
  emoticon: string; // string;
};

export type MessageMediaDocument = {
  // flags: null // null;
  nopremium?: boolean; // boolean;
  spoiler?: boolean; // boolean;
  video?: boolean; // boolean;
  round?: boolean; // boolean;
  voice?: boolean; // boolean;
  document?: TypeDocument; // Api.TypeDocument -> TypeDocument;
  altDocuments?: TypeDocument; // Api.TypeDocument[];
  videoCover?: TypePhoto; // Api.TypePhoto -> TypePhoto;
  videoTimestamp?: number; // int -> number;
  ttlSeconds?: number; // int -> number;
};

export type MessageMediaGame = {
  game: TypeGame; // Api.TypeGame -> TypeGame;
};

export type MessageMediaGeo = {
  geo: TypeGeoPoint; // Api.TypeGeoPoint -> TypeGeoPoint;
};

export type MessageMediaGeoLive = {
  // flags: null // null;
  geo: TypeGeoPoint; // Api.TypeGeoPoint -> TypeGeoPoint;
  heading?: number; // int -> number;
  period: number; // int -> number;
  proximityNotificationRadius?: number; // int -> number;
};

export type MessageMediaGiveaway = {
  // flags: null // null;
  onlyNewSubscribers?: boolean; // boolean;
  winnersAreVisible?: boolean; // boolean;
  channels: string[]; // long[] -> string[];
  countriesIso2?: string[]; // string[];
  prizeDescription?: string; // string;
  quantity: number; // int -> number;
  months?: number; // int -> number;
  stars?: string; // long -> string;
  untilDate: number; // int -> number;
};

export type MessageMediaGiveawayResults = {
  // flags: null // null;
  onlyNewSubscribers?: boolean; // boolean;
  refunded?: boolean; // boolean;
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  additionalPeersCount?: number; // int -> number;
  launchMsgId: number; // int -> number;
  winnersCount: number; // int -> number;
  unclaimedCount: number; // int -> number;
  winners: string[]; // long[] -> string[];
  months?: number; // int -> number;
  stars?: string; // long -> string;
  prizeDescription?: string; // string;
  untilDate: number; // int -> number;
};

export type MessageMediaInvoice = {
  // flags: null // null;
  shippingAddressRequested?: boolean; // boolean;
  test?: boolean; // boolean;
  title: string; // string;
  description: string; // string;
  photo?: TypeWebDocument; // Api.TypeWebDocument -> TypeWebDocument;
  receiptMsgId?: number; // int -> number;
  currency: string; // string;
  totalAmount: string; // long -> string;
  startParam: string; // string;
  extendedMedia?: TypeMessageExtendedMedia; // Api.TypeMessageExtendedMedia -> TypeMessageExtendedMedia;
};

export type MessageMediaPaidMedia = {
  starsAmount: string; // long -> string;
  extendedMedia: TypeMessageExtendedMedia[]; // Api.TypeMessageExtendedMedia[];
};

export type MessageMediaPhoto = {
  // flags: null // null;
  spoiler?: boolean; // boolean;
  photo?: TypePhoto; // Api.TypePhoto -> TypePhoto;
  ttlSeconds?: number; // int -> number;
};

export type MessageMediaPoll = {
  poll: TypePoll; // Api.TypePoll -> TypePoll;
  results: TypePollResults; // Api.TypePollResults -> TypePollResults;
};

export type MessageMediaStory = {
  // flags: null // null;
  viaMention?: boolean; // boolean;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  id: number; // int -> number;
  story?: TypeStoryItem; // Api.TypeStoryItem -> TypeStoryItem;
};

export type MessageMediaVenue = {
  geo: TypeGeoPoint; // Api.TypeGeoPoint -> TypeGeoPoint;
  title: string; // string;
  address: string; // string;
  provider: string; // string;
  venueId: string; // string;
  venueType: string; // string;
};

export type MessageMediaWebPage = {
  // flags: null // null;
  forceLargeMedia?: boolean; // boolean;
  forceSmallMedia?: boolean; // boolean;
  manual?: boolean; // boolean;
  safe?: boolean; // boolean;
  webpage: TypeWebPage; // Api.TypeWebPage -> TypeWebPage;
};

export type MessagePeerReaction = {
  // flags: null // null;
  big?: boolean; // boolean;
  unread?: boolean; // boolean;
  my?: boolean; // boolean;
  peerId: TypePeer; // Api.TypePeer -> TypePeer;
  date: number; // int -> number;
  reaction: TypeReaction; // Api.TypeReaction -> TypeReaction;
};

export type MessagePeerVote = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  option: Uint8Array; // bytes -> Uint8Array;
  date: number; // int -> number;
};

export type MessagePeerVoteInputOption = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  date: number; // int -> number;
};

export type MessagePeerVoteMultiple = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  options: Uint8Array[]; // bytes[] -> Uint8Array[];
  date: number; // int -> number;
};

export type MessageRange = {
  minId: number; // int -> number;
  maxId: number; // int -> number;
};

export type MessageReactions = {
  // flags: null // null;
  min?: boolean; // boolean;
  canSeeList?: boolean; // boolean;
  reactionsAsTags?: boolean; // boolean;
  results: TypeReactionCount[]; // Api.TypeReactionCount[];
  recentReactions?: TypeMessagePeerReaction[]; // Api.TypeMessagePeerReaction[];
  topReactors?: TypeMessageReactor[]; // Api.TypeMessageReactor[];
};

export type MessageReactor = {
  // flags: null // null;
  top?: boolean; // boolean;
  my?: boolean; // boolean;
  anonymous?: boolean; // boolean;
  peerId?: TypePeer; // Api.TypePeer -> TypePeer;
  count: number; // int -> number;
};

export type MessageReplies = {
  // flags: null // null;
  comments?: boolean; // boolean;
  replies: number; // int -> number;
  repliesPts: number; // int -> number;
  recentRepliers?: TypePeer[]; // Api.TypePeer[];
  channelId?: string; // long -> string;
  maxId?: number; // int -> number;
  readMaxId?: number; // int -> number;
};

export type MessageReplyHeader = {
  // flags: null // null;
  replyToScheduled?: boolean; // boolean;
  forumTopic?: boolean; // boolean;
  quote?: boolean; // boolean;
  replyToMsgId?: number; // int -> number;
  replyToPeerId?: TypePeer; // Api.TypePeer -> TypePeer;
  replyFrom?: TypeMessageFwdHeader; // Api.TypeMessageFwdHeader -> TypeMessageFwdHeader;
  replyMedia?: TypeMessageMedia; // Api.TypeMessageMedia -> TypeMessageMedia;
  replyToTopId?: number; // int -> number;
  quoteText?: string; // string;
  quoteEntities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  quoteOffset?: number; // int -> number;
};

export type MessageReplyStoryHeader = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  storyId: number; // int -> number;
};

export type MessageReportOption = {
  text: string; // string;
  option: Uint8Array; // bytes -> Uint8Array;
};

export type MessageViews = {
  // flags: null // null;
  views?: number; // int -> number;
  forwards?: number; // int -> number;
  replies?: TypeMessageReplies; // Api.TypeMessageReplies -> TypeMessageReplies;
};

export type MissingInvitee = {
  // flags: null // null;
  premiumWouldAllowInvite?: boolean; // boolean;
  premiumRequiredForPm?: boolean; // boolean;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
};

export type MsgDetailedInfo = {
  msgId: string; // long -> string;
  answerMsgId: string; // long -> string;
  bytes: number; // int -> number;
  status: number; // int -> number;
};

export type MsgNewDetailedInfo = {
  answerMsgId: string; // long -> string;
  bytes: number; // int -> number;
  status: number; // int -> number;
};

export type MsgResendReq = {
  msgIds: string[]; // long[] -> string[];
};

export type MsgsAck = {
  msgIds: string[]; // long[] -> string[];
};

export type MsgsAllInfo = {
  msgIds: string[]; // long[] -> string[];
  info: string; // string;
};

export type MsgsStateInfo = {
  reqMsgId: string; // long -> string;
  info: string; // string;
};

export type MsgsStateReq = {
  msgIds: string[]; // long[] -> string[];
};

export type MyBoost = {
  // flags: null // null;
  slot: number; // int -> number;
  peer?: TypePeer; // Api.TypePeer -> TypePeer;
  date: number; // int -> number;
  expires: number; // int -> number;
  cooldownUntilDate?: number; // int -> number;
};

export type NearestDc = {
  country: string; // string;
  thisDc: number; // int -> number;
  nearestDc: number; // int -> number;
};

export type NewSessionCreated = {
  firstMsgId: string; // long -> string;
  uniqueId: string; // long -> string;
  serverSalt: string; // long -> string;
};

export type NotificationSoundLocal = {
  title: string; // string;
  data: string; // string;
};

export type NotificationSoundRingtone = {
  id: string; // long -> string;
};

export type NotifyForumTopic = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  topMsgId: number; // int -> number;
};

export type NotifyPeer = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
};

export type OutboxReadDate = {
  date: number; // int -> number;
};

export type Page = {
  // flags: null // null;
  part?: boolean; // boolean;
  rtl?: boolean; // boolean;
  v2?: boolean; // boolean;
  url: string; // string;
  blocks: TypePageBlock[]; // Api.TypePageBlock[];
  photos: TypePhoto[]; // Api.TypePhoto[];
  documents: TypeDocument; // Api.TypeDocument[];
  views?: number; // int -> number;
};

export type PageBlockAnchor = {
  name: string; // string;
};

export type PageBlockAudio = {
  audioId: string; // long -> string;
  caption: TypePageCaption; // Api.TypePageCaption -> TypePageCaption;
};

export type PageBlockAuthorDate = {
  author: TypeRichText; // Api.TypeRichText -> TypeRichText;
  publishedDate: number; // int -> number;
};

export type PageBlockBlockquote = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
  caption: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type PageBlockChannel = {
  channel: TypeChat; // Api.TypeChat -> TypeChat;
};

export type PageBlockCollage = {
  items: TypePageBlock[]; // Api.TypePageBlock[];
  caption: TypePageCaption; // Api.TypePageCaption -> TypePageCaption;
};

export type PageBlockCover = {
  cover: TypePageBlock; // Api.TypePageBlock -> TypePageBlock;
};

export type PageBlockDetails = {
  // flags: null // null;
  open?: boolean; // boolean;
  blocks: TypePageBlock[]; // Api.TypePageBlock[];
  title: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type PageBlockEmbed = {
  // flags: null // null;
  fullWidth?: boolean; // boolean;
  allowScrolling?: boolean; // boolean;
  url?: string; // string;
  html?: string; // string;
  posterPhotoId?: string; // long -> string;
  w?: number; // int -> number;
  h?: number; // int -> number;
  caption: TypePageCaption; // Api.TypePageCaption -> TypePageCaption;
};

export type PageBlockEmbedPost = {
  url: string; // string;
  webpageId: string; // long -> string;
  authorPhotoId: string; // long -> string;
  author: string; // string;
  date: number; // int -> number;
  blocks: TypePageBlock[]; // Api.TypePageBlock[];
  caption: TypePageCaption; // Api.TypePageCaption -> TypePageCaption;
};

export type PageBlockFooter = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type PageBlockHeader = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type PageBlockKicker = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type PageBlockList = {
  items: TypePageListItem[]; // Api.TypePageListItem[];
};

export type PageBlockMap = {
  geo: TypeGeoPoint; // Api.TypeGeoPoint -> TypeGeoPoint;
  zoom: number; // int -> number;
  w: number; // int -> number;
  h: number; // int -> number;
  caption: TypePageCaption; // Api.TypePageCaption -> TypePageCaption;
};

export type PageBlockOrderedList = {
  items: TypePageListOrderedItem[]; // Api.TypePageListOrderedItem[];
};

export type PageBlockParagraph = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type PageBlockPhoto = {
  // flags: null // null;
  photoId: string; // long -> string;
  caption: TypePageCaption; // Api.TypePageCaption -> TypePageCaption;
  url?: string; // string;
  webpageId?: string; // long -> string;
};

export type PageBlockPreformatted = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
  language: string; // string;
};

export type PageBlockPullquote = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
  caption: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type PageBlockRelatedArticles = {
  title: TypeRichText; // Api.TypeRichText -> TypeRichText;
  articles: TypePageRelatedArticle[]; // Api.TypePageRelatedArticle[];
};

export type PageBlockSlideshow = {
  items: TypePageBlock[]; // Api.TypePageBlock[];
  caption: TypePageCaption; // Api.TypePageCaption -> TypePageCaption;
};

export type PageBlockSubheader = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type PageBlockSubtitle = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type PageBlockTable = {
  // flags: null // null;
  bordered?: boolean; // boolean;
  striped?: boolean; // boolean;
  title: TypeRichText; // Api.TypeRichText -> TypeRichText;
  rows: TypePageTableRow[]; // Api.TypePageTableRow[];
};

export type PageBlockTitle = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type PageBlockVideo = {
  // flags: null // null;
  autoplay?: boolean; // boolean;
  loop?: boolean; // boolean;
  videoId: string; // long -> string;
  caption: TypePageCaption; // Api.TypePageCaption -> TypePageCaption;
};

export type PageCaption = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
  credit: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type PageListItemBlocks = {
  blocks: TypePageBlock[]; // Api.TypePageBlock[];
};

export type PageListItemText = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type PageListOrderedItemBlocks = {
  num: string; // string;
  blocks: TypePageBlock[]; // Api.TypePageBlock[];
};

export type PageListOrderedItemText = {
  num: string; // string;
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type PageRelatedArticle = {
  // flags: null // null;
  url: string; // string;
  webpageId: string; // long -> string;
  title?: string; // string;
  description?: string; // string;
  photoId?: string; // long -> string;
  author?: string; // string;
  publishedDate?: number; // int -> number;
};

export type PageTableCell = {
  // flags: null // null;
  header?: boolean; // boolean;
  alignCenter?: boolean; // boolean;
  alignRight?: boolean; // boolean;
  valignMiddle?: boolean; // boolean;
  valignBottom?: boolean; // boolean;
  text?: TypeRichText; // Api.TypeRichText -> TypeRichText;
  colspan?: number; // int -> number;
  rowspan?: number; // int -> number;
};

export type PageTableRow = {
  cells: TypePageTableCell[]; // Api.TypePageTableCell[];
};

export type PasswordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow = {
  salt1: Uint8Array; // bytes -> Uint8Array;
  salt2: Uint8Array; // bytes -> Uint8Array;
  g: number; // int -> number;
  p: Uint8Array; // bytes -> Uint8Array;
};

export type PaymentCharge = {
  id: string; // string;
  providerChargeId: string; // string;
};

export type PaymentFormMethod = {
  url: string; // string;
  title: string; // string;
};

export type PaymentRequestedInfo = {
  // flags: null // null;
  name?: string; // string;
  phone?: string; // string;
  email?: string; // string;
  shippingAddress?: TypePostAddress; // Api.TypePostAddress -> TypePostAddress;
};

export type PaymentSavedCredentialsCard = {
  id: string; // string;
  title: string; // string;
};

export type PeerBlocked = {
  peerId: TypePeer; // Api.TypePeer -> TypePeer;
  date: number; // int -> number;
};

export type PeerChannel = {
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
};

export type PeerChat = {
  chatId: string; // long -> string;
};

export type PeerColor = {
  // flags: null // null;
  color?: number; // int -> number;
  backgroundEmojiId?: string; // long -> string;
};

export type PeerLocated = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  expires: number; // int -> number;
  distance: number; // int -> number;
};

export type PeerNotifySettings = {
  // flags: null // null;
  showPreviews?: boolean; // Bool -> boolean;
  silent?: boolean; // Bool -> boolean;
  muteUntil?: number; // int -> number;
  iosSound?: TypeNotificationSound; // Api.TypeNotificationSound -> TypeNotificationSound;
  androidSound?: TypeNotificationSound; // Api.TypeNotificationSound -> TypeNotificationSound;
  otherSound?: TypeNotificationSound; // Api.TypeNotificationSound -> TypeNotificationSound;
  storiesMuted?: boolean; // Bool -> boolean;
  storiesHideSender?: boolean; // Bool -> boolean;
  storiesIosSound?: TypeNotificationSound; // Api.TypeNotificationSound -> TypeNotificationSound;
  storiesAndroidSound?: TypeNotificationSound; // Api.TypeNotificationSound -> TypeNotificationSound;
  storiesOtherSound?: TypeNotificationSound; // Api.TypeNotificationSound -> TypeNotificationSound;
};

export type PeerSelfLocated = {
  expires: number; // int -> number;
};

export type PeerSettings = {
  // flags: null // null;
  reportSpam?: boolean; // boolean;
  addContact?: boolean; // boolean;
  blockContact?: boolean; // boolean;
  shareContact?: boolean; // boolean;
  needContactsException?: boolean; // boolean;
  reportGeo?: boolean; // boolean;
  autoarchived?: boolean; // boolean;
  inviteMembers?: boolean; // boolean;
  requestChatBroadcast?: boolean; // boolean;
  businessBotPaused?: boolean; // boolean;
  businessBotCanReply?: boolean; // boolean;
  geoDistance?: number; // int -> number;
  requestChatTitle?: string; // string;
  requestChatDate?: number; // int -> number;
  businessBotId?: string; // long -> string;
  businessBotManageUrl?: string; // string;
};

export type PeerStories = {
  // flags: null // null;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  maxReadId?: number; // int -> number;
  stories: TypeStoryItem[]; // Api.TypeStoryItem[];
};

export type PeerUser = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
};

export type PhoneCall = {
  // flags: null // null;
  p2pAllowed?: boolean; // boolean;
  video?: boolean; // boolean;
  id: string; // long -> string;
  accessHash: string; // long -> string;
  date: number; // int -> number;
  adminId: string; // long -> string;
  participantId: string; // long -> string;
  gAOrB: Uint8Array; // bytes -> Uint8Array;
  keyFingerprint: string; // long -> string;
  protocol: TypePhoneCallProtocol; // Api.TypePhoneCallProtocol -> TypePhoneCallProtocol;
  connections: TypePhoneConnection[]; // Api.TypePhoneConnection[];
  startDate: number; // int -> number;
  customParameters?: TypeDataJSON; // Api.TypeDataJSON -> TypeDataJSON;
  conferenceCall?: TypeInputGroupCall; // Api.TypeInputGroupCall -> TypeInputGroupCall;
};

export type PhoneCallAccepted = {
  // flags: null // null;
  video?: boolean; // boolean;
  id: string; // long -> string;
  accessHash: string; // long -> string;
  date: number; // int -> number;
  adminId: string; // long -> string;
  participantId: string; // long -> string;
  gB: Uint8Array; // bytes -> Uint8Array;
  protocol: TypePhoneCallProtocol; // Api.TypePhoneCallProtocol -> TypePhoneCallProtocol;
  conferenceCall?: TypeInputGroupCall; // Api.TypeInputGroupCall -> TypeInputGroupCall;
};

export type PhoneCallDiscarded = {
  // flags: null // null;
  needRating?: boolean; // boolean;
  needDebug?: boolean; // boolean;
  video?: boolean; // boolean;
  id: string; // long -> string;
  reason?: TypePhoneCallDiscardReason; // Api.TypePhoneCallDiscardReason -> TypePhoneCallDiscardReason;
  duration?: number; // int -> number;
  conferenceCall?: TypeInputGroupCall; // Api.TypeInputGroupCall -> TypeInputGroupCall;
};

export type PhoneCallDiscardReasonAllowGroupCall = {
  encryptedKey: Uint8Array; // bytes -> Uint8Array;
};

export type PhoneCallEmpty = {
  id: string; // long -> string;
};

export type PhoneCallProtocol = {
  // flags: null // null;
  udpP2p?: boolean; // boolean;
  udpReflector?: boolean; // boolean;
  minLayer: number; // int -> number;
  maxLayer: number; // int -> number;
  libraryVersions: string[]; // string[];
};

export type PhoneCallRequested = {
  // flags: null // null;
  video?: boolean; // boolean;
  id: string; // long -> string;
  accessHash: string; // long -> string;
  date: number; // int -> number;
  adminId: string; // long -> string;
  participantId: string; // long -> string;
  gAHash: Uint8Array; // bytes -> Uint8Array;
  protocol: TypePhoneCallProtocol; // Api.TypePhoneCallProtocol -> TypePhoneCallProtocol;
  conferenceCall?: TypeInputGroupCall; // Api.TypeInputGroupCall -> TypeInputGroupCall;
};

export type PhoneCallWaiting = {
  // flags: null // null;
  video?: boolean; // boolean;
  id: string; // long -> string;
  accessHash: string; // long -> string;
  date: number; // int -> number;
  adminId: string; // long -> string;
  participantId: string; // long -> string;
  protocol: TypePhoneCallProtocol; // Api.TypePhoneCallProtocol -> TypePhoneCallProtocol;
  receiveDate?: number; // int -> number;
  conferenceCall?: TypeInputGroupCall; // Api.TypeInputGroupCall -> TypeInputGroupCall;
};

export type PhoneConnection = {
  // flags: null // null;
  tcp?: boolean; // boolean;
  id: string; // long -> string;
  ip: string; // string;
  ipv6: string; // string;
  port: number; // int -> number;
  peerTag: Uint8Array; // bytes -> Uint8Array;
};

export type PhoneConnectionWebrtc = {
  // flags: null // null;
  turn?: boolean; // boolean;
  stun?: boolean; // boolean;
  id: string; // long -> string;
  ip: string; // string;
  ipv6: string; // string;
  port: number; // int -> number;
  username: string; // string;
  password: string; // string;
};

export type Poll = {
  id: string; // long -> string;
  // flags: null // null;
  closed?: boolean; // boolean;
  publicVoters?: boolean; // boolean;
  multipleChoice?: boolean; // boolean;
  quiz?: boolean; // boolean;
  question: TypeTextWithEntities; // Api.TypeTextWithEntities -> TypeTextWithEntities;
  answers: TypePollAnswer[]; // Api.TypePollAnswer[];
  closePeriod?: number; // int -> number;
  closeDate?: number; // int -> number;
};

export type PollAnswer = {
  text: TypeTextWithEntities; // Api.TypeTextWithEntities -> TypeTextWithEntities;
  option: Uint8Array; // bytes -> Uint8Array;
};

export type PollAnswerVoters = {
  // flags: null // null;
  chosen?: boolean; // boolean;
  correct?: boolean; // boolean;
  option: Uint8Array; // bytes -> Uint8Array;
  voters: number; // int -> number;
};

export type PollResults = {
  // flags: null // null;
  min?: boolean; // boolean;
  results?: TypePollAnswerVoters[]; // Api.TypePollAnswerVoters[];
  totalVoters?: number; // int -> number;
  recentVoters?: TypePeer[]; // Api.TypePeer[];
  solution?: string; // string;
  solutionEntities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
};

export type Pong = {
  msgId: string; // long -> string;
  pingId: string; // long -> string;
};

export type PopularContact = {
  clientId: string; // long -> string;
  importers: number; // int -> number;
};

export type PostAddress = {
  streetLine1: string; // string;
  streetLine2: string; // string;
  city: string; // string;
  state: string; // string;
  countryIso2: string; // string;
  postCode: string; // string;
};

export type PostInteractionCountersMessage = {
  msgId: number; // int -> number;
  views: number; // int -> number;
  forwards: number; // int -> number;
  reactions: number; // int -> number;
};

export type PostInteractionCountersStory = {
  storyId: number; // int -> number;
  views: number; // int -> number;
  forwards: number; // int -> number;
  reactions: number; // int -> number;
};

export type PQInnerData = {
  pq: Uint8Array; // bytes -> Uint8Array;
  p: Uint8Array; // bytes -> Uint8Array;
  q: Uint8Array; // bytes -> Uint8Array;
  nonce: string; // int128 -> string;
  serverNonce: string; // int128 -> string;
  newNonce: string; // int256 -> string;
};

export type PQInnerDataDc = {
  pq: Uint8Array; // bytes -> Uint8Array;
  p: Uint8Array; // bytes -> Uint8Array;
  q: Uint8Array; // bytes -> Uint8Array;
  nonce: string; // int128 -> string;
  serverNonce: string; // int128 -> string;
  newNonce: string; // int256 -> string;
  dc: number; // int -> number;
};

export type PQInnerDataTemp = {
  pq: Uint8Array; // bytes -> Uint8Array;
  p: Uint8Array; // bytes -> Uint8Array;
  q: Uint8Array; // bytes -> Uint8Array;
  nonce: string; // int128 -> string;
  serverNonce: string; // int128 -> string;
  newNonce: string; // int256 -> string;
  expiresIn: number; // int -> number;
};

export type PQInnerDataTempDc = {
  pq: Uint8Array; // bytes -> Uint8Array;
  p: Uint8Array; // bytes -> Uint8Array;
  q: Uint8Array; // bytes -> Uint8Array;
  nonce: string; // int128 -> string;
  serverNonce: string; // int128 -> string;
  newNonce: string; // int256 -> string;
  dc: number; // int -> number;
  expiresIn: number; // int -> number;
};

export type PremiumGiftCodeOption = {
  // flags: null // null;
  users: number; // int -> number;
  months: number; // int -> number;
  storeProduct?: string; // string;
  storeQuantity?: number; // int -> number;
  currency: string; // string;
  amount: string; // long -> string;
};

export type PremiumGiftOption = {
  // flags: null // null;
  months: number; // int -> number;
  currency: string; // string;
  amount: string; // long -> string;
  botUrl: string; // string;
  storeProduct?: string; // string;
};

export type PremiumSubscriptionOption = {
  // flags: null // null;
  current?: boolean; // boolean;
  canPurchaseUpgrade?: boolean; // boolean;
  transaction?: string; // string;
  months: number; // int -> number;
  currency: string; // string;
  amount: string; // long -> string;
  botUrl: string; // string;
  storeProduct?: string; // string;
};

export type PrepaidGiveaway = {
  id: string; // long -> string;
  months: number; // int -> number;
  quantity: number; // int -> number;
  date: number; // int -> number;
};

export type PrepaidStarsGiveaway = {
  id: string; // long -> string;
  stars: string; // long -> string;
  quantity: number; // int -> number;
  boosts: number; // int -> number;
  date: number; // int -> number;
};

export type PrivacyValueAllowChatParticipants = {
  chats: string[]; // long[] -> string[];
};

export type PrivacyValueAllowUsers = {
  users: string[]; // long[] -> string[];
};

export type PrivacyValueDisallowChatParticipants = {
  chats: string[]; // long[] -> string[];
};

export type PrivacyValueDisallowUsers = {
  users: string[]; // long[] -> string[];
};

export type ProfileTab =
  | { _: 'profileTabPosts' }
  | { _: 'profileTabGifts' }
  | { _: 'profileTabMedia' }
  | { _: 'profileTabFiles' }
  | { _: 'profileTabMusic' }
  | { _: 'profileTabVoice' }
  | { _: 'profileTabLinks' }
  | { _: 'profileTabGifs' };

export type PublicForwardMessage = {
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
};

export type PublicForwardStory = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  story: TypeStoryItem; // Api.TypeStoryItem -> TypeStoryItem;
};

export type QuickReply = {
  shortcutId: number; // int -> number;
  shortcut: string; // string;
  topMessage: number; // int -> number;
  count: number; // int -> number;
};

export type ReactionEmpty = {
  empty: true;
};

export type ReactionPaid = {
  paid: true;
};

export type ReactionCount = {
  // flags: null // null;
  chosenOrder?: number; // int -> number;
  reaction: TypeReaction; // Api.TypeReaction -> TypeReaction;
  count: number; // int -> number;
};

export type ReactionCustomEmoji = {
  documentId: string; // long -> string;
};

export type ReactionEmoji = {
  emoticon: string; // string;
};

export type ReactionsNotifySettings = {
  // flags: null // null;
  messagesNotifyFrom?: TypeReactionNotificationsFrom; // Api.TypeReactionNotificationsFrom -> TypeReactionNotificationsFrom;
  storiesNotifyFrom?: TypeReactionNotificationsFrom; // Api.TypeReactionNotificationsFrom -> TypeReactionNotificationsFrom;
  sound: TypeNotificationSound; // Api.TypeNotificationSound -> TypeNotificationSound;
  showPreviews: boolean; // Bool -> boolean;
};

export type ReadParticipantDate = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  date: number; // int -> number;
};

export type ReceivedNotifyMessage = {
  id: number; // int -> number;
  flags: number; // int -> number;
};

export type RecentMeUrlChat = {
  url: string; // string;
  chatId: string; // long -> string;
};

export type RecentMeUrlChatInvite = {
  url: string; // string;
  chatInvite: TypeChatInvite; // Api.TypeChatInvite -> TypeChatInvite;
};

export type RecentMeUrlStickerSet = {
  url: string; // string;
  set: TypeStickerSetCovered; // Api.TypeStickerSetCovered -> TypeStickerSetCovered;
};

export type RecentMeUrlUnknown = {
  url: string; // string;
};

export type RecentMeUrlUser = {
  url: string; // string;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
};

export type ReplyInlineMarkup = {
  rows: TypeKeyboardButtonRow[]; // Api.TypeKeyboardButtonRow[];
};

export type ReplyKeyboardForceReply = {
  // flags: null // null;
  singleUse?: boolean; // boolean;
  selective?: boolean; // boolean;
  placeholder?: string; // string;
};

export type ReplyKeyboardHide = {
  // flags: null // null;
  selective?: boolean; // boolean;
};

export type ReplyKeyboardMarkup = {
  // flags: null // null;
  resize?: boolean; // boolean;
  singleUse?: boolean; // boolean;
  selective?: boolean; // boolean;
  persistent?: boolean; // boolean;
  rows: TypeKeyboardButtonRow[]; // Api.TypeKeyboardButtonRow[];
  placeholder?: string; // string;
};

export type ReportResultAddComment = {
  // flags: null // null;
  optional?: boolean; // boolean;
  option: Uint8Array; // bytes -> Uint8Array;
};

export type ReportResultChooseOption = {
  title: string; // string;
  options: TypeMessageReportOption[]; // Api.TypeMessageReportOption[];
};

export type RequestedPeerChannel = {
  // flags: null // null;
  channelId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  title?: string; // string;
  username?: string; // string;
  photo?: TypePhoto; // Api.TypePhoto -> TypePhoto;
};

export type RequestedPeerChat = {
  // flags: null // null;
  chatId: string; // long -> string;
  title?: string; // string;
  photo?: TypePhoto; // Api.TypePhoto -> TypePhoto;
};

export type RequestedPeerUser = {
  // flags: null // null;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  firstName?: string; // string;
  lastName?: string; // string;
  username?: string; // string;
  photo?: TypePhoto; // Api.TypePhoto -> TypePhoto;
};

export type RequestPeerTypeBroadcast = {
  // flags: null // null;
  creator?: boolean; // boolean;
  hasUsername?: boolean; // Bool -> boolean;
  userAdminRights?: TypeChatAdminRights; // Api.TypeChatAdminRights -> TypeChatAdminRights;
  botAdminRights?: TypeChatAdminRights; // Api.TypeChatAdminRights -> TypeChatAdminRights;
};

export type RequestPeerTypeChat = {
  // flags: null // null;
  creator?: boolean; // boolean;
  botParticipant?: boolean; // boolean;
  hasUsername?: boolean; // Bool -> boolean;
  forum?: boolean; // Bool -> boolean;
  userAdminRights?: TypeChatAdminRights; // Api.TypeChatAdminRights -> TypeChatAdminRights;
  botAdminRights?: TypeChatAdminRights; // Api.TypeChatAdminRights -> TypeChatAdminRights;
};

export type RequestPeerTypeUser = {
  // flags: null // null;
  bot?: boolean; // Bool -> boolean;
  premium?: boolean; // Bool -> boolean;
};

export type ResPQ = {
  nonce: string; // int128 -> string;
  serverNonce: string; // int128 -> string;
  pq: Uint8Array; // bytes -> Uint8Array;
  serverPublicKeyFingerprints: string[]; // long[] -> string[];
};

export type RestrictionReason = {
  platform: string; // string;
  reason: string; // string;
  text: string; // string;
};

export type RpcAnswerDropped = {
  msgId: string; // long -> string;
  seqNo: number; // int -> number;
  bytes: number; // int -> number;
};

export type RpcError = {
  errorCode: number; // int -> number;
  errorMessage: string; // string;
};

export type SavedDialog = {
  // flags: null // null;
  pinned?: boolean; // boolean;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  topMessage: number; // int -> number;
};

export type SavedPhoneContact = {
  phone: string; // string;
  firstName: string; // string;
  lastName: string; // string;
  date: number; // int -> number;
};

export type SavedReactionTag = {
  // flags: null // null;
  reaction: TypeReaction; // Api.TypeReaction -> TypeReaction;
  title?: string; // string;
  count: number; // int -> number;
};

export type SavedStarGift = {
  // flags: null // null;
  nameHidden?: boolean; // boolean;
  unsaved?: boolean; // boolean;
  refunded?: boolean; // boolean;
  canUpgrade?: boolean; // boolean;
  fromId?: TypePeer; // Api.TypePeer -> TypePeer;
  date: number; // int -> number;
  gift: TypeStarGift; // Api.TypeStarGift -> TypeStarGift;
  message?: TypeTextWithEntities; // Api.TypeTextWithEntities -> TypeTextWithEntities;
  msgId?: number; // int -> number;
  savedId?: string; // long -> string;
  convertStars?: string; // long -> string;
  upgradeStars?: string; // long -> string;
  canExportAt?: number; // int -> number;
  transferStars?: string; // long -> string;
};

export type SearchResultPosition = {
  msgId: number; // int -> number;
  date: number; // int -> number;
  offset: number; // int -> number;
};

export type SearchResultsCalendarPeriod = {
  date: number; // int -> number;
  minMsgId: number; // int -> number;
  maxMsgId: number; // int -> number;
  count: number; // int -> number;
};

export type SecureCredentialsEncrypted = {
  data: Uint8Array; // bytes -> Uint8Array;
  hash: Uint8Array; // bytes -> Uint8Array;
  secret: Uint8Array; // bytes -> Uint8Array;
};

export type SecureData = {
  data: Uint8Array; // bytes -> Uint8Array;
  dataHash: Uint8Array; // bytes -> Uint8Array;
  secret: Uint8Array; // bytes -> Uint8Array;
};

export type SecureFile = {
  id: string; // long -> string;
  accessHash: string; // long -> string;
  size: string; // long -> string;
  dcId: number; // int -> number;
  date: number; // int -> number;
  fileHash: Uint8Array; // bytes -> Uint8Array;
  secret: Uint8Array; // bytes -> Uint8Array;
};

export type SecurePasswordKdfAlgoPBKDF2HMACSHA512iter100000 = {
  salt: Uint8Array; // bytes -> Uint8Array;
};

export type SecurePasswordKdfAlgoSHA512 = {
  salt: Uint8Array; // bytes -> Uint8Array;
};

export type SecurePlainEmail = {
  email: string; // string;
};

export type SecurePlainPhone = {
  phone: string; // string;
};

export type SecureRequiredType = {
  // flags: null // null;
  nativeNames?: boolean; // boolean;
  selfieRequired?: boolean; // boolean;
  translationRequired?: boolean; // boolean;
  type: TypeSecureValueType; // Api.TypeSecureValueType -> TypeSecureValueType;
};

export type SecureRequiredTypeOneOf = {
  types: TypeSecureRequiredType[]; // Api.TypeSecureRequiredType[];
};

export type SecureSecretSettings = {
  secureAlgo: TypeSecurePasswordKdfAlgo; // Api.TypeSecurePasswordKdfAlgo -> TypeSecurePasswordKdfAlgo;
  secureSecret: Uint8Array; // bytes -> Uint8Array;
  secureSecretId: string; // long -> string;
};

export type SecureValue = {
  // flags: null // null;
  type: TypeSecureValueType; // Api.TypeSecureValueType -> TypeSecureValueType;
  data?: TypeSecureData; // Api.TypeSecureData -> TypeSecureData;
  frontSide?: TypeSecureFile; // Api.TypeSecureFile -> TypeSecureFile;
  reverseSide?: TypeSecureFile; // Api.TypeSecureFile -> TypeSecureFile;
  selfie?: TypeSecureFile; // Api.TypeSecureFile -> TypeSecureFile;
  translation?: TypeSecureFile[]; // Api.TypeSecureFile[];
  files?: TypeSecureFile[]; // Api.TypeSecureFile[];
  plainData?: TypeSecurePlainData; // Api.TypeSecurePlainData -> TypeSecurePlainData;
  hash: Uint8Array; // bytes -> Uint8Array;
};

export type SecureValueError = {
  type: TypeSecureValueType; // Api.TypeSecureValueType -> TypeSecureValueType;
  hash: Uint8Array; // bytes -> Uint8Array;
  text: string; // string;
};

export type SecureValueErrorData = {
  type: TypeSecureValueType; // Api.TypeSecureValueType -> TypeSecureValueType;
  dataHash: Uint8Array; // bytes -> Uint8Array;
  field: string; // string;
  text: string; // string;
};

export type SecureValueErrorFile = {
  type: TypeSecureValueType; // Api.TypeSecureValueType -> TypeSecureValueType;
  fileHash: Uint8Array; // bytes -> Uint8Array;
  text: string; // string;
};

export type SecureValueErrorFiles = {
  type: TypeSecureValueType; // Api.TypeSecureValueType -> TypeSecureValueType;
  fileHash: Uint8Array[]; // bytes[] -> Uint8Array[];
  text: string; // string;
};

export type SecureValueErrorFrontSide = {
  type: TypeSecureValueType; // Api.TypeSecureValueType -> TypeSecureValueType;
  fileHash: Uint8Array; // bytes -> Uint8Array;
  text: string; // string;
};

export type SecureValueErrorReverseSide = {
  type: TypeSecureValueType; // Api.TypeSecureValueType -> TypeSecureValueType;
  fileHash: Uint8Array; // bytes -> Uint8Array;
  text: string; // string;
};

export type SecureValueErrorSelfie = {
  type: TypeSecureValueType; // Api.TypeSecureValueType -> TypeSecureValueType;
  fileHash: Uint8Array; // bytes -> Uint8Array;
  text: string; // string;
};

export type SecureValueErrorTranslationFile = {
  type: TypeSecureValueType; // Api.TypeSecureValueType -> TypeSecureValueType;
  fileHash: Uint8Array; // bytes -> Uint8Array;
  text: string; // string;
};

export type SecureValueErrorTranslationFiles = {
  type: TypeSecureValueType; // Api.TypeSecureValueType -> TypeSecureValueType;
  fileHash: Uint8Array[]; // bytes[] -> Uint8Array[];
  text: string; // string;
};

export type SecureValueHash = {
  type: TypeSecureValueType; // Api.TypeSecureValueType -> TypeSecureValueType;
  hash: Uint8Array; // bytes -> Uint8Array;
};

export type SendAsPeer = {
  // flags: null // null;
  premiumRequired?: boolean; // boolean;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
};

export type SendMessageEmojiInteraction = {
  emoticon: string; // string;
  msgId: number; // int -> number;
  interaction: TypeDataJSON; // Api.TypeDataJSON -> TypeDataJSON;
};

export type SendMessageEmojiInteractionSeen = {
  emoticon: string; // string;
};

export type SendMessageHistoryImportAction = {
  progress: number; // int -> number;
};

export type SendMessageUploadAudioAction = {
  progress: number; // int -> number;
};

export type SendMessageUploadDocumentAction = {
  progress: number; // int -> number;
};

export type SendMessageUploadPhotoAction = {
  progress: number; // int -> number;
};

export type SendMessageUploadRoundAction = {
  progress: number; // int -> number;
};

export type SendMessageUploadVideoAction = {
  progress: number; // int -> number;
};

export type ServerDHInnerData = {
  nonce: string; // int128 -> string;
  serverNonce: string; // int128 -> string;
  g: number; // int -> number;
  dhPrime: Uint8Array; // bytes -> Uint8Array;
  gA: Uint8Array; // bytes -> Uint8Array;
  serverTime: number; // int -> number;
};

export type ServerDHParamsFail = {
  nonce: string; // int128 -> string;
  serverNonce: string; // int128 -> string;
  newNonceHash: string; // int128 -> string;
};

export type ServerDHParamsOk = {
  nonce: string; // int128 -> string;
  serverNonce: string; // int128 -> string;
  encryptedAnswer: Uint8Array; // bytes -> Uint8Array;
};

export type ShippingOption = {
  id: string; // string;
  title: string; // string;
  prices: TypeLabeledPrice[]; // Api.TypeLabeledPrice[];
};

export type SmsJob = {
  jobId: string; // string;
  phoneNumber: string; // string;
  text: string; // string;
};

export type SponsoredMessage = {
  // flags: null // null;
  recommended?: boolean; // boolean;
  canReport?: boolean; // boolean;
  randomId: Uint8Array; // bytes -> Uint8Array;
  url: string; // string;
  title: string; // string;
  message: string; // string;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  photo?: TypePhoto; // Api.TypePhoto -> TypePhoto;
  media?: TypeMessageMedia; // Api.TypeMessageMedia -> TypeMessageMedia;
  color?: TypePeerColor; // Api.TypePeerColor -> TypePeerColor;
  buttonText: string; // string;
  sponsorInfo?: string; // string;
  additionalInfo?: string; // string;
};

export type SponsoredMessageReportOption = {
  text: string; // string;
  option: Uint8Array; // bytes -> Uint8Array;
};

export type StarGift = {
  // flags: null // null;
  limited?: boolean; // boolean;
  soldOut?: boolean; // boolean;
  birthday?: boolean; // boolean;
  id: string; // long -> string;
  sticker: TypeDocument; // Api.TypeDocument -> TypeDocument;
  stars: string; // long -> string;
  availabilityRemains?: number; // int -> number;
  availabilityTotal?: number; // int -> number;
  convertStars: string; // long -> string;
  firstSaleDate?: number; // int -> number;
  lastSaleDate?: number; // int -> number;
  upgradeStars?: string; // long -> string;
};

export type StarGiftAttributeBackdrop = {
  name: string; // string;
  centerColor: number; // int -> number;
  edgeColor: number; // int -> number;
  patternColor: number; // int -> number;
  textColor: number; // int -> number;
  rarityPermille: number; // int -> number;
};

export type StarGiftAttributeModel = {
  name: string; // string;
  document: TypeDocument; // Api.TypeDocument -> TypeDocument;
  rarityPermille: number; // int -> number;
};

export type StarGiftAttributeOriginalDetails = {
  // flags: null // null;
  senderId?: TypePeer; // Api.TypePeer -> TypePeer;
  recipientId: TypePeer; // Api.TypePeer -> TypePeer;
  date: number; // int -> number;
  message?: TypeTextWithEntities; // Api.TypeTextWithEntities -> TypeTextWithEntities;
};

export type StarGiftAttributePattern = {
  name: string; // string;
  document: TypeDocument; // Api.TypeDocument -> TypeDocument;
  rarityPermille: number; // int -> number;
};

export type StarGiftUnique = {
  // flags: null // null;
  id: string; // long -> string;
  title: string; // string;
  slug: string; // string;
  num: number; // int -> number;
  ownerId?: TypePeer; // Api.TypePeer -> TypePeer;
  ownerName?: string; // string;
  ownerAddress?: string; // string;
  attributes: TypeStarGiftAttribute[]; // Api.TypeStarGiftAttribute[];
  availabilityIssued: number; // int -> number;
  availabilityTotal: number; // int -> number;
};

export type StarRefProgram = {
  // flags: null // null;
  botId: string; // long -> string;
  commissionPermille: number; // int -> number;
  durationMonths?: number; // int -> number;
  endDate?: number; // int -> number;
  dailyRevenuePerUser?: TypeStarsAmount; // Api.TypeStarsAmount -> TypeStarsAmount;
};

export type StarsAmount = {
  amount: string; // long -> string;
  nanos: number; // int -> number;
};

export type StarsGiftOption = {
  // flags: null // null;
  extended?: boolean; // boolean;
  stars: string; // long -> string;
  storeProduct?: string; // string;
  currency: string; // string;
  amount: string; // long -> string;
};

export type StarsGiveawayOption = {
  // flags: null // null;
  extended?: boolean; // boolean;
  default?: boolean; // boolean;
  stars: string; // long -> string;
  yearlyBoosts: number; // int -> number;
  storeProduct?: string; // string;
  currency: string; // string;
  amount: string; // long -> string;
  winners: TypeStarsGiveawayWinnersOption[]; // Api.TypeStarsGiveawayWinnersOption[];
};

export type StarsGiveawayWinnersOption = {
  // flags: null // null;
  default?: boolean; // boolean;
  users: number; // int -> number;
  perUserStars: string; // long -> string;
};

export type StarsRating = {
  level: number; // int -> number;
  currentLevelStars: string; // long -> string;
  stars: string; // long -> string;
  nextLevelStars?: string; // long -> string;
};

export type StarsRevenueStatus = {
  // flags: null // null;
  withdrawalEnabled?: boolean; // boolean;
  currentBalance: TypeStarsAmount; // Api.TypeStarsAmount -> TypeStarsAmount;
  availableBalance: TypeStarsAmount; // Api.TypeStarsAmount -> TypeStarsAmount;
  overallRevenue: TypeStarsAmount; // Api.TypeStarsAmount -> TypeStarsAmount;
  nextWithdrawalAt?: number; // int -> number;
};

export type StarsSubscription = {
  // flags: null // null;
  canceled?: boolean; // boolean;
  canRefulfill?: boolean; // boolean;
  missingBalance?: boolean; // boolean;
  botCanceled?: boolean; // boolean;
  id: string; // string;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  untilDate: number; // int -> number;
  pricing: TypeStarsSubscriptionPricing; // Api.TypeStarsSubscriptionPricing -> TypeStarsSubscriptionPricing;
  chatInviteHash?: string; // string;
  title?: string; // string;
  photo?: TypeWebDocument; // Api.TypeWebDocument -> TypeWebDocument;
  invoiceSlug?: string; // string;
};

export type StarsSubscriptionPricing = {
  period: number; // int -> number;
  amount: string; // long -> string;
};

export type StarsTopupOption = {
  // flags: null // null;
  extended?: boolean; // boolean;
  stars: string; // long -> string;
  storeProduct?: string; // string;
  currency: string; // string;
  amount: string; // long -> string;
};

export type StarsTransaction = {
  // flags: null // null;
  refund?: boolean; // boolean;
  pending?: boolean; // boolean;
  failed?: boolean; // boolean;
  gift?: boolean; // boolean;
  reaction?: boolean; // boolean;
  stargiftUpgrade?: boolean; // boolean;
  id: string; // string;
  stars: TypeStarsAmount; // Api.TypeStarsAmount -> TypeStarsAmount;
  date: number; // int -> number;
  peer: TypeStarsTransactionPeer; // Api.TypeStarsTransactionPeer -> TypeStarsTransactionPeer;
  title?: string; // string;
  description?: string; // string;
  photo?: TypeWebDocument; // Api.TypeWebDocument -> TypeWebDocument;
  transactionDate?: number; // int -> number;
  transactionUrl?: string; // string;
  botPayload?: Uint8Array; // bytes -> Uint8Array;
  msgId?: number; // int -> number;
  extendedMedia?: TypeMessageMedia[]; // Api.TypeMessageMedia[];
  subscriptionPeriod?: number; // int -> number;
  giveawayPostId?: number; // int -> number;
  stargift?: TypeStarGift; // Api.TypeStarGift -> TypeStarGift;
  floodskipNumber?: number; // int -> number;
  starrefCommissionPermille?: number; // int -> number;
  starrefPeer?: TypePeer; // Api.TypePeer -> TypePeer;
  starrefAmount?: TypeStarsAmount; // Api.TypeStarsAmount -> TypeStarsAmount;
};

export type StarsTransactionPeer = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
};

export type StatsAbsValueAndPrev = {
  current: number; // double -> number;
  previous: number; // double -> number;
};

export type StatsDateRangeDays = {
  minDate: number; // int -> number;
  maxDate: number; // int -> number;
};

export type StatsGraph = {
  // flags: null // null;
  json: TypeDataJSON; // Api.TypeDataJSON -> TypeDataJSON;
  zoomToken?: string; // string;
};

export type StatsGraphAsync = {
  token: string; // string;
};

export type StatsGraphError = {
  error: string; // string;
};

export type StatsGroupTopAdmin = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  deleted: number; // int -> number;
  kicked: number; // int -> number;
  banned: number; // int -> number;
};

export type StatsGroupTopInviter = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  invitations: number; // int -> number;
};

export type StatsGroupTopPoster = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  messages: number; // int -> number;
  avgChars: number; // int -> number;
};

export type StatsPercentValue = {
  part: number; // double -> number;
  total: number; // double -> number;
};

export type StatsURL = {
  url: string; // string;
};

export type StickerKeyword = {
  documentId: string; // long -> string;
  keyword: string[]; // string[];
};

export type StickerPack = {
  emoticon: string; // string;
  documents: string[]; // long[] -> string[];
};

export type StickerSet = {
  // flags: null // null;
  archived?: boolean; // boolean;
  official?: boolean; // boolean;
  masks?: boolean; // boolean;
  emojis?: boolean; // boolean;
  textColor?: boolean; // boolean;
  channelEmojiStatus?: boolean; // boolean;
  creator?: boolean; // boolean;
  installedDate?: number; // int -> number;
  id: string; // long -> string;
  accessHash: string; // long -> string;
  title: string; // string;
  shortName: string; // string;
  thumbs?: TypePhotoSize[]; // Api.TypePhotoSize[];
  thumbDcId?: number; // int -> number;
  thumbVersion?: number; // int -> number;
  thumbDocumentId?: string; // long -> string;
  count: number; // int -> number;
  hash: number; // int -> number;
};

export type StickerSetCovered = {
  set: TypeStickerSet; // Api.TypeStickerSet -> TypeStickerSet;
  cover: TypeDocument; // Api.TypeDocument -> TypeDocument;
};

export type StickerSetFullCovered = {
  set: TypeStickerSet; // Api.TypeStickerSet -> TypeStickerSet;
  packs: TypeStickerPack[]; // Api.TypeStickerPack[];
  keywords: TypeStickerKeyword[]; // Api.TypeStickerKeyword[];
  documents: TypeDocument; // Api.TypeDocument[];
};

export type StickerSetMultiCovered = {
  set: TypeStickerSet; // Api.TypeStickerSet -> TypeStickerSet;
  covers: TypeDocument; // Api.TypeDocument[];
};

export type StickerSetNoCovered = {
  set: TypeStickerSet; // Api.TypeStickerSet -> TypeStickerSet;
};

export type StoriesStealthMode = {
  // flags: null // null;
  activeUntilDate?: number; // int -> number;
  cooldownUntilDate?: number; // int -> number;
};

export type StoryFwdHeader = {
  // flags: null // null;
  modified?: boolean; // boolean;
  from?: TypePeer; // Api.TypePeer -> TypePeer;
  fromName?: string; // string;
  storyId?: number; // int -> number;
};

export type StoryItem = {
  // flags: null // null;
  pinned?: boolean; // boolean;
  public?: boolean; // boolean;
  closeFriends?: boolean; // boolean;
  min?: boolean; // boolean;
  noforwards?: boolean; // boolean;
  edited?: boolean; // boolean;
  contacts?: boolean; // boolean;
  selectedContacts?: boolean; // boolean;
  out?: boolean; // boolean;
  id: number; // int -> number;
  date: number; // int -> number;
  fromId?: TypePeer; // Api.TypePeer -> TypePeer;
  fwdFrom?: TypeStoryFwdHeader; // Api.TypeStoryFwdHeader -> TypeStoryFwdHeader;
  expireDate: number; // int -> number;
  caption?: string; // string;
  entities?: TypeMessageEntity[]; // Api.TypeMessageEntity[];
  media: TypeMessageMedia; // Api.TypeMessageMedia -> TypeMessageMedia;
  mediaAreas?: TypeMediaArea[]; // Api.TypeMediaArea[];
  privacy?: TypePrivacyRule[]; // Api.TypePrivacyRule[];
  views?: TypeStoryViews; // Api.TypeStoryViews -> TypeStoryViews;
  sentReaction?: TypeReaction; // Api.TypeReaction -> TypeReaction;
};

export type StoryItemDeleted = {
  id: number; // int -> number;
};

export type StoryItemSkipped = {
  // flags: null // null;
  closeFriends?: boolean; // boolean;
  id: number; // int -> number;
  date: number; // int -> number;
  expireDate: number; // int -> number;
};

export type StoryReaction = {
  peerId: TypePeer; // Api.TypePeer -> TypePeer;
  date: number; // int -> number;
  reaction: TypeReaction; // Api.TypeReaction -> TypeReaction;
};

export type StoryReactionPublicForward = {
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
};

export type StoryReactionPublicRepost = {
  peerId: TypePeer; // Api.TypePeer -> TypePeer;
  story: TypeStoryItem; // Api.TypeStoryItem -> TypeStoryItem;
};

export type StoryView = {
  // flags: null // null;
  blocked?: boolean; // boolean;
  blockedMyStoriesFrom?: boolean; // boolean;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  date: number; // int -> number;
  reaction?: TypeReaction; // Api.TypeReaction -> TypeReaction;
};

export type StoryViewPublicForward = {
  // flags: null // null;
  blocked?: boolean; // boolean;
  blockedMyStoriesFrom?: boolean; // boolean;
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
};

export type StoryViewPublicRepost = {
  // flags: null // null;
  blocked?: boolean; // boolean;
  blockedMyStoriesFrom?: boolean; // boolean;
  peerId: TypePeer; // Api.TypePeer -> TypePeer;
  story: TypeStoryItem; // Api.TypeStoryItem -> TypeStoryItem;
};

export type StoryViews = {
  // flags: null // null;
  hasViewers?: boolean; // boolean;
  viewsCount: number; // int -> number;
  forwardsCount?: number; // int -> number;
  reactions?: TypeReactionCount[]; // Api.TypeReactionCount[];
  reactionsCount?: number; // int -> number;
  recentViewers?: string[]; // long[] -> string[];
};

export type TextAnchor = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
  name: string; // string;
};

export type TextBold = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type TextConcat = {
  texts: TypeRichText[]; // Api.TypeRichText[];
};

export type TextEmail = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
  email: string; // string;
};

export type TextFixed = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type TextImage = {
  documentId: string; // long -> string;
  w: number; // int -> number;
  h: number; // int -> number;
};

export type TextItalic = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type TextMarked = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type TextPhone = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
  phone: string; // string;
};

export type TextPlain = {
  text: string; // string;
};

export type TextStrike = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type TextSubscript = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type TextSuperscript = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type TextUnderline = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
};

export type TextUrl = {
  text: TypeRichText; // Api.TypeRichText -> TypeRichText;
  url: string; // string;
  webpageId: string; // long -> string;
};

export type TextWithEntities = {
  text: string; // string;
  entities: TypeMessageEntity[]; // Api.TypeMessageEntity[];
};

export type Theme = {
  // flags: null // null;
  creator?: boolean; // boolean;
  default?: boolean; // boolean;
  forChat?: boolean; // boolean;
  id: string; // long -> string;
  accessHash: string; // long -> string;
  slug: string; // string;
  title: string; // string;
  document?: TypeDocument; // Api.TypeDocument -> TypeDocument;
  settings?: TypeThemeSettings[]; // Api.TypeThemeSettings[];
  emoticon?: string; // string;
  installsCount?: number; // int -> number;
};

export type ThemeSettings = {
  // flags: null // null;
  messageColorsAnimated?: boolean; // boolean;
  baseTheme: TypeBaseTheme; // Api.TypeBaseTheme -> TypeBaseTheme;
  accentColor: number; // int -> number;
  outboxAccentColor?: number; // int -> number;
  messageColors?: number[]; // int[] -> number[];
  wallpaper?: TypeWallPaper; // Api.TypeWallPaper -> TypeWallPaper;
};

export type Timezone = {
  id: string; // string;
  name: string; // string;
  utcOffset: number; // int -> number;
};

export type TlsBlockGrease = {
  seed: number; // int -> number;
};

export type TlsBlockPermutation = {
  entries: TypeTlsBlock[]; // Api.TypeTlsBlock[];
};

export type TlsBlockRandom = {
  length: number; // int -> number;
};

export type TlsBlockScope = {
  entries: TypeTlsBlock[]; // Api.TypeTlsBlock[];
};

export type TlsBlockString = {
  data: string; // string;
};

export type TlsBlockZero = {
  length: number; // int -> number;
};

export type TlsClientHello = {
  blocks: TypeTlsBlock[]; // Api.TypeTlsBlock[];
};

export type TopPeer = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  rating: number; // double -> number;
};

export type TopPeerCategoryPeers = {
  category: TypeTopPeerCategory; // Api.TypeTopPeerCategory -> TypeTopPeerCategory;
  count: number; // int -> number;
  peers: TypeTopPeer[]; // Api.TypeTopPeer[];
};

export type UrlAuthResultAccepted = {
  url: string; // string;
};

export type UrlAuthResultRequest = {
  // flags: null // null;
  requestWriteAccess?: boolean; // boolean;
  bot: TypeUser; // Api.TypeUser -> TypeUser;
  domain: string; // string;
};

export type WallPaper = {
  id: string; // long -> string;
  // flags: null // null;
  creator?: boolean; // boolean;
  default?: boolean; // boolean;
  pattern?: boolean; // boolean;
  dark?: boolean; // boolean;
  accessHash: string; // long -> string;
  slug: string; // string;
  document: TypeDocument; // Api.TypeDocument -> TypeDocument;
  settings?: TypeWallPaperSettings; // Api.TypeWallPaperSettings -> TypeWallPaperSettings;
};

export type WallPaperNoFile = {
  id: string; // long -> string;
  // flags: null // null;
  default?: boolean; // boolean;
  dark?: boolean; // boolean;
  settings?: TypeWallPaperSettings; // Api.TypeWallPaperSettings -> TypeWallPaperSettings;
};

export type WallPaperSettings = {
  // flags: null // null;
  blur?: boolean; // boolean;
  motion?: boolean; // boolean;
  backgroundColor?: number; // int -> number;
  secondBackgroundColor?: number; // int -> number;
  thirdBackgroundColor?: number; // int -> number;
  fourthBackgroundColor?: number; // int -> number;
  intensity?: number; // int -> number;
  rotation?: number; // int -> number;
  emoticon?: string; // string;
};

export type WebAuthorization = {
  hash: string; // long -> string;
  botId: string; // long -> string;
  domain: string; // string;
  browser: string; // string;
  platform: string; // string;
  dateCreated: number; // int -> number;
  dateActive: number; // int -> number;
  ip: string; // string;
  region: string; // string;
};

export type WebDocument = {
  url: string; // string;
  accessHash: string; // long -> string;
  size: number; // int -> number;
  mimeType: string; // string;
  attributes: TypeDocumentAttribute[]; // Api.TypeDocumentAttribute[];
};

export type WebDocumentNoProxy = {
  url: string; // string;
  size: number; // int -> number;
  mimeType: string; // string;
  attributes: TypeDocumentAttribute[]; // Api.TypeDocumentAttribute[];
};

export type WebPage = {
  // flags: null // null;
  hasLargeMedia?: boolean; // boolean;
  id: string; // long -> string;
  url: string; // string;
  displayUrl: string; // string;
  hash: number; // int -> number;
  type?: string; // string;
  siteName?: string; // string;
  title?: string; // string;
  description?: string; // string;
  photo?: TypePhoto; // Api.TypePhoto -> TypePhoto;
  embedUrl?: string; // string;
  embedType?: string; // string;
  embedWidth?: number; // int -> number;
  embedHeight?: number; // int -> number;
  duration?: number; // int -> number;
  author?: string; // string;
  document?: TypeDocument; // Api.TypeDocument -> TypeDocument;
  cachedPage?: TypePage; // Api.TypePage -> TypePage;
  attributes?: TypeWebPageAttribute[]; // Api.TypeWebPageAttribute[];
};

export type WebPageAttributeStickerSet = {
  // flags: null // null;
  emojis?: boolean; // boolean;
  textColor?: boolean; // boolean;
  stickers: TypeDocument; // Api.TypeDocument[];
};

export type WebPageAttributeStory = {
  // flags: null // null;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  id: number; // int -> number;
  story?: TypeStoryItem; // Api.TypeStoryItem -> TypeStoryItem;
};

export type WebPageAttributeTheme = {
  // flags: null // null;
  documents?: TypeDocument; // Api.TypeDocument[];
  settings?: TypeThemeSettings; // Api.TypeThemeSettings -> TypeThemeSettings;
};

export type WebPageAttributeUniqueStarGift = {
  gift: TypeStarGift; // Api.TypeStarGift -> TypeStarGift;
};

export type WebPageEmpty = {
  // flags: null // null;
  id: string; // long -> string;
  url?: string; // string;
};

export type WebPageNotModified = {
  // flags: null // null;
  cachedPageViews?: number; // int -> number;
};

export type WebPagePending = {
  // flags: null // null;
  id: string; // long -> string;
  url?: string; // string;
  date: number; // int -> number;
};

export type WebViewMessageSent = {
  // flags: null // null;
  msgId?: TypeInputBotInlineMessageID; // Api.TypeInputBotInlineMessageID -> TypeInputBotInlineMessageID;
};

export type WebViewResultUrl = {
  // flags: null // null;
  fullsize?: boolean; // boolean;
  fullscreen?: boolean; // boolean;
  queryId?: string; // long -> string;
  url: string; // string;
};

export type TypeAccessPointRule = AccessPointRule; // AccessPointRule

export type TypeAccountDaysTTL = AccountDaysTTL; // AccountDaysTTL

export type TypeAdminLogResults = channels.AdminLogResults; // channels.AdminLogResults

export type TypeAffectedFoundMessages = messages.AffectedFoundMessages; // messages.AffectedFoundMessages

export type TypeAffectedHistory = messages.AffectedHistory; // messages.AffectedHistory

export type TypeAffectedMessages = messages.AffectedMessages; // messages.AffectedMessages

export type TypeAllStickers = messages.AllStickersNotModified | messages.AllStickers; // messages.AllStickersNotModified | messages.AllStickers

export type TypeAllStories = stories.AllStoriesNotModified | stories.AllStories; // stories.AllStoriesNotModified | stories.AllStories

export type TypeAppConfig = help.AppConfigNotModified | help.AppConfig; // help.AppConfigNotModified | help.AppConfig

export type TypeAppUpdate = help.AppUpdate | help.NoAppUpdate; // help.AppUpdate | help.NoAppUpdate

export type TypeArchivedStickers = messages.ArchivedStickers; // messages.ArchivedStickers

export type TypeAttachMenuBot = AttachMenuBot; // AttachMenuBot

export type TypeAttachMenuBotIcon = AttachMenuBotIcon; // AttachMenuBotIcon

export type TypeAttachMenuBotIconColor = AttachMenuBotIconColor; // AttachMenuBotIconColor

export type TypeAttachMenuBots = AttachMenuBotsNotModified | AttachMenuBots; // AttachMenuBotsNotModified | AttachMenuBots

export type TypeAttachMenuBotsBot = AttachMenuBotsBot; // AttachMenuBotsBot

export type TypeAttachMenuPeerType =
  | AttachMenuPeerTypeSameBotPM
  | AttachMenuPeerTypeBotPM
  | AttachMenuPeerTypePM
  | AttachMenuPeerTypeChat
  | AttachMenuPeerTypeBroadcast; // AttachMenuPeerTypeSameBotPM | AttachMenuPeerTypeBotPM | AttachMenuPeerTypePM | AttachMenuPeerTypeChat | AttachMenuPeerTypeBroadcast

export type {
  Authorization,
  TypeAuthorization,
  AuthAuthorization,
  TypeAuthAuthorization,
  AuthorizationSignUpRequired,
  ExportedAuthorization,
  TypeExportedAuthorization,
  LoggedOut,
  TypeLoggedOut,
  LoginToken,
  LoginTokenMigrateTo,
  LoginTokenSuccess,
  TypeLoginToken,
  PasswordRecovery,
  TypePasswordRecovery,
  SentCode,
  SentCodeSuccess,
  TypeSentCode,
  TypeSentCodeType,
  TypeCodeType,
} from './auth';

export type * from './updates';


export type TypeAuthorizationForm = account.AuthorizationForm; // account.AuthorizationForm

export type TypeAuthorizations = account.Authorizations; // account.Authorizations

export type TypeAutoDownloadSettings = account.AutoDownloadSettings; // account.AutoDownloadSettings

export type TypeAutoSaveException = AutoSaveException; // AutoSaveException

export type TypeAutoSaveSettings = account.AutoSaveSettings; // account.AutoSaveSettings

export type TypeAvailableEffect = AvailableEffect; // AvailableEffect

export type TypeAvailableEffects = messages.AvailableEffectsNotModified | messages.AvailableEffects; // messages.AvailableEffectsNotModified | messages.AvailableEffects

export type TypeAvailableReaction = AvailableReaction; // AvailableReaction

export type TypeAvailableReactions =
  | messages.AvailableReactionsNotModified
  | messages.AvailableReactions; // messages.AvailableReactionsNotModified | messages.AvailableReactions

export type TypeBadMsgNotification = BadMsgNotification | BadServerSalt; // BadMsgNotification | BadServerSalt

export type TypeBankCardData = payments.BankCardData; // payments.BankCardData

export type TypeBankCardOpenUrl = BankCardOpenUrl; // BankCardOpenUrl

export type TypeBaseTheme =
  | BaseThemeClassic
  | BaseThemeDay
  | BaseThemeNight
  | BaseThemeTinted
  | BaseThemeArctic; // BaseThemeClassic | BaseThemeDay | BaseThemeNight | BaseThemeTinted | BaseThemeArctic

export type TypeBindAuthKeyInner = BindAuthKeyInner; // BindAuthKeyInner

export type TypeBirthday = Birthday; // Birthday

export type TypeBlocked = contacts.Blocked | contacts.BlockedSlice; // contacts.Blocked | contacts.BlockedSlice

export type TypeBoost = Boost; // Boost

export type TypeBoostsList = premium.BoostsList; // premium.BoostsList

export type TypeBoostsStatus = premium.BoostsStatus; // premium.BoostsStatus

export type TypeBotApp = BotApp; // BotApp (constructor, not messages.BotApp)

export type TypeBotAppSettings = BotAppSettings; // BotAppSettings

export type TypeBotBusinessConnection = BotBusinessConnection; // BotBusinessConnection

export type TypeBotCallbackAnswer = messages.BotCallbackAnswer; // messages.BotCallbackAnswer

export type TypeBotCommand = BotCommand; // BotCommand

export type TypeBotCommandScope =
  | BotCommandScopeDefault
  | BotCommandScopeUsers
  | BotCommandScopeChats
  | BotCommandScopeChatAdmins
  | BotCommandScopePeer
  | BotCommandScopePeerAdmins
  | BotCommandScopePeerUser; // BotCommandScopeDefault | BotCommandScopeUsers | BotCommandScopeChats | BotCommandScopeChatAdmins | BotCommandScopePeer | BotCommandScopePeerAdmins | BotCommandScopePeerUser

export type TypeBotInfo = BotInfo; // BotInfo (constructor, not bots.BotInfo)

export type TypeBotInlineMessage =
  | BotInlineMessageMediaAuto
  | BotInlineMessageText
  | BotInlineMessageMediaGeo
  | BotInlineMessageMediaVenue
  | BotInlineMessageMediaContact
  | BotInlineMessageMediaInvoice
  | BotInlineMessageMediaWebPage; // BotInlineMessageMediaAuto | BotInlineMessageText | BotInlineMessageMediaGeo | BotInlineMessageMediaVenue | BotInlineMessageMediaContact | BotInlineMessageMediaInvoice | BotInlineMessageMediaWebPage

export type TypeBotInlineResult = BotInlineResult | BotInlineMediaResult; // BotInlineResult | BotInlineMediaResult

export type TypeBotMenuButton = BotMenuButtonDefault | BotMenuButtonCommands | BotMenuButton; // BotMenuButtonDefault | BotMenuButtonCommands | BotMenuButton

export type TypeBotPreparedInlineMessage = messages.BotPreparedInlineMessage; // messages.BotPreparedInlineMessage

export type TypeBotPreviewMedia = BotPreviewMedia; // BotPreviewMedia

export type TypeBotResults = messages.BotResults; // messages.BotResults

export type TypeBotVerification = BotVerification; // BotVerification

export type TypeBotVerifierSettings = BotVerifierSettings; // BotVerifierSettings

export type TypeBroadcastRevenueBalances = BroadcastRevenueBalances; // BroadcastRevenueBalances

export type TypeBroadcastRevenueStats = stats.BroadcastRevenueStats; // stats.BroadcastRevenueStats

export type TypeBroadcastRevenueTransaction =
  | BroadcastRevenueTransactionProceeds
  | BroadcastRevenueTransactionWithdrawal
  | BroadcastRevenueTransactionRefund; // BroadcastRevenueTransactionProceeds | BroadcastRevenueTransactionWithdrawal | BroadcastRevenueTransactionRefund

export type TypeBroadcastRevenueTransactions = stats.BroadcastRevenueTransactions; // stats.BroadcastRevenueTransactions

export type TypeBroadcastRevenueWithdrawalUrl = stats.BroadcastRevenueWithdrawalUrl; // stats.BroadcastRevenueWithdrawalUrl

export type TypeBroadcastStats = stats.BroadcastStats; // stats.BroadcastStats

export type TypeBusinessAwayMessage = BusinessAwayMessage; // BusinessAwayMessage

export type TypeBusinessAwayMessageSchedule =
  | BusinessAwayMessageScheduleAlways
  | BusinessAwayMessageScheduleOutsideWorkHours
  | BusinessAwayMessageScheduleCustom; // BusinessAwayMessageScheduleAlways | BusinessAwayMessageScheduleOutsideWorkHours | BusinessAwayMessageScheduleCustom

export type TypeBusinessBotRecipients = BusinessBotRecipients; // BusinessBotRecipients

export type TypeBusinessChatLink = BusinessChatLink; // BusinessChatLink

export type TypeBusinessChatLinks = account.BusinessChatLinks; // account.BusinessChatLinks

export type TypeBusinessGreetingMessage = BusinessGreetingMessage; // BusinessGreetingMessage

export type TypeBusinessIntro = BusinessIntro; // BusinessIntro

export type TypeBusinessLocation = BusinessLocation; // BusinessLocation

export type TypeBusinessRecipients = BusinessRecipients; // BusinessRecipients

export type TypeBusinessWeeklyOpen = BusinessWeeklyOpen; // BusinessWeeklyOpen

export type TypeBusinessWorkHours = BusinessWorkHours; // BusinessWorkHours

export type TypeCdnConfig = CdnConfig; // CdnConfig

export type TypeCdnFile = upload.CdnFileReuploadNeeded | upload.CdnFile; // upload.CdnFileReuploadNeeded | upload.CdnFile

export type TypeCdnPublicKey = CdnPublicKey; // CdnPublicKey

export type TypeChatAdminsWithInvites = messages.ChatAdminsWithInvites; // messages.ChatAdminsWithInvites

export type TypeChatInviteImporters = messages.ChatInviteImporters; // messages.ChatInviteImporters

export type TypeChatlistInvite = chatlists.ChatlistInviteAlready | chatlists.ChatlistInvite; // chatlists.ChatlistInviteAlready | chatlists.ChatlistInvite

export type TypeChatlistUpdates = chatlists.ChatlistUpdates; // chatlists.ChatlistUpdates

export type TypeChats = messages.Chats | messages.ChatsSlice; // messages.Chats | messages.ChatsSlice

export type TypeCheckedGiftCode = payments.CheckedGiftCode; // payments.CheckedGiftCode

export type TypeCheckedHistoryImportPeer = messages.CheckedHistoryImportPeer; // messages.CheckedHistoryImportPeer

export type TypeClient_DH_Inner_Data = ClientDHInnerData; // ClientDHInnerData

export type TypeCodeSettings = CodeSettings; // CodeSettings

export type TypeCodeType =
  | auth.CodeTypeSms
  | auth.CodeTypeCall
  | auth.CodeTypeFlashCall
  | auth.CodeTypeMissedCall
  | auth.CodeTypeFragmentSms; // auth.CodeTypeSms | auth.CodeTypeCall | auth.CodeTypeFlashCall | auth.CodeTypeMissedCall | auth.CodeTypeFragmentSms

export type TypeCollectibleInfo = fragment.CollectibleInfo; // fragment.CollectibleInfo

export type TypeConfig = Config; // Config

export type TypeConfigSimple = help.ConfigSimple; // help.ConfigSimple

export type TypeConnectedBot = ConnectedBot; // ConnectedBot

export type TypeConnectedBots = account.ConnectedBots; // account.ConnectedBots

export type TypeConnectedBotStarRef = ConnectedBotStarRef; // ConnectedBotStarRef

export type TypeConnectedStarRefBots = payments.ConnectedStarRefBots; // payments.ConnectedStarRefBots

export type TypeContact = Contact; // Contact

export type TypeContactBirthday = ContactBirthday; // ContactBirthday

export type TypeContactBirthdays = contacts.ContactBirthdays; // contacts.ContactBirthdays

export type TypeContacts = contacts.ContactsNotModified | contacts.Contacts; // contacts.ContactsNotModified | contacts.Contacts

export type TypeContactStatus = ContactStatus; // ContactStatus

export type TypeContentSettings = account.ContentSettings; // account.ContentSettings

export type TypeCountriesList = help.CountriesListNotModified | help.CountriesList; // help.CountriesListNotModified | help.CountriesList

export type TypeCountry = help.Country; // help.Country

export type TypeCountryCode = help.CountryCode; // help.CountryCode

export type TypeDataJSON = DataJSON; // DataJSON

export type TypeDcOption = DcOption; // DcOption

export type TypeDeepLinkInfo = help.DeepLinkInfoEmpty | help.DeepLinkInfo; // help.DeepLinkInfoEmpty | help.DeepLinkInfo

export type TypeDefaultHistoryTTL = DefaultHistoryTTL; // DefaultHistoryTTL

export type TypeDestroyAuthKeyRes = DestroyAuthKeyOk | DestroyAuthKeyNone | DestroyAuthKeyFail; // DestroyAuthKeyOk | DestroyAuthKeyNone | DestroyAuthKeyFail

export type TypeDestroySessionRes = DestroySessionOk | DestroySessionNone; // DestroySessionOk | DestroySessionNone

export type TypeDhConfig = messages.DhConfigNotModified | messages.DhConfig; // messages.DhConfigNotModified | messages.DhConfig

export type TypeDialog = Dialog | DialogFolder; // Dialog | DialogFolder

export type TypeDialogFilter = DialogFilter | DialogFilterDefault | DialogFilterChatlist; // DialogFilter | DialogFilterDefault | DialogFilterChatlist

export type TypeDialogFilters = messages.DialogFilters; // messages.DialogFilters

export type TypeDialogFilterSuggested = DialogFilterSuggested; // DialogFilterSuggested

export type TypeDialogPeer = DialogPeer | DialogPeerFolder; // DialogPeer | DialogPeerFolder

export type TypeDialogs = messages.Dialogs | messages.DialogsSlice | messages.DialogsNotModified; // messages.Dialogs | messages.DialogsSlice | messages.DialogsNotModified

export type TypeDisallowedGiftsSettings = DisallowedGiftsSettings; // DisallowedGiftsSettings

export type TypeDiscussionMessage = messages.DiscussionMessage; // messages.DiscussionMessage

export type TypeDraftMessage = DraftMessageEmpty | DraftMessage; // DraftMessageEmpty | DraftMessage

export type TypeEligibilityToJoin = smsjobs.EligibleToJoin; // smsjobs.EligibleToJoin

export type TypeEmailVerification =
  | EmailVerificationCode
  | EmailVerificationGoogle
  | EmailVerificationApple; // EmailVerificationCode | EmailVerificationGoogle | EmailVerificationApple

export type TypeEmailVerified = account.EmailVerified | account.EmailVerifiedLogin; // account.EmailVerified | account.EmailVerifiedLogin

export type TypeEmailVerifyPurpose =
  | EmailVerifyPurposeLoginSetup
  | EmailVerifyPurposeLoginChange
  | EmailVerifyPurposePassport; // EmailVerifyPurposeLoginSetup | EmailVerifyPurposeLoginChange | EmailVerifyPurposePassport

export type TypeEmojiGroup = EmojiGroup | EmojiGroupGreeting | EmojiGroupPremium; // EmojiGroup | EmojiGroupGreeting | EmojiGroupPremium

export type TypeEmojiGroups = messages.EmojiGroupsNotModified | messages.EmojiGroups; // messages.EmojiGroupsNotModified | messages.EmojiGroups

export type TypeEmojiKeyword = EmojiKeyword | EmojiKeywordDeleted; // EmojiKeyword | EmojiKeywordDeleted

export type TypeEmojiKeywordsDifference = EmojiKeywordsDifference; // EmojiKeywordsDifference

export type TypeEmojiLanguage = EmojiLanguage; // EmojiLanguage

export type TypeEmojiList = EmojiListNotModified | EmojiList; // EmojiListNotModified | EmojiList

export type TypeEmojiStatus =
  | EmojiStatusEmpty
  | EmojiStatus
  | EmojiStatusCollectible
  | InputEmojiStatusCollectible; // EmojiStatusEmpty | EmojiStatus | EmojiStatusCollectible | InputEmojiStatusCollectible

export type TypeEmojiStatuses = account.EmojiStatusesNotModified | account.EmojiStatuses; // account.EmojiStatusesNotModified | account.EmojiStatuses

export type TypeEmojiURL = EmojiURL; // EmojiURL

export type TypeEncryptedChat =
  | EncryptedChatEmpty
  | EncryptedChatWaiting
  | EncryptedChatRequested
  | EncryptedChat
  | EncryptedChatDiscarded; // EncryptedChatEmpty | EncryptedChatWaiting | EncryptedChatRequested | EncryptedChat | EncryptedChatDiscarded

export type TypeEncryptedFile = EncryptedFileEmpty | EncryptedFile; // EncryptedFileEmpty | EncryptedFile

export type TypeEncryptedMessage = EncryptedMessage | EncryptedMessageService; // EncryptedMessage | EncryptedMessageService

export type TypeEntityLike = EntityLike; // EntityLike


export type TypeExportedChatInvite = ChatInviteExported; // ChatInviteExported (constructor; messages wrappers are TypeMessagesExportedChatInvite)

export type TypeExportedChatInvites = messages.ExportedChatInvites; // messages.ExportedChatInvites

export type TypeExportedChatlistInvite = chatlists.ExportedChatlistInvite; // chatlists.ExportedChatlistInvite

export type TypeExportedContactToken = ExportedContactToken; // ExportedContactToken

export type TypeExportedGroupCallInvite = phone.ExportedGroupCallInvite; // phone.ExportedGroupCallInvite

export type TypeExportedInvites = chatlists.ExportedInvites; // chatlists.ExportedInvites

export type TypeExportedInvoice = payments.ExportedInvoice; // payments.ExportedInvoice

export type TypeExportedMessageLink = ExportedMessageLink; // ExportedMessageLink

export type TypeExportedStoryLink = ExportedStoryLink; // ExportedStoryLink

export type TypeFactCheck = FactCheck; // FactCheck

export type TypeFavedStickers = messages.FavedStickersNotModified | messages.FavedStickers; // messages.FavedStickersNotModified | messages.FavedStickers

export type TypeFeaturedStickers = messages.FeaturedStickersNotModified | messages.FeaturedStickers; // messages.FeaturedStickersNotModified | messages.FeaturedStickers

export type TypeFile = upload.File | upload.FileCdnRedirect; // upload.File | upload.FileCdnRedirect

export type TypeFileHash = FileHash; // FileHash

export type TypeFileType =
  | storage.FileUnknown
  | storage.FilePartial
  | storage.FileJpeg
  | storage.FileGif
  | storage.FilePng
  | storage.FilePdf
  | storage.FileMp3
  | storage.FileMov
  | storage.FileMp4
  | storage.FileWebp; // storage.FileUnknown | storage.FilePartial | storage.FileJpeg | storage.FileGif | storage.FilePng | storage.FilePdf | storage.FileMp3 | storage.FileMov | storage.FileMp4 | storage.FileWebp

export type TypeFolder = Folder; // Folder

export type TypeFolderPeer = FolderPeer; // FolderPeer

export type TypeForumTopic = ForumTopicDeleted | ForumTopic; // ForumTopicDeleted | ForumTopic

export type TypeForumTopics = messages.ForumTopics; // messages.ForumTopics

export type TypeFound = contacts.Found; // contacts.Found

export type TypeFoundStickers = messages.FoundStickersNotModified | messages.FoundStickers; // messages.FoundStickersNotModified | messages.FoundStickers

export type TypeFoundStickerSets = messages.FoundStickerSetsNotModified | messages.FoundStickerSets; // messages.FoundStickerSetsNotModified | messages.FoundStickerSets

export type TypeFoundStories = stories.FoundStories; // stories.FoundStories

export type TypeFoundStory = FoundStory; // FoundStory

export type TypeFutureSalt = FutureSalt; // FutureSalt

export type TypeFutureSalts = FutureSalts; // FutureSalts

export type TypeGame = Game; // Game

export type TypeGeoPoint = GeoPointEmpty | GeoPoint; // GeoPointEmpty | GeoPoint

export type TypeGeoPointAddress = GeoPointAddress; // GeoPointAddress

export type TypeGiveawayInfo = payments.GiveawayInfo | payments.GiveawayInfoResults; // payments.GiveawayInfo | payments.GiveawayInfoResults

export type TypeGlobalPrivacySettings = GlobalPrivacySettings; // GlobalPrivacySettings

export type TypeGroupCall = phone.GroupCall; // phone.GroupCall

export type TypeGroupCallParticipant = GroupCallParticipant; // GroupCallParticipant

export type TypeGroupCallParticipantVideo = GroupCallParticipantVideo; // GroupCallParticipantVideo

export type TypeGroupCallParticipantVideoSourceGroup = GroupCallParticipantVideoSourceGroup; // GroupCallParticipantVideoSourceGroup

export type TypeGroupCallStreamChannel = GroupCallStreamChannel; // GroupCallStreamChannel

export type TypeGroupCallStreamChannels = phone.GroupCallStreamChannels; // phone.GroupCallStreamChannels

export type TypeGroupCallStreamRtmpUrl = phone.GroupCallStreamRtmpUrl; // phone.GroupCallStreamRtmpUrl

export type TypeGroupParticipants = phone.GroupParticipants; // phone.GroupParticipants

export type TypeHighScore = HighScore; // HighScore

export type TypeHighScores = messages.HighScores; // messages.HighScores

export type TypeHistoryImport = messages.HistoryImport; // messages.HistoryImport

export type TypeHistoryImportParsed = messages.HistoryImportParsed; // messages.HistoryImportParsed

export type TypeHttpWait = HttpWait; // HttpWait

export type TypeImportedContact = ImportedContact; // ImportedContact

export type TypeImportedContacts = contacts.ImportedContacts; // contacts.ImportedContacts

export type TypeInactiveChats = messages.InactiveChats; // messages.InactiveChats

export type TypeInlineBotSwitchPM = InlineBotSwitchPM; // InlineBotSwitchPM

export type TypeInlineBotWebView = InlineBotWebView; // InlineBotWebView

export type TypeInlineQueryPeerType =
  | InlineQueryPeerTypeSameBotPM
  | InlineQueryPeerTypePM
  | InlineQueryPeerTypeChat
  | InlineQueryPeerTypeMegagroup
  | InlineQueryPeerTypeBroadcast
  | InlineQueryPeerTypeBotPM; // InlineQueryPeerTypeSameBotPM | InlineQueryPeerTypePM | InlineQueryPeerTypeChat | InlineQueryPeerTypeMegagroup | InlineQueryPeerTypeBroadcast | InlineQueryPeerTypeBotPM

export type TypeInputAppEvent = InputAppEvent; // InputAppEvent

export type TypeInputBotApp = InputBotAppID | InputBotAppShortName; // InputBotAppID | InputBotAppShortName

export type TypeInputBotInlineMessage =
  | InputBotInlineMessageMediaAuto
  | InputBotInlineMessageText
  | InputBotInlineMessageMediaGeo
  | InputBotInlineMessageMediaVenue
  | InputBotInlineMessageMediaContact
  | InputBotInlineMessageGame
  | InputBotInlineMessageMediaInvoice
  | InputBotInlineMessageMediaWebPage; // InputBotInlineMessageMediaAuto | InputBotInlineMessageText | InputBotInlineMessageMediaGeo | InputBotInlineMessageMediaVenue | InputBotInlineMessageMediaContact | InputBotInlineMessageGame | InputBotInlineMessageMediaInvoice | InputBotInlineMessageMediaWebPage

export type TypeInputBotInlineMessageID = InputBotInlineMessageID | InputBotInlineMessageID64; // InputBotInlineMessageID | InputBotInlineMessageID64

export type TypeInputBotInlineResult =
  | InputBotInlineResult
  | InputBotInlineResultPhoto
  | InputBotInlineResultDocument
  | InputBotInlineResultGame; // InputBotInlineResult | InputBotInlineResultPhoto | InputBotInlineResultDocument | InputBotInlineResultGame

export type TypeInputBusinessAwayMessage = InputBusinessAwayMessage; // InputBusinessAwayMessage

export type TypeInputBusinessBotRecipients = InputBusinessBotRecipients; // InputBusinessBotRecipients

export type TypeInputBusinessChatLink = InputBusinessChatLink; // InputBusinessChatLink

export type TypeInputBusinessGreetingMessage = InputBusinessGreetingMessage; // InputBusinessGreetingMessage

export type TypeInputBusinessIntro = InputBusinessIntro; // InputBusinessIntro

export type TypeInputBusinessRecipients = InputBusinessRecipients; // InputBusinessRecipients

export type TypeInputChannel = InputChannel | InputChannelFromMessage; // InputChannelEmpty | InputChannel | InputChannelFromMessage

export type TypeInputChatlist = InputChatlistDialogFilter; // InputChatlistDialogFilter

export type TypeInputCheckPasswordSRP = InputCheckPasswordEmpty | InputCheckPasswordSRP; // InputCheckPasswordEmpty | InputCheckPasswordSRP

export type TypeInputClientProxy = InputClientProxy; // InputClientProxy

export type TypeInputCollectible = InputCollectibleUsername | InputCollectiblePhone; // InputCollectibleUsername | InputCollectiblePhone

export type TypeInputDialogPeer = InputDialogPeer | InputDialogPeerFolder; // InputDialogPeer | InputDialogPeerFolder

export type TypeInputEncryptedChat = InputEncryptedChat; // InputEncryptedChat

export type TypeInputEncryptedFile =
  | InputEncryptedFileEmpty
  | InputEncryptedFileUploaded
  | InputEncryptedFile
  | InputEncryptedFileBigUploaded; // InputEncryptedFileEmpty | InputEncryptedFileUploaded | InputEncryptedFile | InputEncryptedFileBigUploaded

export type TypeInputFolderPeer = InputFolderPeer; // InputFolderPeer

export type TypeInputGame = InputGameID | InputGameShortName; // InputGameID | InputGameShortName

export type TypeInputGroupCall = InputGroupCall; // InputGroupCall

export type TypeInputInvoice =
  | InputInvoiceMessage
  | InputInvoiceSlug
  | InputInvoicePremiumGiftCode
  | InputInvoiceStars
  | InputInvoiceChatInviteSubscription
  | InputInvoiceStarGift
  | InputInvoiceStarGiftUpgrade
  | InputInvoiceStarGiftTransfer; // InputInvoiceMessage | InputInvoiceSlug | InputInvoicePremiumGiftCode | InputInvoiceStars | InputInvoiceChatInviteSubscription | InputInvoiceStarGift | InputInvoiceStarGiftUpgrade | InputInvoiceStarGiftTransfer

export type TypeInputMessage =
  | InputMessageID
  | InputMessageReplyTo
  | InputMessagePinned
  | InputMessageCallbackQuery; // InputMessageID | InputMessageReplyTo | InputMessagePinned | InputMessageCallbackQuery

export type TypeInputNotifyPeer =
  | InputNotifyPeer
  | InputNotifyUsers
  | InputNotifyChats
  | InputNotifyBroadcasts
  | InputNotifyForumTopic; // InputNotifyPeer | InputNotifyUsers | InputNotifyChats | InputNotifyBroadcasts | InputNotifyForumTopic

export type TypeInputPaymentCredentials =
  | InputPaymentCredentialsSaved
  | InputPaymentCredentials
  | InputPaymentCredentialsApplePay
  | InputPaymentCredentialsGooglePay; // InputPaymentCredentialsSaved | InputPaymentCredentials | InputPaymentCredentialsApplePay | InputPaymentCredentialsGooglePay

export type TypeInputPeerNotifySettings = InputPeerNotifySettings; // InputPeerNotifySettings

export type TypeInputPhoneCall = InputPhoneCall; // InputPhoneCall

export type TypeInputPrivacyKey =
  | InputPrivacyKeyStatusTimestamp
  | InputPrivacyKeyChatInvite
  | InputPrivacyKeyPhoneCall
  | InputPrivacyKeyPhoneP2P
  | InputPrivacyKeyForwards
  | InputPrivacyKeyProfilePhoto
  | InputPrivacyKeyPhoneNumber
  | InputPrivacyKeyAddedByPhone
  | InputPrivacyKeyVoiceMessages
  | InputPrivacyKeyAbout
  | InputPrivacyKeyBirthday
  | InputPrivacyKeyStarGiftsAutoSave; // InputPrivacyKeyStatusTimestamp | InputPrivacyKeyChatInvite | InputPrivacyKeyPhoneCall | InputPrivacyKeyPhoneP2P | InputPrivacyKeyForwards | InputPrivacyKeyProfilePhoto | InputPrivacyKeyPhoneNumber | InputPrivacyKeyAddedByPhone | InputPrivacyKeyVoiceMessages | InputPrivacyKeyAbout | InputPrivacyKeyBirthday | InputPrivacyKeyStarGiftsAutoSave

export type TypeInputPrivacyRule =
  | InputPrivacyValueAllowContacts
  | InputPrivacyValueAllowAll
  | InputPrivacyValueAllowUsers
  | InputPrivacyValueDisallowContacts
  | InputPrivacyValueDisallowAll
  | InputPrivacyValueDisallowUsers
  | InputPrivacyValueAllowChatParticipants
  | InputPrivacyValueDisallowChatParticipants
  | InputPrivacyValueAllowCloseFriends
  | InputPrivacyValueAllowPremium
  | InputPrivacyValueAllowBots
  | InputPrivacyValueDisallowBots; // InputPrivacyValueAllowContacts | InputPrivacyValueAllowAll | InputPrivacyValueAllowUsers | InputPrivacyValueDisallowContacts | InputPrivacyValueDisallowAll | InputPrivacyValueDisallowUsers | InputPrivacyValueAllowChatParticipants | InputPrivacyValueDisallowChatParticipants | InputPrivacyValueAllowCloseFriends | InputPrivacyValueAllowPremium | InputPrivacyValueAllowBots | InputPrivacyValueDisallowBots

export type TypeInputQuickReplyShortcut = InputQuickReplyShortcut | InputQuickReplyShortcutId; // InputQuickReplyShortcut | InputQuickReplyShortcutId

export type TypeInputReplyTo = InputReplyToMessage | InputReplyToStory; // InputReplyToMessage | InputReplyToStory

export type TypeInputSavedStarGift = InputSavedStarGiftUser | InputSavedStarGiftChat; // InputSavedStarGiftUser | InputSavedStarGiftChat

export type TypeInputSecureFile = InputSecureFileUploaded | InputSecureFile; // InputSecureFileUploaded | InputSecureFile

export type TypeInputSecureValue = InputSecureValue; // InputSecureValue

export type TypeInputSingleMedia = InputSingleMedia; // InputSingleMedia

export type TypeInputStarsTransaction = InputStarsTransaction; // InputStarsTransaction

export type TypeInputStickeredMedia = InputStickeredMediaPhoto | InputStickeredMediaDocument; // InputStickeredMediaPhoto | InputStickeredMediaDocument

export type TypeInputStickerSetItem = InputStickerSetItem; // InputStickerSetItem

export type TypeInputStorePaymentPurpose =
  | InputStorePaymentPremiumSubscription
  | InputStorePaymentGiftPremium
  | InputStorePaymentPremiumGiftCode
  | InputStorePaymentPremiumGiveaway
  | InputStorePaymentStarsTopup
  | InputStorePaymentStarsGift
  | InputStorePaymentStarsGiveaway; // InputStorePaymentPremiumSubscription | InputStorePaymentGiftPremium | InputStorePaymentPremiumGiftCode | InputStorePaymentPremiumGiveaway | InputStorePaymentStarsTopup | InputStorePaymentStarsGift | InputStorePaymentStarsGiveaway

export type TypeInputTheme = InputTheme | InputThemeSlug; // InputTheme | InputThemeSlug

export type TypeInputThemeSettings = InputThemeSettings; // InputThemeSettings

export type TypeInputWallPaper = InputWallPaper | InputWallPaperSlug | InputWallPaperNoFile; // InputWallPaper | InputWallPaperSlug | InputWallPaperNoFile

export type TypeInputWebDocument = InputWebDocument; // InputWebDocument

export type TypeInputWebFileLocation =
  | InputWebFileLocation
  | InputWebFileGeoPointLocation
  | InputWebFileAudioAlbumThumbLocation; // InputWebFileLocation | InputWebFileGeoPointLocation | InputWebFileAudioAlbumThumbLocation

export type TypeInvitedUsers = messages.InvitedUsers; // messages.InvitedUsers

export type TypeInviteText = help.InviteText; // help.InviteText

export type TypeInvoice = Invoice; // Invoice

export type TypeIpPort = IpPort | IpPortSecret; // IpPort | IpPortSecret

export type TypeJoinAsPeers = phone.JoinAsPeers; // phone.JoinAsPeers

export type TypeJSONObjectValue = JsonObjectValue; // JsonObjectValue

export type TypeJSONValue = JsonNull | JsonBool | JsonNumber | JsonString | JsonArray | JsonObject; // JsonNull | JsonBool | JsonNumber | JsonString | JsonArray | JsonObject

export type TypeKeyboardButton =
  | KeyboardButton
  | KeyboardButtonUrl
  | KeyboardButtonCallback
  | KeyboardButtonRequestPhone
  | KeyboardButtonRequestGeoLocation
  | KeyboardButtonSwitchInline
  | KeyboardButtonGame
  | KeyboardButtonBuy
  | KeyboardButtonUrlAuth
  | InputKeyboardButtonUrlAuth
  | KeyboardButtonRequestPoll
  | InputKeyboardButtonUserProfile
  | KeyboardButtonUserProfile
  | KeyboardButtonWebView
  | KeyboardButtonSimpleWebView
  | KeyboardButtonRequestPeer
  | InputKeyboardButtonRequestPeer
  | KeyboardButtonCopy; // KeyboardButton | KeyboardButtonUrl | KeyboardButtonCallback | KeyboardButtonRequestPhone | KeyboardButtonRequestGeoLocation | KeyboardButtonSwitchInline | KeyboardButtonGame | KeyboardButtonBuy | KeyboardButtonUrlAuth | InputKeyboardButtonUrlAuth | KeyboardButtonRequestPoll | InputKeyboardButtonUserProfile | KeyboardButtonUserProfile | KeyboardButtonWebView | KeyboardButtonSimpleWebView | KeyboardButtonRequestPeer | InputKeyboardButtonRequestPeer | KeyboardButtonCopy

export type TypeKeyboardButtonRow = KeyboardButtonRow; // KeyboardButtonRow

export type TypeLabeledPrice = LabeledPrice; // LabeledPrice

export type TypeLangPackDifference = LangPackDifference; // LangPackDifference

export type TypeLangPackLanguage = LangPackLanguage; // LangPackLanguage

export type TypeLangPackString = LangPackString | LangPackStringPluralized | LangPackStringDeleted; // LangPackString | LangPackStringPluralized | LangPackStringDeleted

export type TypeLoggedOut = auth.LoggedOut; // auth.LoggedOut

export type TypeLoginToken = auth.LoginToken | auth.LoginTokenMigrateTo | auth.LoginTokenSuccess; // auth.LoginToken | auth.LoginTokenMigrateTo | auth.LoginTokenSuccess

export type TypeMediaArea =
  | MediaAreaVenue
  | InputMediaAreaVenue
  | MediaAreaGeoPoint
  | MediaAreaSuggestedReaction
  | MediaAreaChannelPost
  | InputMediaAreaChannelPost
  | MediaAreaUrl
  | MediaAreaWeather
  | MediaAreaStarGift; // MediaAreaVenue | InputMediaAreaVenue | MediaAreaGeoPoint | MediaAreaSuggestedReaction | MediaAreaChannelPost | InputMediaAreaChannelPost | MediaAreaUrl | MediaAreaWeather | MediaAreaStarGift

export type TypeMediaAreaCoordinates = MediaAreaCoordinates; // MediaAreaCoordinates

export type TypeMegagroupStats = MegagroupStats; // stats.MegagroupStats

export type TypeMessage = Message | MessageService; // MessageEmpty | Message | MessageService

export type TypeMessageAction =
  | MessageActionChatCreate
  | MessageActionChatEditTitle
  | MessageActionChatEditPhoto
  | MessageActionChatAddUser
  | MessageActionChatDeleteUser
  | MessageActionChatJoinedByLink
  | MessageActionChannelCreate
  | MessageActionChatMigrateTo
  | MessageActionChannelMigrateFrom
  | MessageActionPinMessage
  | MessageActionGameScore
  | MessageActionPaymentSentMe
  | MessageActionPaymentSent
  | MessageActionPhoneCall
  | MessageActionCustomAction
  | MessageActionBotAllowed
  | MessageActionSecureValuesSentMe
  | MessageActionSecureValuesSent
  | MessageActionGeoProximityReached
  | MessageActionGroupCall
  | MessageActionInviteToGroupCall
  | MessageActionSetMessagesTTL
  | MessageActionGroupCallScheduled
  | MessageActionSetChatTheme
  | MessageActionWebViewDataSentMe
  | MessageActionWebViewDataSent
  | MessageActionGiftPremium
  | MessageActionTopicCreate
  | MessageActionTopicEdit
  | MessageActionSuggestProfilePhoto
  | MessageActionRequestedPeer
  | MessageActionSetChatWallPaper
  | MessageActionGiftCode
  | MessageActionGiveawayLaunch
  | MessageActionGiveawayResults
  | MessageActionBoostApply
  | MessageActionRequestedPeerSentMe
  | MessageActionPaymentRefunded
  | MessageActionGiftStars
  | MessageActionPrizeStars
  | MessageActionStarGift
  | MessageActionStarGiftUnique; // MessageActionEmpty | MessageActionChatCreate | MessageActionChatEditTitle | MessageActionChatEditPhoto | MessageActionChatDeletePhoto | MessageActionChatAddUser | MessageActionChatDeleteUser | MessageActionChatJoinedByLink | MessageActionChannelCreate | MessageActionChatMigrateTo | MessageActionChannelMigrateFrom | MessageActionPinMessage | MessageActionHistoryClear | MessageActionGameScore | MessageActionPaymentSentMe | MessageActionPaymentSent | MessageActionPhoneCall | MessageActionScreenshotTaken | MessageActionCustomAction | MessageActionBotAllowed | MessageActionSecureValuesSentMe | MessageActionSecureValuesSent | MessageActionContactSignUp | MessageActionGeoProximityReached | MessageActionGroupCall | MessageActionInviteToGroupCall | MessageActionSetMessagesTTL | MessageActionGroupCallScheduled | MessageActionSetChatTheme | MessageActionChatJoinedByRequest | MessageActionWebViewDataSentMe | MessageActionWebViewDataSent | MessageActionGiftPremium | MessageActionTopicCreate | MessageActionTopicEdit | MessageActionSuggestProfilePhoto | MessageActionRequestedPeer | MessageActionSetChatWallPaper | MessageActionGiftCode | MessageActionGiveawayLaunch | MessageActionGiveawayResults | MessageActionBoostApply | MessageActionRequestedPeerSentMe | MessageActionPaymentRefunded | MessageActionGiftStars | MessageActionPrizeStars | MessageActionStarGift | MessageActionStarGiftUnique

export type TypeMessageEditData = messages.MessageEditData; // messages.MessageEditData

export type TypeMessageEntity = (
  | MessageEntityUnknown
  | MessageEntityMention
  | MessageEntityHashtag
  | MessageEntityBotCommand
  | MessageEntityUrl
  | MessageEntityEmail
  | MessageEntityBold
  | MessageEntityItalic
  | MessageEntityCode
  | MessageEntityPre
  | MessageEntityTextUrl
  | MessageEntityMentionName
  | InputMessageEntityMentionName
  | MessageEntityPhone
  | MessageEntityCashtag
  | MessageEntityUnderline
  | MessageEntityStrike
  | MessageEntityBankCard
  | MessageEntitySpoiler
  | MessageEntityCustomEmoji
  | MessageEntityBlockquote
) & { className?: string };

export type TypeMessageExtendedMedia = MessageExtendedMediaPreview | MessageExtendedMedia; // MessageExtendedMediaPreview | MessageExtendedMedia

export type TypeMessageFwdHeader = MessageFwdHeader; // MessageFwdHeader

export type TypeMessageMedia =
  | MessageMediaPhoto
  | MessageMediaGeo
  | MessageMediaContact
  | MessageMediaDocument
  | MessageMediaWebPage
  | MessageMediaVenue
  | MessageMediaGame
  | MessageMediaInvoice
  | MessageMediaGeoLive
  | MessageMediaPoll
  | MessageMediaDice
  | MessageMediaStory
  | MessageMediaGiveaway
  | MessageMediaGiveawayResults
  | MessageMediaPaidMedia; // MessageMediaEmpty | MessageMediaPhoto | MessageMediaGeo | MessageMediaContact | MessageMediaUnsupported | MessageMediaDocument | MessageMediaWebPage | MessageMediaVenue | MessageMediaGame | MessageMediaInvoice | MessageMediaGeoLive | MessageMediaPoll | MessageMediaDice | MessageMediaStory | MessageMediaGiveaway | MessageMediaGiveawayResults | MessageMediaPaidMedia

export type TypeMessagePeerReaction = MessagePeerReaction; // MessagePeerReaction

export type TypeMessagePeerVote =
  | MessagePeerVote
  | MessagePeerVoteInputOption
  | MessagePeerVoteMultiple; // MessagePeerVote | MessagePeerVoteInputOption | MessagePeerVoteMultiple

export type TypeMessageRange = MessageRange; // MessageRange

export type TypeMessageReactions = MessageReactions; // MessageReactions

export type TypeMessageReactionsList = messages.MessageReactionsList; // messages.MessageReactionsList

export type TypeMessageReactor = MessageReactor; // MessageReactor

export type TypeMessageReplies = MessageReplies; // MessageReplies

export type TypeMessageReplyHeader = MessageReplyHeader | MessageReplyStoryHeader; // MessageReplyHeader | MessageReplyStoryHeader

export type TypeMessageReportOption = MessageReportOption; // MessageReportOption

export type TypeMessages =
  | messages.Messages
  | messages.MessagesSlice
  | messages.ChannelMessages
  | messages.MessagesNotModified; // messages.Messages | messages.MessagesSlice | messages.ChannelMessages | messages.MessagesNotModified

export type TypeMessagesFilter =
  | InputMessagesFilterEmpty
  | InputMessagesFilterPhotos
  | InputMessagesFilterVideo
  | InputMessagesFilterPhotoVideo
  | InputMessagesFilterDocument
  | InputMessagesFilterUrl
  | InputMessagesFilterGif
  | InputMessagesFilterVoice
  | InputMessagesFilterMusic
  | InputMessagesFilterChatPhotos
  | InputMessagesFilterPhoneCalls
  | InputMessagesFilterRoundVoice
  | InputMessagesFilterRoundVideo
  | InputMessagesFilterMyMentions
  | InputMessagesFilterGeo
  | InputMessagesFilterContacts
  | InputMessagesFilterPinned; // InputMessagesFilterEmpty | InputMessagesFilterPhotos | InputMessagesFilterVideo | InputMessagesFilterPhotoVideo | InputMessagesFilterDocument | InputMessagesFilterUrl | InputMessagesFilterGif | InputMessagesFilterVoice | InputMessagesFilterMusic | InputMessagesFilterChatPhotos | InputMessagesFilterPhoneCalls | InputMessagesFilterRoundVoice | InputMessagesFilterRoundVideo | InputMessagesFilterMyMentions | InputMessagesFilterGeo | InputMessagesFilterContacts | InputMessagesFilterPinned

export type TypeMessageStats = stats.MessageStats; // stats.MessageStats

export type TypeMessageViews = messages.MessageViews; // messages.MessageViews

export type TypeMissingInvitee = MissingInvitee; // MissingInvitee

export type TypeMsgDetailedInfo = MsgDetailedInfo | MsgNewDetailedInfo; // MsgDetailedInfo | MsgNewDetailedInfo

export type TypeMsgResendReq = MsgResendReq; // MsgResendReq

export type TypeMsgsAck = MsgsAck; // MsgsAck

export type TypeMsgsAllInfo = MsgsAllInfo; // MsgsAllInfo

export type TypeMsgsStateInfo = MsgsStateInfo; // MsgsStateInfo

export type TypeMsgsStateReq = MsgsStateReq; // MsgsStateReq

export type TypeMyBoost = MyBoost; // MyBoost

export type TypeMyBoosts = premium.MyBoosts; // premium.MyBoosts

export type TypeMyStickers = messages.MyStickers; // messages.MyStickers

export type TypeNearestDc = NearestDc; // NearestDc

export type TypeNewSession = NewSessionCreated; // NewSessionCreated

export type TypeNotificationSound =
  | NotificationSoundDefault
  | NotificationSoundNone
  | NotificationSoundLocal
  | NotificationSoundRingtone; // NotificationSoundDefault | NotificationSoundNone | NotificationSoundLocal | NotificationSoundRingtone

export type TypeNotifyPeer =
  | NotifyPeer
  | NotifyUsers
  | NotifyChats
  | NotifyBroadcasts
  | NotifyForumTopic; // NotifyPeer | NotifyUsers | NotifyChats | NotifyBroadcasts | NotifyForumTopic

export type TypeOutboxReadDate = OutboxReadDate; // OutboxReadDate

export type TypeP_Q_inner_data = PQInnerData | PQInnerDataDc | PQInnerDataTemp | PQInnerDataTempDc; // PQInnerData | PQInnerDataDc | PQInnerDataTemp | PQInnerDataTempDc

export type TypePage = Page; // Page

export type TypePageBlock =
  | PageBlockUnsupported
  | PageBlockTitle
  | PageBlockSubtitle
  | PageBlockAuthorDate
  | PageBlockHeader
  | PageBlockSubheader
  | PageBlockParagraph
  | PageBlockPreformatted
  | PageBlockFooter
  | PageBlockDivider
  | PageBlockAnchor
  | PageBlockList
  | PageBlockBlockquote
  | PageBlockPullquote
  | PageBlockPhoto
  | PageBlockVideo
  | PageBlockCover
  | PageBlockEmbed
  | PageBlockEmbedPost
  | PageBlockCollage
  | PageBlockSlideshow
  | PageBlockChannel
  | PageBlockAudio
  | PageBlockKicker
  | PageBlockTable
  | PageBlockOrderedList
  | PageBlockDetails
  | PageBlockRelatedArticles
  | PageBlockMap; // PageBlockUnsupported | PageBlockTitle | PageBlockSubtitle | PageBlockAuthorDate | PageBlockHeader | PageBlockSubheader | PageBlockParagraph | PageBlockPreformatted | PageBlockFooter | PageBlockDivider | PageBlockAnchor | PageBlockList | PageBlockBlockquote | PageBlockPullquote | PageBlockPhoto | PageBlockVideo | PageBlockCover | PageBlockEmbed | PageBlockEmbedPost | PageBlockCollage | PageBlockSlideshow | PageBlockChannel | PageBlockAudio | PageBlockKicker | PageBlockTable | PageBlockOrderedList | PageBlockDetails | PageBlockRelatedArticles | PageBlockMap

export type TypePageCaption = PageCaption; // PageCaption

export type TypePageListItem = PageListItemText | PageListItemBlocks; // PageListItemText | PageListItemBlocks

export type TypePageListOrderedItem = PageListOrderedItemText | PageListOrderedItemBlocks; // PageListOrderedItemText | PageListOrderedItemBlocks

export type TypePageRelatedArticle = PageRelatedArticle; // PageRelatedArticle

export type TypePageTableCell = PageTableCell; // PageTableCell

export type TypePageTableRow = PageTableRow; // PageTableRow

export type TypePassportConfig = help.PassportConfigNotModified | help.PassportConfig; // help.PassportConfigNotModified | help.PassportConfig

export type TypePassword = account.Password; // account.Password

export type TypePasswordInputSettings = account.PasswordInputSettings; // account.PasswordInputSettings

export type TypePasswordKdfAlgo =
  | PasswordKdfAlgoUnknown
  | PasswordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow; // PasswordKdfAlgoUnknown | PasswordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow

export type TypePasswordRecovery = auth.PasswordRecovery; // auth.PasswordRecovery

export type TypePasswordSettings = account.PasswordSettings; // account.PasswordSettings

export type TypePaymentCharge = PaymentCharge; // PaymentCharge

export type TypePaymentForm =
  | payments.PaymentForm
  | payments.PaymentFormStars
  | payments.PaymentFormStarGift; // payments.PaymentForm | payments.PaymentFormStars | payments.PaymentFormStarGift

export type TypePaymentFormMethod = PaymentFormMethod; // PaymentFormMethod

export type TypePaymentReceipt = payments.PaymentReceipt | payments.PaymentReceiptStars; // payments.PaymentReceipt | payments.PaymentReceiptStars

export type TypePaymentRequestedInfo = PaymentRequestedInfo; // PaymentRequestedInfo

export type TypePaymentResult = payments.PaymentResult | payments.PaymentVerificationNeeded; // payments.PaymentResult | payments.PaymentVerificationNeeded

export type TypePaymentSavedCredentials = PaymentSavedCredentialsCard; // PaymentSavedCredentialsCard

export type TypePeer = PeerUser | PeerChat | PeerChannel; // PeerUser | PeerChat | PeerChannel

export type TypePeerBlocked = PeerBlocked; // PeerBlocked

export type TypePeerColor = PeerColor; // PeerColor

export type TypePeerColorOption = help.PeerColorOption; // help.PeerColorOption

export type TypePeerColors = help.PeerColorsNotModified | help.PeerColors; // help.PeerColorsNotModified | help.PeerColors

export type TypePeerColorSet = help.PeerColorSet | help.PeerColorProfileSet; // help.PeerColorSet | help.PeerColorProfileSet

export type TypePeerDialogs = messages.PeerDialogs; // messages.PeerDialogs

export type TypePeerLocated = PeerLocated | PeerSelfLocated; // PeerLocated | PeerSelfLocated

export type TypePeerNotifySettings = PeerNotifySettings; // PeerNotifySettings

export type TypePeerSettings = PeerSettings; // PeerSettings (constructor, not messages.PeerSettings)

export type TypePeerStories = stories.PeerStories; // stories.PeerStories

export type TypePhoneCall = phone.PhoneCall; // phone.PhoneCall

export type TypePhoneCallDiscardReason =
  | PhoneCallDiscardReasonMissed
  | PhoneCallDiscardReasonDisconnect
  | PhoneCallDiscardReasonHangup
  | PhoneCallDiscardReasonBusy
  | PhoneCallDiscardReasonAllowGroupCall; // PhoneCallDiscardReasonMissed | PhoneCallDiscardReasonDisconnect | PhoneCallDiscardReasonHangup | PhoneCallDiscardReasonBusy | PhoneCallDiscardReasonAllowGroupCall

export type TypePhoneCallProtocol = PhoneCallProtocol; // PhoneCallProtocol

export type TypePhoneConnection = PhoneConnection | PhoneConnectionWebrtc; // PhoneConnection | PhoneConnectionWebrtc

export type { TypePhotos, TypePhotosPhoto, Photos, PhotosSlice, PhotosPhoto } from './photos';

export type TypePoll = Poll; // Poll

export type TypePollAnswer = PollAnswer; // PollAnswer

export type TypePollAnswerVoters = PollAnswerVoters; // PollAnswerVoters

export type TypePollResults = PollResults; // PollResults

export type TypePong = Pong; // Pong

export type TypePopularAppBots = bots.PopularAppBots; // bots.PopularAppBots

export type TypePopularContact = PopularContact; // PopularContact

export type TypePostAddress = PostAddress; // PostAddress

export type TypePostInteractionCounters =
  | PostInteractionCountersMessage
  | PostInteractionCountersStory; // PostInteractionCountersMessage | PostInteractionCountersStory

export type TypePremiumGiftCodeOption = PremiumGiftCodeOption; // PremiumGiftCodeOption

export type TypePremiumGiftOption = PremiumGiftOption; // PremiumGiftOption

export type TypePremiumPromo = help.PremiumPromo; // help.PremiumPromo

export type TypePremiumSubscriptionOption = PremiumSubscriptionOption; // PremiumSubscriptionOption

export type TypePrepaidGiveaway = PrepaidGiveaway | PrepaidStarsGiveaway; // PrepaidGiveaway | PrepaidStarsGiveaway

export type TypePreparedInlineMessage = messages.PreparedInlineMessage; // messages.PreparedInlineMessage

export type TypePreviewInfo = bots.PreviewInfo; // bots.PreviewInfo

export type TypePrivacyKey =
  | PrivacyKeyStatusTimestamp
  | PrivacyKeyChatInvite
  | PrivacyKeyPhoneCall
  | PrivacyKeyPhoneP2P
  | PrivacyKeyForwards
  | PrivacyKeyProfilePhoto
  | PrivacyKeyPhoneNumber
  | PrivacyKeyAddedByPhone
  | PrivacyKeyVoiceMessages
  | PrivacyKeyAbout
  | PrivacyKeyBirthday
  | PrivacyKeyStarGiftsAutoSave; // PrivacyKeyStatusTimestamp | PrivacyKeyChatInvite | PrivacyKeyPhoneCall | PrivacyKeyPhoneP2P | PrivacyKeyForwards | PrivacyKeyProfilePhoto | PrivacyKeyPhoneNumber | PrivacyKeyAddedByPhone | PrivacyKeyVoiceMessages | PrivacyKeyAbout | PrivacyKeyBirthday | PrivacyKeyStarGiftsAutoSave

export type TypePrivacyRule =
  | PrivacyValueAllowContacts
  | PrivacyValueAllowAll
  | PrivacyValueAllowUsers
  | PrivacyValueDisallowContacts
  | PrivacyValueDisallowAll
  | PrivacyValueDisallowUsers
  | PrivacyValueAllowChatParticipants
  | PrivacyValueDisallowChatParticipants
  | PrivacyValueAllowCloseFriends
  | PrivacyValueAllowPremium
  | PrivacyValueAllowBots
  | PrivacyValueDisallowBots; // PrivacyValueAllowContacts | PrivacyValueAllowAll | PrivacyValueAllowUsers | PrivacyValueDisallowContacts | PrivacyValueDisallowAll | PrivacyValueDisallowUsers | PrivacyValueAllowChatParticipants | PrivacyValueDisallowChatParticipants | PrivacyValueAllowCloseFriends | PrivacyValueAllowPremium | PrivacyValueAllowBots | PrivacyValueDisallowBots

export type TypePrivacyRules = account.PrivacyRules; // account.PrivacyRules

export type TypeProfileTab = ProfileTab; // ProfileTab

export type TypePromoData = help.PromoDataEmpty | help.PromoData; // help.PromoDataEmpty | help.PromoData

export type TypePublicForward = PublicForwardMessage | PublicForwardStory; // PublicForwardMessage | PublicForwardStory

export type TypePublicForwards = stats.PublicForwards; // stats.PublicForwards

export type TypeQuickReplies = messages.QuickReplies | messages.QuickRepliesNotModified; // messages.QuickReplies | messages.QuickRepliesNotModified

export type TypeQuickReply = QuickReply; // QuickReply

export type TypeReaction = ReactionEmpty | ReactionEmoji | ReactionCustomEmoji | ReactionPaid; // ReactionEmpty | ReactionEmoji | ReactionCustomEmoji | ReactionPaid

export type TypeReactionCount = ReactionCount; // ReactionCount

export type TypeReactionNotificationsFrom =
  | ReactionNotificationsFromContacts
  | ReactionNotificationsFromAll; // ReactionNotificationsFromContacts | ReactionNotificationsFromAll

export type TypeReactions = messages.ReactionsNotModified | messages.Reactions; // messages.ReactionsNotModified | messages.Reactions

export type TypeReactionsNotifySettings = ReactionsNotifySettings; // ReactionsNotifySettings

export type TypeReadParticipantDate = ReadParticipantDate; // ReadParticipantDate

export type TypeReceivedNotifyMessage = ReceivedNotifyMessage; // ReceivedNotifyMessage

export type TypeRecentMeUrl =
  | RecentMeUrlUnknown
  | RecentMeUrlUser
  | RecentMeUrlChat
  | RecentMeUrlChatInvite
  | RecentMeUrlStickerSet; // RecentMeUrlUnknown | RecentMeUrlUser | RecentMeUrlChat | RecentMeUrlChatInvite | RecentMeUrlStickerSet

export type TypeRecentMeUrls = help.RecentMeUrls; // help.RecentMeUrls

export type TypeRecentStickers = messages.RecentStickersNotModified | messages.RecentStickers; // messages.RecentStickersNotModified | messages.RecentStickers

export type TypeReplyMarkup =
  | ReplyKeyboardHide
  | ReplyKeyboardForceReply
  | ReplyKeyboardMarkup
  | ReplyInlineMarkup; // ReplyKeyboardHide | ReplyKeyboardForceReply | ReplyKeyboardMarkup | ReplyInlineMarkup

export type TypeReportReason =
  | InputReportReasonSpam
  | InputReportReasonViolence
  | InputReportReasonPornography
  | InputReportReasonChildAbuse
  | InputReportReasonOther
  | InputReportReasonCopyright
  | InputReportReasonGeoIrrelevant
  | InputReportReasonFake
  | InputReportReasonIllegalDrugs
  | InputReportReasonPersonalDetails; // InputReportReasonSpam | InputReportReasonViolence | InputReportReasonPornography | InputReportReasonChildAbuse | InputReportReasonOther | InputReportReasonCopyright | InputReportReasonGeoIrrelevant | InputReportReasonFake | InputReportReasonIllegalDrugs | InputReportReasonPersonalDetails

export type TypeReportResult =
  | ReportResultChooseOption
  | ReportResultAddComment
  | ReportResultReported; // ReportResultChooseOption | ReportResultAddComment | ReportResultReported

export type TypeRequestedPeer = RequestedPeerUser | RequestedPeerChat | RequestedPeerChannel; // RequestedPeerUser | RequestedPeerChat | RequestedPeerChannel

export type TypeRequestPeerType =
  | RequestPeerTypeUser
  | RequestPeerTypeChat
  | RequestPeerTypeBroadcast; // RequestPeerTypeUser | RequestPeerTypeChat | RequestPeerTypeBroadcast

export type TypeResetPasswordResult =
  | account.ResetPasswordFailedWait
  | account.ResetPasswordRequestedWait
  | account.ResetPasswordOk; // account.ResetPasswordFailedWait | account.ResetPasswordRequestedWait | account.ResetPasswordOk

export type TypeResolvedBusinessChatLinks = account.ResolvedBusinessChatLinks; // account.ResolvedBusinessChatLinks

export type TypeResolvedPeer = contacts.ResolvedPeer; // contacts.ResolvedPeer

export type TypeResPQ = ResPQ; // ResPQ

export type TypeRestrictionReason = RestrictionReason; // RestrictionReason

export type TypeRichText =
  | TextEmpty
  | TextPlain
  | TextBold
  | TextItalic
  | TextUnderline
  | TextStrike
  | TextFixed
  | TextUrl
  | TextEmail
  | TextConcat
  | TextSubscript
  | TextSuperscript
  | TextMarked
  | TextPhone
  | TextImage
  | TextAnchor; // TextEmpty | TextPlain | TextBold | TextItalic | TextUnderline | TextStrike | TextFixed | TextUrl | TextEmail | TextConcat | TextSubscript | TextSuperscript | TextMarked | TextPhone | TextImage | TextAnchor

export type TypeRpcDropAnswer = RpcAnswerUnknown | RpcAnswerDroppedRunning | RpcAnswerDropped; // RpcAnswerUnknown | RpcAnswerDroppedRunning | RpcAnswerDropped

export type TypeRpcError = RpcError; // RpcError

export type TypeSavedContact = SavedPhoneContact; // SavedPhoneContact

export type TypeSavedDialog = SavedDialog; // SavedDialog

export type TypeSavedDialogs =
  | messages.SavedDialogs
  | messages.SavedDialogsSlice
  | messages.SavedDialogsNotModified; // messages.SavedDialogs | messages.SavedDialogsSlice | messages.SavedDialogsNotModified

export type TypeSavedGifs = messages.SavedGifsNotModified | messages.SavedGifs; // messages.SavedGifsNotModified | messages.SavedGifs

export type TypeSavedInfo = payments.SavedInfo; // payments.SavedInfo

export type TypeSavedReactionTag = SavedReactionTag; // SavedReactionTag

export type TypeSavedReactionTags =
  | messages.SavedReactionTagsNotModified
  | messages.SavedReactionTags; // messages.SavedReactionTagsNotModified | messages.SavedReactionTags

export type TypeSavedRingtone = account.SavedRingtone | account.SavedRingtoneConverted; // account.SavedRingtone | account.SavedRingtoneConverted

export type TypeSavedRingtones = account.SavedRingtonesNotModified | account.SavedRingtones; // account.SavedRingtonesNotModified | account.SavedRingtones

export type TypeSavedStarGift = SavedStarGift; // SavedStarGift

export type TypeSavedStarGifts = payments.SavedStarGifts; // payments.SavedStarGifts

export type TypeSearchCounter = messages.SearchCounter; // messages.SearchCounter

export type TypeSearchResultsCalendar = messages.SearchResultsCalendar; // messages.SearchResultsCalendar

export type TypeSearchResultsCalendarPeriod = SearchResultsCalendarPeriod; // SearchResultsCalendarPeriod

export type TypeSearchResultsPosition = SearchResultPosition; // SearchResultPosition

export type TypeSearchResultsPositions = messages.SearchResultsPositions; // messages.SearchResultsPositions

export type TypeSecureCredentialsEncrypted = SecureCredentialsEncrypted; // SecureCredentialsEncrypted

export type TypeSecureData = SecureData; // SecureData

export type TypeSecureFile = SecureFileEmpty | SecureFile; // SecureFileEmpty | SecureFile

export type TypeSecurePasswordKdfAlgo =
  | SecurePasswordKdfAlgoUnknown
  | SecurePasswordKdfAlgoPBKDF2HMACSHA512iter100000
  | SecurePasswordKdfAlgoSHA512; // SecurePasswordKdfAlgoUnknown | SecurePasswordKdfAlgoPBKDF2HMACSHA512iter100000 | SecurePasswordKdfAlgoSHA512

export type TypeSecurePlainData = SecurePlainPhone | SecurePlainEmail; // SecurePlainPhone | SecurePlainEmail

export type TypeSecureRequiredType = SecureRequiredType | SecureRequiredTypeOneOf; // SecureRequiredType | SecureRequiredTypeOneOf

export type TypeSecureSecretSettings = SecureSecretSettings; // SecureSecretSettings

export type TypeSecureValue = SecureValue; // SecureValue

export type TypeSecureValueError =
  | SecureValueErrorData
  | SecureValueErrorFrontSide
  | SecureValueErrorReverseSide
  | SecureValueErrorSelfie
  | SecureValueErrorFile
  | SecureValueErrorFiles
  | SecureValueError
  | SecureValueErrorTranslationFile
  | SecureValueErrorTranslationFiles; // SecureValueErrorData | SecureValueErrorFrontSide | SecureValueErrorReverseSide | SecureValueErrorSelfie | SecureValueErrorFile | SecureValueErrorFiles | SecureValueError | SecureValueErrorTranslationFile | SecureValueErrorTranslationFiles

export type TypeSecureValueHash = SecureValueHash; // SecureValueHash

export type TypeSecureValueType =
  | SecureValueTypePersonalDetails
  | SecureValueTypePassport
  | SecureValueTypeDriverLicense
  | SecureValueTypeIdentityCard
  | SecureValueTypeInternalPassport
  | SecureValueTypeAddress
  | SecureValueTypeUtilityBill
  | SecureValueTypeBankStatement
  | SecureValueTypeRentalAgreement
  | SecureValueTypePassportRegistration
  | SecureValueTypeTemporaryRegistration
  | SecureValueTypePhone
  | SecureValueTypeEmail; // SecureValueTypePersonalDetails | SecureValueTypePassport | SecureValueTypeDriverLicense | SecureValueTypeIdentityCard | SecureValueTypeInternalPassport | SecureValueTypeAddress | SecureValueTypeUtilityBill | SecureValueTypeBankStatement | SecureValueTypeRentalAgreement | SecureValueTypePassportRegistration | SecureValueTypeTemporaryRegistration | SecureValueTypePhone | SecureValueTypeEmail

export type TypeSendAsPeer = SendAsPeer; // SendAsPeer

export type TypeSendMessageAction =
  | SendMessageTypingAction
  | SendMessageCancelAction
  | SendMessageRecordVideoAction
  | SendMessageUploadVideoAction
  | SendMessageRecordAudioAction
  | SendMessageUploadAudioAction
  | SendMessageUploadPhotoAction
  | SendMessageUploadDocumentAction
  | SendMessageGeoLocationAction
  | SendMessageChooseContactAction
  | SendMessageGamePlayAction
  | SendMessageRecordRoundAction
  | SendMessageUploadRoundAction
  | SpeakingInGroupCallAction
  | SendMessageHistoryImportAction
  | SendMessageChooseStickerAction
  | SendMessageEmojiInteraction
  | SendMessageEmojiInteractionSeen; // SendMessageTypingAction | SendMessageCancelAction | SendMessageRecordVideoAction | SendMessageUploadVideoAction | SendMessageRecordAudioAction | SendMessageUploadAudioAction | SendMessageUploadPhotoAction | SendMessageUploadDocumentAction | SendMessageGeoLocationAction | SendMessageChooseContactAction | SendMessageGamePlayAction | SendMessageRecordRoundAction | SendMessageUploadRoundAction | SpeakingInGroupCallAction | SendMessageHistoryImportAction | SendMessageChooseStickerAction | SendMessageEmojiInteraction | SendMessageEmojiInteractionSeen

export type TypeSentCode = auth.SentCode | auth.SentCodeSuccess; // auth.SentCode | auth.SentCodeSuccess

export type TypeSentCodeType =
  | auth.SentCodeTypeApp
  | auth.SentCodeTypeSms
  | auth.SentCodeTypeCall
  | auth.SentCodeTypeFlashCall
  | auth.SentCodeTypeMissedCall
  | auth.SentCodeTypeEmailCode
  | auth.SentCodeTypeSetUpEmailRequired
  | auth.SentCodeTypeFragmentSms
  | auth.SentCodeTypeFirebaseSms
  | auth.SentCodeTypeSmsWord
  | auth.SentCodeTypeSmsPhrase; // auth.SentCodeTypeApp | auth.SentCodeTypeSms | auth.SentCodeTypeCall | auth.SentCodeTypeFlashCall | auth.SentCodeTypeMissedCall | auth.SentCodeTypeEmailCode | auth.SentCodeTypeSetUpEmailRequired | auth.SentCodeTypeFragmentSms | auth.SentCodeTypeFirebaseSms | auth.SentCodeTypeSmsWord | auth.SentCodeTypeSmsPhrase

export type TypeSentEmailCode = account.SentEmailCode; // account.SentEmailCode

export type TypeSentEncryptedMessage = messages.SentEncryptedMessage | messages.SentEncryptedFile; // messages.SentEncryptedMessage | messages.SentEncryptedFile

export type TypeServer_DH_inner_data = ServerDHInnerData; // ServerDHInnerData

export type TypeServer_DH_Params = ServerDHParamsFail | ServerDHParamsOk; // ServerDHParamsFail | ServerDHParamsOk

export type TypeSet_client_DH_params_answer = DhGenOk | DhGenRetry | DhGenFail; // DhGenOk | DhGenRetry | DhGenFail

export type TypeShippingOption = ShippingOption; // ShippingOption

export type TypeSmsJob = SmsJob; // SmsJob

export type TypeSponsoredMessage = SponsoredMessage; // SponsoredMessage

export type TypeSponsoredMessageReportOption = SponsoredMessageReportOption; // SponsoredMessageReportOption

export type TypeSponsoredMessageReportResult =
  | channels.SponsoredMessageReportResultChooseOption
  | channels.SponsoredMessageReportResultAdsHidden
  | channels.SponsoredMessageReportResultReported; // channels.SponsoredMessageReportResultChooseOption | channels.SponsoredMessageReportResultAdsHidden | channels.SponsoredMessageReportResultReported

export type TypeSponsoredMessages = messages.SponsoredMessages | messages.SponsoredMessagesEmpty; // messages.SponsoredMessages | messages.SponsoredMessagesEmpty

export type TypeStarGift = StarGift | StarGiftUnique; // StarGift | StarGiftUnique

export type TypeStarGiftAttribute =
  | StarGiftAttributeModel
  | StarGiftAttributePattern
  | StarGiftAttributeBackdrop
  | StarGiftAttributeOriginalDetails; // StarGiftAttributeModel | StarGiftAttributePattern | StarGiftAttributeBackdrop | StarGiftAttributeOriginalDetails

export type TypeStarGifts = payments.StarGiftsNotModified | payments.StarGifts; // payments.StarGiftsNotModified | payments.StarGifts

export type TypeStarGiftUpgradePreview = payments.StarGiftUpgradePreview; // payments.StarGiftUpgradePreview

export type TypeStarGiftWithdrawalUrl = payments.StarGiftWithdrawalUrl; // payments.StarGiftWithdrawalUrl

export type TypeStarRefProgram = StarRefProgram; // StarRefProgram

export type TypeStarsAmount = StarsAmount; // StarsAmount

export type TypeStarsGiftOption = StarsGiftOption; // StarsGiftOption

export type TypeStarsGiveawayOption = StarsGiveawayOption; // StarsGiveawayOption

export type TypeStarsGiveawayWinnersOption = StarsGiveawayWinnersOption; // StarsGiveawayWinnersOption

export type TypeStarsRating = StarsRating; // StarsRating

export type TypeStarsRevenueAdsAccountUrl = payments.StarsRevenueAdsAccountUrl; // payments.StarsRevenueAdsAccountUrl

export type TypeStarsRevenueStats = payments.StarsRevenueStats; // payments.StarsRevenueStats

export type TypeStarsRevenueStatus = StarsRevenueStatus; // StarsRevenueStatus

export type TypeStarsRevenueWithdrawalUrl = payments.StarsRevenueWithdrawalUrl; // payments.StarsRevenueWithdrawalUrl

export type TypeStarsStatus = payments.StarsStatus; // payments.StarsStatus

export type TypeStarsSubscription = StarsSubscription; // StarsSubscription

export type TypeStarsSubscriptionPricing = StarsSubscriptionPricing; // StarsSubscriptionPricing

export type TypeStarsTopupOption = StarsTopupOption; // StarsTopupOption

export type TypeStarsTransaction = StarsTransaction; // StarsTransaction

export type TypeStarsTransactionPeer =
  | StarsTransactionPeerUnsupported
  | StarsTransactionPeerAppStore
  | StarsTransactionPeerPlayMarket
  | StarsTransactionPeerPremiumBot
  | StarsTransactionPeerFragment
  | StarsTransactionPeer
  | StarsTransactionPeerAds
  | StarsTransactionPeerAPI; // StarsTransactionPeerUnsupported | StarsTransactionPeerAppStore | StarsTransactionPeerPlayMarket | StarsTransactionPeerPremiumBot | StarsTransactionPeerFragment | StarsTransactionPeer | StarsTransactionPeerAds | StarsTransactionPeerAPI

export type TypeStatsAbsValueAndPrev = StatsAbsValueAndPrev; // StatsAbsValueAndPrev

export type TypeStatsDateRangeDays = StatsDateRangeDays; // StatsDateRangeDays

export type TypeStatsGraph = StatsGraphAsync | StatsGraphError | StatsGraph; // StatsGraphAsync | StatsGraphError | StatsGraph

export type TypeStatsGroupTopAdmin = StatsGroupTopAdmin; // StatsGroupTopAdmin

export type TypeStatsGroupTopInviter = StatsGroupTopInviter; // StatsGroupTopInviter

export type TypeStatsGroupTopPoster = StatsGroupTopPoster; // StatsGroupTopPoster

export type TypeStatsPercentValue = StatsPercentValue; // StatsPercentValue

export type TypeStatsURL = StatsURL; // StatsURL

export type TypeStatus = smsjobs.Status; // smsjobs.Status

export type TypeStickerKeyword = StickerKeyword; // StickerKeyword

export type TypeStickerPack = StickerPack; // StickerPack

export type TypeStickers = messages.StickersNotModified | messages.Stickers; // messages.StickersNotModified | messages.Stickers

export type TypeStickerSet = messages.StickerSet | messages.StickerSetNotModified; // messages.StickerSet | messages.StickerSetNotModified

export type TypeStickerSetCovered =
  | StickerSetCovered
  | StickerSetMultiCovered
  | StickerSetFullCovered
  | StickerSetNoCovered; // StickerSetCovered | StickerSetMultiCovered | StickerSetFullCovered | StickerSetNoCovered

export type TypeStickerSetInstallResult =
  | messages.StickerSetInstallResultSuccess
  | messages.StickerSetInstallResultArchive; // messages.StickerSetInstallResultSuccess | messages.StickerSetInstallResultArchive

export type TypeStories = stories.Stories; // stories.Stories

export type TypeStoriesStealthMode = StoriesStealthMode; // StoriesStealthMode

export type TypeStoryFwdHeader = StoryFwdHeader; // StoryFwdHeader

export type TypeStoryItem = StoryItemDeleted | StoryItemSkipped | StoryItem; // StoryItemDeleted | StoryItemSkipped | StoryItem

export type TypeStoryReaction =
  | StoryReaction
  | StoryReactionPublicForward
  | StoryReactionPublicRepost; // StoryReaction | StoryReactionPublicForward | StoryReactionPublicRepost

export type TypeStoryReactionsList = stories.StoryReactionsList; // stories.StoryReactionsList

export type TypeStoryStats = stats.StoryStats; // stats.StoryStats

export type TypeStoryView = StoryView | StoryViewPublicForward | StoryViewPublicRepost; // StoryView | StoryViewPublicForward | StoryViewPublicRepost

export type TypeStoryViews = stories.StoryViews; // stories.StoryViews

export type TypeStoryViewsList = stories.StoryViewsList; // stories.StoryViewsList

export type TypeSuggestedShortName = stickers.SuggestedShortName; // stickers.SuggestedShortName

export type TypeSuggestedStarRefBots = payments.SuggestedStarRefBots; // payments.SuggestedStarRefBots

export type TypeSupport = help.Support; // help.Support

export type TypeSupportName = help.SupportName; // help.SupportName

export type TypeTakeout = account.Takeout; // account.Takeout

export type TypeTermsOfService = help.TermsOfService; // help.TermsOfService

export type TypeTermsOfServiceUpdate = help.TermsOfServiceUpdateEmpty | help.TermsOfServiceUpdate; // help.TermsOfServiceUpdateEmpty | help.TermsOfServiceUpdate

export type TypeTextWithEntities = TextWithEntities; // TextWithEntities

export type TypeTheme = Theme; // Theme

export type TypeThemes = account.ThemesNotModified | account.Themes; // account.ThemesNotModified | account.Themes

export type TypeThemeSettings = ThemeSettings; // ThemeSettings

export type TypeTimezone = Timezone; // Timezone

export type TypeTimezonesList = help.TimezonesListNotModified | help.TimezonesList; // help.TimezonesListNotModified | help.TimezonesList

export type TypeTlsBlock =
  | TlsBlockString
  | TlsBlockRandom
  | TlsBlockZero
  | TlsBlockDomain
  | TlsBlockGrease
  | TlsBlockPublicKey
  | TlsBlockScope
  | TlsBlockPermutation; // TlsBlockString | TlsBlockRandom | TlsBlockZero | TlsBlockDomain | TlsBlockGrease | TlsBlockPublicKey | TlsBlockScope | TlsBlockPermutation

export type TypeTlsClientHello = TlsClientHello; // TlsClientHello

export type TypeTmpPassword = account.TmpPassword; // account.TmpPassword

export type TypeTopPeer = TopPeer; // TopPeer

export type TypeTopPeerCategory =
  | TopPeerCategoryBotsPM
  | TopPeerCategoryBotsInline
  | TopPeerCategoryCorrespondents
  | TopPeerCategoryGroups
  | TopPeerCategoryChannels
  | TopPeerCategoryPhoneCalls
  | TopPeerCategoryForwardUsers
  | TopPeerCategoryForwardChats
  | TopPeerCategoryBotsApp; // TopPeerCategoryBotsPM | TopPeerCategoryBotsInline | TopPeerCategoryCorrespondents | TopPeerCategoryGroups | TopPeerCategoryChannels | TopPeerCategoryPhoneCalls | TopPeerCategoryForwardUsers | TopPeerCategoryForwardChats | TopPeerCategoryBotsApp

export type TypeTopPeerCategoryPeers = TopPeerCategoryPeers; // TopPeerCategoryPeers

export type TypeTopPeers =
  | contacts.TopPeersNotModified
  | contacts.TopPeers
  | contacts.TopPeersDisabled; // contacts.TopPeersNotModified | contacts.TopPeers | contacts.TopPeersDisabled

export type TypeTranscribedAudio = messages.TranscribedAudio; // messages.TranscribedAudio

export type TypeTranslatedText = messages.TranslateResult; // messages.TranslateResult

export type TypeUniqueStarGift = payments.UniqueStarGift; // payments.UniqueStarGift

export type TypeUrlAuthResult = UrlAuthResultRequest | UrlAuthResultAccepted | UrlAuthResultDefault; // UrlAuthResultRequest | UrlAuthResultAccepted | UrlAuthResultDefault

export type TypeUserInfo = help.UserInfoEmpty | help.UserInfo; // help.UserInfoEmpty | help.UserInfo

export type TypeValidatedRequestedInfo = payments.ValidatedRequestedInfo; // payments.ValidatedRequestedInfo

export type TypeVotesList = messages.VotesList; // messages.VotesList

export type TypeWallPaper = WallPaper | WallPaperNoFile; // WallPaper | WallPaperNoFile

export type TypeWallPapers = account.WallPapersNotModified | account.WallPapers; // account.WallPapersNotModified | account.WallPapers

export type TypeWallPaperSettings = WallPaperSettings; // WallPaperSettings

export type TypeWebAuthorization = WebAuthorization; // WebAuthorization

export type TypeWebAuthorizations = account.WebAuthorizations; // account.WebAuthorizations

export type TypeWebDocument = WebDocument | WebDocumentNoProxy; // WebDocument | WebDocumentNoProxy

export type TypeWebFile = upload.WebFile; // upload.WebFile

export type TypeWebPage = messages.WebPage; // messages.WebPage

export type TypeWebPageAttribute =
  | WebPageAttributeTheme
  | WebPageAttributeStory
  | WebPageAttributeStickerSet
  | WebPageAttributeUniqueStarGift; // WebPageAttributeTheme | WebPageAttributeStory | WebPageAttributeStickerSet | WebPageAttributeUniqueStarGift

export type TypeWebPagePreview = WebPagePreview; // messages.WebPagePreview

export type TypeWebViewMessageSent = WebViewMessageSent; // WebViewMessageSent

export type TypeWebViewResult = WebViewResultUrl; // WebViewResultUrl
