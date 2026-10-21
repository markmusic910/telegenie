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
  TypePeerNotifySettings,
  TypePeerSettings,
  TypePeerStories,
  TypePhoto,
  TypeProfileTab,
  TypeStarRefProgram,
  TypeStarsRating,
  TypeTextWithEntities,
  TypeWallPaper,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import { toJS } from 'mobx';
import type { UserFullEntity } from '../../types';
import { stringifyJson } from '../../utils/json';
import BaseEntityModel, { makeModelObservable } from './base.model';

/**
 * @see https://core.telegram.org/constructor/userFull
 */
export class UserFull extends BaseEntityModel<UserFullEntity> {
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
  about?: string;
  settings!: TypePeerSettings;
  personalPhoto?: TypePhoto;
  profilePhoto?: TypePhoto;
  fallbackPhoto?: TypePhoto;
  notifySettings!: TypePeerNotifySettings;
  botInfo?: TypeBotInfo;
  pinnedMsgId?: number;
  commonChatsCount!: number;
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

  constructor(data: UserFullEntity) {
    super(data);
    this.blocked = data.blocked;
    this.phoneCallsAvailable = data.phoneCallsAvailable;
    this.phoneCallsPrivate = data.phoneCallsPrivate;
    this.canPinMessage = data.canPinMessage;
    this.hasScheduled = data.hasScheduled;
    this.videoCallsAvailable = data.videoCallsAvailable;
    this.voiceMessagesForbidden = data.voiceMessagesForbidden;
    this.translationsDisabled = data.translationsDisabled;
    this.storiesPinnedAvailable = data.storiesPinnedAvailable;
    this.blockedMyStoriesFrom = data.blockedMyStoriesFrom;
    this.wallpaperOverridden = data.wallpaperOverridden;
    this.contactRequirePremium = data.contactRequirePremium;
    this.readDatesPrivate = data.readDatesPrivate;
    this.sponsoredEnabled = data.sponsoredEnabled;
    this.canViewRevenue = data.canViewRevenue;
    this.botCanManageEmojiStatus = data.botCanManageEmojiStatus;
    this.displayGiftsButton = data.displayGiftsButton;
    this.noforwardsMyEnabled = data.noforwardsMyEnabled;
    this.noforwardsPeerEnabled = data.noforwardsPeerEnabled;
    this.unofficialSecurityRisk = data.unofficialSecurityRisk;
    this.about = data.about;
    this.settings = data.settings;
    this.personalPhoto = data.personalPhoto;
    this.profilePhoto = data.profilePhoto;
    this.fallbackPhoto = data.fallbackPhoto;
    this.notifySettings = data.notifySettings;
    this.botInfo = data.botInfo;
    this.pinnedMsgId = data.pinnedMsgId;
    this.commonChatsCount = data.commonChatsCount;
    this.folderId = data.folderId;
    this.ttlPeriod = data.ttlPeriod;
    this.theme = data.theme;
    this.privateForwardName = data.privateForwardName;
    this.botGroupAdminRights = data.botGroupAdminRights;
    this.botBroadcastAdminRights = data.botBroadcastAdminRights;
    this.wallpaper = data.wallpaper;
    this.stories = data.stories;
    this.businessWorkHours = data.businessWorkHours;
    this.businessLocation = data.businessLocation;
    this.businessGreetingMessage = data.businessGreetingMessage;
    this.businessAwayMessage = data.businessAwayMessage;
    this.businessIntro = data.businessIntro;
    this.birthday = data.birthday;
    this.personalChannelId = data.personalChannelId;
    this.personalChannelMessage = data.personalChannelMessage;
    this.stargiftsCount = data.stargiftsCount;
    this.starrefProgram = data.starrefProgram;
    this.botVerification = data.botVerification;
    this.sendPaidMessagesStars = data.sendPaidMessagesStars;
    this.disallowedGifts = data.disallowedGifts;
    this.starsRating = data.starsRating;
    this.starsMyPendingRating = data.starsMyPendingRating;
    this.starsMyPendingRatingDate = data.starsMyPendingRatingDate;
    this.mainTab = data.mainTab;
    this.savedMusic = data.savedMusic;
    this.note = data.note;
    this.botManagerId = data.botManagerId;
    makeModelObservable(this);
  }

  /** Serialize to a plain JSON string round-trippable via {@link UserFull.fromJSON}. */
  toJSON(): string {
    return stringifyJson(toJS(this));
  }

  static fromJSON(json: string): UserFull {
    return new UserFull(JSON.parse(json) as UserFullEntity);
  }
}
