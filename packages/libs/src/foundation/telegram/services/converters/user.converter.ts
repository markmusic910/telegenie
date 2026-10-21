import { Api } from '@telegenie/teleproto';
import type {
  TypeBirthday,
  TypeBotInfo,
  TypeBotVerification,
  TypeBusinessAwayMessage,
  TypeBusinessAwayMessageSchedule,
  TypeBusinessGreetingMessage,
  TypeBusinessIntro,
  TypeBusinessLocation,
  TypeBusinessRecipients,
  TypeBusinessWorkHours,
  TypeChatAdminRights,
  TypeChatTheme,
  TypeDisallowedGiftsSettings,
  TypeDocument,
  TypeEmojiStatus,
  TypeGeoPoint,
  TypePeerColor,
  TypePeerSettings,
  TypePeerStories,
  TypePhoto,
  TypePremiumGiftOption,
  TypeProfileTab,
  TypeRestrictionReason,
  TypeStarRefProgram,
  TypeStarsAmount,
  TypeStarsRating,
  TypeWallPaper,
  TypeWallPaperSettings,
} from '../../types/api-types';
import type {
  TypeUsername,
  TypeUserProfilePhoto,
  TypeUserStatus,
  User,
  UserFull,
} from '../../types/users';
import { convertTypePeerNotifySettings } from './common.converter';
import { convertTypeTextWithEntities } from './input.converter';
import {
  convertTypeDocumentSerializable,
  convertTypePeerStoriesSerializable,
  convertTypePhotoSerializable,
} from './media.converter';
import { buildStrippedThumbDataUri } from './thumbnail.converter';

// Converter for UserProfilePhoto
export const convertTypeUserProfilePhoto = (
  photo?: Api.TypeUserProfilePhoto,
): TypeUserProfilePhoto | undefined => {
  if (!photo) {
    return undefined;
  }
  if (photo instanceof Api.UserProfilePhotoEmpty) {
    return undefined;
  }
  if (photo instanceof Api.UserProfilePhoto) {
    return {
      hasVideo: photo.hasVideo ?? false,
      personal: photo.personal ?? false,
      photoId: photo.photoId.toString(),
      strippedThumb: buildStrippedThumbDataUri(photo.strippedThumb),
      dcId: photo.dcId ?? 0,
    };
  }
  return undefined;
};

// Converter for UserStatus
export const convertTypeUserStatus = (status?: Api.TypeUserStatus): TypeUserStatus | undefined => {
  if (!status) {
    return undefined;
  }
  if (status instanceof Api.UserStatusEmpty) {
    return {
      className: 'UserStatusEmpty',
    };
  }
  if (status instanceof Api.UserStatusOnline) {
    return {
      className: 'UserStatusOnline',
      expires: status.expires ?? 0,
    };
  }
  if (status instanceof Api.UserStatusOffline) {
    return {
      className: 'UserStatusOffline',
      wasOnline: status.wasOnline ?? 0,
    };
  }
  if (status instanceof Api.UserStatusRecently) {
    return {
      className: 'UserStatusRecently',
      byMe: status.byMe ?? false,
    };
  }
  if (status instanceof Api.UserStatusLastWeek) {
    return {
      className: 'UserStatusLastWeek',
      byMe: status.byMe ?? false,
    };
  }
  if (status instanceof Api.UserStatusLastMonth) {
    return {
      className: 'UserStatusLastMonth',
      byMe: status.byMe ?? false,
    };
  }
  return undefined;
};

// Converter for EmojiStatus
export const convertTypeEmojiStatus = (
  emojiStatus?: Api.TypeEmojiStatus,
): TypeEmojiStatus | undefined => {
  if (!emojiStatus) {
    return undefined;
  }
  if (emojiStatus instanceof Api.EmojiStatusEmpty) {
    return {} as TypeEmojiStatus; // Empty type
  }
  if (emojiStatus instanceof Api.EmojiStatus) {
    return {
      documentId: emojiStatus.documentId.toString(),
      ...(emojiStatus.until != null ? { until: emojiStatus.until } : {}),
    };
  }
  return undefined;
};

// Converter for PeerColor
export const convertTypePeerColor = (color?: Api.TypePeerColor): TypePeerColor | undefined => {
  if (!color) {
    return undefined;
  }
  if (color instanceof Api.PeerColor) {
    return {
      color: color.color,
      backgroundEmojiId: color.backgroundEmojiId?.toString(),
    };
  }
  return undefined;
};

// Converter for RestrictionReason
export const convertTypeRestrictionReason = (
  restrictionReason?: Api.TypeRestrictionReason,
): TypeRestrictionReason | undefined => {
  if (!restrictionReason) {
    return undefined;
  }
  if (restrictionReason instanceof Api.RestrictionReason) {
    return {
      platform: restrictionReason.platform ?? '',
      reason: restrictionReason.reason ?? '',
      text: restrictionReason.text ?? '',
    };
  }
  return undefined;
};

// Converter for Username
export const convertTypeUsername = (username?: Api.TypeUsername): TypeUsername | undefined => {
  if (!username) {
    return undefined;
  }
  if (username instanceof Api.Username) {
    return {
      editable: username.editable ?? false,
      active: username.active ?? false,
      username: username.username ?? '',
    };
  }
  return undefined;
};

export const convertUser = (user: Api.TypeUser): User => {
  // Handle UserEmpty case
  if (user instanceof Api.UserEmpty) {
    return {
      id: user.id.toString(),
    };
  }

  // Handle User case
  if (user instanceof Api.User) {
    return {
      // Basic fields
      id: user.id.toString(),
      accessHash: user.accessHash?.toString(),
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      username: user.username ?? '',
      phone: user.phone ?? '',

      // Boolean flags
      self: user.self ?? false,
      contact: user.contact ?? false,
      mutualContact: user.mutualContact ?? false,
      deleted: user.deleted ?? false,
      bot: user.bot ?? false,
      botChatHistory: user.botChatHistory ?? false,
      botNochats: user.botNochats ?? false,
      verified: user.verified ?? false,
      restricted: user.restricted ?? false,
      min: user.min ?? false,
      botInlineGeo: user.botInlineGeo ?? false,
      support: user.support ?? false,
      scam: user.scam ?? false,
      applyMinPhoto: user.applyMinPhoto ?? false,
      fake: user.fake ?? false,
      botAttachMenu: user.botAttachMenu ?? false,
      premium: user.premium ?? false,
      attachMenuEnabled: user.attachMenuEnabled ?? false,
      botCanEdit: user.botCanEdit ?? false,
      closeFriend: user.closeFriend ?? false,
      storiesHidden: user.storiesHidden ?? false,
      storiesUnavailable: user.storiesUnavailable ?? false,
      contactRequirePremium: user.contactRequirePremium ?? false,
      botBusiness: user.botBusiness ?? false,
      botHasMainApp: user.botHasMainApp ?? false,

      // Complex nested types
      photo: convertTypeUserProfilePhoto(user.photo),
      status: convertTypeUserStatus(user.status),
      emojiStatus: convertTypeEmojiStatus(user.emojiStatus),
      color: convertTypePeerColor(user.color),
      profileColor: convertTypePeerColor(user.profileColor),

      // Other fields
      botInfoVersion: user.botInfoVersion,
      restrictionReason: user.restrictionReason
        ?.map(convertTypeRestrictionReason)
        .filter(Boolean) as TypeRestrictionReason[],
      botInlinePlaceholder: user.botInlinePlaceholder,
      langCode: user.langCode,
      usernames: user.usernames?.map(convertTypeUsername).filter(Boolean) as TypeUsername[],
      storiesMaxId: user.storiesMaxId?.maxId,
      botActiveUsers: user.botActiveUsers,
      botVerificationIcon: (user as any).botVerificationIcon?.toString(),
    };
  }

  // Fallback for unknown types
  throw new Error('Unknown user type');
};

// Converter for Photo (JSON-safe: base64 fileReference + converted sizes)
export const convertTypePhoto = (photo?: Api.TypePhoto): TypePhoto | undefined => {
  return convertTypePhotoSerializable(photo);
};

// Converter for PeerSettings
export const convertTypePeerSettings = (
  settings?: Api.TypePeerSettings,
): TypePeerSettings | undefined => {
  if (!settings) {
    return undefined;
  }
  if (settings instanceof Api.PeerSettings) {
    return {
      reportSpam: settings.reportSpam ?? false,
      addContact: settings.addContact ?? false,
      blockContact: settings.blockContact ?? false,
      shareContact: settings.shareContact ?? false,
      needContactsException: settings.needContactsException ?? false,
      reportGeo: settings.reportGeo ?? false,
      autoarchived: settings.autoarchived ?? false,
      inviteMembers: settings.inviteMembers ?? false,
      requestChatBroadcast: settings.requestChatBroadcast ?? false,
      businessBotPaused: settings.businessBotPaused ?? false,
      businessBotCanReply: settings.businessBotCanReply ?? false,
      geoDistance: settings.geoDistance ?? 0,
      requestChatTitle: settings.requestChatTitle ?? '',
      requestChatDate: settings.requestChatDate ?? 0,
      businessBotId: settings.businessBotId?.toString(),
      businessBotManageUrl: settings.businessBotManageUrl ?? '',
    };
  }
  return undefined;
};

// Converter for BotInfo (TL constructor, not bots.BotInfo)
export const convertTypeBotInfo = (botInfo?: Api.TypeBotInfo): TypeBotInfo | undefined => {
  if (!botInfo) {
    return undefined;
  }
  if (botInfo instanceof Api.BotInfo) {
    const result: TypeBotInfo = {};
    if (botInfo.hasPreviewMedias) result.hasPreviewMedias = true;
    if (botInfo.userId != null) result.userId = botInfo.userId.toString();
    if (botInfo.description != null) result.description = botInfo.description;
    const descriptionPhoto = convertTypePhoto(botInfo.descriptionPhoto);
    if (descriptionPhoto) result.descriptionPhoto = descriptionPhoto;
    const descriptionDocument = convertTypeDocument(botInfo.descriptionDocument);
    if (descriptionDocument) result.descriptionDocument = descriptionDocument;
    if (botInfo.commands?.length) {
      result.commands = botInfo.commands.map((c) => ({
        command: c.command ?? '',
        description: c.description ?? '',
      }));
    }
    if (botInfo.privacyPolicyUrl) result.privacyPolicyUrl = botInfo.privacyPolicyUrl;
    // menuButton / appSettings / verifierSettings: convert when needed
    return result;
  }
  return undefined;
};

// Converter for ChatAdminRights
export const convertTypeChatAdminRights = (
  rights?: Api.TypeChatAdminRights,
): TypeChatAdminRights | undefined => {
  if (!rights) {
    return undefined;
  }
  if (rights instanceof Api.ChatAdminRights) {
    return {
      changeInfo: rights.changeInfo ?? false,
      postMessages: rights.postMessages ?? false,
      editMessages: rights.editMessages ?? false,
      deleteMessages: rights.deleteMessages ?? false,
      banUsers: rights.banUsers ?? false,
      inviteUsers: rights.inviteUsers ?? false,
      pinMessages: rights.pinMessages ?? false,
      addAdmins: rights.addAdmins ?? false,
      anonymous: rights.anonymous ?? false,
      manageCall: rights.manageCall ?? false,
      other: rights.other ?? false,
      manageTopics: rights.manageTopics ?? false,
      postStories: rights.postStories ?? false,
      editStories: rights.editStories ?? false,
      deleteStories: rights.deleteStories ?? false,
    };
  }
  return undefined;
};

// Converter for PremiumGiftOption
export const convertTypePremiumGiftOption = (gift?: {
  className?: string;
  months?: number;
  currency?: string;
  amount?: { toString(): string } | string | number;
  botUrl?: string;
  storeProduct?: string;
}): TypePremiumGiftOption | undefined => {
  if (!gift || typeof gift !== 'object') {
    return undefined;
  }
  if (
    gift.className &&
    gift.className !== 'PremiumGiftOption' &&
    gift.className !== 'PremiumGiftCodeOption'
  ) {
    return undefined;
  }
  return {
    months: gift.months ?? 0,
    currency: gift.currency ?? '',
    amount: gift.amount?.toString() ?? '0',
    botUrl: gift.botUrl ?? '',
    storeProduct: gift.storeProduct ?? '',
  };
};

// Converter for WallPaper
export const convertTypeWallPaper = (wallpaper?: Api.TypeWallPaper): TypeWallPaper | undefined => {
  if (!wallpaper) {
    return undefined;
  }
  if (wallpaper instanceof Api.WallPaper) {
    return {
      id: wallpaper.id.toString(),
      creator: wallpaper.creator ?? false,
      default: wallpaper.default ?? false,
      pattern: wallpaper.pattern ?? false,
      dark: wallpaper.dark ?? false,
      accessHash: wallpaper.accessHash.toString(),
      slug: wallpaper.slug ?? '',
      document: convertTypeDocument(wallpaper.document),
      settings: convertTypeWallPaperSettings(wallpaper.settings),
    };
  }
  if (wallpaper instanceof Api.WallPaperNoFile) {
    return {
      id: wallpaper.id.toString(),
      default: wallpaper.default ?? false,
      dark: wallpaper.dark ?? false,
      settings: convertTypeWallPaperSettings(wallpaper.settings),
    };
  }
  return undefined;
};

// Converter for PeerStories (JSON-safe: lightweight story items, media omitted)
export const convertTypePeerStories = (
  stories?: Api.TypePeerStories,
): TypePeerStories | undefined => {
  return convertTypePeerStoriesSerializable(stories) as TypePeerStories | undefined;
};

// Converter for BusinessWorkHours
export const convertTypeBusinessWorkHours = (
  workHours?: Api.TypeBusinessWorkHours,
): TypeBusinessWorkHours | undefined => {
  if (!workHours) {
    return undefined;
  }
  if (workHours instanceof Api.BusinessWorkHours) {
    return {
      openNow: workHours.openNow ?? false,
      timezoneId: workHours.timezoneId ?? '',
      weeklyOpen:
        workHours.weeklyOpen?.map((open) => ({
          startMinute: open.startMinute ?? 0,
          endMinute: open.endMinute ?? 0,
        })) ?? [],
    };
  }
  return undefined;
};

// Converter for BusinessLocation
export const convertTypeBusinessLocation = (
  location?: Api.TypeBusinessLocation,
): TypeBusinessLocation | undefined => {
  if (!location) {
    return undefined;
  }
  if (location instanceof Api.BusinessLocation) {
    return {
      geoPoint: convertTypeGeoPoint(location.geoPoint),
      address: location.address ?? '',
    };
  }
  return undefined;
};

// Converter for BusinessGreetingMessage
export const convertTypeBusinessGreetingMessage = (
  greeting?: Api.TypeBusinessGreetingMessage,
): TypeBusinessGreetingMessage | undefined => {
  if (!greeting) {
    return undefined;
  }
  if (greeting instanceof Api.BusinessGreetingMessage) {
    return {
      shortcutId: greeting.shortcutId ?? 0,
      recipients: convertTypeBusinessRecipients(greeting.recipients)!,
      noActivityDays: greeting.noActivityDays ?? 0,
    };
  }
  return undefined;
};

// Converter for BusinessAwayMessage
export const convertTypeBusinessAwayMessage = (
  awayMessage?: Api.TypeBusinessAwayMessage,
): TypeBusinessAwayMessage | undefined => {
  if (!awayMessage) {
    return undefined;
  }
  if (awayMessage instanceof Api.BusinessAwayMessage) {
    return {
      offlineOnly: awayMessage.offlineOnly ?? false,
      shortcutId: awayMessage.shortcutId ?? 0,
      schedule: convertTypeBusinessAwayMessageSchedule(awayMessage.schedule)!,
      recipients: convertTypeBusinessRecipients(awayMessage.recipients)!,
    };
  }
  return undefined;
};

// Converter for BusinessIntro
export const convertTypeBusinessIntro = (
  intro?: Api.TypeBusinessIntro,
): TypeBusinessIntro | undefined => {
  if (!intro) {
    return undefined;
  }
  if (intro instanceof Api.BusinessIntro) {
    return {
      title: intro.title ?? '',
      description: intro.description ?? '',
      sticker: convertTypeDocument(intro.sticker),
    };
  }
  return undefined;
};

// Converter for Birthday
export const convertTypeBirthday = (birthday?: Api.TypeBirthday): TypeBirthday | undefined => {
  if (!birthday) {
    return undefined;
  }
  if (birthday instanceof Api.Birthday) {
    return {
      day: birthday.day ?? 0,
      month: birthday.month ?? 0,
      year: birthday.year ?? 0,
    };
  }
  return undefined;
};

// Converter for StarRefProgram
export const convertTypeStarRefProgram = (program?: any): TypeStarRefProgram | undefined => {
  if (!program) {
    return undefined;
  }
  if (program.className === 'StarRefProgram') {
    return {
      botId: program.botId.toString(),
      commissionPermille: program.commissionPermille ?? 0,
      durationMonths: program.durationMonths ?? 0,
      endDate: program.endDate ?? 0,
      dailyRevenuePerUser: convertTypeStarsAmount(program.dailyRevenuePerUser),
    };
  }
  return undefined;
};

// Converter for BotVerification
export const convertTypeBotVerification = (verification?: any): TypeBotVerification | undefined => {
  if (!verification) {
    return undefined;
  }
  if (verification.className === 'BotVerification') {
    return {
      botId: verification.botId.toString(),
      icon: verification.icon.toString(),
      description: verification.description ?? '',
    };
  }
  return undefined;
};

// Converter for Document (JSON-safe: base64 fileReference + converted thumbs/attributes)
export const convertTypeDocument = (document?: Api.TypeDocument): TypeDocument | undefined => {
  return convertTypeDocumentSerializable(document);
};

// Converter for WallPaperSettings
export const convertTypeWallPaperSettings = (
  settings?: Api.TypeWallPaperSettings,
): TypeWallPaperSettings | undefined => {
  if (!settings) {
    return undefined;
  }
  if (settings instanceof Api.WallPaperSettings) {
    return {
      blur: settings.blur ?? false,
      motion: settings.motion ?? false,
      backgroundColor: settings.backgroundColor ?? 0,
      secondBackgroundColor: settings.secondBackgroundColor ?? 0,
      thirdBackgroundColor: settings.thirdBackgroundColor ?? 0,
      fourthBackgroundColor: settings.fourthBackgroundColor ?? 0,
      intensity: settings.intensity ?? 0,
      rotation: settings.rotation ?? 0,
      emoticon: settings.emoticon ?? '',
    };
  }
  return undefined;
};

// Converter for GeoPoint
export const convertTypeGeoPoint = (geoPoint?: Api.TypeGeoPoint): TypeGeoPoint | undefined => {
  if (!geoPoint) {
    return undefined;
  }
  if (geoPoint instanceof Api.GeoPointEmpty) {
    return undefined;
  }
  if (geoPoint instanceof Api.GeoPoint) {
    return {
      long: geoPoint.long ?? 0,
      lat: geoPoint.lat ?? 0,
      accessHash: geoPoint.accessHash.toString(),
      accuracyRadius: geoPoint.accuracyRadius ?? 0,
    };
  }
  return undefined;
};

// Converter for BusinessRecipients
export const convertTypeBusinessRecipients = (
  recipients?: Api.TypeBusinessRecipients,
): TypeBusinessRecipients | undefined => {
  if (!recipients) {
    return undefined;
  }
  if (recipients instanceof Api.BusinessRecipients) {
    return {
      existingChats: recipients.existingChats ?? false,
      newChats: recipients.newChats ?? false,
      contacts: recipients.contacts ?? false,
      nonContacts: recipients.nonContacts ?? false,
      excludeSelected: recipients.excludeSelected ?? false,
      users: recipients.users?.map((id) => id.toString()) ?? [],
    };
  }
  return undefined;
};

// Converter for BusinessAwayMessageSchedule
export const convertTypeBusinessAwayMessageSchedule = (
  schedule?: Api.TypeBusinessAwayMessageSchedule,
): TypeBusinessAwayMessageSchedule | undefined => {
  if (!schedule) {
    return undefined;
  }
  if (schedule instanceof Api.BusinessAwayMessageScheduleAlways) {
    return {} as TypeBusinessAwayMessageSchedule; // Empty type
  }
  if (schedule instanceof Api.BusinessAwayMessageScheduleOutsideWorkHours) {
    return {} as TypeBusinessAwayMessageSchedule; // Empty type
  }
  if (schedule instanceof Api.BusinessAwayMessageScheduleCustom) {
    return {
      startDate: schedule.startDate ?? 0,
      endDate: schedule.endDate ?? 0,
    };
  }
  return undefined;
};

// Converter for StarsAmount
export const convertTypeStarsAmount = (amount?: any): TypeStarsAmount | undefined => {
  if (!amount) {
    return undefined;
  }
  if (amount.className === 'StarsAmount') {
    return {
      amount: amount.amount?.toString() ?? '0',
      nanos: amount.nanos ?? 0,
    };
  }
  return undefined;
};

const PROFILE_TAB_CLASS_TO_UNDERSCORE: Record<string, TypeProfileTab['_']> = {
  ProfileTabPosts: 'profileTabPosts',
  ProfileTabGifts: 'profileTabGifts',
  ProfileTabMedia: 'profileTabMedia',
  ProfileTabFiles: 'profileTabFiles',
  ProfileTabMusic: 'profileTabMusic',
  ProfileTabVoice: 'profileTabVoice',
  ProfileTabLinks: 'profileTabLinks',
  ProfileTabGifs: 'profileTabGifs',
  profileTabPosts: 'profileTabPosts',
  profileTabGifts: 'profileTabGifts',
  profileTabMedia: 'profileTabMedia',
  profileTabFiles: 'profileTabFiles',
  profileTabMusic: 'profileTabMusic',
  profileTabVoice: 'profileTabVoice',
  profileTabLinks: 'profileTabLinks',
  profileTabGifs: 'profileTabGifs',
};

export const convertTypeChatTheme = (theme?: any): TypeChatTheme | undefined => {
  if (!theme) {
    return undefined;
  }
  if (typeof theme === 'string') {
    return { emoticon: theme };
  }
  if (typeof theme.emoticon === 'string' && theme.emoticon !== '') {
    return { emoticon: theme.emoticon };
  }
  return undefined;
};

export const convertTypeDisallowedGiftsSettings = (
  settings?: any,
): TypeDisallowedGiftsSettings | undefined => {
  if (!settings) {
    return undefined;
  }
  return {
    disallowUnlimitedStargifts: settings.disallowUnlimitedStargifts ?? false,
    disallowLimitedStargifts: settings.disallowLimitedStargifts ?? false,
    disallowUniqueStargifts: settings.disallowUniqueStargifts ?? false,
    disallowPremiumGifts: settings.disallowPremiumGifts ?? false,
  };
};

export const convertTypeStarsRating = (rating?: any): TypeStarsRating | undefined => {
  if (!rating) {
    return undefined;
  }
  return {
    level: rating.level ?? 0,
    currentLevelStars: rating.currentLevelStars?.toString() ?? '0',
    stars: rating.stars?.toString() ?? '0',
    nextLevelStars: rating.nextLevelStars?.toString(),
  };
};

export const convertTypeProfileTab = (tab?: any): TypeProfileTab | undefined => {
  if (!tab) {
    return undefined;
  }
  const key = tab.className ?? tab._;
  const underscore = typeof key === 'string' ? PROFILE_TAB_CLASS_TO_UNDERSCORE[key] : undefined;
  if (!underscore) {
    return undefined;
  }
  return { _: underscore };
};

export const convertUserFull = (user: Api.TypeUserFull): UserFull => {
  const extended = user as Api.TypeUserFull & {
    displayGiftsButton?: boolean;
    noforwardsMyEnabled?: boolean;
    noforwardsPeerEnabled?: boolean;
    unofficialSecurityRisk?: boolean;
    theme?: unknown;
    themeEmoticon?: string;
    sendPaidMessagesStars?: { toString(): string } | string | number;
    disallowedGifts?: unknown;
    starsRating?: unknown;
    starsMyPendingRating?: unknown;
    starsMyPendingRatingDate?: number;
    mainTab?: unknown;
    savedMusic?: Api.TypeDocument;
    note?: Api.TypeTextWithEntities;
    botManagerId?: { toString(): string } | string | number;
  };

  return {
    // Boolean flags
    blocked: user.blocked ?? false,
    phoneCallsAvailable: user.phoneCallsAvailable ?? false,
    phoneCallsPrivate: user.phoneCallsPrivate ?? false,
    canPinMessage: user.canPinMessage ?? false,
    hasScheduled: user.hasScheduled ?? false,
    videoCallsAvailable: user.videoCallsAvailable ?? false,
    voiceMessagesForbidden: user.voiceMessagesForbidden ?? false,
    translationsDisabled: user.translationsDisabled ?? false,
    storiesPinnedAvailable: user.storiesPinnedAvailable ?? false,
    blockedMyStoriesFrom: user.blockedMyStoriesFrom ?? false,
    wallpaperOverridden: user.wallpaperOverridden ?? false,
    contactRequirePremium: user.contactRequirePremium ?? false,
    readDatesPrivate: user.readDatesPrivate ?? false,
    sponsoredEnabled: user.sponsoredEnabled ?? false,
    canViewRevenue: user.canViewRevenue ?? false,
    botCanManageEmojiStatus: user.botCanManageEmojiStatus ?? false,
    displayGiftsButton: extended.displayGiftsButton ?? false,
    noforwardsMyEnabled: extended.noforwardsMyEnabled ?? false,
    noforwardsPeerEnabled: extended.noforwardsPeerEnabled ?? false,
    unofficialSecurityRisk: extended.unofficialSecurityRisk ?? false,

    // Basic fields
    id: user.id.toString(),
    about: user.about ?? '',
    settings: convertTypePeerSettings(user.settings)!,
    personalPhoto: convertTypePhoto(user.personalPhoto),
    profilePhoto: convertTypePhoto(user.profilePhoto),
    fallbackPhoto: convertTypePhoto(user.fallbackPhoto),
    notifySettings: convertTypePeerNotifySettings(user.notifySettings)!,
    botInfo: convertTypeBotInfo(user.botInfo),
    pinnedMsgId: user.pinnedMsgId ?? 0,
    commonChatsCount: user.commonChatsCount ?? 0,
    folderId: user.folderId ?? 0,
    ttlPeriod: user.ttlPeriod ?? 0,
    theme:
      convertTypeChatTheme(extended.theme) ??
      convertTypeChatTheme(
        extended.themeEmoticon != null && extended.themeEmoticon !== ''
          ? { emoticon: extended.themeEmoticon }
          : undefined,
      ),
    privateForwardName: user.privateForwardName ?? '',
    botGroupAdminRights: convertTypeChatAdminRights(user.botGroupAdminRights),
    botBroadcastAdminRights: convertTypeChatAdminRights(user.botBroadcastAdminRights),
    wallpaper: convertTypeWallPaper(user.wallpaper),
    stories: convertTypePeerStories(user.stories),
    businessWorkHours: convertTypeBusinessWorkHours(user.businessWorkHours),
    businessLocation: convertTypeBusinessLocation(user.businessLocation),
    businessGreetingMessage: convertTypeBusinessGreetingMessage(user.businessGreetingMessage),
    businessAwayMessage: convertTypeBusinessAwayMessage(user.businessAwayMessage),
    businessIntro: convertTypeBusinessIntro(user.businessIntro),
    birthday: convertTypeBirthday(user.birthday),
    personalChannelId: user.personalChannelId?.toString(),
    personalChannelMessage: user.personalChannelMessage ?? 0,
    stargiftsCount: user.stargiftsCount ?? 0,
    starrefProgram: convertTypeStarRefProgram((user as any).starrefProgram),
    botVerification: convertTypeBotVerification((user as any).botVerification),
    sendPaidMessagesStars:
      extended.sendPaidMessagesStars != null
        ? extended.sendPaidMessagesStars.toString()
        : undefined,
    disallowedGifts: convertTypeDisallowedGiftsSettings(extended.disallowedGifts),
    starsRating: convertTypeStarsRating(extended.starsRating),
    starsMyPendingRating: convertTypeStarsRating(extended.starsMyPendingRating),
    starsMyPendingRatingDate: extended.starsMyPendingRatingDate,
    mainTab: convertTypeProfileTab(extended.mainTab),
    savedMusic: convertTypeDocument(extended.savedMusic),
    note: extended.note ? convertTypeTextWithEntities(extended.note) : undefined,
    botManagerId: extended.botManagerId != null ? extended.botManagerId.toString() : undefined,
  };
};
