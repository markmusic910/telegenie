import { isChannelId, isUserId } from '@telegenie/libs/foundation/telegram/utils';

export type DialogPeerKind = 'user' | 'chat' | 'channel';

export type PeerDisplay = {
  name: string;
  initials: string;
  isVerified: boolean;
  isSavedMessages: boolean;
  isDeleted?: boolean;
  senderLabel?: string;
};

/** Structural peer fields used to derive {@link PeerDisplay} without importing model classes. */
type PeerLike = {
  id: string;
  self?: boolean;
  deleted?: boolean;
  firstName?: string;
  lastName?: string;
  username?: string;
  verified?: boolean;
  title?: string;
};

export function dialogPeerKindFromId(peerId: string): DialogPeerKind {
  if (isUserId(peerId)) return 'user';
  if (isChannelId(peerId)) return 'channel';
  return 'chat';
}

export function peerColorIndex(id: string, modulo = 8): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % modulo;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return name.replace(/^-/, '').slice(0, 2).toUpperCase() || '?';
}

export function fallbackPeerDisplay(peerId: string): PeerDisplay {
  return {
    name: peerId,
    initials: initialsFromName(peerId),
    isVerified: false,
    isSavedMessages: false,
  };
}

export function buildPeerDisplay(peer: PeerLike): PeerDisplay {
  if (peer.self && !peer.deleted) {
    return {
      name: 'Saved Messages',
      initials: 'S',
      isVerified: false,
      isSavedMessages: true,
      senderLabel: 'You',
    };
  }

  return peerProfileDisplay(peer);
}

/** Profile display for avatars — never Saved Messages branding, even for `self` users. */
export function peerProfileDisplay(peer: PeerLike): PeerDisplay {
  if (peer.deleted) {
    return {
      name: 'Deleted Account',
      initials: '',
      isVerified: false,
      isSavedMessages: false,
      isDeleted: true,
      senderLabel: 'Deleted Account',
    };
  }

  if ('firstName' in peer) {
    const firstName = peer.firstName ?? '';
    const lastName = peer.lastName ?? '';
    const name = [firstName, lastName].filter(Boolean).join(' ') || peer.username || peer.id;
    const initials =
      [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase() || initialsFromName(name);
    return {
      name,
      initials,
      isVerified: Boolean(peer.verified),
      isSavedMessages: false,
      senderLabel: firstName || lastName || peer.username || undefined,
    };
  }

  const name = peer.title || peer.id;
  return {
    name,
    initials: initialsFromName(name),
    isVerified: Boolean(peer.verified),
    isSavedMessages: false,
    senderLabel: peer.title || undefined,
  };
}

/** Real peer name for service/action messages — never the Saved Messages dialog label. */
export function peerActionName(peer: PeerLike | null | undefined): string | undefined {
  if (!peer) return undefined;
  if (peer.deleted) return 'Deleted Account';

  if ('firstName' in peer) {
    const name = [peer.firstName, peer.lastName].filter(Boolean).join(' ');
    return name || peer.username || undefined;
  }

  return peer.title || undefined;
}
