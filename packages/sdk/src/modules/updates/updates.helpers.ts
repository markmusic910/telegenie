import { reactionKey } from '@telegenie/libs/foundation/telegram/helpers';
import type {
  TypeMessageReactions,
  TypePeer,
  TypeReaction,
} from '@telegenie/libs/foundation/telegram/types/api-types';

export function sameReactions(a?: TypeMessageReactions, b?: TypeMessageReactions): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function asMessageId(id: string | number): number {
  const n = typeof id === 'number' ? id : parseInt(id, 10);
  return Number.isFinite(n) ? n : 0;
}

function peerIdFromReactionPeer(peer?: TypePeer): string | undefined {
  if (!peer) return undefined;
  if ('userId' in peer && peer.userId) return String(peer.userId);
  if ('chatId' in peer && peer.chatId) return String(peer.chatId);
  if ('channelId' in peer && peer.channelId) return String(peer.channelId);
  return undefined;
}

function hasUnreadForeignReaction(
  reactions: TypeMessageReactions | undefined,
  selfUserId: string | undefined,
): boolean {
  for (const recent of reactions?.recentReactions ?? []) {
    if (!recent?.unread || recent.my) continue;
    const peerId = peerIdFromReactionPeer(recent.peerId);
    if (!peerId || peerId === selfUserId) continue;
    return true;
  }
  return false;
}

function foreignRecentKey(
  recent: NonNullable<TypeMessageReactions['recentReactions']>[number] | undefined,
  selfUserId: string | undefined,
): string | undefined {
  if (!recent?.reaction || recent.my) return undefined;
  const peerId = peerIdFromReactionPeer(recent.peerId);
  if (!peerId || peerId === selfUserId) return undefined;
  return `${peerId}:${reactionKey(recent.reaction)}:${recent.date ?? 0}`;
}

function hasForeignRecent(
  reactions: TypeMessageReactions | undefined,
  selfUserId: string | undefined,
): boolean {
  for (const recent of reactions?.recentReactions ?? []) {
    if (foreignRecentKey(recent, selfUserId)) return true;
  }
  return false;
}

function hasNewForeignRecent(
  before: TypeMessageReactions | undefined,
  after: TypeMessageReactions | undefined,
  selfUserId: string | undefined,
): boolean {
  const previous = new Set<string>();
  for (const recent of before?.recentReactions ?? []) {
    const key = foreignRecentKey(recent, selfUserId);
    if (key) previous.add(key);
  }
  for (const recent of after?.recentReactions ?? []) {
    const key = foreignRecentKey(recent, selfUserId);
    if (key && !previous.has(key)) return true;
  }
  return false;
}

/**
 * Someone else's reaction count went up.
 * A row that just gained `chosenOrder` is the user's own new reaction.
 * A count increase on a row they already chose is someone else adding to it.
 */
function foreignReactionCountIncreased(
  before: TypeMessageReactions | undefined,
  after: TypeMessageReactions | undefined,
): boolean {
  const previous = new Map<string, { count: number; chosen: boolean }>();
  for (const row of before?.results ?? []) {
    if (!row?.reaction) continue;
    previous.set(reactionKey(row.reaction), {
      count: row.count ?? 0,
      chosen: row.chosenOrder != null,
    });
  }
  for (const row of after?.results ?? []) {
    if (!row?.reaction) continue;
    const prev = previous.get(reactionKey(row.reaction));
    if ((row.count ?? 0) <= (prev?.count ?? 0)) continue;
    const newlyChosen = row.chosenOrder != null && !prev?.chosen;
    if (newlyChosen) continue;
    return true;
  }
  return false;
}

export function addedIncomingReaction(
  before: TypeMessageReactions | undefined,
  after: TypeMessageReactions | undefined,
  selfUserId: string | undefined,
  trustCountDelta: boolean,
): boolean {
  if (hasUnreadForeignReaction(after, selfUserId) && !hasUnreadForeignReaction(before, selfUserId)) {
    return true;
  }
  if (hasNewForeignRecent(before, after, selfUserId)) return true;
  return trustCountDelta && foreignReactionCountIncreased(before, after);
}

/** Keep the dialog badge while the foreign reaction is still on the message. */
export function incomingReactionRemains(
  reactions: TypeMessageReactions | undefined,
  selfUserId: string | undefined,
): boolean {
  if (!reactions) return false;
  if (hasUnreadForeignReaction(reactions, selfUserId)) return true;
  if (hasForeignRecent(reactions, selfUserId)) return true;
  return (reactions.results ?? []).some((row) => (row?.count ?? 0) > 0);
}

export function reactionNotificationBody(reactions: TypeMessageReactions | undefined): string {
  const reaction: TypeReaction | undefined = reactions?.recentReactions?.[0]?.reaction;
  if (reaction && 'emoticon' in reaction && reaction.emoticon) return reaction.emoticon;
  if (reaction && 'documentId' in reaction) return 'Custom emoji';
  if (reaction && 'paid' in reaction) return '⭐';
  return 'Reaction';
}
