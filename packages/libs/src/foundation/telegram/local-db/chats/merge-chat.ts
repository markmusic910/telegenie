import type { Chat, ChatEmpty, ChatForbidden } from '../../types/api-types';
import type { ChatPeerRow } from '../types';

/** Runtime empty check. Not a type predicate: ChatEmpty ⊂ Chat structurally, so a false branch would narrow to `never`. */
export function isChatEmpty(chat: Chat | ChatEmpty | ChatForbidden): boolean {
  return !('title' in chat) || (Object.keys(chat).length === 1 && 'id' in chat);
}

/** Runtime forbidden check. Not a type predicate: Chat ⊂ ChatForbidden structurally. */
export function isChatForbidden(chat: Chat | ChatEmpty | ChatForbidden): boolean {
  return 'title' in chat && !('version' in chat) && !('participantsCount' in chat);
}

export function mergeChat(
  incoming: Chat | ChatEmpty | ChatForbidden,
  local?: ChatPeerRow,
  now = Date.now(),
): ChatPeerRow {
  if (isChatEmpty(incoming)) {
    if (!local) {
      return {
        id: incoming.id,
        entity: { id: incoming.id } as Chat,
        minAccessHash: false,
        updatedAt: now,
      };
    }
    return { ...local, updatedAt: now };
  }

  if (isChatForbidden(incoming)) {
    const forbidden = incoming as ChatForbidden;
    if (!local) {
      return {
        id: forbidden.id,
        entity: {
          id: forbidden.id,
          title: forbidden.title,
          participantsCount: 0,
          date: 0,
          version: 0,
        },
        minAccessHash: false,
        updatedAt: now,
      };
    }
    return {
      id: forbidden.id,
      entity: { ...local.entity, title: forbidden.title },
      minAccessHash: false,
      updatedAt: now,
    };
  }

  const chat = incoming as Chat;

  if (!local) {
    return {
      id: chat.id,
      entity: { ...chat },
      minAccessHash: false,
      updatedAt: now,
    };
  }

  // Stale version: skip replace
  if (
    typeof chat.version === 'number' &&
    typeof local.entity.version === 'number' &&
    chat.version < local.entity.version
  ) {
    return { ...local, updatedAt: now };
  }

  return {
    id: chat.id,
    entity: { ...chat },
    minAccessHash: false,
    updatedAt: now,
  };
}
