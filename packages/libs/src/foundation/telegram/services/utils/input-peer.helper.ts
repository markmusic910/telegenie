import { Api } from '@telegenie/teleproto';

/** Map a sendable input peer to the peer stored on a message. */
export function peerFromInputPeer(peer: Api.TypeInputPeer): Api.TypePeer | undefined {
  if (peer instanceof Api.InputPeerUser) {
    return new Api.PeerUser({ userId: peer.userId });
  }
  if (peer instanceof Api.InputPeerChat) {
    return new Api.PeerChat({ chatId: peer.chatId });
  }
  if (peer instanceof Api.InputPeerChannel) {
    return new Api.PeerChannel({ channelId: peer.channelId });
  }
  return undefined;
}
