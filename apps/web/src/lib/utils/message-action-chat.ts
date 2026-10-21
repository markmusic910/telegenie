import type { DialogPeer } from '@/lib/contexts/sdk.context';
import type { MessageActionChat } from '@telegenie/sdk';

/** Chat facts the message actions (copy, forward, pin, delete, edit) depend on. */
export function actionChat(peer: DialogPeer | null): MessageActionChat | undefined {
  if (!peer) return undefined;
  if (!('title' in peer)) return { peerKind: 'user', bot: peer.bot };
  if ('broadcast' in peer) {
    return {
      peerKind: 'channel',
      forbidden: peer.status === 'forbidden',
      broadcast: peer.broadcast,
      megagroup: peer.megagroup,
      creator: peer.creator,
      noforwards: peer.noforwards,
      adminRights: peer.adminRights,
      defaultBannedRights: peer.defaultBannedRights,
    };
  }
  return {
    peerKind: 'chat',
    forbidden: peer.status === 'forbidden',
    creator: peer.creator,
    noforwards: peer.noforwards,
    adminRights: peer.adminRights,
    defaultBannedRights: peer.defaultBannedRights,
  };
}
