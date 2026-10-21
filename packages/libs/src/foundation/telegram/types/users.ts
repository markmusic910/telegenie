/**
 * User-related Telegram types (constructors + users.* namespace results).
 * Canonical home for User / UserFull / related status & photo types.
 */

import type {
  TypeBirthday,
  TypeBotInfo,
  TypeBotVerification,
  TypeBusinessAwayMessage,
  TypeBusinessGreetingMessage,
  TypeBusinessIntro,
  TypeBusinessLocation,
  TypeBusinessWorkHours,
  TypeDisallowedGiftsSettings,
  TypeEmojiStatus,
  TypePeerColor,
  TypePeerNotifySettings,
  TypePeerSettings,
  TypePeerStories,
  TypeProfileTab,
  TypeRestrictionReason,
  TypeStarRefProgram,
  TypeStarsRating,
  TypeTextWithEntities,
  TypeWallPaper,
} from './api-types';
import type {
  TypeChat,
  TypeChatAdminRights,
  TypeChatTheme,
} from './chats';
import type { TypeDocument, TypePhoto } from './file';

// --- Constructors ---

export type User = {
  self?: boolean;
  contact?: boolean;
  mutualContact?: boolean;
  deleted?: boolean;
  bot?: boolean;
  botChatHistory?: boolean;
  botNochats?: boolean;
  verified?: boolean;
  restricted?: boolean;
  min?: boolean;
  botInlineGeo?: boolean;
  support?: boolean;
  scam?: boolean;
  applyMinPhoto?: boolean;
  fake?: boolean;
  botAttachMenu?: boolean;
  premium?: boolean;
  attachMenuEnabled?: boolean;
  botCanEdit?: boolean;
  closeFriend?: boolean;
  storiesHidden?: boolean;
  storiesUnavailable?: boolean;
  contactRequirePremium?: boolean;
  botBusiness?: boolean;
  botHasMainApp?: boolean;
  id: string;
  accessHash?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  phone?: string;
  photo?: TypeUserProfilePhoto;
  status?: TypeUserStatus;
  botInfoVersion?: number;
  restrictionReason?: TypeRestrictionReason[];
  botInlinePlaceholder?: string;
  langCode?: string;
  emojiStatus?: TypeEmojiStatus;
  usernames?: TypeUsername[];
  storiesMaxId?: number;
  color?: TypePeerColor;
  profileColor?: TypePeerColor;
  botActiveUsers?: number;
  botVerificationIcon?: string;
};

export type UserEmpty = {
  id: string;
};

/**
 * @see https://core.telegram.org/constructor/userFull
 */
export type UserFull = {
  blocked?: boolean;
  phoneCallsAvailable?: boolean;
  phoneCallsPrivate?: boolean;
  canPinMessage?: boolean;
  hasScheduled?: boolean;
  videoCallsAvailable?: boolean;
  voiceMessagesForbidden?: boolean;
  translationsDisabled?: boolean;
  storiesPinnedAvailable?: boolean;
  blockedMyStoriesFrom?: boolean;
  wallpaperOverridden?: boolean;
  contactRequirePremium?: boolean;
  readDatesPrivate?: boolean;
  sponsoredEnabled?: boolean;
  canViewRevenue?: boolean;
  botCanManageEmojiStatus?: boolean;
  displayGiftsButton?: boolean;
  noforwardsMyEnabled?: boolean;
  noforwardsPeerEnabled?: boolean;
  unofficialSecurityRisk?: boolean;
  id: string;
  about?: string;
  settings: TypePeerSettings;
  personalPhoto?: TypePhoto;
  profilePhoto?: TypePhoto;
  fallbackPhoto?: TypePhoto;
  notifySettings: TypePeerNotifySettings;
  botInfo?: TypeBotInfo;
  pinnedMsgId?: number;
  commonChatsCount: number;
  folderId?: number;
  ttlPeriod?: number;
  theme?: TypeChatTheme;
  privateForwardName?: string;
  botGroupAdminRights?: TypeChatAdminRights;
  botBroadcastAdminRights?: TypeChatAdminRights;
  wallpaper?: TypeWallPaper;
  stories?: TypePeerStories;
  businessWorkHours?: TypeBusinessWorkHours;
  businessLocation?: TypeBusinessLocation;
  businessGreetingMessage?: TypeBusinessGreetingMessage;
  businessAwayMessage?: TypeBusinessAwayMessage;
  businessIntro?: TypeBusinessIntro;
  birthday?: TypeBirthday;
  personalChannelId?: string;
  personalChannelMessage?: number;
  stargiftsCount?: number;
  starrefProgram?: TypeStarRefProgram;
  botVerification?: TypeBotVerification;
  sendPaidMessagesStars?: string;
  disallowedGifts?: TypeDisallowedGiftsSettings;
  starsRating?: TypeStarsRating;
  starsMyPendingRating?: TypeStarsRating;
  starsMyPendingRatingDate?: number;
  mainTab?: TypeProfileTab;
  savedMusic?: TypeDocument;
  note?: TypeTextWithEntities;
  botManagerId?: string;
};

export type Username = {
  editable?: boolean;
  active?: boolean;
  username: string;
};

export type UserProfilePhoto = {
  hasVideo?: boolean;
  personal?: boolean;
  photoId: string;
  /** JPEG data URI from stripped thumb bytes (`data:image/jpeg;base64,...`) */
  strippedThumb?: string;
  dcId: number;
};

export type UserStatusEmpty = {
  className: 'UserStatusEmpty';
};

export type UserStatusLastMonth = {
  className: 'UserStatusLastMonth';
  byMe?: boolean;
};

export type UserStatusLastWeek = {
  className: 'UserStatusLastWeek';
  byMe?: boolean;
};

export type UserStatusOffline = {
  className: 'UserStatusOffline';
  wasOnline: number;
};

export type UserStatusOnline = {
  className: 'UserStatusOnline';
  expires: number;
};

export type UserStatusRecently = {
  className: 'UserStatusRecently';
  byMe?: boolean;
};

// --- users.* namespace results ---

/** users.UserFull — wrapper returned by users.getFullUser */
export type UserFullResult = {
  fullUser: UserFull;
  chats: TypeChat[];
  users: TypeUser[];
};

export type Users = {
  users: TypeUser[];
};

export type UsersSlice = {
  count: number;
  users: TypeUser[];
};

// --- Type* unions / aliases ---

export type TypeUser = UserEmpty | User;

/** GramJS `users.UserFull` result wrapper (not the userFull constructor). */
export type TypeUserFull = UserFullResult;

export type TypeUsername = Username;

export type TypeUserProfilePhoto = UserProfilePhoto;

export type TypeUsers = Users | UsersSlice;

export type TypeUserStatus =
  | UserStatusEmpty
  | UserStatusOnline
  | UserStatusOffline
  | UserStatusRecently
  | UserStatusLastWeek
  | UserStatusLastMonth;
