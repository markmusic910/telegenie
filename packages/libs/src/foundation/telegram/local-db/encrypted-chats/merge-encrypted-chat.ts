import type { TypeEncryptedChat } from '../../types/api-types';
import { encryptedChatStatus } from '../../services/converters/encrypted-chat.converter';
import type { EncryptedChatPeerRow } from '../types';

const STATUS_RANK: Record<string, number> = {
  empty: 0,
  waiting: 1,
  requested: 2,
  ready: 3,
  discarded: 4,
};

function rank(chat: TypeEncryptedChat): number {
  if (encryptedChatStatus(chat) === 'discarded') return STATUS_RANK.discarded;
  return STATUS_RANK[encryptedChatStatus(chat)] ?? 0;
}

export function mergeEncryptedChat(
  incoming: TypeEncryptedChat,
  local?: EncryptedChatPeerRow,
  now = Date.now(),
): EncryptedChatPeerRow {
  const id = String(incoming.id);

  if (!local) {
    return { id, entity: incoming, updatedAt: now };
  }

  const incomingRank = rank(incoming);
  const localRank = rank(local.entity);

  if (incomingRank === STATUS_RANK.discarded) {
    return { id, entity: incoming, updatedAt: now };
  }

  if (localRank === STATUS_RANK.ready && incomingRank < STATUS_RANK.ready) {
    return { ...local, updatedAt: now };
  }

  if (incomingRank < localRank) {
    return { ...local, updatedAt: now };
  }

  return { id, entity: incoming, updatedAt: now };
}
