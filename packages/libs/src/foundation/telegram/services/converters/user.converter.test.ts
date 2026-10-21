import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import {
  convertTypeBirthday,
  convertTypeBotInfo,
  convertTypeBotVerification,
  convertTypeBusinessAwayMessage,
  convertTypeBusinessAwayMessageSchedule,
  convertTypeBusinessGreetingMessage,
  convertTypeBusinessIntro,
  convertTypeBusinessLocation,
  convertTypeBusinessRecipients,
  convertTypeBusinessWorkHours,
  convertTypeChatAdminRights,
  convertTypeDocument,
  convertTypeEmojiStatus,
  convertTypeGeoPoint,
  convertTypePeerColor,
  convertTypePeerSettings,
  convertTypePeerStories,
  convertTypePhoto,
  convertTypePremiumGiftOption,
  convertTypeRestrictionReason,
  convertTypeStarRefProgram,
  convertTypeStarsAmount,
  convertTypeUserProfilePhoto,
  convertTypeUserStatus,
  convertTypeUsername,
  convertTypeWallPaper,
  convertTypeWallPaperSettings,
  convertUser,
  convertUserFull,
} from './user.converter';

const unknown = { className: 'TotallyUnknown' } as any;
const STRIPPED = Buffer.from([1, 10, 20, 0xaa, 0xbb]);

const geoPoint = () =>
  new Api.GeoPoint({ long: 1, lat: 2, accessHash: bigInt(3), accuracyRadius: 4 });
const recipients = () => new Api.BusinessRecipients({ existingChats: true, users: [bigInt(1)] });
const document = () =>
  new Api.Document({
    id: bigInt(1),
    accessHash: bigInt(2),
    fileReference: Buffer.from([104, 105]),
    date: 3,
    mimeType: 'image/webp',
    size: bigInt(10),
    dcId: 4,
    attributes: [],
  });

describe('convertTypeUserProfilePhoto', () => {
  it('returns undefined without a photo', () => {
    expect(convertTypeUserProfilePhoto(undefined)).toBeUndefined();
  });

  it('returns undefined for UserProfilePhotoEmpty', () => {
    expect(convertTypeUserProfilePhoto(new Api.UserProfilePhotoEmpty())).toBeUndefined();
  });

  it('maps a full profile photo', () => {
    const photo = new Api.UserProfilePhoto({
      hasVideo: true,
      personal: true,
      photoId: bigInt(9),
      strippedThumb: STRIPPED,
      dcId: 2,
    });
    const result = convertTypeUserProfilePhoto(photo)!;
    expect(result).toMatchObject({ hasVideo: true, personal: true, photoId: '9', dcId: 2 });
    expect(result.strippedThumb?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('defaults missing profile photo fields', () => {
    const photo = new Api.UserProfilePhoto({ photoId: bigInt(9) } as any);
    expect(convertTypeUserProfilePhoto(photo)).toEqual({
      hasVideo: false,
      personal: false,
      photoId: '9',
      strippedThumb: undefined,
      dcId: 0,
    });
  });

  it('returns undefined for an unknown photo', () => {
    expect(convertTypeUserProfilePhoto(unknown)).toBeUndefined();
  });
});

describe('convertTypeUserStatus', () => {
  it('returns undefined without a status', () => {
    expect(convertTypeUserStatus(undefined)).toBeUndefined();
  });

  it('maps UserStatusEmpty to an empty marker', () => {
    expect(convertTypeUserStatus(new Api.UserStatusEmpty())).toEqual({
      className: 'UserStatusEmpty',
    });
  });

  it('maps UserStatusOnline', () => {
    expect(convertTypeUserStatus(new Api.UserStatusOnline({ expires: 50 }))).toEqual({
      className: 'UserStatusOnline',
      expires: 50,
    });
  });

  it('maps UserStatusOffline', () => {
    expect(convertTypeUserStatus(new Api.UserStatusOffline({ wasOnline: 60 }))).toEqual({
      className: 'UserStatusOffline',
      wasOnline: 60,
    });
  });

  it.each([
    ['UserStatusRecently', () => new Api.UserStatusRecently({ byMe: true })],
    ['UserStatusLastWeek', () => new Api.UserStatusLastWeek({ byMe: true })],
    ['UserStatusLastMonth', () => new Api.UserStatusLastMonth({ byMe: true })],
  ])('maps %s', (label, build) => {
    expect(convertTypeUserStatus(build())).toEqual({ className: label, byMe: true });
  });

  it('defaults missing status fields', () => {
    expect(convertTypeUserStatus(new Api.UserStatusOnline({} as any))).toEqual({
      className: 'UserStatusOnline',
      expires: 0,
    });
    expect(convertTypeUserStatus(new Api.UserStatusOffline({} as any))).toEqual({
      className: 'UserStatusOffline',
      wasOnline: 0,
    });
    expect(convertTypeUserStatus(new Api.UserStatusRecently({}))).toEqual({
      className: 'UserStatusRecently',
      byMe: false,
    });
    expect(convertTypeUserStatus(new Api.UserStatusLastWeek({}))).toEqual({
      className: 'UserStatusLastWeek',
      byMe: false,
    });
    expect(convertTypeUserStatus(new Api.UserStatusLastMonth({}))).toEqual({
      className: 'UserStatusLastMonth',
      byMe: false,
    });
  });

  it('returns undefined for an unknown status', () => {
    expect(convertTypeUserStatus(unknown)).toBeUndefined();
  });
});

describe('convertTypeEmojiStatus', () => {
  it('returns undefined without an emoji status', () => {
    expect(convertTypeEmojiStatus(undefined)).toBeUndefined();
  });

  it('maps EmojiStatusEmpty to an empty marker', () => {
    expect(convertTypeEmojiStatus(new Api.EmojiStatusEmpty())).toEqual({});
  });

  it('maps EmojiStatus', () => {
    expect(convertTypeEmojiStatus(new Api.EmojiStatus({ documentId: bigInt(4) }))).toEqual({
      documentId: '4',
    });
  });

  it('maps EmojiStatusUntil', () => {
    const status = new Api.EmojiStatus({ documentId: bigInt(4), until: 99 });
    expect(convertTypeEmojiStatus(status)).toEqual({ documentId: '4', until: 99 });
  });

  it('returns undefined for an unknown emoji status', () => {
    expect(convertTypeEmojiStatus(unknown)).toBeUndefined();
  });
});

describe('convertTypePeerColor', () => {
  it('returns undefined without a color', () => {
    expect(convertTypePeerColor(undefined)).toBeUndefined();
  });

  it('maps PeerColor with a background emoji', () => {
    const color = new Api.PeerColor({ color: 3, backgroundEmojiId: bigInt(8) });
    expect(convertTypePeerColor(color)).toEqual({ color: 3, backgroundEmojiId: '8' });
  });

  it('maps PeerColor without a background emoji', () => {
    expect(convertTypePeerColor(new Api.PeerColor({ color: 3 }))).toEqual({
      color: 3,
      backgroundEmojiId: undefined,
    });
  });

  it('returns undefined for an unknown color', () => {
    expect(convertTypePeerColor(unknown)).toBeUndefined();
  });
});

describe('convertTypeRestrictionReason', () => {
  it('returns undefined without a reason', () => {
    expect(convertTypeRestrictionReason(undefined)).toBeUndefined();
  });

  it('maps RestrictionReason', () => {
    const reason = new Api.RestrictionReason({ platform: 'ios', reason: 'porn', text: 'blocked' });
    expect(convertTypeRestrictionReason(reason)).toEqual({
      platform: 'ios',
      reason: 'porn',
      text: 'blocked',
    });
  });

  it('defaults missing reason fields', () => {
    expect(convertTypeRestrictionReason(new Api.RestrictionReason({} as any))).toEqual({
      platform: '',
      reason: '',
      text: '',
    });
  });

  it('returns undefined for an unknown reason', () => {
    expect(convertTypeRestrictionReason(unknown)).toBeUndefined();
  });
});

describe('convertTypeUsername', () => {
  it('returns undefined without a username', () => {
    expect(convertTypeUsername(undefined)).toBeUndefined();
  });

  it('maps Username', () => {
    const username = new Api.Username({ editable: true, active: true, username: 'handle' });
    expect(convertTypeUsername(username)).toEqual({
      editable: true,
      active: true,
      username: 'handle',
    });
  });

  it('defaults missing username fields', () => {
    expect(convertTypeUsername(new Api.Username({} as any))).toEqual({
      editable: false,
      active: false,
      username: '',
    });
  });

  it('returns undefined for an unknown username', () => {
    expect(convertTypeUsername(unknown)).toBeUndefined();
  });
});

describe('convertUser', () => {
  it('maps UserEmpty to an id-only shape', () => {
    expect(convertUser(new Api.UserEmpty({ id: bigInt(5) }))).toEqual({ id: '5' });
  });

  it('maps a fully populated user', () => {
    const user = new Api.User({ id: bigInt(1) });
    Object.assign(user, {
      accessHash: bigInt(2),
      firstName: 'First',
      lastName: 'Last',
      username: 'handle',
      phone: '+123',
      self: true,
      contact: true,
      mutualContact: true,
      deleted: true,
      bot: true,
      botChatHistory: true,
      botNochats: true,
      verified: true,
      restricted: true,
      min: true,
      botInlineGeo: true,
      support: true,
      scam: true,
      applyMinPhoto: true,
      fake: true,
      botAttachMenu: true,
      premium: true,
      attachMenuEnabled: true,
      botCanEdit: true,
      closeFriend: true,
      storiesHidden: true,
      storiesUnavailable: true,
      contactRequirePremium: true,
      botBusiness: true,
      botHasMainApp: true,
      photo: new Api.UserProfilePhoto({ photoId: bigInt(3), dcId: 1 }),
      status: new Api.UserStatusOnline({ expires: 10 }),
      emojiStatus: new Api.EmojiStatus({ documentId: bigInt(4) }),
      color: new Api.PeerColor({ color: 1 }),
      profileColor: new Api.PeerColor({ color: 2 }),
      botInfoVersion: 7,
      restrictionReason: [
        new Api.RestrictionReason({ platform: 'ios', reason: 'r', text: 't' }),
        unknown,
      ],
      botInlinePlaceholder: 'search',
      langCode: 'en',
      usernames: [new Api.Username({ username: 'alt', active: true }), unknown],
      storiesMaxId: new Api.RecentStory({ maxId: 12 }),
      botActiveUsers: 100,
      botVerificationIcon: bigInt(88),
    });

    expect(convertUser(user)).toMatchObject({
      id: '1',
      accessHash: '2',
      firstName: 'First',
      lastName: 'Last',
      username: 'handle',
      phone: '+123',
      self: true,
      bot: true,
      premium: true,
      botHasMainApp: true,
      photo: { photoId: '3', dcId: 1 },
      status: { expires: 10 },
      emojiStatus: { documentId: '4' },
      color: { color: 1 },
      profileColor: { color: 2 },
      botInfoVersion: 7,
      restrictionReason: [{ platform: 'ios', reason: 'r', text: 't' }],
      botInlinePlaceholder: 'search',
      langCode: 'en',
      usernames: [{ editable: false, active: true, username: 'alt' }],
      storiesMaxId: 12,
      botActiveUsers: 100,
      botVerificationIcon: '88',
    });
  });

  it('defaults every optional user field', () => {
    const result = convertUser(new Api.User({ id: bigInt(1) }));
    expect(result).toMatchObject({
      id: '1',
      accessHash: undefined,
      firstName: '',
      lastName: '',
      username: '',
      phone: '',
      self: false,
      contact: false,
      bot: false,
      premium: false,
      photo: undefined,
      status: undefined,
      emojiStatus: undefined,
      color: undefined,
      profileColor: undefined,
      restrictionReason: undefined,
      usernames: undefined,
      botVerificationIcon: undefined,
    });
  });

  it('throws for an unknown user type', () => {
    expect(() => convertUser(unknown)).toThrow('Unknown user type');
  });
});

describe('convertTypePhoto and convertTypeDocument delegates', () => {
  it('delegates photo conversion', () => {
    const photo = new Api.Photo({
      id: bigInt(1),
      accessHash: bigInt(2),
      fileReference: Buffer.from([104, 105]),
      date: 3,
      sizes: [],
      dcId: 4,
    });
    expect(convertTypePhoto(photo)).toMatchObject({ id: '1', accessHash: '2', dcId: 4 });
  });

  it('delegates document conversion', () => {
    expect(convertTypeDocument(document())).toMatchObject({ id: '1', mimeType: 'image/webp' });
  });

  it('delegates peer stories conversion', () => {
    const stories = new Api.PeerStories({
      peer: new Api.PeerUser({ userId: bigInt(1) }),
      maxReadId: 2,
      stories: [],
    });
    expect(convertTypePeerStories(stories)).toEqual({
      peer: { userId: '1' },
      maxReadId: 2,
      stories: [],
    });
  });
});

describe('convertTypePeerSettings', () => {
  it('returns undefined without settings', () => {
    expect(convertTypePeerSettings(undefined)).toBeUndefined();
  });

  it('maps full peer settings', () => {
    const settings = new Api.PeerSettings({
      reportSpam: true,
      addContact: true,
      blockContact: true,
      shareContact: true,
      needContactsException: true,
      reportGeo: true,
      autoarchived: true,
      inviteMembers: true,
      requestChatBroadcast: true,
      businessBotPaused: true,
      businessBotCanReply: true,
      geoDistance: 100,
      requestChatTitle: 'Title',
      requestChatDate: 5,
      businessBotId: bigInt(6),
      businessBotManageUrl: 'http://m',
    });
    expect(convertTypePeerSettings(settings)).toEqual({
      reportSpam: true,
      addContact: true,
      blockContact: true,
      shareContact: true,
      needContactsException: true,
      reportGeo: true,
      autoarchived: true,
      inviteMembers: true,
      requestChatBroadcast: true,
      businessBotPaused: true,
      businessBotCanReply: true,
      geoDistance: 100,
      requestChatTitle: 'Title',
      requestChatDate: 5,
      businessBotId: '6',
      businessBotManageUrl: 'http://m',
    });
  });

  it('defaults missing peer settings fields', () => {
    expect(convertTypePeerSettings(new Api.PeerSettings({}))).toMatchObject({
      reportSpam: false,
      geoDistance: 0,
      requestChatTitle: '',
      requestChatDate: 0,
      businessBotId: undefined,
      businessBotManageUrl: '',
    });
  });

  it('returns undefined for unknown settings', () => {
    expect(convertTypePeerSettings(unknown)).toBeUndefined();
  });
});

describe('convertTypeBotInfo', () => {
  it('returns undefined without bot info', () => {
    expect(convertTypeBotInfo(undefined)).toBeUndefined();
  });

  it('maps BotInfo constructor fields', () => {
    expect(convertTypeBotInfo(new Api.BotInfo({ description: 'About me' }))).toEqual({
      description: 'About me',
    });
  });

  it('omits a missing description', () => {
    expect(convertTypeBotInfo(new Api.BotInfo({}))).toEqual({});
  });

  it('returns undefined for unknown bot info', () => {
    expect(convertTypeBotInfo(unknown)).toBeUndefined();
  });
});

describe('convertTypeChatAdminRights', () => {
  it('returns undefined without rights', () => {
    expect(convertTypeChatAdminRights(undefined)).toBeUndefined();
  });

  it('maps full admin rights', () => {
    const rights = new Api.ChatAdminRights({
      changeInfo: true,
      postMessages: true,
      editMessages: true,
      deleteMessages: true,
      banUsers: true,
      inviteUsers: true,
      pinMessages: true,
      addAdmins: true,
      anonymous: true,
      manageCall: true,
      other: true,
      manageTopics: true,
      postStories: true,
      editStories: true,
      deleteStories: true,
    });
    expect(Object.values(convertTypeChatAdminRights(rights)!)).toEqual(Array(15).fill(true));
  });

  it('defaults missing admin rights', () => {
    const converted = convertTypeChatAdminRights(new Api.ChatAdminRights({} as any))!;
    expect(Object.values(converted)).toEqual(Array(15).fill(false));
  });

  it('returns undefined for unknown rights', () => {
    expect(convertTypeChatAdminRights(unknown)).toBeUndefined();
  });
});

describe('convertTypePremiumGiftOption', () => {
  it('returns undefined without a gift', () => {
    expect(convertTypePremiumGiftOption(undefined)).toBeUndefined();
  });

  it('maps a full gift option', () => {
    const gift = {
      months: 3,
      currency: 'USD',
      amount: bigInt(500),
      botUrl: 'http://bot',
      storeProduct: 'sp',
    };
    expect(convertTypePremiumGiftOption(gift)).toEqual({
      months: 3,
      currency: 'USD',
      amount: '500',
      botUrl: 'http://bot',
      storeProduct: 'sp',
    });
  });

  it('defaults missing gift fields', () => {
    expect(convertTypePremiumGiftOption({} as any)).toEqual({
      months: 0,
      currency: '',
      amount: '0',
      botUrl: '',
      storeProduct: '',
    });
  });

  it('returns undefined for an unknown gift', () => {
    expect(convertTypePremiumGiftOption(unknown)).toBeUndefined();
  });
});

describe('convertTypeWallPaper', () => {
  it('returns undefined without a wallpaper', () => {
    expect(convertTypeWallPaper(undefined)).toBeUndefined();
  });

  it('maps a full WallPaper', () => {
    const wallpaper = new Api.WallPaper({
      id: bigInt(1),
      creator: true,
      default: true,
      pattern: true,
      dark: true,
      accessHash: bigInt(2),
      slug: 'slug',
      document: document(),
      settings: new Api.WallPaperSettings({ blur: true }),
    });
    expect(convertTypeWallPaper(wallpaper)).toMatchObject({
      id: '1',
      creator: true,
      default: true,
      pattern: true,
      dark: true,
      accessHash: '2',
      slug: 'slug',
      document: { id: '1' },
      settings: { blur: true },
    });
  });

  it('defaults missing WallPaper fields', () => {
    const wallpaper = new Api.WallPaper({
      id: bigInt(1),
      accessHash: bigInt(2),
    } as any);
    expect(convertTypeWallPaper(wallpaper)).toMatchObject({
      creator: false,
      default: false,
      pattern: false,
      dark: false,
      slug: '',
      document: undefined,
      settings: undefined,
    });
  });

  it('maps WallPaperNoFile', () => {
    const wallpaper = new Api.WallPaperNoFile({
      id: bigInt(3),
      default: true,
      dark: true,
      settings: new Api.WallPaperSettings({ motion: true }),
    });
    expect(convertTypeWallPaper(wallpaper)).toMatchObject({
      id: '3',
      default: true,
      dark: true,
      settings: { motion: true },
    });
  });

  it('defaults missing WallPaperNoFile fields', () => {
    expect(convertTypeWallPaper(new Api.WallPaperNoFile({ id: bigInt(3) } as any))).toEqual({
      id: '3',
      default: false,
      dark: false,
      settings: undefined,
    });
  });

  it('returns undefined for an unknown wallpaper', () => {
    expect(convertTypeWallPaper(unknown)).toBeUndefined();
  });
});

describe('convertTypeBusinessWorkHours', () => {
  it('returns undefined without work hours', () => {
    expect(convertTypeBusinessWorkHours(undefined)).toBeUndefined();
  });

  it('maps full work hours', () => {
    const workHours = new Api.BusinessWorkHours({
      openNow: true,
      timezoneId: 'UTC',
      weeklyOpen: [
        new Api.BusinessWeeklyOpen({ startMinute: 60, endMinute: 120 }),
        new Api.BusinessWeeklyOpen({} as any),
      ],
    });
    expect(convertTypeBusinessWorkHours(workHours)).toEqual({
      openNow: true,
      timezoneId: 'UTC',
      weeklyOpen: [
        { startMinute: 60, endMinute: 120 },
        { startMinute: 0, endMinute: 0 },
      ],
    });
  });

  it('defaults missing work hours fields', () => {
    expect(convertTypeBusinessWorkHours(new Api.BusinessWorkHours({} as any))).toEqual({
      openNow: false,
      timezoneId: '',
      weeklyOpen: [],
    });
  });

  it('returns undefined for unknown work hours', () => {
    expect(convertTypeBusinessWorkHours(unknown)).toBeUndefined();
  });
});

describe('convertTypeBusinessLocation', () => {
  it('returns undefined without a location', () => {
    expect(convertTypeBusinessLocation(undefined)).toBeUndefined();
  });

  it('maps a full business location', () => {
    const location = new Api.BusinessLocation({ geoPoint: geoPoint(), address: 'Street 1' });
    expect(convertTypeBusinessLocation(location)).toEqual({
      geoPoint: { long: 1, lat: 2, accessHash: '3', accuracyRadius: 4 },
      address: 'Street 1',
    });
  });

  it('defaults missing business location fields', () => {
    expect(convertTypeBusinessLocation(new Api.BusinessLocation({} as any))).toEqual({
      geoPoint: undefined,
      address: '',
    });
  });

  it('returns undefined for an unknown location', () => {
    expect(convertTypeBusinessLocation(unknown)).toBeUndefined();
  });
});

describe('convertTypeBusinessGreetingMessage', () => {
  it('returns undefined without a greeting', () => {
    expect(convertTypeBusinessGreetingMessage(undefined)).toBeUndefined();
  });

  it('maps a full greeting', () => {
    const greeting = new Api.BusinessGreetingMessage({
      shortcutId: 2,
      recipients: recipients(),
      noActivityDays: 7,
    });
    expect(convertTypeBusinessGreetingMessage(greeting)).toMatchObject({
      shortcutId: 2,
      noActivityDays: 7,
      recipients: { existingChats: true, users: ['1'] },
    });
  });

  it('defaults missing greeting fields', () => {
    const greeting = new Api.BusinessGreetingMessage({} as any);
    expect(convertTypeBusinessGreetingMessage(greeting)).toEqual({
      shortcutId: 0,
      recipients: undefined,
      noActivityDays: 0,
    });
  });

  it('returns undefined for an unknown greeting', () => {
    expect(convertTypeBusinessGreetingMessage(unknown)).toBeUndefined();
  });
});

describe('convertTypeBusinessAwayMessage', () => {
  it('returns undefined without an away message', () => {
    expect(convertTypeBusinessAwayMessage(undefined)).toBeUndefined();
  });

  it('maps a full away message', () => {
    const away = new Api.BusinessAwayMessage({
      offlineOnly: true,
      shortcutId: 3,
      schedule: new Api.BusinessAwayMessageScheduleAlways(),
      recipients: recipients(),
    });
    expect(convertTypeBusinessAwayMessage(away)).toMatchObject({
      offlineOnly: true,
      shortcutId: 3,
      schedule: {},
    });
  });

  it('defaults missing away message fields', () => {
    expect(convertTypeBusinessAwayMessage(new Api.BusinessAwayMessage({} as any))).toEqual({
      offlineOnly: false,
      shortcutId: 0,
      schedule: undefined,
      recipients: undefined,
    });
  });

  it('returns undefined for an unknown away message', () => {
    expect(convertTypeBusinessAwayMessage(unknown)).toBeUndefined();
  });
});

describe('convertTypeBusinessIntro', () => {
  it('returns undefined without an intro', () => {
    expect(convertTypeBusinessIntro(undefined)).toBeUndefined();
  });

  it('maps a full intro', () => {
    const intro = new Api.BusinessIntro({
      title: 'Hi',
      description: 'Desc',
      sticker: document(),
    });
    expect(convertTypeBusinessIntro(intro)).toMatchObject({
      title: 'Hi',
      description: 'Desc',
      sticker: { id: '1' },
    });
  });

  it('defaults missing intro fields', () => {
    expect(convertTypeBusinessIntro(new Api.BusinessIntro({} as any))).toEqual({
      title: '',
      description: '',
      sticker: undefined,
    });
  });

  it('returns undefined for an unknown intro', () => {
    expect(convertTypeBusinessIntro(unknown)).toBeUndefined();
  });
});

describe('convertTypeBirthday', () => {
  it('returns undefined without a birthday', () => {
    expect(convertTypeBirthday(undefined)).toBeUndefined();
  });

  it('maps a full birthday', () => {
    expect(convertTypeBirthday(new Api.Birthday({ day: 1, month: 2, year: 1990 }))).toEqual({
      day: 1,
      month: 2,
      year: 1990,
    });
  });

  it('defaults missing birthday fields', () => {
    expect(convertTypeBirthday(new Api.Birthday({} as any))).toEqual({
      day: 0,
      month: 0,
      year: 0,
    });
  });

  it('returns undefined for an unknown birthday', () => {
    expect(convertTypeBirthday(unknown)).toBeUndefined();
  });
});

describe('convertTypeStarRefProgram', () => {
  it('returns undefined without a program', () => {
    expect(convertTypeStarRefProgram(undefined)).toBeUndefined();
  });

  it('maps a StarRefProgram duck-typed payload', () => {
    const program = {
      className: 'StarRefProgram',
      botId: bigInt(1),
      commissionPermille: 50,
      durationMonths: 6,
      endDate: 123,
      dailyRevenuePerUser: { className: 'StarsAmount', amount: bigInt(10), nanos: 5 },
    };
    expect(convertTypeStarRefProgram(program)).toEqual({
      botId: '1',
      commissionPermille: 50,
      durationMonths: 6,
      endDate: 123,
      dailyRevenuePerUser: { amount: '10', nanos: 5 },
    });
  });

  it('defaults missing program fields', () => {
    expect(convertTypeStarRefProgram({ className: 'StarRefProgram', botId: bigInt(1) })).toEqual({
      botId: '1',
      commissionPermille: 0,
      durationMonths: 0,
      endDate: 0,
      dailyRevenuePerUser: undefined,
    });
  });

  it('returns undefined for a different class name', () => {
    expect(convertTypeStarRefProgram(unknown)).toBeUndefined();
  });
});

describe('convertTypeBotVerification', () => {
  it('returns undefined without a verification', () => {
    expect(convertTypeBotVerification(undefined)).toBeUndefined();
  });

  it('maps a BotVerification duck-typed payload', () => {
    const verification = {
      className: 'BotVerification',
      botId: bigInt(2),
      icon: bigInt(3),
      description: 'verified',
    };
    expect(convertTypeBotVerification(verification)).toEqual({
      botId: '2',
      icon: '3',
      description: 'verified',
    });
  });

  it('defaults a missing description', () => {
    const verification = { className: 'BotVerification', botId: bigInt(2), icon: bigInt(3) };
    expect(convertTypeBotVerification(verification)).toMatchObject({ description: '' });
  });

  it('returns undefined for a different class name', () => {
    expect(convertTypeBotVerification(unknown)).toBeUndefined();
  });
});

describe('convertTypeWallPaperSettings', () => {
  it('returns undefined without settings', () => {
    expect(convertTypeWallPaperSettings(undefined)).toBeUndefined();
  });

  it('maps full wallpaper settings', () => {
    const settings = new Api.WallPaperSettings({
      blur: true,
      motion: true,
      backgroundColor: 1,
      secondBackgroundColor: 2,
      thirdBackgroundColor: 3,
      fourthBackgroundColor: 4,
      intensity: 5,
      rotation: 6,
      emoticon: '🌅',
    });
    expect(convertTypeWallPaperSettings(settings)).toEqual({
      blur: true,
      motion: true,
      backgroundColor: 1,
      secondBackgroundColor: 2,
      thirdBackgroundColor: 3,
      fourthBackgroundColor: 4,
      intensity: 5,
      rotation: 6,
      emoticon: '🌅',
    });
  });

  it('defaults missing wallpaper settings', () => {
    expect(convertTypeWallPaperSettings(new Api.WallPaperSettings({}))).toEqual({
      blur: false,
      motion: false,
      backgroundColor: 0,
      secondBackgroundColor: 0,
      thirdBackgroundColor: 0,
      fourthBackgroundColor: 0,
      intensity: 0,
      rotation: 0,
      emoticon: '',
    });
  });

  it('returns undefined for unknown settings', () => {
    expect(convertTypeWallPaperSettings(unknown)).toBeUndefined();
  });
});

describe('convertTypeGeoPoint', () => {
  it('returns undefined without a geo point', () => {
    expect(convertTypeGeoPoint(undefined)).toBeUndefined();
  });

  it('returns undefined for GeoPointEmpty', () => {
    expect(convertTypeGeoPoint(new Api.GeoPointEmpty())).toBeUndefined();
  });

  it('maps a full geo point', () => {
    expect(convertTypeGeoPoint(geoPoint())).toEqual({
      long: 1,
      lat: 2,
      accessHash: '3',
      accuracyRadius: 4,
    });
  });

  it('defaults missing geo point fields', () => {
    const point = new Api.GeoPoint({ accessHash: bigInt(3) } as any);
    expect(convertTypeGeoPoint(point)).toEqual({
      long: 0,
      lat: 0,
      accessHash: '3',
      accuracyRadius: 0,
    });
  });

  it('returns undefined for an unknown geo point', () => {
    expect(convertTypeGeoPoint(unknown)).toBeUndefined();
  });
});

describe('convertTypeBusinessRecipients', () => {
  it('returns undefined without recipients', () => {
    expect(convertTypeBusinessRecipients(undefined)).toBeUndefined();
  });

  it('maps full recipients', () => {
    const value = new Api.BusinessRecipients({
      existingChats: true,
      newChats: true,
      contacts: true,
      nonContacts: true,
      excludeSelected: true,
      users: [bigInt(1), bigInt(2)],
    });
    expect(convertTypeBusinessRecipients(value)).toEqual({
      existingChats: true,
      newChats: true,
      contacts: true,
      nonContacts: true,
      excludeSelected: true,
      users: ['1', '2'],
    });
  });

  it('defaults missing recipients fields', () => {
    expect(convertTypeBusinessRecipients(new Api.BusinessRecipients({}))).toEqual({
      existingChats: false,
      newChats: false,
      contacts: false,
      nonContacts: false,
      excludeSelected: false,
      users: [],
    });
  });

  it('returns undefined for unknown recipients', () => {
    expect(convertTypeBusinessRecipients(unknown)).toBeUndefined();
  });
});

describe('convertTypeBusinessAwayMessageSchedule', () => {
  it('returns undefined without a schedule', () => {
    expect(convertTypeBusinessAwayMessageSchedule(undefined)).toBeUndefined();
  });

  it('maps the always schedule to an empty marker', () => {
    expect(
      convertTypeBusinessAwayMessageSchedule(new Api.BusinessAwayMessageScheduleAlways()),
    ).toEqual({});
  });

  it('maps the outside-work-hours schedule to an empty marker', () => {
    expect(
      convertTypeBusinessAwayMessageSchedule(
        new Api.BusinessAwayMessageScheduleOutsideWorkHours(),
      ),
    ).toEqual({});
  });

  it('maps a custom schedule', () => {
    const schedule = new Api.BusinessAwayMessageScheduleCustom({ startDate: 1, endDate: 2 });
    expect(convertTypeBusinessAwayMessageSchedule(schedule)).toEqual({ startDate: 1, endDate: 2 });
  });

  it('defaults missing custom schedule fields', () => {
    const schedule = new Api.BusinessAwayMessageScheduleCustom({} as any);
    expect(convertTypeBusinessAwayMessageSchedule(schedule)).toEqual({ startDate: 0, endDate: 0 });
  });

  it('returns undefined for an unknown schedule', () => {
    expect(convertTypeBusinessAwayMessageSchedule(unknown)).toBeUndefined();
  });
});

describe('convertTypeStarsAmount', () => {
  it('returns undefined without an amount', () => {
    expect(convertTypeStarsAmount(undefined)).toBeUndefined();
  });

  it('maps a StarsAmount duck-typed payload', () => {
    expect(
      convertTypeStarsAmount({ className: 'StarsAmount', amount: bigInt(7), nanos: 8 }),
    ).toEqual({ amount: '7', nanos: 8 });
  });

  it('defaults missing amount fields', () => {
    expect(convertTypeStarsAmount({ className: 'StarsAmount' })).toEqual({
      amount: '0',
      nanos: 0,
    });
  });

  it('returns undefined for a different class name', () => {
    expect(convertTypeStarsAmount(unknown)).toBeUndefined();
  });
});

describe('convertUserFull', () => {
  it('maps a fully populated user full', () => {
    const userFull = new Api.UserFull({
      blocked: true,
      phoneCallsAvailable: true,
      phoneCallsPrivate: true,
      canPinMessage: true,
      hasScheduled: true,
      videoCallsAvailable: true,
      voiceMessagesForbidden: true,
      translationsDisabled: true,
      storiesPinnedAvailable: true,
      blockedMyStoriesFrom: true,
      wallpaperOverridden: true,
      contactRequirePremium: true,
      readDatesPrivate: true,
      sponsoredEnabled: true,
      canViewRevenue: true,
      botCanManageEmojiStatus: true,
      id: bigInt(1),
      about: 'about',
      settings: new Api.PeerSettings({ reportSpam: true }),
      notifySettings: new Api.PeerNotifySettings({ silent: true }),
      botInfo: new Api.BotInfo({ description: 'bot' }),
      pinnedMsgId: 2,
      commonChatsCount: 3,
      folderId: 4,
      ttlPeriod: 5,
      theme: new Api.ChatTheme({ emoticon: '🎨' }),
      privateForwardName: 'anon',
      botGroupAdminRights: new Api.ChatAdminRights({ changeInfo: true } as any),
      botBroadcastAdminRights: new Api.ChatAdminRights({ postMessages: true } as any),
      wallpaper: new Api.WallPaperNoFile({ id: bigInt(9) } as any),
      stories: new Api.PeerStories({
        peer: new Api.PeerUser({ userId: bigInt(1) }),
        maxReadId: 1,
        stories: [],
      }),
      businessWorkHours: new Api.BusinessWorkHours({ timezoneId: 'UTC' } as any),
      businessLocation: new Api.BusinessLocation({ address: 'A' } as any),
      businessGreetingMessage: new Api.BusinessGreetingMessage({
        shortcutId: 1,
        recipients: recipients(),
        noActivityDays: 2,
      }),
      businessAwayMessage: new Api.BusinessAwayMessage({
        shortcutId: 2,
        schedule: new Api.BusinessAwayMessageScheduleAlways(),
        recipients: recipients(),
      }),
      businessIntro: new Api.BusinessIntro({ title: 'T' } as any),
      birthday: new Api.Birthday({ day: 1, month: 1 } as any),
      personalChannelId: bigInt(10),
      personalChannelMessage: 11,
      stargiftsCount: 12,
    } as any);
    Object.assign(userFull, {
      starrefProgram: { className: 'StarRefProgram', botId: bigInt(1) },
      botVerification: { className: 'BotVerification', botId: bigInt(2), icon: bigInt(3) },
    });

    expect(convertUserFull(userFull)).toMatchObject({
      blocked: true,
      canViewRevenue: true,
      botCanManageEmojiStatus: true,
      id: '1',
      about: 'about',
      settings: { reportSpam: true },
      notifySettings: { silent: true },
      botInfo: { description: 'bot' },
      pinnedMsgId: 2,
      commonChatsCount: 3,
      folderId: 4,
      ttlPeriod: 5,
      theme: { emoticon: '🎨' },
      privateForwardName: 'anon',
      wallpaper: { id: '9' },
      stories: { maxReadId: 1 },
      businessWorkHours: { timezoneId: 'UTC' },
      businessLocation: { address: 'A' },
      businessIntro: { title: 'T' },
      birthday: { day: 1, month: 1, year: 0 },
      personalChannelId: '10',
      personalChannelMessage: 11,
      stargiftsCount: 12,
      starrefProgram: { botId: '1' },
      botVerification: { botId: '2', icon: '3' },
    });
  });

  it('defaults every optional user full field', () => {
    const userFull = new Api.UserFull({ id: bigInt(1) } as any);
    expect(convertUserFull(userFull)).toMatchObject({
      blocked: false,
      phoneCallsAvailable: false,
      id: '1',
      about: '',
      settings: undefined,
      personalPhoto: undefined,
      profilePhoto: undefined,
      fallbackPhoto: undefined,
      botInfo: undefined,
      pinnedMsgId: 0,
      commonChatsCount: 0,
      folderId: 0,
      ttlPeriod: 0,
      theme: undefined,
      privateForwardName: '',
      botGroupAdminRights: undefined,
      botBroadcastAdminRights: undefined,
      wallpaper: undefined,
      stories: undefined,
      businessWorkHours: undefined,
      birthday: undefined,
      personalChannelId: undefined,
      personalChannelMessage: 0,
      stargiftsCount: 0,
      starrefProgram: undefined,
      botVerification: undefined,
    });
  });
});
