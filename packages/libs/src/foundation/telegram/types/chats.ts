/**
 * Chat Telegram constructors.
 * Canonical home for Chat / ChatFull / rights / participants / invites.
 * Channel* types live in ./channels.
 */

import type {
  TypeBotInfo,
  TypeInputChannel,
  TypeInputGroupCall,
  TypePeer,
  TypePeerNotifySettings,
  TypeReaction,
} from './api-types';
import type { Channel, ChannelForbidden, ChannelFull } from './channels';
import type { TypePhoto } from './file';

// --- Empty markers ---

export type ChatPhotoEmpty = Record<string, never>;

export type ChatReactionsNone = Record<string, never>;

export type ChatEmpty = {
  id: string; // Bot API / TDLib dialog id (see peer-id.helper)
};

export type Chat = {
  // flags: null // null;
  creator?: boolean; // boolean;
  left?: boolean; // boolean;
  deactivated?: boolean; // boolean;
  callActive?: boolean; // boolean;
  callNotEmpty?: boolean; // boolean;
  noforwards?: boolean; // boolean;
  id: string; // Bot API / TDLib dialog id (see peer-id.helper)
  title: string; // string;
  photo?: TypeChatPhoto | null; // Api.TypeChatPhoto -> TypeChatPhoto;
  participantsCount: number; // int -> number;
  date: number; // int -> number;
  version: number; // int -> number;
  migratedTo?: TypeInputChannel; // Api.TypeInputChannel -> TypeInputChannel;
  adminRights?: TypeChatAdminRights; // Api.TypeChatAdminRights -> TypeChatAdminRights;
  defaultBannedRights?: TypeChatBannedRights; // Api.TypeChatBannedRights -> TypeChatBannedRights;
};

export type ChatForbidden = {
  id: string; // Bot API / TDLib dialog id (see peer-id.helper)
  title: string; // string;
};

export type ChatAdminRights = {
  // flags: null // null;
  changeInfo?: boolean; // boolean;
  postMessages?: boolean; // boolean;
  editMessages?: boolean; // boolean;
  deleteMessages?: boolean; // boolean;
  banUsers?: boolean; // boolean;
  inviteUsers?: boolean; // boolean;
  pinMessages?: boolean; // boolean;
  addAdmins?: boolean; // boolean;
  anonymous?: boolean; // boolean;
  manageCall?: boolean; // boolean;
  other?: boolean; // boolean;
  manageTopics?: boolean; // boolean;
  postStories?: boolean; // boolean;
  editStories?: boolean; // boolean;
  deleteStories?: boolean; // boolean;
};

export type ChatBannedRights = {
  // flags: null // null;
  viewMessages?: boolean; // boolean;
  sendMessages?: boolean; // boolean;
  sendMedia?: boolean; // boolean;
  sendStickers?: boolean; // boolean;
  sendGifs?: boolean; // boolean;
  sendGames?: boolean; // boolean;
  sendInline?: boolean; // boolean;
  embedLinks?: boolean; // boolean;
  sendPolls?: boolean; // boolean;
  changeInfo?: boolean; // boolean;
  inviteUsers?: boolean; // boolean;
  pinMessages?: boolean; // boolean;
  manageTopics?: boolean; // boolean;
  sendPhotos?: boolean; // boolean;
  sendVideos?: boolean; // boolean;
  sendRoundvideos?: boolean; // boolean;
  sendAudios?: boolean; // boolean;
  sendVoices?: boolean; // boolean;
  sendDocs?: boolean; // boolean;
  sendPlain?: boolean; // boolean;
  untilDate: number; // int -> number;
};

export type ChatAdminWithInvites = {
  adminId: string; // long -> string;
  invitesCount: number; // int -> number;
  revokedInvitesCount: number; // int -> number;
};

export type ChatPhoto = {
  // flags: null // null;
  hasVideo?: boolean; // boolean;
  photoId: string; // long -> string;
  /** JPEG data URI from stripped thumb bytes (`data:image/jpeg;base64,...`) */
  strippedThumb?: string;
  dcId: number; // int -> number;
};

export type ChatParticipant = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  inviterId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  date: number; // int -> number;
};

export type ChatParticipantCreator = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
};

export type ChatParticipantAdmin = {
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  inviterId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  date: number; // int -> number;
};

export type ChatParticipants = {
  chatId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  participants: TypeChatParticipant[]; // Api.TypeChatParticipant[];
  version: number; // int -> number;
};

export type ChatParticipantsForbidden = {
  // flags: null // null;
  chatId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  selfParticipant?: TypeChatParticipant; // Api.TypeChatParticipant -> TypeChatParticipant;
};

export type ChatInvite = {
  // flags: null // null;
  channel?: boolean; // boolean;
  broadcast?: boolean; // boolean;
  public?: boolean; // boolean;
  megagroup?: boolean; // boolean;
  requestNeeded?: boolean; // boolean;
  verified?: boolean; // boolean;
  scam?: boolean; // boolean;
  fake?: boolean; // boolean;
  canRefulfillSubscription?: boolean; // boolean;
  title: string; // string;
  about?: string; // string;
  photo: TypePhoto; // Api.TypePhoto -> TypePhoto;
  participantsCount: number; // int -> number;
  participants?: TypeUser[]; // Api.TypeUser[];
  color: number; // int -> number;
  subscriptionPricing?: TypeStarsSubscriptionPricing; // Api.TypeStarsSubscriptionPricing -> TypeStarsSubscriptionPricing;
  subscriptionFormId?: string; // long -> string;
  botVerification?: TypeBotVerification; // Api.TypeBotVerification -> TypeBotVerification;
};

export type ChatInviteAlready = {
  chat: TypeChat; // Api.TypeChat -> TypeChat;
};

export type ChatInvitePeek = {
  chat: TypeChat; // Api.TypeChat -> TypeChat;
  expires: number; // int -> number;
};

export type ChatInviteExported = {
  // flags: null // null;
  revoked?: boolean; // boolean;
  permanent?: boolean; // boolean;
  requestNeeded?: boolean; // boolean;
  link: string; // string;
  adminId: string; // long -> string;
  date: number; // int -> number;
  startDate?: number; // int -> number;
  expireDate?: number; // int -> number;
  usageLimit?: number; // int -> number;
  usage?: number; // int -> number;
  requested?: number; // int -> number;
  subscriptionExpired?: number; // int -> number;
  title?: string; // string;
  subscriptionPricing?: TypeStarsSubscriptionPricing; // Api.TypeStarsSubscriptionPricing -> TypeStarsSubscriptionPricing;
};

export type ChatInviteImporter = {
  // flags: null // null;
  requested?: boolean; // boolean;
  viaChatlist?: boolean; // boolean;
  userId: string; // Bot API / TDLib dialog id (see peer-id.helper)
  date: number; // int -> number;
  about?: string; // string;
  approvedBy?: string; // long -> string;
};

export type ChatOnlines = {
  onlines: number; // int -> number;
};

export type ChatReactionsAll = {
  // flags: null // null;
  allowCustom?: boolean; // boolean;
};

export type ChatReactionsSome = {
  reactions: TypeReaction[]; // Api.TypeReaction[];
};

export type ChatTheme = {
  emoticon?: string; // string;
};

export type ChatFull = {
  // flags: null // null;
  canSetUsername?: boolean; // boolean;
  hasScheduled?: boolean; // boolean;
  translationsDisabled?: boolean; // boolean;
  id: string; // Bot API / TDLib dialog id (see peer-id.helper)
  about: string; // string;
  participants: TypeChatParticipants; // Api.TypeChatParticipants -> TypeChatParticipants;
  chatPhoto?: TypePhoto; // Api.TypePhoto -> TypePhoto;
  notifySettings: TypePeerNotifySettings; // Api.TypePeerNotifySettings -> TypePeerNotifySettings;
  exportedInvite?: ChatInviteExported;
  botInfo?: TypeBotInfo[]; // Api.TypeBotInfo[];
  pinnedMsgId?: number; // int -> number;
  folderId?: number; // int -> number;
  call?: TypeInputGroupCall; // Api.TypeInputGroupCall -> TypeInputGroupCall;
  ttlPeriod?: number; // int -> number;
  groupcallDefaultJoinAs?: TypePeer; // Api.TypePeer -> TypePeer;
  themeEmoticon?: string; // string;
  requestsPending?: number; // int -> number;
  recentRequesters?: string[]; // long[] -> string[];
  availableReactions?: TypeChatReactions; // Api.TypeChatReactions -> TypeChatReactions;
  reactionsLimit?: number; // int -> number;
};

export type TypeChat = ChatEmpty | Chat | ChatForbidden | Channel | ChannelForbidden;

export type TypeChatFull = ChatFull | ChannelFull;

export type TypeChatPhoto = ChatPhotoEmpty | ChatPhoto;

export type TypeChatAdminRights = ChatAdminRights;

export type TypeChatBannedRights = ChatBannedRights;

export type TypeChatAdminWithInvites = ChatAdminWithInvites;

export type TypeChatParticipant =
  | ChatParticipant
  | ChatParticipantCreator
  | ChatParticipantAdmin;

export type TypeChatParticipants = ChatParticipantsForbidden | ChatParticipants;

export type TypeChatInvite = ChatInviteAlready | ChatInvite | ChatInvitePeek;

export type TypeChatInviteImporter = ChatInviteImporter;

/** Exported invite constructor (chatInviteExported). */
export type TypeChatInviteExported = ChatInviteExported;

export type TypeChatOnlines = ChatOnlines;

export type TypeChatReactions = ChatReactionsNone | ChatReactionsAll | ChatReactionsSome;

export type TypeChatTheme = ChatTheme;

