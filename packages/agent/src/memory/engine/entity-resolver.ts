import type { IEntityRepository } from '../repository/repository.types';
import type {
  AgentMessageRecord,
  DialogMemoryContext,
  DialogParticipantInfo,
} from '../../types/agent-message-record';
import type { Entity } from '../db/memory-db.types';

/**
 * Resolves subject/object name strings from extraction candidates into Entity records.
 *
 * Strategy:
 * 1. Match against `dialogContext.peers` or `message.mentions` (by `isSelf`, display `name`, `@username`, or `peerId`).
 *    When matched, look up or upsert by `telegramPeerId` and canonical display name.
 * 2. Check existing entities by name (case-insensitive).
 * 3. If the message has a known fromId and name is first-person, try to link to an existing entity by
 *    telegramPeerId (Bot-API format ID).
 * 4. If no match, create a new Entity (type = PERSON by default for names,
 *    THING for everything else).
 */
export class EntityResolver {
  constructor(private readonly entityRepository: IEntityRepository) {}

  /**
   * Resolve a name string to an Entity, creating one if needed.
   * @param name - The subject or object name from the extraction candidate.
   * @param message - The source message (used to link PERSON entities to Telegram users).
   * @param dialogContext - Optional dialog-level metadata and scoped participant lookup map.
   */
  async resolve(
    name: string,
    message?: AgentMessageRecord,
    dialogContext?: DialogMemoryContext,
  ): Promise<Entity> {
    const normalizedName = name.trim();

    // 1. Try matching against dialogContext.peers / message.mentions
    const matchedParticipant = matchDialogParticipant(normalizedName, message, dialogContext);
    if (matchedParticipant) {
      const canonicalName =
        matchedParticipant.name?.trim() ||
        matchedParticipant.username?.replace(/^@/, '').trim() ||
        normalizedName;

      // 1a. Try existing entity by telegramPeerId
      if (matchedParticipant.id) {
        const byPeerId = await this.entityRepository.findByTelegramPeerId(matchedParticipant.id);
        if (byPeerId) {
          // Upgrade display name if existing entity had a placeholder name like "me" or raw ID
          if (
            canonicalName &&
            (isFirstPersonName(byPeerId.name) || byPeerId.name === matchedParticipant.id) &&
            !isFirstPersonName(canonicalName)
          ) {
            const upgraded: Entity = { ...byPeerId, name: canonicalName };
            await this.entityRepository.save(upgraded);
            return upgraded;
          }
          return byPeerId;
        }
      }

      // 1b. Try existing entity by canonicalName
      const byCanonicalName = await this.entityRepository.findByName(canonicalName);
      if (byCanonicalName) {
        if (matchedParticipant.id && !byCanonicalName.telegramPeerId) {
          const linked: Entity = {
            ...byCanonicalName,
            telegramPeerId: matchedParticipant.id,
          };
          await this.entityRepository.save(linked);
          return linked;
        }
        return byCanonicalName;
      }

      // 1c. Create new entity linked to matchedParticipant
      const entityType: Entity['type'] =
        matchedParticipant.type === 'channel' || matchedParticipant.type === 'chat'
          ? 'ORGANIZATION'
          : 'PERSON';
      return this.entityRepository.upsert({
        type: entityType,
        name: canonicalName,
        telegramPeerId: matchedParticipant.id,
      });
    }

    // 2. Try by name (case-insensitive dedup)
    const byName = await this.entityRepository.findByName(normalizedName);
    if (byName) return byName;

    // 3. If this is a "me" / "I" / "user" resolution and we have a fromId, try by telegram peer
    if (message?.fromId && isFirstPersonName(normalizedName)) {
      const byPeerId = await this.entityRepository.findByTelegramPeerId(message.fromId);
      if (byPeerId) return byPeerId;
    }

    // 4. Create new entity
    const type = guessEntityType(normalizedName);
    const newEntity = await this.entityRepository.upsert({
      type,
      name: normalizedName,
      telegramPeerId:
        message?.fromId && isFirstPersonName(normalizedName) ? message.fromId : undefined,
    });
    return newEntity;
  }

  /**
   * Link an entity to a Telegram peer (user/chat/channel) by their Bot-API style ID.
   * Called when the SDK provides peer metadata alongside messages.
   */
  async linkToTelegramPeer(entityId: string, telegramPeerId: string): Promise<void> {
    const entity = await this.entityRepository.findById(entityId);
    if (!entity || entity.telegramPeerId === telegramPeerId) return;
    await this.entityRepository.save({ ...entity, telegramPeerId });
  }

  async linkToDialog(entityId: string, peerId: string): Promise<void> {
    await this.entityRepository.linkParticipantToDialog(entityId, peerId);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Heuristic: is the name a first-person self-reference? */
function isFirstPersonName(name: string): boolean {
  return /^(i|me|myself|self|user)$/i.test(name.trim());
}

/**
 * Match a candidate subject/object string against `dialogContext.peers` and `message.mentions`.
 */
function matchDialogParticipant(
  rawName: string,
  message?: AgentMessageRecord,
  dialogContext?: DialogMemoryContext,
): DialogParticipantInfo | undefined {
  const peers = dialogContext?.peers;
  const cleaned = rawName.trim();
  if (!cleaned) return undefined;
  const lower = cleaned.toLowerCase();
  const handleCandidate = lower.replace(/^@/, '');

  // 1. First-person resolution ("me", "I", "user") -> sender's peer entry or self entry
  if (isFirstPersonName(cleaned)) {
    if (message?.fromId && peers?.[message.fromId]) {
      return peers[message.fromId];
    }
    if (message?.out && peers) {
      const selfPeer = Object.values(peers).find((p) => p.isSelf);
      if (selfPeer) return selfPeer;
    }
    return undefined;
  }

  // 2. Check message.mentions first (e.g. "@bob_dev" or text mention "Bob")
  if (message?.mentions) {
    for (const mention of message.mentions) {
      const mentionTextLower = mention.text.trim().toLowerCase();
      const mentionUserLower = mention.username?.replace(/^@/, '').trim().toLowerCase();
      if (
        mentionTextLower === lower ||
        mentionTextLower.replace(/^@/, '') === handleCandidate ||
        (mentionUserLower && mentionUserLower === handleCandidate)
      ) {
        if (mention.peerId && peers?.[mention.peerId]) {
          return peers[mention.peerId];
        }
        if (mention.peerId) {
          return {
            id: mention.peerId,
            name: mention.text.startsWith('@') ? undefined : mention.text,
            username: mention.username ?? (mention.text.startsWith('@') ? mention.text.slice(1) : undefined),
            type: 'user',
          };
        }
      }
    }
  }

  if (!peers) return undefined;

  // 3. Direct match in dialogContext.peers by ID, @username, full name, or unique first name
  const peerList = Object.values(peers);
  for (const peer of peerList) {
    if (peer.id.toLowerCase() === lower) return peer;
    if (peer.username && peer.username.replace(/^@/, '').toLowerCase() === handleCandidate) {
      return peer;
    }
    if (peer.name && peer.name.trim().toLowerCase() === lower) {
      return peer;
    }
  }

  // 4. Unique first-name match among participants in the batch (e.g. "Alice" matches "Alice Chen")
  const firstNameMatches = peerList.filter((peer) => {
    const firstToken = peer.name?.trim().split(/\s+/)[0]?.toLowerCase();
    return firstToken && firstToken === lower;
  });
  if (firstNameMatches.length === 1) {
    return firstNameMatches[0];
  }

  return undefined;
}

/** Guess entity type from name heuristics. */
function guessEntityType(name: string): Entity['type'] {
  // Organization patterns
  if (/\b(inc|llc|ltd|corp|company|co\.|agency|firm|group|team)\b/i.test(name)) {
    return 'ORGANIZATION';
  }
  // Place patterns
  if (/\b(city|town|street|ave|blvd|road|country|state|province|office)\b/i.test(name)) {
    return 'PLACE';
  }
  // Assume single capitalized words / proper names are people
  if (/^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(name)) {
    return 'PERSON';
  }
  return 'THING';
}
