import type { EntityRepository } from '../repository/entity.repository';
import type { AgentMessageRecord } from '../../types/agent-message-record';
import type { Entity } from '../db/memory-db.types';

/**
 * Resolves subject/object name strings from extraction candidates into Entity records.
 *
 * Strategy:
 * 1. Check existing entities by name (case-insensitive).
 * 2. If the message has a known fromId, try to link to an existing entity by
 *    telegramPeerId (Bot-API format ID).
 * 3. If no match, create a new Entity (type = PERSON by default for names,
 *    THING for everything else).
 */
export class EntityResolver {
  constructor(private readonly entityRepository: EntityRepository) {}

  /**
   * Resolve a name string to an Entity, creating one if needed.
   * @param name - The subject or object name from the extraction candidate.
   * @param message - The source message (used to link PERSON entities to Telegram users).
   */
  async resolve(name: string, message?: AgentMessageRecord): Promise<Entity> {
    const normalizedName = name.trim();

    // 1. Try by name (case-insensitive dedup)
    const byName = await this.entityRepository.findByName(normalizedName);
    if (byName) return byName;

    // 2. If this is a "me" / "I" resolution and we have a fromId, try by telegram peer
    if (message?.fromId && isFirstPersonName(normalizedName)) {
      const byPeerId = await this.entityRepository.findByTelegramPeerId(message.fromId);
      if (byPeerId) return byPeerId;
    }

    // 3. Create new entity
    const type = guessEntityType(normalizedName);
    const newEntity = await this.entityRepository.upsert({
      type,
      name: normalizedName,
      telegramPeerId: message?.fromId && isFirstPersonName(normalizedName)
        ? message.fromId
        : undefined,
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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Heuristic: is the name a first-person self-reference? */
function isFirstPersonName(name: string): boolean {
  return /^(i|me|myself|self)$/i.test(name.trim());
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
