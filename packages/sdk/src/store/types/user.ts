import type {
  TypeBirthday,
  TypeBotInfo,
  TypeBotVerification,
  TypeBusinessAwayMessage,
  TypeBusinessGreetingMessage,
  TypeBusinessIntro,
  TypeBusinessLocation,
  TypeBusinessWorkHours,
  TypeChatAdminRights,
  TypeChatTheme,
  TypeDisallowedGiftsSettings,
  TypeDocument,
  TypeEmojiStatus,
  TypePeerColor,
  TypePeerNotifySettings,
  TypePeerSettings,
  TypePeerStories,
  TypePhoto,
  TypeProfileTab,
  TypeRestrictionReason,
  TypeStarRefProgram,
  TypeStarsRating,
  TypeTextWithEntities,
  TypeUsername,
  TypeUserProfilePhoto,
  TypeUserStatus,
  TypeWallPaper,
} from '@telegenie/libs/foundation/telegram/types/api-types';

/**
 * @see https://core.telegram.org/constructor/user
 */
export type UserEntity = {
  id: string;
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

/**
 * @see https://core.telegram.org/constructor/userFull
 */
export type UserFullEntity = {
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
