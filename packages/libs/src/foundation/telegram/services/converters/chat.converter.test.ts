import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import {
  convertChannel,
  convertChannelForbidden,
  convertChannelFull,
  convertChat,
  convertChatEmpty,
  convertChatForbidden,
  convertChatFull,
  convertTypeChannelLocation,
  convertTypeChat,
  convertTypeChatBannedRights,
  convertTypeChatParticipant,
  convertTypeChatParticipants,
  convertTypeChatReactions,
  convertTypeExportedChatInvite,
  convertTypeInputChannel,
  convertTypeInputGroupCall,
  convertTypeReaction,
  convertTypeStarsSubscriptionPricing,
  convertTypeStickerSet,
} from './chat.converter';

const unknown = { className: 'TotallyUnknown' } as any;
const STRIPPED = Buffer.from([1, 10, 20, 0xaa, 0xbb]);

const photo = () =>
  new Api.Photo({
    id: bigInt(20),
    accessHash: bigInt(21),
    fileReference: Buffer.from([104, 105]),
    date: 1,
    sizes: [],
    dcId: 2,
  });

describe('convertChat', () => {
  it('maps a full chat', () => {
    const chat = new Api.Chat({
      id: bigInt(5),
      title: 'Group',
      photo: new Api.ChatPhoto({ photoId: bigInt(1), dcId: 2, strippedThumb: STRIPPED }),
      participantsCount: 10,
      date: 100,
      version: 3,
      migratedTo: new Api.InputChannel({ channelId: bigInt(7), accessHash: bigInt(8) }),
      adminRights: new Api.ChatAdminRights({ changeInfo: true } as any),
      defaultBannedRights: new Api.ChatBannedRights({ sendMessages: true, untilDate: 0 } as any),
      creator: true,
      left: true,
      deactivated: true,
      callActive: true,
      callNotEmpty: true,
      noforwards: true,
    } as any);
    expect(convertChat(chat)).toMatchObject({
      id: '-5',
      title: 'Group',
      participantsCount: 10,
      date: 100,
      version: 3,
      migratedTo: { channelId: '-1000000000007', accessHash: '8' },
      adminRights: { changeInfo: true },
      defaultBannedRights: { sendMessages: true },
      creator: true,
      left: true,
      deactivated: true,
      callActive: true,
      callNotEmpty: true,
      noforwards: true,
    });
  });

  it('defaults missing chat fields and nulls an absent photo', () => {
    const chat = new Api.Chat({ id: bigInt(5) } as any);
    expect(convertChat(chat)).toEqual({
      id: '-5',
      title: '',
      photo: null,
      participantsCount: 0,
      date: 0,
      version: 0,
      migratedTo: undefined,
      adminRights: undefined,
      defaultBannedRights: undefined,
      creator: false,
      left: false,
      deactivated: false,
      callActive: false,
      callNotEmpty: false,
      noforwards: false,
    });
  });
});

describe('convertChannel', () => {
  it('maps a full channel', () => {
    const channel = new Api.Channel({
      id: bigInt(9),
      accessHash: bigInt(10),
      title: 'News',
      username: 'news',
      photo: new Api.ChatPhoto({ photoId: bigInt(1), dcId: 2 }),
      date: 50,
      restrictionReason: [
        new Api.RestrictionReason({ platform: 'ios', reason: 'r', text: 't' }),
        unknown,
      ],
      adminRights: new Api.ChatAdminRights({ postMessages: true } as any),
      bannedRights: new Api.ChatBannedRights({ sendMessages: true, untilDate: 0 } as any),
      defaultBannedRights: new Api.ChatBannedRights({ sendMedia: true, untilDate: 0 } as any),
      participantsCount: 500,
      usernames: [new Api.Username({ username: 'alt', active: true }), unknown],
      storiesMaxId: new Api.RecentStory({ maxId: 4 }),
      color: new Api.PeerColor({ color: 1 }),
      profileColor: new Api.PeerColor({ color: 2 }),
      emojiStatus: new Api.EmojiStatus({ documentId: bigInt(3) }),
      level: 2,
      subscriptionUntilDate: 77,
      creator: true,
      broadcast: true,
      megagroup: true,
      forum: true,
      signatureProfiles: true,
    } as any);
    Object.assign(channel, { botVerificationIcon: bigInt(6) });

    expect(convertChannel(channel)).toMatchObject({
      id: '-1000000000009',
      title: 'News',
      username: 'news',
      date: 50,
      restrictionReason: [{ platform: 'ios', reason: 'r', text: 't' }],
      adminRights: { postMessages: true },
      bannedRights: { sendMessages: true },
      defaultBannedRights: { sendMedia: true },
      participantsCount: 500,
      usernames: [{ username: 'alt', active: true, editable: false }],
      storiesMaxId: 4,
      color: { color: 1 },
      profileColor: { color: 2 },
      emojiStatus: { documentId: '3' },
      level: 2,
      subscriptionUntilDate: 77,
      botVerificationIcon: '6',
      accessHash: '10',
      creator: true,
      broadcast: true,
      megagroup: true,
      forum: true,
      signatureProfiles: true,
    });
  });

  it('defaults missing channel fields and empties an absent photo', () => {
    const channel = new Api.Channel({ id: bigInt(9) } as any);
    expect(convertChannel(channel)).toMatchObject({
      id: '-1000000000009',
      title: '',
      photo: {},
      date: 0,
      restrictionReason: undefined,
      adminRights: undefined,
      bannedRights: undefined,
      defaultBannedRights: undefined,
      usernames: undefined,
      color: undefined,
      profileColor: undefined,
      emojiStatus: undefined,
      botVerificationIcon: undefined,
      accessHash: undefined,
      creator: false,
      broadcast: false,
      signatureProfiles: false,
    });
  });
});

describe('convertChatForbidden / convertChannelForbidden / convertChatEmpty', () => {
  it('maps ChatForbidden', () => {
    const chat = new Api.ChatForbidden({ id: bigInt(3), title: 'Hidden' });
    expect(convertChatForbidden(chat)).toEqual({ id: '-3', title: 'Hidden' });
  });

  it('defaults a missing ChatForbidden title', () => {
    expect(convertChatForbidden(new Api.ChatForbidden({ id: bigInt(3) } as any))).toEqual({
      id: '-3',
      title: '',
    });
  });

  it('maps ChannelForbidden', () => {
    const channel = new Api.ChannelForbidden({
      id: bigInt(4),
      accessHash: bigInt(5),
      title: 'Hidden',
      untilDate: 99,
      broadcast: true,
      megagroup: true,
    });
    expect(convertChannelForbidden(channel)).toEqual({
      id: '-1000000000004',
      accessHash: '5',
      title: 'Hidden',
      untilDate: 99,
      broadcast: true,
      megagroup: true,
    });
  });

  it('defaults missing ChannelForbidden fields', () => {
    const channel = new Api.ChannelForbidden({ id: bigInt(4) } as any);
    expect(convertChannelForbidden(channel)).toEqual({
      id: '-1000000000004',
      accessHash: '',
      title: '',
      untilDate: undefined,
      broadcast: false,
      megagroup: false,
    });
  });

  it('maps ChatEmpty', () => {
    expect(convertChatEmpty(new Api.ChatEmpty({ id: bigInt(6) }))).toEqual({ id: '-6' });
  });
});

describe('convertTypeChatBannedRights', () => {
  it('returns undefined without rights', () => {
    expect(convertTypeChatBannedRights(undefined)).toBeUndefined();
  });

  it('maps full banned rights', () => {
    const rights = new Api.ChatBannedRights({
      viewMessages: true,
      sendMessages: true,
      sendMedia: true,
      sendStickers: true,
      sendGifs: true,
      sendGames: true,
      sendInline: true,
      embedLinks: true,
      sendPolls: true,
      changeInfo: true,
      inviteUsers: true,
      pinMessages: true,
      untilDate: 42,
      sendPhotos: true,
      sendVideos: true,
      sendRoundvideos: true,
      sendAudios: true,
      sendVoices: true,
      sendDocs: true,
      sendPlain: true,
    });
    expect(convertTypeChatBannedRights(rights)).toMatchObject({
      viewMessages: true,
      sendPlain: true,
      untilDate: 42,
    });
  });

  it('defaults missing banned rights', () => {
    const converted = convertTypeChatBannedRights(new Api.ChatBannedRights({} as any))!;
    expect(converted).toMatchObject({ viewMessages: false, untilDate: 0, sendPlain: false });
  });

  it('returns undefined for unknown rights', () => {
    expect(convertTypeChatBannedRights(unknown)).toBeUndefined();
  });
});

describe('convertTypeInputChannel', () => {
  it('returns undefined without an input channel', () => {
    expect(convertTypeInputChannel(undefined)).toBeUndefined();
  });

  it('maps InputChannel', () => {
    const channel = new Api.InputChannel({ channelId: bigInt(1), accessHash: bigInt(2) });
    expect(convertTypeInputChannel(channel)).toEqual({
      channelId: '-1000000000001',
      accessHash: '2',
    });
  });

  it('maps InputChannelFromMessage', () => {
    const channel = new Api.InputChannelFromMessage({
      peer: new Api.InputPeerChat({ chatId: bigInt(3) }),
      msgId: 4,
      channelId: bigInt(1),
    });
    expect(convertTypeInputChannel(channel)).toEqual({
      peer: { chatId: '-3' },
      msgId: 4,
      channelId: '-1000000000001',
    });
  });

  it('returns undefined when the inner peer cannot be converted', () => {
    const channel = new Api.InputChannelFromMessage({
      peer: new Api.InputPeerEmpty(),
      msgId: 4,
      channelId: bigInt(1),
    });
    expect(convertTypeInputChannel(channel)).toBeUndefined();
  });

  it('returns undefined for InputChannelEmpty', () => {
    expect(convertTypeInputChannel(new Api.InputChannelEmpty())).toBeUndefined();
  });
});

describe('convertTypeChat', () => {
  it('splits chats by type and ignores unknown entries', () => {
    const result = convertTypeChat([
      new Api.Chat({ id: bigInt(1), title: 'C' } as any),
      new Api.Channel({ id: bigInt(2), title: 'Ch' } as any),
      new Api.ChatEmpty({ id: bigInt(3) }),
      new Api.ChatForbidden({ id: bigInt(4), title: 'F' }),
      new Api.ChannelForbidden({ id: bigInt(5), title: 'CF' } as any),
      unknown,
    ]);
    expect(result.chats).toHaveLength(1);
    expect(result.channels).toHaveLength(1);
    expect(result.emptyChats).toHaveLength(1);
    expect(result.forbiddenChats).toHaveLength(1);
    expect(result.forbiddenChannels).toHaveLength(1);
  });

  it('returns empty buckets for an empty list', () => {
    expect(convertTypeChat([])).toEqual({
      chats: [],
      channels: [],
      forbiddenChats: [],
      forbiddenChannels: [],
      emptyChats: [],
    });
  });
});

describe('convertTypeStarsSubscriptionPricing', () => {
  it('returns undefined without pricing', () => {
    expect(convertTypeStarsSubscriptionPricing(undefined)).toBeUndefined();
  });

  it('maps pricing', () => {
    const pricing = new Api.StarsSubscriptionPricing({ period: 30, amount: bigInt(100) });
    expect(convertTypeStarsSubscriptionPricing(pricing)).toEqual({ period: 30, amount: '100' });
  });

  it('defaults missing pricing fields', () => {
    expect(
      convertTypeStarsSubscriptionPricing(new Api.StarsSubscriptionPricing({} as any)),
    ).toEqual({ period: 0, amount: '0' });
  });

  it('returns undefined for unknown pricing', () => {
    expect(convertTypeStarsSubscriptionPricing(unknown)).toBeUndefined();
  });
});

describe('convertTypeExportedChatInvite', () => {
  it('returns undefined without an invite', () => {
    expect(convertTypeExportedChatInvite(undefined)).toBeUndefined();
  });

  it('returns undefined for ChatInvitePublicJoinRequests', () => {
    expect(convertTypeExportedChatInvite(new Api.ChatInvitePublicJoinRequests())).toBeUndefined();
  });

  it('maps a full exported invite', () => {
    const invite = new Api.ChatInviteExported({
      revoked: true,
      permanent: true,
      requestNeeded: true,
      link: 'http://t.me/x',
      adminId: bigInt(1),
      date: 2,
      startDate: 3,
      expireDate: 4,
      usageLimit: 5,
      usage: 6,
      requested: 7,
      subscriptionExpired: 8,
      title: 'Invite',
      subscriptionPricing: new Api.StarsSubscriptionPricing({ period: 30, amount: bigInt(9) }),
    } as any);
    expect(convertTypeExportedChatInvite(invite)).toMatchObject({
      revoked: true,
      permanent: true,
      requestNeeded: true,
      link: 'http://t.me/x',
      adminId: '1',
      date: 2,
      title: 'Invite',
      subscriptionPricing: { period: 30, amount: '9' },
    });
  });

  it('defaults missing invite fields', () => {
    expect(convertTypeExportedChatInvite(new Api.ChatInviteExported({} as any))).toMatchObject({
      revoked: false,
      permanent: false,
      requestNeeded: false,
      link: '',
      adminId: '',
      date: 0,
      subscriptionPricing: undefined,
    });
  });

  it('returns undefined for an unknown invite', () => {
    expect(convertTypeExportedChatInvite(unknown)).toBeUndefined();
  });
});

describe('convertTypeInputGroupCall', () => {
  it('returns undefined without a call', () => {
    expect(convertTypeInputGroupCall(undefined)).toBeUndefined();
  });

  it('maps InputGroupCall', () => {
    const call = new Api.InputGroupCall({ id: bigInt(1), accessHash: bigInt(2) });
    expect(convertTypeInputGroupCall(call)).toEqual({ id: '1', accessHash: '2' });
  });

  it('returns undefined for an unknown call', () => {
    expect(convertTypeInputGroupCall(unknown)).toBeUndefined();
  });
});

describe('convertTypeReaction', () => {
  it('returns undefined without a reaction', () => {
    expect(convertTypeReaction(undefined)).toBeUndefined();
  });

  it('maps ReactionEmpty to an empty marker', () => {
    expect(convertTypeReaction(new Api.ReactionEmpty())).toEqual({ empty: true });
  });

  it('maps ReactionPaid to a paid marker', () => {
    expect(convertTypeReaction(new Api.ReactionPaid())).toEqual({ paid: true });
  });

  it('maps ReactionEmoji', () => {
    expect(convertTypeReaction(new Api.ReactionEmoji({ emoticon: '👍' }))).toEqual({
      emoticon: '👍',
    });
  });

  it('defaults a missing emoticon', () => {
    expect(convertTypeReaction(new Api.ReactionEmoji({} as any))).toEqual({ emoticon: '' });
  });

  it('maps ReactionCustomEmoji', () => {
    expect(convertTypeReaction(new Api.ReactionCustomEmoji({ documentId: bigInt(5) }))).toEqual({
      documentId: '5',
    });
  });

  it('returns undefined for an unknown reaction', () => {
    expect(convertTypeReaction(unknown)).toBeUndefined();
  });
});

describe('convertTypeChatReactions', () => {
  it('returns undefined without reactions', () => {
    expect(convertTypeChatReactions(undefined)).toBeUndefined();
  });

  it('maps ChatReactionsNone to an empty marker', () => {
    expect(convertTypeChatReactions(new Api.ChatReactionsNone())).toEqual({});
  });

  it('maps ChatReactionsAll', () => {
    expect(convertTypeChatReactions(new Api.ChatReactionsAll({ allowCustom: true }))).toEqual({
      allowCustom: true,
    });
  });

  it('defaults a missing allowCustom flag', () => {
    expect(convertTypeChatReactions(new Api.ChatReactionsAll({}))).toEqual({ allowCustom: false });
  });

  it('maps ChatReactionsSome and drops unconvertible reactions', () => {
    const reactions = new Api.ChatReactionsSome({
      reactions: [new Api.ReactionEmoji({ emoticon: '👍' }), unknown],
    });
    expect(convertTypeChatReactions(reactions)).toEqual({ reactions: [{ emoticon: '👍' }] });
  });

  it('defaults a missing reaction list', () => {
    expect(convertTypeChatReactions(new Api.ChatReactionsSome({} as any))).toEqual({
      reactions: [],
    });
  });

  it('returns undefined for unknown reactions', () => {
    expect(convertTypeChatReactions(unknown)).toBeUndefined();
  });
});

describe('convertTypeChannelLocation', () => {
  it('returns undefined without a location', () => {
    expect(convertTypeChannelLocation(undefined)).toBeUndefined();
  });

  it('maps ChannelLocationEmpty to an empty marker', () => {
    expect(convertTypeChannelLocation(new Api.ChannelLocationEmpty())).toEqual({});
  });

  it('maps ChannelLocation', () => {
    const location = new Api.ChannelLocation({
      geoPoint: new Api.GeoPoint({ long: 1, lat: 2, accessHash: bigInt(3), accuracyRadius: 4 }),
      address: 'Street',
    });
    expect(convertTypeChannelLocation(location)).toEqual({
      geoPoint: { long: 1, lat: 2, accessHash: '3', accuracyRadius: 4 },
      address: 'Street',
    });
  });

  it('defaults a missing address', () => {
    expect(convertTypeChannelLocation(new Api.ChannelLocation({} as any))).toEqual({
      geoPoint: undefined,
      address: '',
    });
  });

  it('returns undefined for an unknown location', () => {
    expect(convertTypeChannelLocation(unknown)).toBeUndefined();
  });
});

describe('convertTypeStickerSet', () => {
  it('returns undefined without a sticker set', () => {
    expect(convertTypeStickerSet(undefined)).toBeUndefined();
  });

  it('maps a full sticker set', () => {
    const stickerset = new Api.StickerSet({
      archived: true,
      official: true,
      masks: true,
      emojis: true,
      textColor: true,
      channelEmojiStatus: true,
      creator: true,
      installedDate: 10,
      id: bigInt(1),
      accessHash: bigInt(2),
      title: 'Pack',
      shortName: 'pack',
      thumbs: [new Api.PhotoSize({ type: 'm', w: 1, h: 2, size: 3 }), unknown],
      thumbDcId: 4,
      thumbVersion: 5,
      thumbDocumentId: bigInt(6),
      count: 7,
      hash: 8,
    });
    expect(convertTypeStickerSet(stickerset)).toMatchObject({
      archived: true,
      official: true,
      creator: true,
      installedDate: 10,
      id: '1',
      accessHash: '2',
      title: 'Pack',
      shortName: 'pack',
      thumbs: [{ type: 'm', w: 1, h: 2, size: 3 }],
      thumbDcId: 4,
      thumbVersion: 5,
      thumbDocumentId: '6',
      count: 7,
      hash: 8,
    });
  });

  it('defaults missing sticker set fields', () => {
    const stickerset = new Api.StickerSet({ id: bigInt(1), accessHash: bigInt(2) } as any);
    expect(convertTypeStickerSet(stickerset)).toMatchObject({
      archived: false,
      official: false,
      title: '',
      shortName: '',
      thumbs: undefined,
      thumbDocumentId: undefined,
      count: 0,
      hash: 0,
    });
  });

  it('returns undefined for an unknown sticker set', () => {
    expect(convertTypeStickerSet(unknown)).toBeUndefined();
  });
});

describe('convertTypeChatParticipant', () => {
  it('returns undefined without a participant', () => {
    expect(convertTypeChatParticipant(undefined)).toBeUndefined();
  });

  it('maps ChatParticipantCreator', () => {
    const participant = new Api.ChatParticipantCreator({ userId: bigInt(1) });
    expect(convertTypeChatParticipant(participant)).toEqual({ userId: '1' });
  });

  it('maps ChatParticipantAdmin', () => {
    const participant = new Api.ChatParticipantAdmin({
      userId: bigInt(1),
      inviterId: bigInt(2),
      date: 3,
    });
    expect(convertTypeChatParticipant(participant)).toEqual({
      userId: '1',
      inviterId: '2',
      date: 3,
    });
  });

  it('maps ChatParticipant', () => {
    const participant = new Api.ChatParticipant({
      userId: bigInt(1),
      inviterId: bigInt(2),
      date: 3,
    });
    expect(convertTypeChatParticipant(participant)).toEqual({
      userId: '1',
      inviterId: '2',
      date: 3,
    });
  });

  it('defaults a missing participant date', () => {
    const participant = new Api.ChatParticipant({
      userId: bigInt(1),
      inviterId: bigInt(2),
    } as any);
    expect(convertTypeChatParticipant(participant)).toMatchObject({ date: 0 });
  });

  it('defaults a missing admin participant date', () => {
    const participant = new Api.ChatParticipantAdmin({
      userId: bigInt(1),
      inviterId: bigInt(2),
    } as any);
    expect(convertTypeChatParticipant(participant)).toMatchObject({ date: 0 });
  });

  it('returns undefined for an unknown participant', () => {
    expect(convertTypeChatParticipant(unknown)).toBeUndefined();
  });
});

describe('convertTypeChatParticipants', () => {
  it('returns undefined without participants', () => {
    expect(convertTypeChatParticipants(undefined)).toBeUndefined();
  });

  it('maps ChatParticipantsForbidden with a self participant', () => {
    const participants = new Api.ChatParticipantsForbidden({
      chatId: bigInt(3),
      selfParticipant: new Api.ChatParticipantCreator({ userId: bigInt(1) }),
    });
    expect(convertTypeChatParticipants(participants)).toEqual({
      chatId: '-3',
      selfParticipant: { userId: '1' },
    });
  });

  it('maps ChatParticipantsForbidden without a self participant', () => {
    const participants = new Api.ChatParticipantsForbidden({ chatId: bigInt(3) });
    expect(convertTypeChatParticipants(participants)).toEqual({
      chatId: '-3',
      selfParticipant: undefined,
    });
  });

  it('maps ChatParticipants and drops unconvertible participants', () => {
    const participants = new Api.ChatParticipants({
      chatId: bigInt(3),
      participants: [new Api.ChatParticipantCreator({ userId: bigInt(1) }), unknown],
      version: 2,
    });
    expect(convertTypeChatParticipants(participants)).toEqual({
      chatId: '-3',
      participants: [{ userId: '1' }],
      version: 2,
    });
  });

  it('defaults a missing participant list and version', () => {
    const participants = new Api.ChatParticipants({ chatId: bigInt(3) } as any);
    expect(convertTypeChatParticipants(participants)).toEqual({
      chatId: '-3',
      participants: [],
      version: 0,
    });
  });

  it('returns undefined for unknown participants', () => {
    expect(convertTypeChatParticipants(unknown)).toBeUndefined();
  });
});

describe('convertChatFull', () => {
  it('maps a full chat full', () => {
    const chatFull = new Api.ChatFull({
      canSetUsername: true,
      hasScheduled: true,
      translationsDisabled: true,
      id: bigInt(1),
      about: 'about',
      participants: new Api.ChatParticipants({
        chatId: bigInt(1),
        participants: [],
        version: 1,
      }),
      chatPhoto: photo(),
      notifySettings: new Api.PeerNotifySettings({ silent: true }),
      exportedInvite: new Api.ChatInviteExported({ link: 'l', adminId: bigInt(2) } as any),
      botInfo: [new Api.BotInfo({ description: 'bot' }), unknown],
      pinnedMsgId: 3,
      folderId: 4,
      call: new Api.InputGroupCall({ id: bigInt(5), accessHash: bigInt(6) }),
      ttlPeriod: 7,
      groupcallDefaultJoinAs: new Api.PeerUser({ userId: bigInt(8) }),
      themeEmoticon: '🎨',
      requestsPending: 9,
      recentRequesters: [bigInt(10)],
      availableReactions: new Api.ChatReactionsAll({ allowCustom: true }),
      reactionsLimit: 11,
    } as any);
    expect(convertChatFull(chatFull)).toMatchObject({
      canSetUsername: true,
      hasScheduled: true,
      translationsDisabled: true,
      id: '-1',
      about: 'about',
      participants: { chatId: '-1', participants: [], version: 1 },
      chatPhoto: { id: '20' },
      notifySettings: { silent: true },
      exportedInvite: { link: 'l', adminId: '2' },
      botInfo: [{ description: 'bot' }],
      pinnedMsgId: 3,
      folderId: 4,
      call: { id: '5', accessHash: '6' },
      ttlPeriod: 7,
      groupcallDefaultJoinAs: { userId: '8' },
      themeEmoticon: '🎨',
      requestsPending: 9,
      recentRequesters: ['10'],
      availableReactions: { allowCustom: true },
      reactionsLimit: 11,
    });
  });

  it('defaults missing chat full fields', () => {
    const chatFull = new Api.ChatFull({ id: bigInt(1) } as any);
    expect(convertChatFull(chatFull)).toMatchObject({
      canSetUsername: false,
      hasScheduled: false,
      translationsDisabled: false,
      id: '-1',
      about: '',
      participants: undefined,
      chatPhoto: undefined,
      exportedInvite: undefined,
      botInfo: undefined,
      call: undefined,
      groupcallDefaultJoinAs: undefined,
      recentRequesters: undefined,
      availableReactions: undefined,
    });
  });
});

describe('convertChannelFull', () => {
  it('maps a full channel full', () => {
    const channelFull = new Api.ChannelFull({
      canViewParticipants: true,
      canSetUsername: true,
      canSetStickers: true,
      hiddenPrehistory: true,
      canSetLocation: true,
      hasScheduled: true,
      canViewStats: true,
      blocked: true,
      canDeleteChannel: true,
      antispam: true,
      participantsHidden: true,
      translationsDisabled: true,
      storiesPinnedAvailable: true,
      viewForumAsMessages: true,
      restrictedSponsored: true,
      canViewRevenue: true,
      paidMediaAllowed: true,
      canViewStarsRevenue: true,
      paidReactionsAvailable: true,
      id: bigInt(1),
      about: 'about',
      participantsCount: 2,
      adminsCount: 3,
      kickedCount: 4,
      bannedCount: 5,
      onlineCount: 6,
      readInboxMaxId: 7,
      readOutboxMaxId: 8,
      unreadCount: 9,
      chatPhoto: photo(),
      notifySettings: new Api.PeerNotifySettings({ silent: true }),
      exportedInvite: new Api.ChatInviteExported({ link: 'l', adminId: bigInt(2) } as any),
      botInfo: [new Api.BotInfo({ description: 'bot' }), unknown],
      migratedFromChatId: bigInt(10),
      migratedFromMaxId: 11,
      pinnedMsgId: 12,
      stickerset: new Api.StickerSet({
        id: bigInt(13),
        accessHash: bigInt(14),
        title: 'Pack',
      } as any),
      availableMinId: 15,
      folderId: 16,
      linkedChatId: bigInt(17),
      location: new Api.ChannelLocationEmpty(),
      slowmodeSeconds: 18,
      slowmodeNextSendDate: 19,
      statsDc: 20,
      pts: 21,
      call: new Api.InputGroupCall({ id: bigInt(22), accessHash: bigInt(23) }),
      ttlPeriod: 24,
      pendingSuggestions: ['s'],
      groupcallDefaultJoinAs: new Api.PeerChat({ chatId: bigInt(25) }),
      themeEmoticon: '🎨',
      requestsPending: 26,
      recentRequesters: [bigInt(27)],
      defaultSendAs: new Api.PeerUser({ userId: bigInt(28) }),
      availableReactions: new Api.ChatReactionsNone(),
      reactionsLimit: 29,
      stories: new Api.PeerStories({
        peer: new Api.PeerChannel({ channelId: bigInt(1) }),
        maxReadId: 30,
        stories: [],
      }),
      wallpaper: new Api.WallPaperNoFile({ id: bigInt(31) } as any),
      boostsApplied: 32,
      boostsUnrestrict: 33,
      emojiset: new Api.StickerSet({
        id: bigInt(34),
        accessHash: bigInt(35),
        title: 'Emoji',
      } as any),
    } as any);
    Object.assign(channelFull, {
      stargiftsAvailable: true,
      stargiftsCount: 36,
      botVerification: { className: 'BotVerification', botId: bigInt(37), icon: bigInt(38) },
    });

    expect(convertChannelFull(channelFull)).toMatchObject({
      canViewParticipants: true,
      paidReactionsAvailable: true,
      stargiftsAvailable: true,
      id: '-1000000000001',
      about: 'about',
      participantsCount: 2,
      readInboxMaxId: 7,
      unreadCount: 9,
      chatPhoto: { id: '20' },
      notifySettings: { silent: true },
      exportedInvite: { link: 'l' },
      botInfo: [{ description: 'bot' }],
      migratedFromChatId: '-10',
      migratedFromMaxId: 11,
      pinnedMsgId: 12,
      stickerset: { id: '13', title: 'Pack' },
      availableMinId: 15,
      folderId: 16,
      linkedChatId: '-1000000000017',
      location: {},
      slowmodeSeconds: 18,
      statsDc: 20,
      pts: 21,
      call: { id: '22', accessHash: '23' },
      ttlPeriod: 24,
      pendingSuggestions: ['s'],
      groupcallDefaultJoinAs: { chatId: '-25' },
      themeEmoticon: '🎨',
      recentRequesters: ['27'],
      defaultSendAs: { userId: '28' },
      availableReactions: {},
      reactionsLimit: 29,
      stories: { maxReadId: 30 },
      wallpaper: { id: '31' },
      boostsApplied: 32,
      boostsUnrestrict: 33,
      emojiset: { id: '34', title: 'Emoji' },
      botVerification: { botId: '37', icon: '38' },
      stargiftsCount: 36,
    });
  });

  it('defaults missing channel full fields', () => {
    const channelFull = new Api.ChannelFull({ id: bigInt(1) } as any);
    expect(convertChannelFull(channelFull)).toMatchObject({
      canViewParticipants: false,
      blocked: false,
      stargiftsAvailable: false,
      id: '-1000000000001',
      about: '',
      readInboxMaxId: 0,
      readOutboxMaxId: 0,
      unreadCount: 0,
      chatPhoto: undefined,
      exportedInvite: undefined,
      botInfo: [],
      migratedFromChatId: undefined,
      stickerset: undefined,
      linkedChatId: undefined,
      location: undefined,
      pts: 0,
      call: undefined,
      groupcallDefaultJoinAs: undefined,
      recentRequesters: undefined,
      defaultSendAs: undefined,
      availableReactions: undefined,
      stories: undefined,
      wallpaper: undefined,
      emojiset: undefined,
      botVerification: undefined,
      stargiftsCount: undefined,
    });
  });
});
