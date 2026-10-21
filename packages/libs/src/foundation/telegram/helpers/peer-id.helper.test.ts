import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import {
  buildMarkedPeerIdByType,
  buildMtpPeerId,
  buildPeer,
  getEntityTypeById,
  getPeerId,
  markedChannelIdFromMtp,
  markedPeerIdFromApiPeer,
  mtpChannelIdFromPeerId,
  peerIdFromMessage,
} from './peer-id.helper';

describe('mtpChannelIdFromPeerId', () => {
  it('parses Bot API / TDLib marked channel ids only', () => {
    expect(mtpChannelIdFromPeerId('-1000000000777')?.toString()).toBe('777');
    // GramJS utils.getPeerId style (`-100` + mtpId) is not accepted in foundation
    expect(mtpChannelIdFromPeerId('-100777')).toBeUndefined();
    expect(mtpChannelIdFromPeerId('42')).toBeUndefined();
  });
});

describe('getEntityTypeById', () => {
  it('classifies user, chat, channel, and fallback', () => {
    expect(getEntityTypeById('42')).toBe('user');
    expect(getEntityTypeById('-10')).toBe('chat');
    expect(getEntityTypeById('-1000000000777')).toBe('channel');
    // Between ZERO_CHANNEL_ID and MIN_MARKED_CHAT_ID → fallback chat
    expect(getEntityTypeById('-1000000000000')).toBe('chat');
  });
});

describe('buildMtpPeerId / buildMarkedPeerIdByType', () => {
  it('round-trips user/chat/channel ids', () => {
    expect(buildMtpPeerId('42', 'user').toString()).toBe('42');
    expect(buildMtpPeerId('-10', 'chat').toString()).toBe('10');
    expect(buildMtpPeerId('-1000000000777', 'channel').toString()).toBe('777');

    expect(buildMarkedPeerIdByType('42', 'user')).toBe('42');
    expect(buildMarkedPeerIdByType('10', 'chat')).toBe('-10');
    expect(buildMarkedPeerIdByType('777', 'channel')).toBe('-1000000000777');
  });
});

describe('buildPeer', () => {
  it('builds PeerUser / PeerChat / PeerChannel', () => {
    expect(buildPeer('42')).toBeInstanceOf(Api.PeerUser);
    expect(buildPeer('-10')).toBeInstanceOf(Api.PeerChat);
    expect(buildPeer('-1000000000777')).toBeInstanceOf(Api.PeerChannel);
  });
});

describe('markedPeerIdFromApiPeer / markedChannelIdFromMtp', () => {
  it('marks peers and channels', () => {
    expect(markedPeerIdFromApiPeer(new Api.PeerUser({ userId: bigInt(5) }))).toBe('5');
    expect(markedPeerIdFromApiPeer(new Api.PeerChat({ chatId: bigInt(6) }))).toBe('-6');
    expect(
      markedPeerIdFromApiPeer(new Api.PeerChannel({ channelId: bigInt(7) })),
    ).toBe('-1000000000007');
    expect(markedChannelIdFromMtp(bigInt(7))).toBe('-1000000000007');
  });
});

describe('peerIdFromMessage', () => {
  it('extracts peer id from empty and regular messages', () => {
    expect(
      peerIdFromMessage(new Api.MessageEmpty({ id: 1 })),
    ).toBeUndefined();
    expect(
      peerIdFromMessage(
        new Api.MessageEmpty({
          id: 1,
          peerId: new Api.PeerUser({ userId: bigInt(9) }),
        }),
      ),
    ).toBe('9');
    expect(
      peerIdFromMessage(
        new Api.Message({
          id: 2,
          peerId: new Api.PeerChat({ chatId: bigInt(3) }),
          date: 1,
          message: 'hi',
        }),
      ),
    ).toBe('-3');
  });
});

describe('getPeerId', () => {
  it('marks users, chats, and channels with Bot API / TDLib rules', () => {
    expect(getPeerId(new Api.User({ id: bigInt(42) }))).toBe('42');
    expect(getPeerId(new Api.UserEmpty({ id: bigInt(1) }))).toBe('1');
    expect(getPeerId(new Api.Chat({
      id: bigInt(10),
      title: 'G',
      photo: new Api.ChatPhotoEmpty(),
      participantsCount: 1,
      date: 1,
      version: 1,
    }))).toBe('-10');
    expect(getPeerId(new Api.ChatEmpty({ id: bigInt(11) }))).toBe('-11');
    expect(
      getPeerId(new Api.ChatForbidden({ id: bigInt(12), title: 'F' })),
    ).toBe('-12');
    expect(
      getPeerId(
        new Api.Channel({
          id: bigInt(777),
          title: 'C',
          photo: new Api.ChatPhotoEmpty(),
          date: 1,
        }),
      ),
    ).toBe('-1000000000777');
    expect(
      getPeerId(
        new Api.ChannelForbidden({
          id: bigInt(778),
          title: 'CF',
          accessHash: bigInt(1),
        }),
      ),
    ).toBe('-1000000000778');
    expect(getPeerId(new Api.PeerChannel({ channelId: bigInt(777) }))).toBe(
      '-1000000000777',
    );
  });
});
