import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import {
  convertMessage,
  convertMessageEmpty,
  convertMessageService,
  convertMessages,
} from './message.converter';

const unknown = { className: 'TotallyUnknown' } as any;

const peerUser = (id = 1) => new Api.PeerUser({ userId: bigInt(id) });
const peerChat = (id = 2) => new Api.PeerChat({ chatId: bigInt(id) });
const peerChannel = (id = 3) => new Api.PeerChannel({ channelId: bigInt(id) });

const photo = () =>
  new Api.Photo({
    id: bigInt(50),
    accessHash: bigInt(51),
    fileReference: Buffer.from([104, 105]),
    date: 1,
    sizes: [],
    dcId: 2,
  });

const message = (overrides: Record<string, unknown> = {}) => {
  const msg = new Api.Message({ id: 1, peerId: peerUser(), date: 10, message: 'hi' });
  // GramJS's custom Message constructor drops non-empty media, so fields are applied after init.
  Object.assign(msg, overrides);
  return msg;
};

const service = (action: Api.TypeMessageAction, overrides: Record<string, unknown> = {}) => {
  const msg = new Api.MessageService({ id: 2, peerId: peerUser(), date: 20, action });
  Object.assign(msg, overrides);
  return msg;
};

/** Run an action through the public `convertMessageService` entry point. */
const actionOf = (action: Api.TypeMessageAction) => convertMessageService(service(action)).action;

/** Run media through the public `convertMessage` entry point. */
const mediaOf = (media: Api.TypeMessageMedia) => convertMessage(message({ media })).media;

/** Run reply markup through the public `convertMessage` entry point. */
const markupOf = (replyMarkup: Api.TypeReplyMarkup) =>
  convertMessage(message({ replyMarkup })).reply_markup;

describe('convertMessageEmpty', () => {
  it('maps an empty message with a peer', () => {
    const empty = new Api.MessageEmpty({ id: 5, peerId: peerChat() });
    expect(convertMessageEmpty(empty)).toEqual({ id: 5, peerId: { chatId: '-2' } });
  });

  it('maps an empty message without a peer', () => {
    expect(convertMessageEmpty(new Api.MessageEmpty({ id: 5 }))).toEqual({
      id: 5,
      peerId: undefined,
    });
  });
});

describe('convertMessageService', () => {
  it('maps all flags and optional fields', () => {
    const svc = service(new Api.MessageActionPinMessage(), {
      out: true,
      mentioned: true,
      mediaUnread: true,
      silent: true,
      post: true,
      legacy: true,
      fromId: peerChannel(),
      replyTo: new Api.MessageReplyHeader({ replyToMsgId: 3 }),
      ttlPeriod: 60,
    });
    expect(convertMessageService(svc)).toMatchObject({
      out: true,
      mentioned: true,
      media_unread: true,
      silent: true,
      post: true,
      legacy: true,
      id: 2,
      from_id: { channelId: '-1000000000003' },
      peer_id: { userId: '1' },
      reply_to: expect.objectContaining({ replyToMsgId: 3 }),
      date: 20,
      action: { type: 'pinMessage', isPin: true },
      ttl_period: 60,
    });
  });

  it('defaults flags and leaves optional fields undefined', () => {
    expect(convertMessageService(service(new Api.MessageActionHistoryClear()))).toMatchObject({
      out: false,
      mentioned: false,
      media_unread: false,
      silent: false,
      post: false,
      legacy: false,
      from_id: undefined,
      reply_to: undefined,
      ttl_period: undefined,
    });
  });
});

describe('message actions', () => {
  it.each([
    ['MessageActionEmpty', () => new Api.MessageActionEmpty()],
    ['MessageActionChatDeletePhoto', () => new Api.MessageActionChatDeletePhoto()],
    ['MessageActionHistoryClear', () => new Api.MessageActionHistoryClear()],
    ['MessageActionScreenshotTaken', () => new Api.MessageActionScreenshotTaken()],
    ['MessageActionContactSignUp', () => new Api.MessageActionContactSignUp()],
    ['MessageActionChatJoinedByRequest', () => new Api.MessageActionChatJoinedByRequest()],
  ])('maps %s to an empty marker', (_label, build) => {
    expect(actionOf(build())).toEqual({});
  });

  it('maps MessageActionPinMessage', () => {
    expect(actionOf(new Api.MessageActionPinMessage())).toEqual({
      type: 'pinMessage',
      isPin: true,
    });
  });

  it('maps MessageActionChatCreate', () => {
    const action = new Api.MessageActionChatCreate({
      title: 'Group',
      users: [bigInt(1), bigInt(2)],
    });
    expect(actionOf(action)).toEqual({ title: 'Group', users: ['1', '2'] });
  });

  it('maps MessageActionChatEditTitle', () => {
    expect(actionOf(new Api.MessageActionChatEditTitle({ title: 'New' }))).toEqual({
      title: 'New',
    });
  });

  it('maps MessageActionChatEditPhoto', () => {
    const apiPhoto = photo();
    expect(actionOf(new Api.MessageActionChatEditPhoto({ photo: apiPhoto }))).toEqual({
      photo: apiPhoto,
    });
  });

  it('maps MessageActionChatAddUser', () => {
    expect(actionOf(new Api.MessageActionChatAddUser({ users: [bigInt(4)] }))).toEqual({
      users: ['4'],
    });
  });

  it('maps MessageActionChatDeleteUser', () => {
    expect(actionOf(new Api.MessageActionChatDeleteUser({ userId: bigInt(4) }))).toEqual({
      userId: '4',
    });
  });

  it('maps MessageActionChatJoinedByLink', () => {
    expect(actionOf(new Api.MessageActionChatJoinedByLink({ inviterId: bigInt(4) }))).toEqual({
      inviterId: '4',
    });
  });

  it('maps MessageActionChannelCreate', () => {
    expect(actionOf(new Api.MessageActionChannelCreate({ title: 'Ch' }))).toEqual({ title: 'Ch' });
  });

  it('maps MessageActionChatMigrateTo', () => {
    expect(actionOf(new Api.MessageActionChatMigrateTo({ channelId: bigInt(6) }))).toEqual({
      channelId: '6',
    });
  });

  it('maps MessageActionChannelMigrateFrom', () => {
    const action = new Api.MessageActionChannelMigrateFrom({ title: 'Old', chatId: bigInt(7) });
    expect(actionOf(action)).toEqual({ title: 'Old', chatId: '7' });
  });

  it('maps MessageActionGameScore', () => {
    const action = new Api.MessageActionGameScore({ gameId: bigInt(8), score: 42 });
    expect(actionOf(action)).toEqual({ gameId: '8', score: 42 });
  });

  it('maps MessageActionPaymentSentMe', () => {
    const action = new Api.MessageActionPaymentSentMe({
      recurringInit: true,
      recurringUsed: true,
      currency: 'USD',
      totalAmount: bigInt(999),
      payload: Buffer.from([1]),
      charge: new Api.PaymentCharge({ id: 'c1', providerChargeId: 'p1' }),
    });
    expect(actionOf(action)).toEqual({
      recurringInit: true,
      recurringUsed: true,
      currency: 'USD',
      totalAmount: '999',
      payload: Buffer.from([1]),
      charge: { id: 'c1', providerChargeId: 'p1' },
    });
  });

  it('defaults MessageActionPaymentSentMe recurring flags', () => {
    const action = new Api.MessageActionPaymentSentMe({
      currency: 'USD',
      totalAmount: bigInt(1),
      payload: Buffer.from([1]),
      charge: new Api.PaymentCharge({ id: 'c', providerChargeId: 'p' }),
    } as any);
    expect(actionOf(action)).toMatchObject({ recurringInit: false, recurringUsed: false });
  });

  it('maps MessageActionPaymentSent', () => {
    const action = new Api.MessageActionPaymentSent({
      recurringInit: true,
      recurringUsed: true,
      currency: 'EUR',
      totalAmount: bigInt(10),
      invoiceSlug: 'slug',
    });
    expect(actionOf(action)).toEqual({
      recurringInit: true,
      recurringUsed: true,
      currency: 'EUR',
      totalAmount: '10',
      invoiceSlug: 'slug',
    });
  });

  it('defaults MessageActionPaymentSent flags', () => {
    const action = new Api.MessageActionPaymentSent({
      currency: 'EUR',
      totalAmount: bigInt(10),
    } as any);
    expect(actionOf(action)).toMatchObject({
      recurringInit: false,
      recurringUsed: false,
      invoiceSlug: undefined,
    });
  });

  it('maps MessageActionPhoneCall', () => {
    const reason = new Api.PhoneCallDiscardReasonHangup();
    const action = new Api.MessageActionPhoneCall({
      video: true,
      callId: bigInt(11),
      reason,
      duration: 30,
    });
    expect(actionOf(action)).toEqual({
      video: true,
      callId: '11',
      reason,
      duration: 30,
    });
  });

  it('defaults the MessageActionPhoneCall video flag', () => {
    const action = new Api.MessageActionPhoneCall({ callId: bigInt(11) } as any);
    expect(actionOf(action)).toMatchObject({ video: false, reason: undefined, duration: undefined });
  });

  it('maps MessageActionCustomAction', () => {
    expect(actionOf(new Api.MessageActionCustomAction({ message: 'custom' }))).toEqual({
      message: 'custom',
    });
  });

  it('maps MessageActionBotAllowed', () => {
    const app = new Api.BotAppNotModified();
    const action = new Api.MessageActionBotAllowed({
      attachMenu: true,
      fromRequest: true,
      domain: 'example.com',
      app,
    });
    expect(actionOf(action)).toEqual({
      attachMenu: true,
      fromRequest: true,
      domain: 'example.com',
      app,
    });
  });

  it('defaults MessageActionBotAllowed flags', () => {
    expect(actionOf(new Api.MessageActionBotAllowed({}))).toEqual({
      attachMenu: false,
      fromRequest: false,
      domain: undefined,
      app: undefined,
    });
  });

  it('maps MessageActionSecureValuesSentMe', () => {
    const credentials = new Api.SecureCredentialsEncrypted({
      data: Buffer.from([1]),
      hash: Buffer.from([2]),
      secret: Buffer.from([3]),
    });
    const action = new Api.MessageActionSecureValuesSentMe({ values: [], credentials });
    expect(actionOf(action)).toEqual({ values: [], credentials });
  });

  it('maps MessageActionSecureValuesSent', () => {
    const types = [new Api.SecureValueTypePhone()];
    expect(actionOf(new Api.MessageActionSecureValuesSent({ types }))).toEqual({ types });
  });

  it('maps MessageActionGeoProximityReached', () => {
    const action = new Api.MessageActionGeoProximityReached({
      fromId: peerUser(1),
      toId: peerChat(2),
      distance: 500,
    });
    expect(actionOf(action)).toEqual({
      fromId: { userId: '1' },
      toId: { chatId: '-2' },
      distance: 500,
    });
  });

  it('maps MessageActionGroupCall', () => {
    const call = new Api.InputGroupCall({ id: bigInt(1), accessHash: bigInt(2) });
    const action = new Api.MessageActionGroupCall({ call, duration: 120 });
    expect(actionOf(action)).toEqual({ call, duration: 120 });
  });

  it('maps MessageActionInviteToGroupCall', () => {
    const call = new Api.InputGroupCall({ id: bigInt(1), accessHash: bigInt(2) });
    const action = new Api.MessageActionInviteToGroupCall({ call, users: [bigInt(3)] });
    expect(actionOf(action)).toEqual({ call, users: ['3'] });
  });

  it('maps MessageActionSetMessagesTTL', () => {
    const action = new Api.MessageActionSetMessagesTTL({
      period: 86400,
      autoSettingFrom: bigInt(9),
    });
    expect(actionOf(action)).toEqual({ period: 86400, autoSettingFrom: '9' });
  });

  it('leaves MessageActionSetMessagesTTL autoSettingFrom undefined when absent', () => {
    expect(actionOf(new Api.MessageActionSetMessagesTTL({ period: 1 }))).toEqual({
      period: 1,
      autoSettingFrom: undefined,
    });
  });

  it('maps MessageActionGroupCallScheduled', () => {
    const call = new Api.InputGroupCall({ id: bigInt(1), accessHash: bigInt(2) });
    const action = new Api.MessageActionGroupCallScheduled({ call, scheduleDate: 500 });
    expect(actionOf(action)).toEqual({ call, scheduleDate: 500 });
  });

  it('maps MessageActionSetChatTheme', () => {
    expect(actionOf(new Api.MessageActionSetChatTheme({ theme: new Api.ChatTheme({ emoticon: '🌈' }) }))).toEqual({
      emoticon: '🌈',
    });
  });

  it('maps MessageActionWebViewDataSentMe', () => {
    const action = new Api.MessageActionWebViewDataSentMe({ text: 'btn', data: '{}' });
    expect(actionOf(action)).toEqual({ text: 'btn', data: '{}' });
  });

  it('maps MessageActionWebViewDataSent', () => {
    expect(actionOf(new Api.MessageActionWebViewDataSent({ text: 'btn' }))).toEqual({
      text: 'btn',
    });
  });

  it('maps MessageActionGiftPremium', () => {
    const action = new Api.MessageActionGiftPremium({
      currency: 'USD',
      amount: bigInt(100),
      days: 3,
      cryptoCurrency: 'TON',
      cryptoAmount: bigInt(5),
    });
    expect(actionOf(action)).toEqual({
      currency: 'USD',
      amount: '100',
      months: 3,
      cryptoCurrency: 'TON',
      cryptoAmount: '5',
    });
  });

  it('leaves MessageActionGiftPremium crypto amount undefined when absent', () => {
    const action = new Api.MessageActionGiftPremium({
      currency: 'USD',
      amount: bigInt(100),
      days: 3,
    });
    expect(actionOf(action)).toMatchObject({ cryptoAmount: undefined });
  });

  it('maps MessageActionTopicCreate', () => {
    const action = new Api.MessageActionTopicCreate({
      title: 'Topic',
      iconColor: 7,
      iconEmojiId: bigInt(12),
    });
    expect(actionOf(action)).toEqual({ title: 'Topic', iconColor: 7, iconEmojiId: '12' });
  });

  it('leaves MessageActionTopicCreate emoji id undefined when absent', () => {
    const action = new Api.MessageActionTopicCreate({ title: 'Topic', iconColor: 7 });
    expect(actionOf(action)).toMatchObject({ iconEmojiId: undefined });
  });

  it('maps MessageActionTopicEdit', () => {
    const action = new Api.MessageActionTopicEdit({
      title: 'Edited',
      iconEmojiId: bigInt(13),
      closed: true,
      hidden: true,
    });
    expect(actionOf(action)).toEqual({
      title: 'Edited',
      iconEmojiId: '13',
      closed: true,
      hidden: true,
    });
  });

  it('leaves MessageActionTopicEdit fields undefined when absent', () => {
    expect(actionOf(new Api.MessageActionTopicEdit({}))).toEqual({
      title: undefined,
      iconEmojiId: undefined,
      closed: undefined,
      hidden: undefined,
    });
  });

  it('maps MessageActionSuggestProfilePhoto', () => {
    const action = new Api.MessageActionSuggestProfilePhoto({ photo: photo() });
    expect(actionOf(action)).toEqual({ photo: expect.objectContaining({ id: '50' }) });
  });

  it('maps MessageActionRequestedPeer', () => {
    const action = new Api.MessageActionRequestedPeer({
      buttonId: 1,
      peers: [peerUser(1), peerChat(2), peerChannel(3)],
    });
    expect(actionOf(action)).toEqual({
      buttonId: 1,
      peers: [{ userId: '1' }, { chatId: '-2' }, { channelId: '-1000000000003' }],
    });
  });

  it('maps MessageActionSetChatWallPaper', () => {
    const wallpaper = new Api.WallPaperNoFile({ id: bigInt(1) } as any);
    const action = new Api.MessageActionSetChatWallPaper({
      same: true,
      forBoth: true,
      wallpaper,
    });
    expect(actionOf(action)).toEqual({ same: true, forBoth: true, wallpaper });
  });

  it('defaults MessageActionSetChatWallPaper flags', () => {
    const wallpaper = new Api.WallPaperNoFile({ id: bigInt(1) } as any);
    expect(actionOf(new Api.MessageActionSetChatWallPaper({ wallpaper }))).toMatchObject({
      same: false,
      forBoth: false,
    });
  });

  it('maps MessageActionGiftCode with a boost peer', () => {
    const action = new Api.MessageActionGiftCode({
      viaGiveaway: true,
      unclaimed: true,
      boostPeer: peerChannel(3),
      days: 6,
      slug: 'slug',
      currency: 'USD',
      amount: bigInt(200),
      cryptoCurrency: 'TON',
      cryptoAmount: bigInt(2),
    });
    expect(actionOf(action)).toEqual({
      viaGiveaway: true,
      unclaimed: true,
      boostPeer: { channelId: '-1000000000003' },
      months: 6,
      slug: 'slug',
      currency: 'USD',
      amount: '200',
      cryptoCurrency: 'TON',
      cryptoAmount: '2',
    });
  });

  it('defaults MessageActionGiftCode optional fields', () => {
    const action = new Api.MessageActionGiftCode({ days: 1, slug: 's' });
    expect(actionOf(action)).toMatchObject({
      viaGiveaway: false,
      unclaimed: false,
      boostPeer: undefined,
      amount: undefined,
      cryptoAmount: undefined,
    });
  });

  it('maps MessageActionGiveawayLaunch', () => {
    const action = new Api.MessageActionGiveawayLaunch({ stars: bigInt(5) });
    expect(actionOf(action)).toEqual({ stars: '5' });
  });

  it('leaves MessageActionGiveawayLaunch stars undefined when absent', () => {
    expect(actionOf(new Api.MessageActionGiveawayLaunch({}))).toEqual({ stars: undefined });
  });

  it('maps MessageActionGiveawayResults', () => {
    const action = new Api.MessageActionGiveawayResults({
      stars: true,
      winnersCount: 3,
      unclaimedCount: 1,
    });
    expect(actionOf(action)).toEqual({ stars: true, winnersCount: 3, unclaimedCount: 1 });
  });

  it('defaults the MessageActionGiveawayResults stars flag', () => {
    const action = new Api.MessageActionGiveawayResults({ winnersCount: 3, unclaimedCount: 1 });
    expect(actionOf(action)).toMatchObject({ stars: false });
  });

  it('maps MessageActionBoostApply', () => {
    expect(actionOf(new Api.MessageActionBoostApply({ boosts: 4 }))).toEqual({
      type: 'boostApply',
      boosts: 4,
    });
  });

  it('maps MessageActionRequestedPeerSentMe with every requested peer variant', () => {
    const action = new Api.MessageActionRequestedPeerSentMe({
      buttonId: 2,
      peers: [
        new Api.RequestedPeerUser({
          userId: bigInt(1),
          firstName: 'A',
          lastName: 'B',
          username: 'ab',
          photo: photo(),
        }),
        new Api.RequestedPeerChat({ chatId: bigInt(2), title: 'Chat', photo: photo() }),
        new Api.RequestedPeerChannel({
          channelId: bigInt(3),
          title: 'Channel',
          username: 'ch',
          photo: photo(),
        }),
      ],
    });
    expect(actionOf(action)).toMatchObject({
      buttonId: 2,
      peers: [
        { userId: '1', firstName: 'A', lastName: 'B', username: 'ab' },
        { chatId: '-2', title: 'Chat' },
        { channelId: '-1000000000003', title: 'Channel', username: 'ch' },
      ],
    });
  });

  it('leaves requested peer photos undefined when absent', () => {
    const action = new Api.MessageActionRequestedPeerSentMe({
      buttonId: 2,
      peers: [
        new Api.RequestedPeerUser({ userId: bigInt(1) }),
        new Api.RequestedPeerChat({ chatId: bigInt(2) }),
        new Api.RequestedPeerChannel({ channelId: bigInt(3) }),
      ],
    });
    const converted = actionOf(action) as { peers: Array<{ photo?: unknown }> };
    expect(converted.peers.map((peer) => peer.photo)).toEqual([undefined, undefined, undefined]);
  });

  it('throws for an unknown requested peer', () => {
    const action = new Api.MessageActionRequestedPeerSentMe({ buttonId: 2, peers: [unknown] });
    expect(() => actionOf(action)).toThrow('Invalid requested peer');
  });

  it('maps MessageActionPaymentRefunded', () => {
    const action = new Api.MessageActionPaymentRefunded({
      peer: peerUser(1),
      currency: 'USD',
      totalAmount: bigInt(300),
      payload: Buffer.from([1]),
      charge: new Api.PaymentCharge({ id: 'c', providerChargeId: 'p' }),
    });
    expect(actionOf(action)).toEqual({
      peer: { userId: '1' },
      currency: 'USD',
      totalAmount: '300',
      payload: Buffer.from([1]),
      charge: { id: 'c', providerChargeId: 'p' },
    });
  });

  it('maps MessageActionGiftStars', () => {
    const action = new Api.MessageActionGiftStars({
      currency: 'USD',
      amount: bigInt(10),
      stars: bigInt(20),
      cryptoCurrency: 'TON',
      cryptoAmount: bigInt(30),
    });
    expect(actionOf(action)).toEqual({
      currency: 'USD',
      amount: '10',
      stars: '20',
      cryptoCurrency: 'TON',
      cryptoAmount: '30',
    });
  });

  it('leaves MessageActionGiftStars crypto amount undefined when absent', () => {
    const action = new Api.MessageActionGiftStars({
      currency: 'USD',
      amount: bigInt(10),
      stars: bigInt(20),
    });
    expect(actionOf(action)).toMatchObject({ cryptoAmount: undefined });
  });

  it('maps MessageActionPrizeStars', () => {
    const action = new Api.MessageActionPrizeStars({
      unclaimed: true,
      stars: bigInt(40),
      transactionId: 'tx',
      boostPeer: peerChannel(3),
      giveawayMsgId: 9,
    });
    expect(actionOf(action)).toEqual({
      unclaimed: true,
      stars: '40',
      transactionId: 'tx',
      boostPeer: { channelId: '-1000000000003' },
      giveawayMsgId: 9,
    });
  });

  it('defaults the MessageActionPrizeStars unclaimed flag', () => {
    const action = new Api.MessageActionPrizeStars({
      stars: bigInt(40),
      transactionId: 'tx',
      boostPeer: peerChannel(3),
      giveawayMsgId: 9,
    });
    expect(actionOf(action)).toMatchObject({ unclaimed: false });
  });

  it('maps MessageActionStarGift', () => {
    const gift = { className: 'StarGift', id: bigInt(1) } as any;
    const action = new Api.MessageActionStarGift({
      nameHidden: true,
      saved: true,
      converted: true,
      gift,
    } as any);
    Object.assign(action, { upgraded: true, fromId: peerUser(1) });
    expect(actionOf(action)).toEqual({
      nameHidden: true,
      saved: true,
      converted: true,
      upgraded: true,
      fromId: { userId: '1' },
      gift,
    });
  });

  it('defaults MessageActionStarGift flags', () => {
    const gift = { className: 'StarGift' } as any;
    const action = new Api.MessageActionStarGift({ gift } as any);
    expect(actionOf(action)).toMatchObject({
      nameHidden: false,
      saved: false,
      converted: false,
      upgraded: false,
      fromId: undefined,
    });
  });

  it('maps a duck-typed MessageActionStarGiftUnique', () => {
    const gift = { className: 'StarGiftUnique' };
    const action = {
      className: 'MessageActionStarGiftUnique',
      upgrade: true,
      transferred: true,
      saved: true,
      refunded: true,
      fromId: peerUser(1),
      gift,
    } as any;
    expect(actionOf(action)).toEqual({
      upgrade: true,
      transferred: true,
      saved: true,
      refunded: true,
      fromId: { userId: '1' },
      gift,
    });
  });

  it('defaults duck-typed MessageActionStarGiftUnique flags', () => {
    const action = { className: 'MessageActionStarGiftUnique' } as any;
    expect(actionOf(action)).toEqual({
      upgrade: false,
      transferred: false,
      saved: false,
      refunded: false,
      fromId: undefined,
      gift: undefined,
    });
  });

  it('passes through unknown actions', () => {
    expect(actionOf(unknown)).toBe(unknown);
  });
});

describe('message media', () => {
  it.each([
    ['MessageMediaEmpty', () => new Api.MessageMediaEmpty()],
    ['MessageMediaUnsupported', () => new Api.MessageMediaUnsupported()],
    ['MessageMediaPaidMedia', () =>
      new Api.MessageMediaPaidMedia({ starsAmount: bigInt(1), extendedMedia: [] })],
  ])('maps %s to an empty marker', (_label, build) => {
    expect(mediaOf(build())).toEqual({});
  });

  it('maps MessageMediaPhoto', () => {
    const apiPhoto = photo();
    const media = new Api.MessageMediaPhoto({
      spoiler: true,
      photo: apiPhoto,
      ttlSeconds: 10,
    });
    expect(mediaOf(media)).toEqual({
      spoiler: true,
      photo: {
        hasStickers: false,
        id: '50',
        accessHash: '51',
        fileReference: 'aGk=',
        date: 1,
        sizes: [],
        videoSizes: undefined,
        dcId: 2,
      },
      ttlSeconds: 10,
    });
  });

  it('defaults the MessageMediaPhoto spoiler flag', () => {
    expect(mediaOf(new Api.MessageMediaPhoto({}))).toEqual({
      spoiler: false,
      photo: undefined,
      ttlSeconds: undefined,
    });
  });

  it('maps MessageMediaGeo', () => {
    const geo = new Api.GeoPoint({ long: 1, lat: 2, accessHash: bigInt(3) } as any);
    expect(mediaOf(new Api.MessageMediaGeo({ geo }))).toEqual({ geo });
  });

  it('maps MessageMediaContact', () => {
    const media = new Api.MessageMediaContact({
      phoneNumber: '+1',
      firstName: 'A',
      lastName: 'B',
      vcard: 'v',
      userId: bigInt(4),
    });
    expect(mediaOf(media)).toEqual({
      phoneNumber: '+1',
      firstName: 'A',
      lastName: 'B',
      vcard: 'v',
      userId: '4',
    });
  });

  it('maps MessageMediaDocument', () => {
    const document = new Api.Document({
      id: bigInt(1),
      accessHash: bigInt(2),
      fileReference: Buffer.from([1]),
      date: 1,
      mimeType: 'image/png',
      size: bigInt(1),
      dcId: 1,
      attributes: [],
    });
    const media = new Api.MessageMediaDocument({ spoiler: true, document, ttlSeconds: 5 });
    expect(mediaOf(media)).toEqual({
      nopremium: undefined,
      spoiler: true,
      video: false,
      round: false,
      voice: false,
      document: {
        id: '1',
        accessHash: '2',
        fileReference: 'AQ==',
        date: 1,
        mimeType: 'image/png',
        size: '1',
        thumbs: undefined,
        videoThumbs: undefined,
        dcId: 1,
        attributes: [],
      },
      altDocuments: undefined,
      videoCover: undefined,
      videoTimestamp: undefined,
      ttlSeconds: 5,
    });
  });

  it('sets video flags from DocumentAttributeVideo', () => {
    const document = new Api.Document({
      id: bigInt(1),
      accessHash: bigInt(2),
      fileReference: Buffer.from([1]),
      date: 1,
      mimeType: 'video/mp4',
      size: bigInt(1),
      dcId: 1,
      attributes: [
        new Api.DocumentAttributeVideo({
          duration: 3,
          w: 4,
          h: 5,
          roundMessage: true,
        }),
      ],
    });
    expect(mediaOf(new Api.MessageMediaDocument({ document }))).toMatchObject({
      video: true,
      round: true,
      voice: false,
    });
  });

  it('sets voice from DocumentAttributeAudio', () => {
    const document = new Api.Document({
      id: bigInt(1),
      accessHash: bigInt(2),
      fileReference: Buffer.from([1]),
      date: 1,
      mimeType: 'audio/ogg',
      size: bigInt(1),
      dcId: 1,
      attributes: [new Api.DocumentAttributeAudio({ voice: true, duration: 2 })],
    });
    expect(mediaOf(new Api.MessageMediaDocument({ document }))).toMatchObject({
      video: false,
      round: false,
      voice: true,
    });
  });

  it('defaults the MessageMediaDocument spoiler flag', () => {
    expect(mediaOf(new Api.MessageMediaDocument({}))).toMatchObject({ spoiler: false });
  });

  it('maps MessageMediaWebPage', () => {
    const webpage = new Api.WebPage({
      id: bigInt(99),
      url: 'https://t.me/tailwindcss_tips',
      displayUrl: 't.me/tailwindcss_tips',
      hash: 0,
      siteName: 'Telegram',
      title: 'Tailwind CSS Tips',
      description: 'Learn the most popular utility-first framework.',
      photo: photo(),
    });
    expect(mediaOf(new Api.MessageMediaWebPage({ webpage, forceLargeMedia: true }))).toEqual({
      forceLargeMedia: true,
      forceSmallMedia: undefined,
      manual: undefined,
      safe: undefined,
      webpage: {
        hasLargeMedia: undefined,
        id: '99',
        url: 'https://t.me/tailwindcss_tips',
        displayUrl: 't.me/tailwindcss_tips',
        hash: 0,
        siteName: 'Telegram',
        title: 'Tailwind CSS Tips',
        description: 'Learn the most popular utility-first framework.',
        photo: {
          hasStickers: false,
          id: '50',
          accessHash: '51',
          fileReference: 'aGk=',
          date: 1,
          sizes: [],
          videoSizes: undefined,
          dcId: 2,
        },
        embedUrl: undefined,
        embedType: undefined,
        embedWidth: undefined,
        embedHeight: undefined,
        duration: undefined,
        author: undefined,
        document: undefined,
      },
    });
  });

  it('maps MessageMediaVenue', () => {
    const geo = new Api.GeoPointEmpty();
    const media = new Api.MessageMediaVenue({
      geo,
      title: 'T',
      address: 'A',
      provider: 'P',
      venueId: 'V',
      venueType: 'VT',
    });
    expect(mediaOf(media)).toEqual({
      geo,
      title: 'T',
      address: 'A',
      provider: 'P',
      venueId: 'V',
      venueType: 'VT',
    });
  });

  it('maps MessageMediaGame', () => {
    const game = new Api.Game({
      id: bigInt(1),
      accessHash: bigInt(2),
      shortName: 'g',
      title: 'G',
      description: 'D',
      photo: photo(),
    });
    expect(mediaOf(new Api.MessageMediaGame({ game }))).toEqual({ game });
  });

  it('maps MessageMediaInvoice', () => {
    const media = new Api.MessageMediaInvoice({
      shippingAddressRequested: true,
      test: true,
      title: 'T',
      description: 'D',
      photo: new Api.WebDocumentNoProxy({
        url: 'http://u',
        size: 1,
        mimeType: 'image/png',
        attributes: [],
      }),
      currency: 'USD',
      totalAmount: bigInt(100),
      startParam: 'sp',
      receiptMsgId: 3,
    });
    expect(mediaOf(media)).toMatchObject({
      shippingAddressRequested: true,
      test: true,
      title: 'T',
      description: 'D',
      currency: 'USD',
      totalAmount: '100',
      startParam: 'sp',
      receiptMsgId: 3,
      extendedMedia: undefined,
    });
  });

  it('defaults MessageMediaInvoice flags', () => {
    const media = new Api.MessageMediaInvoice({
      title: 'T',
      description: 'D',
      currency: 'USD',
      totalAmount: bigInt(1),
      startParam: '',
    } as any);
    expect(mediaOf(media)).toMatchObject({ shippingAddressRequested: false, test: false });
  });

  it('maps MessageMediaGeoLive', () => {
    const geo = new Api.GeoPointEmpty();
    const media = new Api.MessageMediaGeoLive({
      geo,
      heading: 90,
      period: 60,
      proximityNotificationRadius: 100,
    });
    expect(mediaOf(media)).toEqual({
      geo,
      heading: 90,
      period: 60,
      proximityNotificationRadius: 100,
    });
  });

  it('maps MessageMediaPoll', () => {
    const poll = new Api.Poll({
      id: bigInt(1),
      question: new Api.TextWithEntities({ text: 'Q', entities: [] }),
      answers: [],
    });
    const results = new Api.PollResults({});
    expect(mediaOf(new Api.MessageMediaPoll({ poll, results }))).toEqual({ poll, results });
  });

  it('maps MessageMediaDice', () => {
    const media = new Api.MessageMediaDice({ value: 5, emoticon: '🎲' });
    expect(mediaOf(media)).toEqual({ value: 5, emoticon: '🎲' });
  });

  it('maps MessageMediaStory', () => {
    const story = new Api.StoryItemDeleted({ id: 4 });
    const media = new Api.MessageMediaStory({ peer: peerChat(2), id: 4, story });
    expect(mediaOf(media)).toEqual({ peer: { chatId: '-2' }, id: 4, story });
  });

  it('maps MessageMediaGiveaway', () => {
    const media = new Api.MessageMediaGiveaway({
      onlyNewSubscribers: true,
      channels: [bigInt(1), bigInt(2)],
      countriesIso2: ['US'],
      untilDate: 100,
      quantity: 3,
      months: 6,
      prizeDescription: 'Prize',
    });
    expect(mediaOf(media)).toEqual({
      onlyNewSubscribers: true,
      channels: ['1', '2'],
      countriesIso2: ['US'],
      untilDate: 100,
      quantity: 3,
      months: 6,
      prizeDescription: 'Prize',
    });
  });

  it('defaults MessageMediaGiveaway channels and flags', () => {
    const media = new Api.MessageMediaGiveaway({ quantity: 1, untilDate: 1 } as any);
    expect(mediaOf(media)).toMatchObject({ onlyNewSubscribers: false, channels: [] });
  });

  it('maps MessageMediaGiveawayResults', () => {
    const media = new Api.MessageMediaGiveawayResults({
      onlyNewSubscribers: true,
      channelId: bigInt(7),
      launchMsgId: 8,
      winners: [bigInt(9)],
      untilDate: 10,
      months: 11,
      prizeDescription: 'Prize',
      winnersCount: 12,
      unclaimedCount: 13,
    });
    expect(mediaOf(media)).toEqual({
      onlyNewSubscribers: true,
      channelId: '7',
      launchMsgId: 8,
      winners: ['9'],
      untilDate: 10,
      months: 11,
      prizeDescription: 'Prize',
      winnersCount: 12,
      unclaimedCount: 13,
    });
  });

  it('defaults MessageMediaGiveawayResults winners and flags', () => {
    const media = new Api.MessageMediaGiveawayResults({
      launchMsgId: 1,
      winnersCount: 0,
      unclaimedCount: 0,
      untilDate: 1,
    } as any);
    expect(mediaOf(media)).toMatchObject({
      onlyNewSubscribers: false,
      channelId: undefined,
      winners: [],
    });
  });

  it('passes through unknown media', () => {
    expect(mediaOf(unknown)).toBe(unknown);
  });
});

describe('reply markup', () => {
  it('maps ReplyKeyboardHide', () => {
    expect(markupOf(new Api.ReplyKeyboardHide({ selective: true }))).toEqual({ selective: true });
  });

  it('defaults the ReplyKeyboardHide selective flag', () => {
    expect(markupOf(new Api.ReplyKeyboardHide({}))).toEqual({ selective: false });
  });

  it('maps ReplyKeyboardForceReply', () => {
    const markup = new Api.ReplyKeyboardForceReply({
      singleUse: true,
      selective: true,
      placeholder: 'type…',
    });
    expect(markupOf(markup)).toEqual({
      singleUse: true,
      selective: true,
      placeholder: 'type…',
    });
  });

  it('defaults ReplyKeyboardForceReply flags', () => {
    expect(markupOf(new Api.ReplyKeyboardForceReply({}))).toEqual({
      singleUse: false,
      selective: false,
      placeholder: undefined,
    });
  });

  it('maps ReplyKeyboardMarkup rows', () => {
    const markup = new Api.ReplyKeyboardMarkup({
      resize: true,
      singleUse: true,
      selective: true,
      persistent: true,
      rows: [
        new Api.KeyboardButtonRow({
          buttons: [new Api.KeyboardButton({ text: 'A' }), new Api.KeyboardButton({ text: 'B' })],
        }),
      ],
    });
    expect(markupOf(markup)).toEqual({
      resize: true,
      singleUse: true,
      selective: true,
      persistent: true,
      rows: [{ buttons: [{ text: 'A' }, { text: 'B' }] }],
    });
  });

  it('defaults ReplyKeyboardMarkup flags', () => {
    const markup = new Api.ReplyKeyboardMarkup({ rows: [] });
    expect(markupOf(markup)).toEqual({
      resize: false,
      singleUse: false,
      selective: false,
      persistent: false,
      rows: [],
    });
  });

  it('maps ReplyInlineMarkup rows', () => {
    const markup = new Api.ReplyInlineMarkup({
      rows: [
        new Api.KeyboardButtonRow({
          buttons: [new Api.KeyboardButtonUrl({ text: 'Open', url: 'http://u' })],
        }),
      ],
    });
    expect(markupOf(markup)).toEqual({ rows: [{ buttons: [{ text: 'Open' }] }] });
  });

  it('passes through unknown markup', () => {
    expect(markupOf(unknown)).toBe(unknown);
  });
});

describe('convertMessage', () => {
  it('maps a fully populated message', () => {
    const msg = message({
      out: true,
      mentioned: true,
      mediaUnread: true,
      silent: true,
      post: true,
      fromScheduled: true,
      legacy: true,
      editHide: true,
      pinned: true,
      noforwards: true,
      fromId: peerChannel(3),
      fwdFrom: new Api.MessageFwdHeader({
        imported: true,
        savedOut: true,
        fromId: peerUser(1),
        fromName: 'Name',
        date: 5,
        channelPost: 6,
        postAuthor: 'Author',
        savedFromPeer: peerChat(2),
        savedFromMsgId: 7,
        savedFromId: peerUser(1),
        savedFromName: 'Saved',
        savedDate: 8,
        psaType: 'psa',
      }),
      viaBotId: bigInt(9),
      replyTo: new Api.MessageReplyHeader({
        replyToScheduled: true,
        forumTopic: true,
        quote: true,
        replyToMsgId: 10,
        replyToPeerId: peerChat(2),
        replyFrom: new Api.MessageFwdHeader({ date: 11 } as any),
        replyMedia: new Api.MessageMediaDice({ value: 1, emoticon: '🎲' }),
        replyToTopId: 12,
        quoteText: 'quote',
        quoteEntities: [new Api.MessageEntityBold({ offset: 0, length: 1 })],
        quoteOffset: 13,
      }),
      media: new Api.MessageMediaDice({ value: 2, emoticon: '🎯' }),
      replyMarkup: new Api.ReplyKeyboardHide({ selective: true }),
      entities: [new Api.MessageEntityItalic({ offset: 0, length: 2 })],
      views: 14,
      forwards: 15,
      replies: new Api.MessageReplies({
        comments: true,
        replies: 16,
        repliesPts: 17,
        recentRepliers: [peerUser(1)],
        channelId: bigInt(18),
        maxId: 19,
        readMaxId: 20,
      }),
      editDate: 21,
      postAuthor: 'Post',
      groupedId: bigInt(22),
      reactions: new Api.MessageReactions({
        min: true,
        canSeeList: true,
        reactionsAsTags: true,
        results: [
          new Api.ReactionCount({
            reaction: new Api.ReactionEmoji({ emoticon: '👍' }),
            count: 3,
          }),
        ],
        recentReactions: [
          new Api.MessagePeerReaction({
            peerId: peerUser(1),
            reaction: new Api.ReactionEmoji({ emoticon: '👍' }),
            unread: true,
            date: 23,
          }),
        ],
        topReactors: [new Api.MessageReactor({ peerId: peerUser(1), count: 4 })],
      }),
      restrictionReason: [
        new Api.RestrictionReason({ platform: 'ios', reason: 'r', text: 't' }),
      ],
      ttlPeriod: 24,
    });

    expect(convertMessage(msg)).toMatchObject({
      out: true,
      mentioned: true,
      media_unread: true,
      silent: true,
      post: true,
      from_scheduled: true,
      legacy: true,
      edit_hide: true,
      pinned: true,
      noforwards: true,
      id: 1,
      date: 10,
      message: 'hi',
      peer_id: { userId: '1' },
      from_id: { channelId: '-1000000000003' },
      fwd_from: {
        imported: true,
        savedOut: true,
        fromId: { userId: '1' },
        fromName: 'Name',
        date: 5,
        channelPost: 6,
        postAuthor: 'Author',
        savedFromPeer: { chatId: '-2' },
        savedFromMsgId: 7,
        savedFromId: { userId: '1' },
        savedFromName: 'Saved',
        savedDate: 8,
        psaType: 'psa',
      },
      via_bot_id: '9',
      reply_to: {
        replyToScheduled: true,
        forumTopic: true,
        quote: true,
        replyToMsgId: 10,
        replyToPeerId: { chatId: '-2' },
        replyFrom: { date: 11 },
        replyMedia: { value: 1, emoticon: '🎲' },
        replyToTopId: 12,
        quoteText: 'quote',
        quoteEntities: [{ offset: 0, length: 1 }],
        quoteOffset: 13,
      },
      media: { value: 2, emoticon: '🎯' },
      reply_markup: { selective: true },
      entities: [{ offset: 0, length: 2 }],
      views: 14,
      forwards: 15,
      replies: {
        comments: true,
        replies: 16,
        repliesPts: 17,
        recentRepliers: [{ userId: '1' }],
        channelId: '18',
        maxId: 19,
        readMaxId: 20,
      },
      edit_date: 21,
      post_author: 'Post',
      grouped_id: '22',
      reactions: {
        min: true,
        canSeeList: true,
        reactionsAsTags: true,
        results: [{ reaction: { emoticon: '👍' }, count: 3 }],
        recentReactions: [
          {
            peerId: { userId: '1' },
            reaction: { emoticon: '👍' },
            unread: true,
            date: 23,
            big: false,
            my: false,
          },
        ],
        topReactors: [
          { peerId: { userId: '1' }, count: 4, top: false, my: false, anonymous: false },
        ],
      },
      restriction_reason: [{ platform: 'ios', reason: 'r', text: 't' }],
      ttl_period: 24,
    });
  });

  it('defaults flags and leaves optional fields undefined', () => {
    expect(convertMessage(message())).toEqual({
      out: false,
      mentioned: false,
      media_unread: false,
      silent: false,
      post: false,
      from_scheduled: false,
      legacy: false,
      edit_hide: false,
      pinned: false,
      noforwards: false,
      invert_media: false,
      id: 1,
      date: 10,
      message: 'hi',
      peer_id: { userId: '1' },
      from_id: undefined,
      fwd_from: undefined,
      via_bot_id: undefined,
      reply_to: undefined,
      media: undefined,
      reply_markup: undefined,
      entities: undefined,
      views: undefined,
      forwards: undefined,
      replies: undefined,
      edit_date: undefined,
      post_author: undefined,
      grouped_id: undefined,
      reactions: undefined,
      restriction_reason: undefined,
      ttl_period: undefined,
    });
  });

  it('defaults an empty message body', () => {
    const msg = message();
    Object.assign(msg, { message: undefined });
    expect(convertMessage(msg).message).toBe('');
  });

  it('defaults optional reply header, replies and reactions fields', () => {
    const msg = message({
      replyTo: new Api.MessageReplyHeader({ replyToMsgId: 1 }),
      replies: new Api.MessageReplies({ replies: 0, repliesPts: 0 } as any),
      reactions: new Api.MessageReactions({ results: [] } as any),
    });
    expect(convertMessage(msg)).toMatchObject({
      reply_to: {
        replyToScheduled: false,
        forumTopic: false,
        quote: false,
        replyToPeerId: undefined,
        replyFrom: undefined,
        replyMedia: undefined,
        quoteEntities: undefined,
      },
      replies: {
        comments: false,
        recentRepliers: undefined,
        channelId: undefined,
      },
      reactions: {
        min: false,
        canSeeList: false,
        reactionsAsTags: false,
        results: [],
        recentReactions: undefined,
        topReactors: undefined,
      },
    });
  });

  it('leaves a top reactor peer undefined when absent', () => {
    const msg = message({
      reactions: new Api.MessageReactions({
        results: [],
        topReactors: [new Api.MessageReactor({ count: 1 } as any)],
      } as any),
    });
    expect(convertMessage(msg).reactions?.topReactors).toEqual([
      { peerId: undefined, count: 1, top: false, my: false, anonymous: false },
    ]);
  });

  it('maps reactionsArePossible on service messages', () => {
    const msg = service(new Api.MessageActionHistoryClear(), { reactionsArePossible: true });
    expect(convertMessageService(msg).reactionsArePossible).toBe(true);
  });

  it('converts emoji, custom, and paid reactions with chosen order and recent flags', () => {
    const msg = message({
      reactions: new Api.MessageReactions({
        results: [
          new Api.ReactionCount({
            reaction: new Api.ReactionEmoji({ emoticon: '👍' }),
            count: 2,
            chosenOrder: 0,
          }),
          new Api.ReactionCount({
            reaction: new Api.ReactionCustomEmoji({ documentId: bigInt(9) }),
            count: 1,
          }),
          new Api.ReactionCount({
            reaction: new Api.ReactionPaid(),
            count: 4,
          }),
        ],
        recentReactions: [
          new Api.MessagePeerReaction({
            peerId: peerUser(1),
            reaction: new Api.ReactionEmoji({ emoticon: '👍' }),
            my: true,
            big: true,
            date: 5,
          }),
        ],
      }),
    });

    expect(convertMessage(msg).reactions).toMatchObject({
      results: [
        { reaction: { emoticon: '👍' }, count: 2, chosenOrder: 0 },
        { reaction: { documentId: '9' }, count: 1 },
        { reaction: { paid: true }, count: 4 },
      ],
      recentReactions: [
        {
          reaction: { emoticon: '👍' },
          my: true,
          big: true,
          unread: false,
        },
      ],
    });
  });

  it('defaults the message forward header flags', () => {
    const msg = message({ fwdFrom: new Api.MessageFwdHeader({ date: 1 } as any) });
    expect(convertMessage(msg).fwd_from).toMatchObject({
      imported: false,
      savedOut: false,
      fromId: undefined,
      savedFromPeer: undefined,
      savedFromId: undefined,
    });
  });
});

describe('convertMessages', () => {
  it('splits messages by type and ignores unknown entries', () => {
    const result = convertMessages([
      new Api.MessageEmpty({ id: 1, peerId: peerUser() }),
      service(new Api.MessageActionPinMessage()),
      message(),
      unknown,
    ]);
    expect(result.emptyMessages).toHaveLength(1);
    expect(result.messageServices).toHaveLength(1);
    expect(result.messages).toHaveLength(1);
  });

  it('returns empty buckets for an empty list', () => {
    expect(convertMessages([])).toEqual({
      messages: [],
      emptyMessages: [],
      messageServices: [],
    });
  });
});
