/**
 * Channel Telegram types.
 * Canonical home for Channel / ChannelFull / participants / admin-log constructors,
 * plus channels.* namespace result wrappers.
 */

import type {
  TypeBotInfo,
  TypeBotVerification,
  TypeEmojiStatus,
  TypeExportedChatInvite,
  TypeForumTopic,
  TypeGeoPoint,
  TypeGroupCallParticipant,
  TypeInputGroupCall,
  TypeInputStickerSet,
  TypeMessage,
  TypeMessageRange,
  TypePeer,
  TypePeerColor,
  TypePeerNotifySettings,
  TypePeerStories,
  TypeProfileTab,
  TypeRestrictionReason,
  TypeSendAsPeer,
  TypeSponsoredMessageReportOption,
  TypeStickerSet,
  TypeWallPaper,
} from './api-types';
import type {
  ChatInviteExported,
  TypeChat,
  TypeChatAdminRights,
  TypeChatBannedRights,
  TypeChatPhoto,
  TypeChatReactions,
} from './chats';
import type { TypePhoto } from './file';
import type { TypeUser, TypeUsername } from './users';

// --- Channel constructors ---

export type ChannelLocationEmpty = Record<string, never>;

export type ChannelMessagesFilterEmpty = Record<string, never>;

export type ChannelParticipantsRecent = Record<string, never>;

export type ChannelParticipantsAdmins = Record<string, never>;

export type ChannelParticipantsBots = Record<string, never>;

// --- Constructors ---

export type Channel = {
  // flags: null // null;
  creator?: boolean; // boolean;
  left?: boolean; // boolean;
  broadcast?: boolean; // boolean;
  verified?: boolean; // boolean;
  megagroup?: boolean; // boolean;
  restricted?: boolean; // boolean;
  signatures?: boolean; // boolean;
  min?: boolean; // boolean;
  scam?: boolean; // boolean;
  hasLink?: boolean; // boolean;
  hasGeo?: boolean; // boolean;
  slowmodeEnabled?: boolean; // boolean;
  callActive?: boolean; // boolean;
  callNotEmpty?: boolean; // boolean;
  fake?: boolean; // boolean;
  gigagroup?: boolean; // boolean;
  noforwards?: boolean; // boolean;
  joinToSend?: boolean; // boolean;
  joinRequest?: boolean; // boolean;
  forum?: boolean; // boolean;
  // flags2: null // null;
  storiesHidden?: boolean; // boolean;
  storiesHiddenMin?: boolean; // boolean;
  storiesUnavailable?: boolean; // boolean;
  signatureProfiles?: boolean; // boolean;
  id: string; // long -> string;
  accessHash?: string; // long -> string;
  title: string; // string;
  username?: string; // string;
  photo: TypeChatPhoto; // Api.TypeChatPhoto -> TypeChatPhoto;
  date: number; // int -> number;
  restrictionReason?: TypeRestrictionReason[]; // Api.TypeRestrictionReason[];
  adminRights?: TypeChatAdminRights; // Api.TypeChatAdminRights -> TypeChatAdminRights;
  bannedRights?: TypeChatBannedRights; // Api.TypeChatBannedRights -> TypeChatBannedRights;
  defaultBannedRights?: TypeChatBannedRights; // Api.TypeChatBannedRights -> TypeChatBannedRights;
  participantsCount?: number; // int -> number;
  usernames?: TypeUsername[]; // Api.TypeUsername[];
  storiesMaxId?: number; // int -> number;
  color?: TypePeerColor; // Api.TypePeerColor -> TypePeerColor;
  profileColor?: TypePeerColor; // Api.TypePeerColor -> TypePeerColor;
  emojiStatus?: TypeEmojiStatus; // Api.TypeEmojiStatus -> TypeEmojiStatus;
  level?: number; // int -> number;
  subscriptionUntilDate?: number; // int -> number;
  botVerificationIcon?: string; // long -> string;
};

export type ChannelForbidden = {
  // flags: null // null;
  broadcast?: boolean; // boolean;
  megagroup?: boolean; // boolean;
  id: string; // Bot API / TDLib dialog id (see peer-id.helper)
  accessHash: string; // long -> string;
  title: string; // string;
  untilDate?: number; // int -> number;
};

export type ChannelFull = {
  // flags: null // null;
  canViewParticipants?: boolean; // boolean;
  canSetUsername?: boolean; // boolean;
  canSetStickers?: boolean; // boolean;
  hiddenPrehistory?: boolean; // boolean;
  canSetLocation?: boolean; // boolean;
  hasScheduled?: boolean; // boolean;
  canViewStats?: boolean; // boolean;
  blocked?: boolean; // boolean;
  // flags2: null // null;
  canDeleteChannel?: boolean; // boolean;
  antispam?: boolean; // boolean;
  participantsHidden?: boolean; // boolean;
  translationsDisabled?: boolean; // boolean;
  storiesPinnedAvailable?: boolean; // boolean;
  viewForumAsMessages?: boolean; // boolean;
  restrictedSponsored?: boolean; // boolean;
  canViewRevenue?: boolean; // boolean;
  paidMediaAllowed?: boolean; // boolean;
  canViewStarsRevenue?: boolean; // boolean;
  paidReactionsAvailable?: boolean; // boolean;
  stargiftsAvailable?: boolean; // boolean;
  paidMessagesAvailable?: boolean; // boolean;
  id: string; // Bot API / TDLib dialog id (see peer-id.helper)
  about: string; // string;
  participantsCount?: number; // int -> number;
  adminsCount?: number; // int -> number;
  kickedCount?: number; // int -> number;
  bannedCount?: number; // int -> number;
  onlineCount?: number; // int -> number;
  readInboxMaxId: number; // int -> number;
  readOutboxMaxId: number; // int -> number;
  unreadCount: number; // int -> number;
  chatPhoto: TypePhoto; // Api.TypePhoto -> TypePhoto;
  notifySettings: TypePeerNotifySettings; // Api.TypePeerNotifySettings -> TypePeerNotifySettings;
  exportedInvite?: ChatInviteExported;
  botInfo: TypeBotInfo[]; // Api.TypeBotInfo[];
  migratedFromChatId?: string; // long -> string;
  migratedFromMaxId?: number; // int -> number;
  pinnedMsgId?: number; // int -> number;
  stickerset?: TypeStickerSet; // Api.TypeStickerSet -> TypeStickerSet;
  availableMinId?: number; // int -> number;
  folderId?: number; // int -> number;
  linkedChatId?: string; // long -> string;
  location?: TypeChannelLocation; // Api.TypeChannelLocation -> TypeChannelLocation;
  slowmodeSeconds?: number; // int -> number;
  slowmodeNextSendDate?: number; // int -> number;
  statsDc?: number; // int -> number;
  pts: number; // int -> number;
  call?: TypeInputGroupCall; // Api.TypeInputGroupCall -> TypeInputGroupCall;
  ttlPeriod?: number; // int -> number;
  pendingSuggestions?: string[]; // string[];
  groupcallDefaultJoinAs?: TypePeer; // Api.TypePeer -> TypePeer;
  themeEmoticon?: string; // string;
  requestsPending?: number; // int -> number;
  recentRequesters?: string[]; // long[] -> string[];
  defaultSendAs?: TypePeer; // Api.TypePeer -> TypePeer;
  availableReactions?: TypeChatReactions; // Api.TypeChatReactions -> TypeChatReactions;
  reactionsLimit?: number; // int -> number;
  stories?: TypePeerStories; // Api.TypePeerStories -> TypePeerStories;
  wallpaper?: TypeWallPaper; // Api.TypeWallPaper -> TypeWallPaper;
  boostsApplied?: number; // int -> number;
  boostsUnrestrict?: number; // int -> number;
  emojiset?: TypeStickerSet; // Api.TypeStickerSet -> TypeStickerSet;
  botVerification?: TypeBotVerification; // Api.TypeBotVerification -> TypeBotVerification;
  stargiftsCount?: number; // int -> number;
  sendPaidMessagesStars?: string; // long -> string;
  mainTab?: TypeProfileTab; // Api.TypeProfileTab -> TypeProfileTab;
};

export type ChannelLocation = {
  geoPoint: TypeGeoPoint; // Api.TypeGeoPoint -> TypeGeoPoint;
  address: string; // string;
};

export type ChannelMessagesFilter = {
  // flags: null // null;
  excludeNewMessages?: boolean; // boolean;
  ranges: TypeMessageRange[]; // Api.TypeMessageRange[];
};

export type ChannelParticipant = {
  // flags: null // null;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  date: number; // int -> number;
  subscriptionUntilDate?: number; // int -> number;
};

export type ChannelParticipantSelf = {
  // flags: null // null;
  viaRequest?: boolean; // boolean;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  inviterId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  date: number; // int -> number;
  subscriptionUntilDate?: number; // int -> number;
};

export type ChannelParticipantCreator = {
  // flags: null // null;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  adminRights: TypeChatAdminRights; // Api.TypeChatAdminRights -> TypeChatAdminRights;
  rank?: string; // string;
};

export type ChannelParticipantAdmin = {
  // flags: null // null;
  canEdit?: boolean; // boolean;
  self?: boolean; // boolean;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  inviterId?: string; // Bot API / TDLib dialog id (see peer-id.helper)
  promotedBy: string; // long -> string;
  date: number; // int -> number;
  adminRights: TypeChatAdminRights; // Api.TypeChatAdminRights -> TypeChatAdminRights;
  rank?: string; // string;
};

export type ChannelParticipantBanned = {
  // flags: null // null;
  left?: boolean; // boolean;
  peer: TypePeer; // Api.TypePeer -> TypePeer;
  kickedBy: string; // Bot API / TDLib dialog id (see peer-id.helper)
  date: number; // int -> number;
  bannedRights: TypeChatBannedRights; // Api.TypeChatBannedRights -> TypeChatBannedRights;
};

export type ChannelParticipantLeft = {
  peer: TypePeer; // Api.TypePeer -> TypePeer;
};

export type ChannelParticipantsBanned = {
  q: string; // string;
};

export type ChannelParticipantsContacts = {
  q: string; // string;
};

export type ChannelParticipantsKicked = {
  q: string; // string;
};

export type ChannelParticipantsMentions = {
  // flags: null // null;
  q?: string; // string;
  topMsgId?: number; // int -> number;
};

export type ChannelParticipantsSearch = {
  q: string; // string;
};


// --- Type* unions ---

export type TypeChannelLocation = ChannelLocationEmpty | ChannelLocation;

export type TypeChannelMessagesFilter = ChannelMessagesFilterEmpty | ChannelMessagesFilter;

export type TypeChannelParticipant =
  | ChannelParticipant
  | ChannelParticipantSelf
  | ChannelParticipantCreator
  | ChannelParticipantAdmin
  | ChannelParticipantBanned
  | ChannelParticipantLeft;

export type TypeChannelParticipantsFilter =
  | ChannelParticipantsRecent
  | ChannelParticipantsAdmins
  | ChannelParticipantsKicked
  | ChannelParticipantsBots
  | ChannelParticipantsBanned
  | ChannelParticipantsSearch
  | ChannelParticipantsContacts
  | ChannelParticipantsMentions;

// --- Admin log constructors ---

/** Empty marker actions (no payload). */
export type ChannelAdminLogEventActionParticipantJoin = Record<string, never>;

export type ChannelAdminLogEventActionParticipantLeave = Record<string, never>;

export type ChannelAdminLogEvent = {
  id: string; // long -> string;
  date: number; // int -> number;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  action: TypeChannelAdminLogEventAction; // Api.TypeChannelAdminLogEventAction -> TypeChannelAdminLogEventAction;
};

export type ChannelAdminLogEventActionChangeAbout = {
  prevValue: string; // string;
  newValue: string; // string;
};

export type ChannelAdminLogEventActionChangeAvailableReactions = {
  prevValue: TypeChatReactions; // Api.TypeChatReactions -> TypeChatReactions;
  newValue: TypeChatReactions; // Api.TypeChatReactions -> TypeChatReactions;
};

export type ChannelAdminLogEventActionChangeEmojiStatus = {
  prevValue: TypeEmojiStatus; // Api.TypeEmojiStatus -> TypeEmojiStatus;
  newValue: TypeEmojiStatus; // Api.TypeEmojiStatus -> TypeEmojiStatus;
};

export type ChannelAdminLogEventActionChangeEmojiStickerSet = {
  prevStickerset: TypeInputStickerSet; // Api.TypeInputStickerSet -> TypeInputStickerSet;
  newStickerset: TypeInputStickerSet; // Api.TypeInputStickerSet -> TypeInputStickerSet;
};

export type ChannelAdminLogEventActionChangeHistoryTTL = {
  prevValue: number; // int -> number;
  newValue: number; // int -> number;
};

export type ChannelAdminLogEventActionChangeLinkedChat = {
  prevValue: string; // long -> string;
  newValue: string; // long -> string;
};

export type ChannelAdminLogEventActionChangeLocation = {
  prevValue: TypeChannelLocation; // Api.TypeChannelLocation -> TypeChannelLocation;
  newValue: TypeChannelLocation; // Api.TypeChannelLocation -> TypeChannelLocation;
};

export type ChannelAdminLogEventActionChangePeerColor = {
  prevValue: TypePeerColor; // Api.TypePeerColor -> TypePeerColor;
  newValue: TypePeerColor; // Api.TypePeerColor -> TypePeerColor;
};

export type ChannelAdminLogEventActionChangePhoto = {
  prevPhoto: TypePhoto; // Api.TypePhoto -> TypePhoto;
  newPhoto: TypePhoto; // Api.TypePhoto -> TypePhoto;
};

export type ChannelAdminLogEventActionChangeProfilePeerColor = {
  prevValue: TypePeerColor; // Api.TypePeerColor -> TypePeerColor;
  newValue: TypePeerColor; // Api.TypePeerColor -> TypePeerColor;
};

export type ChannelAdminLogEventActionChangeStickerSet = {
  prevStickerset: TypeInputStickerSet; // Api.TypeInputStickerSet -> TypeInputStickerSet;
  newStickerset: TypeInputStickerSet; // Api.TypeInputStickerSet -> TypeInputStickerSet;
};

export type ChannelAdminLogEventActionChangeTitle = {
  prevValue: string; // string;
  newValue: string; // string;
};

export type ChannelAdminLogEventActionChangeUsername = {
  prevValue: string; // string;
  newValue: string; // string;
};

export type ChannelAdminLogEventActionChangeUsernames = {
  prevValue: string[]; // string[];
  newValue: string[]; // string[];
};

export type ChannelAdminLogEventActionChangeWallpaper = {
  prevValue: TypeWallPaper; // Api.TypeWallPaper -> TypeWallPaper;
  newValue: TypeWallPaper; // Api.TypeWallPaper -> TypeWallPaper;
};

export type ChannelAdminLogEventActionCreateTopic = {
  topic: TypeForumTopic; // Api.TypeForumTopic -> TypeForumTopic;
};

export type ChannelAdminLogEventActionDefaultBannedRights = {
  prevBannedRights: TypeChatBannedRights; // Api.TypeChatBannedRights -> TypeChatBannedRights;
  newBannedRights: TypeChatBannedRights; // Api.TypeChatBannedRights -> TypeChatBannedRights;
};

export type ChannelAdminLogEventActionDeleteMessage = {
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
};

export type ChannelAdminLogEventActionDeleteTopic = {
  topic: TypeForumTopic; // Api.TypeForumTopic -> TypeForumTopic;
};

export type ChannelAdminLogEventActionDiscardGroupCall = {
  call: TypeInputGroupCall; // Api.TypeInputGroupCall -> TypeInputGroupCall;
};

export type ChannelAdminLogEventActionEditMessage = {
  prevMessage: TypeMessage; // Api.TypeMessage -> TypeMessage;
  newMessage: TypeMessage; // Api.TypeMessage -> TypeMessage;
};

export type ChannelAdminLogEventActionEditTopic = {
  prevTopic: TypeForumTopic; // Api.TypeForumTopic -> TypeForumTopic;
  newTopic: TypeForumTopic; // Api.TypeForumTopic -> TypeForumTopic;
};

export type ChannelAdminLogEventActionExportedInviteDelete = {
  invite: TypeExportedChatInvite; // Api.TypeExportedChatInvite -> TypeExportedChatInvite;
};

export type ChannelAdminLogEventActionExportedInviteEdit = {
  prevInvite: TypeExportedChatInvite; // Api.TypeExportedChatInvite -> TypeExportedChatInvite;
  newInvite: TypeExportedChatInvite; // Api.TypeExportedChatInvite -> TypeExportedChatInvite;
};

export type ChannelAdminLogEventActionExportedInviteRevoke = {
  invite: TypeExportedChatInvite; // Api.TypeExportedChatInvite -> TypeExportedChatInvite;
};

export type ChannelAdminLogEventActionParticipantInvite = {
  participant: TypeChannelParticipant; // Api.TypeChannelParticipant -> TypeChannelParticipant;
};

export type ChannelAdminLogEventActionParticipantJoinByInvite = {
  // flags: null // null;
  viaChatlist?: boolean; // boolean;
  invite: TypeExportedChatInvite; // Api.TypeExportedChatInvite -> TypeExportedChatInvite;
};

export type ChannelAdminLogEventActionParticipantJoinByRequest = {
  invite: TypeExportedChatInvite; // Api.TypeExportedChatInvite -> TypeExportedChatInvite;
  approvedBy: string; // long -> string;
};

export type ChannelAdminLogEventActionParticipantMute = {
  participant: TypeGroupCallParticipant; // Api.TypeGroupCallParticipant -> TypeGroupCallParticipant;
};

export type ChannelAdminLogEventActionParticipantSubExtend = {
  prevParticipant: TypeChannelParticipant; // Api.TypeChannelParticipant -> TypeChannelParticipant;
  newParticipant: TypeChannelParticipant; // Api.TypeChannelParticipant -> TypeChannelParticipant;
};

export type ChannelAdminLogEventActionParticipantToggleAdmin = {
  prevParticipant: TypeChannelParticipant; // Api.TypeChannelParticipant -> TypeChannelParticipant;
  newParticipant: TypeChannelParticipant; // Api.TypeChannelParticipant -> TypeChannelParticipant;
};

export type ChannelAdminLogEventActionParticipantToggleBan = {
  prevParticipant: TypeChannelParticipant; // Api.TypeChannelParticipant -> TypeChannelParticipant;
  newParticipant: TypeChannelParticipant; // Api.TypeChannelParticipant -> TypeChannelParticipant;
};

export type ChannelAdminLogEventActionParticipantUnmute = {
  participant: TypeGroupCallParticipant; // Api.TypeGroupCallParticipant -> TypeGroupCallParticipant;
};

export type ChannelAdminLogEventActionParticipantVolume = {
  participant: TypeGroupCallParticipant; // Api.TypeGroupCallParticipant -> TypeGroupCallParticipant;
};

export type ChannelAdminLogEventActionPinTopic = {
  // flags: null // null;
  prevTopic?: TypeForumTopic; // Api.TypeForumTopic -> TypeForumTopic;
  newTopic?: TypeForumTopic; // Api.TypeForumTopic -> TypeForumTopic;
};

export type ChannelAdminLogEventActionSendMessage = {
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
};

export type ChannelAdminLogEventActionStartGroupCall = {
  call: TypeInputGroupCall; // Api.TypeInputGroupCall -> TypeInputGroupCall;
};

export type ChannelAdminLogEventActionStopPoll = {
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
};

export type ChannelAdminLogEventActionToggleAntiSpam = {
  newValue: boolean; // Bool -> boolean;
};

export type ChannelAdminLogEventActionToggleForum = {
  newValue: boolean; // Bool -> boolean;
};

export type ChannelAdminLogEventActionToggleGroupCallSetting = {
  joinMuted: boolean; // Bool -> boolean;
};

export type ChannelAdminLogEventActionToggleInvites = {
  newValue: boolean; // Bool -> boolean;
};

export type ChannelAdminLogEventActionToggleNoForwards = {
  newValue: boolean; // Bool -> boolean;
};

export type ChannelAdminLogEventActionTogglePreHistoryHidden = {
  newValue: boolean; // Bool -> boolean;
};

export type ChannelAdminLogEventActionToggleSignatureProfiles = {
  newValue: boolean; // Bool -> boolean;
};

export type ChannelAdminLogEventActionToggleSignatures = {
  newValue: boolean; // Bool -> boolean;
};

export type ChannelAdminLogEventActionToggleSlowMode = {
  prevValue: number; // int -> number;
  newValue: number; // int -> number;
};

export type ChannelAdminLogEventActionUpdatePinned = {
  message: TypeMessage; // Api.TypeMessage -> TypeMessage;
};

export type ChannelAdminLogEventsFilter = {
  // flags: null // null;
  join?: boolean; // boolean;
  leave?: boolean; // boolean;
  invite?: boolean; // boolean;
  ban?: boolean; // boolean;
  unban?: boolean; // boolean;
  kick?: boolean; // boolean;
  unkick?: boolean; // boolean;
  promote?: boolean; // boolean;
  demote?: boolean; // boolean;
  info?: boolean; // boolean;
  settings?: boolean; // boolean;
  pinned?: boolean; // boolean;
  edit?: boolean; // boolean;
  delete?: boolean; // boolean;
  groupCall?: boolean; // boolean;
  invites?: boolean; // boolean;
  send?: boolean; // boolean;
  forums?: boolean; // boolean;
  subExtend?: boolean; // boolean;
};

// --- Admin log Type* unions ---

export type TypeChannelAdminLogEvent = ChannelAdminLogEvent; // ChannelAdminLogEvent

export type TypeChannelAdminLogEventAction =
  | ChannelAdminLogEventActionChangeTitle
  | ChannelAdminLogEventActionChangeAbout
  | ChannelAdminLogEventActionChangeUsername
  | ChannelAdminLogEventActionChangePhoto
  | ChannelAdminLogEventActionToggleInvites
  | ChannelAdminLogEventActionToggleSignatures
  | ChannelAdminLogEventActionUpdatePinned
  | ChannelAdminLogEventActionEditMessage
  | ChannelAdminLogEventActionDeleteMessage
  | ChannelAdminLogEventActionParticipantJoin
  | ChannelAdminLogEventActionParticipantLeave
  | ChannelAdminLogEventActionParticipantInvite
  | ChannelAdminLogEventActionParticipantToggleBan
  | ChannelAdminLogEventActionParticipantToggleAdmin
  | ChannelAdminLogEventActionChangeStickerSet
  | ChannelAdminLogEventActionTogglePreHistoryHidden
  | ChannelAdminLogEventActionDefaultBannedRights
  | ChannelAdminLogEventActionStopPoll
  | ChannelAdminLogEventActionChangeLinkedChat
  | ChannelAdminLogEventActionChangeLocation
  | ChannelAdminLogEventActionToggleSlowMode
  | ChannelAdminLogEventActionStartGroupCall
  | ChannelAdminLogEventActionDiscardGroupCall
  | ChannelAdminLogEventActionParticipantMute
  | ChannelAdminLogEventActionParticipantUnmute
  | ChannelAdminLogEventActionToggleGroupCallSetting
  | ChannelAdminLogEventActionParticipantJoinByInvite
  | ChannelAdminLogEventActionExportedInviteDelete
  | ChannelAdminLogEventActionExportedInviteRevoke
  | ChannelAdminLogEventActionExportedInviteEdit
  | ChannelAdminLogEventActionParticipantVolume
  | ChannelAdminLogEventActionChangeHistoryTTL
  | ChannelAdminLogEventActionParticipantJoinByRequest
  | ChannelAdminLogEventActionToggleNoForwards
  | ChannelAdminLogEventActionSendMessage
  | ChannelAdminLogEventActionChangeAvailableReactions
  | ChannelAdminLogEventActionChangeUsernames
  | ChannelAdminLogEventActionToggleForum
  | ChannelAdminLogEventActionCreateTopic
  | ChannelAdminLogEventActionEditTopic
  | ChannelAdminLogEventActionDeleteTopic
  | ChannelAdminLogEventActionPinTopic
  | ChannelAdminLogEventActionToggleAntiSpam
  | ChannelAdminLogEventActionChangePeerColor
  | ChannelAdminLogEventActionChangeProfilePeerColor
  | ChannelAdminLogEventActionChangeWallpaper
  | ChannelAdminLogEventActionChangeEmojiStatus
  | ChannelAdminLogEventActionChangeEmojiStickerSet
  | ChannelAdminLogEventActionToggleSignatureProfiles
  | ChannelAdminLogEventActionParticipantSubExtend; // ChannelAdminLogEventActionChangeTitle | ChannelAdminLogEventActionChangeAbout | ChannelAdminLogEventActionChangeUsername | ChannelAdminLogEventActionChangePhoto | ChannelAdminLogEventActionToggleInvites | ChannelAdminLogEventActionToggleSignatures | ChannelAdminLogEventActionUpdatePinned | ChannelAdminLogEventActionEditMessage | ChannelAdminLogEventActionDeleteMessage | ChannelAdminLogEventActionParticipantJoin | ChannelAdminLogEventActionParticipantLeave | ChannelAdminLogEventActionParticipantInvite | ChannelAdminLogEventActionParticipantToggleBan | ChannelAdminLogEventActionParticipantToggleAdmin | ChannelAdminLogEventActionChangeStickerSet | ChannelAdminLogEventActionTogglePreHistoryHidden | ChannelAdminLogEventActionDefaultBannedRights | ChannelAdminLogEventActionStopPoll | ChannelAdminLogEventActionChangeLinkedChat | ChannelAdminLogEventActionChangeLocation | ChannelAdminLogEventActionToggleSlowMode | ChannelAdminLogEventActionStartGroupCall | ChannelAdminLogEventActionDiscardGroupCall | ChannelAdminLogEventActionParticipantMute | ChannelAdminLogEventActionParticipantUnmute | ChannelAdminLogEventActionToggleGroupCallSetting | ChannelAdminLogEventActionParticipantJoinByInvite | ChannelAdminLogEventActionExportedInviteDelete | ChannelAdminLogEventActionExportedInviteRevoke | ChannelAdminLogEventActionExportedInviteEdit | ChannelAdminLogEventActionParticipantVolume | ChannelAdminLogEventActionChangeHistoryTTL | ChannelAdminLogEventActionParticipantJoinByRequest | ChannelAdminLogEventActionToggleNoForwards | ChannelAdminLogEventActionSendMessage | ChannelAdminLogEventActionChangeAvailableReactions | ChannelAdminLogEventActionChangeUsernames | ChannelAdminLogEventActionToggleForum | ChannelAdminLogEventActionCreateTopic | ChannelAdminLogEventActionEditTopic | ChannelAdminLogEventActionDeleteTopic | ChannelAdminLogEventActionPinTopic | ChannelAdminLogEventActionToggleAntiSpam | ChannelAdminLogEventActionChangePeerColor | ChannelAdminLogEventActionChangeProfilePeerColor | ChannelAdminLogEventActionChangeWallpaper | ChannelAdminLogEventActionChangeEmojiStatus | ChannelAdminLogEventActionChangeEmojiStickerSet | ChannelAdminLogEventActionToggleSignatureProfiles | ChannelAdminLogEventActionParticipantSubExtend

export type TypeChannelAdminLogEventsFilter = ChannelAdminLogEventsFilter; // ChannelAdminLogEventsFilter

// --- channels.* namespace results ---

export type AdminLogResults = {
  events: TypeChannelAdminLogEvent[];
  chats: TypeChat[];
  users: TypeUser[];
};

/** channels.ChannelParticipant — wrapper; not the TL constructor. */
export type ChannelsChannelParticipant = {
  participant: TypeChannelParticipant;
  chats: TypeChat[];
  users: TypeUser[];
};

export type ChannelParticipants = {
  count: number;
  participants: TypeChannelParticipant[];
  chats: TypeChat[];
  users: TypeUser[];
};

export type ChannelParticipantsNotModified = Record<string, never>;

export type SendAsPeers = {
  peers: TypeSendAsPeer[];
  chats: TypeChat[];
  users: TypeUser[];
};

export type SponsoredMessageReportResultChooseOption = {
  title: string;
  options: TypeSponsoredMessageReportOption[];
};

export type SponsoredMessageReportResultAdsHidden = Record<string, never>;
export type SponsoredMessageReportResultReported = Record<string, never>;

export type TypeAdminLogResults = AdminLogResults;

export type TypeChannelsChannelParticipant = ChannelsChannelParticipant;

export type TypeChannelParticipants =
  | ChannelParticipants
  | ChannelParticipantsNotModified;

export type TypeSendAsPeers = SendAsPeers;

export type TypeSponsoredMessageReportResult =
  | SponsoredMessageReportResultChooseOption
  | SponsoredMessageReportResultAdsHidden
  | SponsoredMessageReportResultReported;


/** Channel peer constructors (excluding basic Chat). */
export type TypeChannel = Channel | ChannelForbidden;

export type TypeChannelFull = ChannelFull;
