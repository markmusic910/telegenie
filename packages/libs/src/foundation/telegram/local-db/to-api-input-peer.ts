import { Api } from '@telegenie/teleproto';

import { buildInputPeer } from '../helpers';
import { buildMtpPeerId, getEntityTypeById } from '../helpers/peer-id.helper';
import type { ResolvedInputPeer } from './types';

/**
 * Map LocalDb resolve result to a GramJS InputPeer.
 * For *FromMessage when seen peer is not a basic chat, use `toApiInputPeerWithSeenPeer`.
 */
export function toApiInputPeer(resolved: ResolvedInputPeer): Api.TypeInputPeer | undefined {
  switch (resolved.type) {
    case 'user':
      return buildInputPeer(resolved.userId, resolved.accessHash);
    case 'channel':
      return buildInputPeer(resolved.channelId, resolved.accessHash);
    case 'chat':
      return buildInputPeer(resolved.chatId);
    case 'userFromMessage': {
      if (getEntityTypeById(resolved.seenInPeerId) !== 'chat') return undefined;
      return new Api.InputPeerUserFromMessage({
        peer: buildInputPeer(resolved.seenInPeerId),
        msgId: resolved.msgId,
        userId: buildMtpPeerId(resolved.userId, 'user'),
      });
    }
    case 'channelFromMessage': {
      if (getEntityTypeById(resolved.seenInPeerId) !== 'chat') return undefined;
      return new Api.InputPeerChannelFromMessage({
        peer: buildInputPeer(resolved.seenInPeerId),
        msgId: resolved.msgId,
        channelId: buildMtpPeerId(resolved.channelId, 'channel'),
      });
    }
    case 'unavailable':
      return undefined;
    default:
      return undefined;
  }
}

/** Build FromMessage InputPeer when the container peer InputPeer is already known. */
export function toApiInputPeerWithSeenPeer(
  resolved: Extract<ResolvedInputPeer, { type: 'userFromMessage' | 'channelFromMessage' }>,
  seenPeer: Api.TypeInputPeer,
): Api.TypeInputPeer {
  if (resolved.type === 'userFromMessage') {
    return new Api.InputPeerUserFromMessage({
      peer: seenPeer,
      msgId: resolved.msgId,
      userId: buildMtpPeerId(resolved.userId, 'user'),
    });
  }
  return new Api.InputPeerChannelFromMessage({
    peer: seenPeer,
    msgId: resolved.msgId,
    channelId: buildMtpPeerId(resolved.channelId, 'channel'),
  });
}
