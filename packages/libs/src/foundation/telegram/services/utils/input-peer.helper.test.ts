import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { peerFromInputPeer } from './input-peer.helper';

describe('peerFromInputPeer', () => {
  it('maps a user, chat, and channel', () => {
    const user = peerFromInputPeer(
      new Api.InputPeerUser({ userId: bigInt(7), accessHash: bigInt(1) }),
    );
    expect(user).toBeInstanceOf(Api.PeerUser);
    expect((user as Api.PeerUser).userId.toString()).toBe('7');

    const chat = peerFromInputPeer(new Api.InputPeerChat({ chatId: bigInt(4) }));
    expect(chat).toBeInstanceOf(Api.PeerChat);
    expect((chat as Api.PeerChat).chatId.toString()).toBe('4');

    const channel = peerFromInputPeer(
      new Api.InputPeerChannel({ channelId: bigInt(9), accessHash: bigInt(2) }),
    );
    expect(channel).toBeInstanceOf(Api.PeerChannel);
    expect((channel as Api.PeerChannel).channelId.toString()).toBe('9');
  });

  it('returns undefined for peers that are not a dialog', () => {
    expect(peerFromInputPeer(new Api.InputPeerSelf())).toBeUndefined();
    expect(peerFromInputPeer(new Api.InputPeerEmpty())).toBeUndefined();
  });
});
