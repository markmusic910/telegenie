import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import {
  convertDialog,
  convertDialogFolder,
  convertDraftMessage,
  convertFolder,
  convertInputReplyTo,
  convertInputReplyToMessage,
  convertInputReplyToStory,
  convertTypeChatPhoto,
  convertTypeInputPeer,
  convertTypeInputPeerExcludeSelf,
  convertTypeNotificationSound,
  convertTypePeer,
  convertTypePeerNotifySettings,
} from './common.converter';

const STRIPPED = Buffer.from([1, 10, 20, 0xaa, 0xbb]);
const unknown = { className: 'TotallyUnknown' } as any;

describe('convertTypePeer', () => {
  it('marks a user peer', () => {
    expect(convertTypePeer(new Api.PeerUser({ userId: bigInt(7) }))).toEqual({ userId: '7' });
  });

  it('marks a chat peer', () => {
    expect(convertTypePeer(new Api.PeerChat({ chatId: bigInt(7) }))).toEqual({ chatId: '-7' });
  });

  it('marks a channel peer', () => {
    expect(convertTypePeer(new Api.PeerChannel({ channelId: bigInt(7) }))).toEqual({
      channelId: '-1000000000007',
    });
  });

  it('throws for a peer without an id field', () => {
    expect(() => convertTypePeer(new Api.InputPeerEmpty())).toThrow('Invalid peer');
  });

  it('throws for null or undefined instead of using `in` on null', () => {
    expect(() => convertTypePeer(null)).toThrow('Invalid peer');
    expect(() => convertTypePeer(undefined)).toThrow('Invalid peer');
  });
});

describe('convertTypeInputPeer', () => {
  it('returns undefined without an input peer', () => {
    expect(convertTypeInputPeer(undefined)).toBeUndefined();
  });

  it('returns undefined for InputPeerEmpty', () => {
    expect(convertTypeInputPeer(new Api.InputPeerEmpty())).toBeUndefined();
  });

  it('maps InputPeerSelf', () => {
    expect(convertTypeInputPeer(new Api.InputPeerSelf())).toEqual({ self: true });
  });

  it('maps InputPeerChat', () => {
    expect(convertTypeInputPeer(new Api.InputPeerChat({ chatId: bigInt(3) }))).toEqual({
      chatId: '-3',
    });
  });

  it('maps InputPeerUser', () => {
    const peer = new Api.InputPeerUser({ userId: bigInt(3), accessHash: bigInt(9) });
    expect(convertTypeInputPeer(peer)).toEqual({ userId: '3', accessHash: '9' });
  });

  it('maps InputPeerChannel', () => {
    const peer = new Api.InputPeerChannel({ channelId: bigInt(3), accessHash: bigInt(9) });
    expect(convertTypeInputPeer(peer)).toEqual({
      channelId: '-1000000000003',
      accessHash: '9',
    });
  });

  it('maps InputPeerUserFromMessage', () => {
    const peer = new Api.InputPeerUserFromMessage({
      peer: new Api.InputPeerChat({ chatId: bigInt(2) }),
      msgId: 5,
      userId: bigInt(3),
    });
    expect(convertTypeInputPeer(peer)).toEqual({
      peer: { chatId: '-2' },
      msgId: 5,
      userId: '3',
    });
  });

  it('returns undefined for InputPeerUserFromMessage with an empty inner peer', () => {
    const peer = new Api.InputPeerUserFromMessage({
      peer: new Api.InputPeerEmpty(),
      msgId: 5,
      userId: bigInt(3),
    });
    expect(convertTypeInputPeer(peer)).toBeUndefined();
  });

  it('returns undefined for InputPeerUserFromMessage without an inner peer', () => {
    const peer = new Api.InputPeerUserFromMessage({ msgId: 5, userId: bigInt(3) } as any);
    expect(convertTypeInputPeer(peer)).toBeUndefined();
  });

  it('maps InputPeerChannelFromMessage', () => {
    const peer = new Api.InputPeerChannelFromMessage({
      peer: new Api.InputPeerUser({ userId: bigInt(2), accessHash: bigInt(1) }),
      msgId: 6,
      channelId: bigInt(3),
    });
    expect(convertTypeInputPeer(peer)).toEqual({
      peer: { userId: '2' },
      msgId: 6,
      channelId: '-1000000000003',
    });
  });

  it('returns undefined for InputPeerChannelFromMessage with an empty inner peer', () => {
    const peer = new Api.InputPeerChannelFromMessage({
      peer: new Api.InputPeerEmpty(),
      msgId: 6,
      channelId: bigInt(3),
    });
    expect(convertTypeInputPeer(peer)).toBeUndefined();
  });

  it('returns undefined for InputPeerChannelFromMessage without an inner peer', () => {
    const peer = new Api.InputPeerChannelFromMessage({ msgId: 6, channelId: bigInt(3) } as any);
    expect(convertTypeInputPeer(peer)).toBeUndefined();
  });

  it('returns undefined for an unknown input peer', () => {
    expect(convertTypeInputPeer(unknown)).toBeUndefined();
  });
});

describe('convertTypeInputPeerExcludeSelf', () => {
  it('returns the converted peer', () => {
    const peer = new Api.InputPeerChat({ chatId: bigInt(3) });
    expect(convertTypeInputPeerExcludeSelf(peer)).toEqual({ chatId: '-3' });
  });

  it('throws when the peer cannot be converted', () => {
    expect(() => convertTypeInputPeerExcludeSelf(new Api.InputPeerEmpty())).toThrow(
      'Failed to convert TypeInputPeer',
    );
  });

  it('throws for InputPeerSelf', () => {
    expect(() => convertTypeInputPeerExcludeSelf(new Api.InputPeerSelf())).toThrow(
      'InputPeerSelf is not supported in this context',
    );
  });
});

describe('convertTypeChatPhoto', () => {
  it('returns undefined without a photo', () => {
    expect(convertTypeChatPhoto(undefined)).toBeUndefined();
  });

  it('returns undefined for ChatPhotoEmpty', () => {
    expect(convertTypeChatPhoto(new Api.ChatPhotoEmpty())).toBeUndefined();
  });

  it('maps a full chat photo', () => {
    const photo = new Api.ChatPhoto({
      hasVideo: true,
      photoId: bigInt(4),
      strippedThumb: STRIPPED,
      dcId: 2,
    });
    const result = convertTypeChatPhoto(photo)!;
    expect(result.hasVideo).toBe(true);
    expect(result.photoId).toBe('4');
    expect(result.dcId).toBe(2);
    expect(result.strippedThumb?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('defaults missing chat photo fields', () => {
    expect(convertTypeChatPhoto(new Api.ChatPhoto({} as any))).toEqual({
      hasVideo: false,
      photoId: undefined,
      strippedThumb: undefined,
      dcId: 0,
    });
  });
});

describe('convertFolder', () => {
  it('maps a full folder', () => {
    const folder = new Api.Folder({
      autofillNewBroadcasts: true,
      autofillPublicGroups: true,
      autofillNewCorrespondents: true,
      id: 2,
      title: 'Work',
      photo: new Api.ChatPhotoEmpty(),
    });
    expect(convertFolder(folder)).toEqual({
      autofillNewBroadcasts: true,
      autofillPublicGroups: true,
      autofillNewCorrespondents: true,
      id: 2,
      title: 'Work',
      photo: undefined,
    });
  });

  it('defaults missing folder fields', () => {
    expect(convertFolder(new Api.Folder({} as any))).toEqual({
      autofillNewBroadcasts: false,
      autofillPublicGroups: false,
      autofillNewCorrespondents: false,
      id: 0,
      title: '',
      photo: undefined,
    });
  });
});

describe('convertDialogFolder', () => {
  it('maps a full dialog folder', () => {
    const dialogFolder = new Api.DialogFolder({
      pinned: true,
      folder: new Api.Folder({ id: 1, title: 'Archive' } as any),
      peer: new Api.PeerUser({ userId: bigInt(4) }),
      topMessage: 10,
      unreadMutedPeersCount: 1,
      unreadUnmutedPeersCount: 2,
      unreadMutedMessagesCount: 3,
      unreadUnmutedMessagesCount: 4,
    });
    expect(convertDialogFolder(dialogFolder)).toMatchObject({
      pinned: true,
      peer: { userId: '4' },
      topMessage: 10,
      unreadMutedPeersCount: 1,
      unreadUnmutedPeersCount: 2,
      unreadMutedMessagesCount: 3,
      unreadUnmutedMessagesCount: 4,
    });
  });

  it('defaults missing dialog folder fields', () => {
    const dialogFolder = new Api.DialogFolder({
      folder: new Api.Folder({} as any),
      peer: new Api.PeerUser({ userId: bigInt(4) }),
    } as any);
    expect(convertDialogFolder(dialogFolder)).toMatchObject({
      pinned: false,
      topMessage: 0,
      unreadMutedPeersCount: 0,
      unreadUnmutedPeersCount: 0,
      unreadMutedMessagesCount: 0,
      unreadUnmutedMessagesCount: 0,
    });
  });
});

describe('convertInputReplyToMessage', () => {
  it('returns undefined without a reply', () => {
    expect(convertInputReplyToMessage(undefined)).toBeUndefined();
  });

  it('maps a reply with a peer', () => {
    const replyTo = new Api.InputReplyToMessage({
      replyToMsgId: 5,
      topMsgId: 6,
      replyToPeerId: new Api.InputPeerChat({ chatId: bigInt(2) }),
      quoteText: 'q',
      quoteEntities: [],
      quoteOffset: 1,
    });
    expect(convertInputReplyToMessage(replyTo)).toEqual({
      replyToMsgId: 5,
      topMsgId: 6,
      replyToPeerId: { chatId: '-2' },
      quoteText: 'q',
      quoteEntities: [],
      quoteOffset: 1,
    });
  });

  it('leaves the peer undefined when absent', () => {
    const replyTo = new Api.InputReplyToMessage({ replyToMsgId: 5 });
    expect(convertInputReplyToMessage(replyTo)).toMatchObject({ replyToPeerId: undefined });
  });
});

describe('convertInputReplyToStory', () => {
  it('returns undefined without a reply', () => {
    expect(convertInputReplyToStory(undefined)).toBeUndefined();
  });

  it('maps a story reply', () => {
    const replyTo = new Api.InputReplyToStory({
      peer: new Api.InputPeerChat({ chatId: bigInt(2) }),
      storyId: 8,
    });
    expect(convertInputReplyToStory(replyTo)).toEqual({ peer: { chatId: '-2' }, storyId: 8 });
  });
});

describe('convertInputReplyTo', () => {
  it('returns undefined without a reply', () => {
    expect(convertInputReplyTo(undefined)).toBeUndefined();
  });

  it('delegates InputReplyToMessage', () => {
    const replyTo = new Api.InputReplyToMessage({ replyToMsgId: 5 });
    expect(convertInputReplyTo(replyTo)).toMatchObject({ replyToMsgId: 5 });
  });

  it('delegates InputReplyToStory', () => {
    const replyTo = new Api.InputReplyToStory({
      peer: new Api.InputPeerSelf(),
      storyId: 9,
    });
    expect(convertInputReplyTo(replyTo)).toMatchObject({ storyId: 9 });
  });

  it('throws for an unknown reply target', () => {
    expect(() => convertInputReplyTo(unknown)).toThrow('Invalid replyTo');
  });
});

describe('convertDraftMessage', () => {
  it('returns undefined without a draft', () => {
    expect(convertDraftMessage(undefined)).toBeUndefined();
  });

  it('returns undefined for DraftMessageEmpty', () => {
    expect(convertDraftMessage(new Api.DraftMessageEmpty({}))).toBeUndefined();
  });

  it('maps a full draft', () => {
    const draft = new Api.DraftMessage({
      noWebpage: true,
      invertMedia: true,
      replyTo: new Api.InputReplyToMessage({ replyToMsgId: 3 }),
      message: 'draft',
      entities: [],
      media: new Api.InputMediaDice({ emoticon: '🎲' }),
      date: 99,
      effect: bigInt(4),
    });
    expect(convertDraftMessage(draft)).toEqual({
      noWebpage: true,
      invertMedia: true,
      replyTo: expect.objectContaining({ replyToMsgId: 3 }),
      message: 'draft',
      entities: [],
      media: { emoticon: '🎲' },
      date: 99,
      effect: '4',
    });
  });

  it('defaults missing draft fields', () => {
    expect(convertDraftMessage(new Api.DraftMessage({} as any))).toEqual({
      noWebpage: false,
      invertMedia: false,
      replyTo: undefined,
      message: '',
      entities: [],
      media: undefined,
      date: 0,
      effect: '',
    });
  });
});

describe('convertDialog', () => {
  it('maps a full dialog', () => {
    const dialog = new Api.Dialog({
      peer: new Api.PeerUser({ userId: bigInt(1) }),
      unreadCount: 2,
      topMessage: 3,
      folderId: 4,
      pinned: true,
      unreadMark: true,
      viewForumAsMessages: true,
      notifySettings: new Api.PeerNotifySettings({ silent: true }),
      pts: 5,
      draft: new Api.DraftMessageEmpty({}),
      ttlPeriod: 6,
      readInboxMaxId: 7,
      readOutboxMaxId: 8,
      unreadMentionsCount: 9,
      unreadReactionsCount: 10,
    });
    expect(convertDialog(dialog)).toMatchObject({
      peer: { userId: '1' },
      unreadCount: 2,
      topMessage: 3,
      folderId: 4,
      pinned: true,
      unreadMark: true,
      viewForumAsMessages: true,
      pts: 5,
      draft: undefined,
      ttlPeriod: 6,
      readInboxMaxId: 7,
      readOutboxMaxId: 8,
      unreadMentionsCount: 9,
      unreadReactionsCount: 10,
    });
  });

  it('defaults missing dialog fields', () => {
    const dialog = new Api.Dialog({ peer: new Api.PeerChat({ chatId: bigInt(1) }) } as any);
    expect(convertDialog(dialog)).toMatchObject({
      peer: { chatId: '-1' },
      unreadCount: 0,
      topMessage: 0,
      folderId: 0,
      pinned: false,
      unreadMark: false,
      viewForumAsMessages: false,
      pts: 0,
      ttlPeriod: 0,
    });
  });
});

describe('convertTypeNotificationSound', () => {
  it('returns undefined without a sound', () => {
    expect(convertTypeNotificationSound(undefined)).toBeUndefined();
  });

  it('maps NotificationSoundDefault to an empty marker', () => {
    expect(convertTypeNotificationSound(new Api.NotificationSoundDefault())).toEqual({});
  });

  it('maps NotificationSoundNone to an empty marker', () => {
    expect(convertTypeNotificationSound(new Api.NotificationSoundNone())).toEqual({});
  });

  it('maps NotificationSoundLocal', () => {
    const sound = new Api.NotificationSoundLocal({ title: 'ping', data: 'p' });
    expect(convertTypeNotificationSound(sound)).toEqual({ title: 'ping', data: 'p' });
  });

  it('maps NotificationSoundRingtone', () => {
    expect(convertTypeNotificationSound(new Api.NotificationSoundRingtone({ id: bigInt(6) }))).toEqual(
      { id: '6' },
    );
  });

  it('throws for an unknown sound', () => {
    expect(() => convertTypeNotificationSound(unknown)).toThrow('Invalid notification sound');
  });
});

describe('convertTypePeerNotifySettings', () => {
  it('returns muted defaults when settings are missing', () => {
    expect(convertTypePeerNotifySettings(undefined as unknown as Api.TypePeerNotifySettings)).toEqual({
      showPreviews: false,
      silent: false,
      muteUntil: 0,
      storiesMuted: false,
      storiesHideSender: false,
    });
  });

  it('maps a full settings object', () => {
    const settings = new Api.PeerNotifySettings({
      showPreviews: true,
      silent: true,
      muteUntil: 100,
      iosSound: new Api.NotificationSoundDefault(),
      androidSound: new Api.NotificationSoundNone(),
      otherSound: new Api.NotificationSoundRingtone({ id: bigInt(2) }),
      storiesMuted: true,
      storiesHideSender: true,
      storiesIosSound: new Api.NotificationSoundLocal({ title: 't', data: 'd' }),
      storiesAndroidSound: new Api.NotificationSoundDefault(),
      storiesOtherSound: new Api.NotificationSoundDefault(),
    });
    expect(convertTypePeerNotifySettings(settings)).toEqual({
      showPreviews: true,
      silent: true,
      muteUntil: 100,
      iosSound: {},
      androidSound: {},
      otherSound: { id: '2' },
      storiesMuted: true,
      storiesHideSender: true,
      storiesIosSound: { title: 't', data: 'd' },
      storiesAndroidSound: {},
      storiesOtherSound: {},
    });
  });

  it('defaults missing settings fields', () => {
    expect(convertTypePeerNotifySettings(new Api.PeerNotifySettings({}))).toEqual({
      showPreviews: false,
      silent: false,
      muteUntil: 0,
      iosSound: undefined,
      androidSound: undefined,
      otherSound: undefined,
      storiesMuted: false,
      storiesHideSender: false,
      storiesIosSound: undefined,
      storiesAndroidSound: undefined,
      storiesOtherSound: undefined,
    });
  });

  it('passes through non PeerNotifySettings values', () => {
    expect(convertTypePeerNotifySettings(unknown)).toBe(unknown);
  });
});
