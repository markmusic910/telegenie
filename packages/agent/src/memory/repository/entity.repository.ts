import { v4 as uuidv4 } from 'uuid';
import { MEMORY_STORE } from '../db/memory-db.constants';
import type { Entity, EntityType } from '../db/memory-db.types';
import type { MemoryDb } from '../db/memory-db';

export class EntityRepository {
  constructor(private readonly db: MemoryDb) {}

  async findById(id: string): Promise<Entity | undefined> {
    return this.db.get<Entity>(MEMORY_STORE.entities, id);
  }

  async findByTelegramPeerId(telegramPeerId: string): Promise<Entity | undefined> {
    const results = await this.db.getAllByIndex<Entity>(
      MEMORY_STORE.entities,
      'byTelegramPeerId',
      telegramPeerId,
    );
    return results[0];
  }

  async findByType(type: EntityType): Promise<Entity[]> {
    return this.db.getAllByIndex<Entity>(MEMORY_STORE.entities, 'byType', type);
  }

  async findAll(): Promise<Entity[]> {
    return this.db.getAll<Entity>(MEMORY_STORE.entities);
  }

  /**
   * Find an entity by name (case-insensitive). Used by entity resolver for dedup.
   * Iterates all entities; acceptable for Phase 1 scale.
   */
  async findByName(name: string): Promise<Entity | undefined> {
    const all = await this.findAll();
    const lower = name.toLowerCase();
    return all.find((e) => e.name.toLowerCase() === lower);
  }

  async upsert(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entity> {
    const now = Date.now();
    const existing = await this.findByName(entity.name);
    if (existing) {
      const updated: Entity = { ...existing, ...entity, updatedAt: now };
      await this.db.put<Entity>(MEMORY_STORE.entities, updated);
      return updated;
    }
    const created: Entity = { ...entity, id: `ent_${uuidv4()}`, createdAt: now, updatedAt: now };
    await this.db.put<Entity>(MEMORY_STORE.entities, created);
    return created;
  }

  async save(entity: Entity): Promise<void> {
    await this.db.put<Entity>(MEMORY_STORE.entities, { ...entity, updatedAt: Date.now() });
  }
}
