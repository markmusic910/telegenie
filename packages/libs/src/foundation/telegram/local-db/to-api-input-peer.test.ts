import { Api } from '@telegenie/teleproto';

import { toApiInputPeer, toApiInputPeerWithSeenPeer } from './to-api-input-peer';
import type { ResolvedInputPeer } from './types';

describe('toApiInputPeer', () => {
  it('maps user to InputPeerUser', () => {
    const peer = toApiInputPeer({
      type: 'user',
      userId: '1',
      accessHash: '99',
    });
    expect(peer).toBeInstanceOf(Api.InputPeerUser);
  });

  it('maps channel to InputPeerChannel', () => {
    const peer = toApiInputPeer({
      type: 'channel',
      channelId: '-1000000000123',
      accessHash: '88',
    });
    expect(peer).toBeInstanceOf(Api.InputPeerChannel);
  });

  it('maps chat to InputPeerChat', () => {
    const peer = toApiInputPeer({ type: 'chat', chatId: '-10' });
    expect(peer).toBeInstanceOf(Api.InputPeerChat);
  });

  it('maps userFromMessage when seen peer is a basic chat', () => {
    const peer = toApiInputPeer({
      type: 'userFromMessage',
      userId: '1',
      seenInPeerId: '-10',
      msgId: 42,
    });
    expect(peer).toBeInstanceOf(Api.InputPeerUserFromMessage);
  });

  it('returns undefined for userFromMessage when seen peer is not a chat', () => {
    expect(
      toApiInputPeer({
        type: 'userFromMessage',
        userId: '1',
        seenInPeerId: '2',
        msgId: 42,
      }),
    ).toBeUndefined();
  });

  it('maps channelFromMessage when seen peer is a basic chat', () => {
    const peer = toApiInputPeer({
      type: 'channelFromMessage',
      channelId: '-1000000000123',
      seenInPeerId: '-10',
      msgId: 7,
    });
    expect(peer).toBeInstanceOf(Api.InputPeerChannelFromMessage);
  });

  it('returns undefined for channelFromMessage when seen peer is not a chat', () => {
    expect(
      toApiInputPeer({
        type: 'channelFromMessage',
        channelId: '-1000000000123',
        seenInPeerId: '-1000000000999',
        msgId: 7,
      }),
    ).toBeUndefined();
  });

  it('returns undefined for unavailable', () => {
    expect(toApiInputPeer({ type: 'unavailable', peerId: '1' })).toBeUndefined();
  });

  it('returns undefined for unknown type via default branch', () => {
    expect(
      toApiInputPeer({ type: 'unknown' } as unknown as ResolvedInputPeer),
    ).toBeUndefined();
  });
});

describe('toApiInputPeerWithSeenPeer', () => {
  const seenPeer = new Api.InputPeerChat({ chatId: 10 as never });

  it('builds InputPeerUserFromMessage with provided seen peer', () => {
    const peer = toApiInputPeerWithSeenPeer(
      {
        type: 'userFromMessage',
        userId: '1',
        seenInPeerId: '-10',
        msgId: 3,
      },
      seenPeer,
    );
    expect(peer).toBeInstanceOf(Api.InputPeerUserFromMessage);
    expect((peer as Api.InputPeerUserFromMessage).peer).toBe(seenPeer);
    expect((peer as Api.InputPeerUserFromMessage).msgId).toBe(3);
  });

  it('builds InputPeerChannelFromMessage with provided seen peer', () => {
    const peer = toApiInputPeerWithSeenPeer(
      {
        type: 'channelFromMessage',
        channelId: '-1000000000123',
        seenInPeerId: '-10',
        msgId: 9,
      },
      seenPeer,
    );
    expect(peer).toBeInstanceOf(Api.InputPeerChannelFromMessage);
    expect((peer as Api.InputPeerChannelFromMessage).peer).toBe(seenPeer);
    expect((peer as Api.InputPeerChannelFromMessage).msgId).toBe(9);
  });
});
