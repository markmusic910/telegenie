import type { MessageEntity, MessageStore } from '../../store/types';

/** Group message entities by peerId and write each group into its peer message store. */
export function updateMessagesByPeer(
  ensureMessageStore: (peerId: string) => MessageStore,
  entities: MessageEntity[],
): void {
  if (!entities.length) return;

  const byPeer = new Map<string, MessageEntity[]>();
  for (const entity of entities) {
    const peerId = entity.peerId || '';
    if (!peerId) continue;
    const list = byPeer.get(peerId);
    if (list) {
      list.push(entity);
    } else {
      byPeer.set(peerId, [entity]);
    }
  }

  for (const [peerId, list] of byPeer) {
    ensureMessageStore(peerId).update(list);
  }
}
