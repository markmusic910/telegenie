import { v4 as uuidv4 } from 'uuid';
import { GRAPH_EDGE, GRAPH_LABEL } from '../db/memory-db.constants';
import type { MemoryDb } from '../db/memory-db';
import type { Entity, EntityType } from '../db/memory-db.types';
import type { IEntityRepository } from './repository.types';

function stripUndefined(obj: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function toEntity(props: Record<string, unknown>): Entity {
  return {
    id: String(props.id),
    type: props.type as EntityType,
    name: String(props.name),
    normalizedName: props.normalizedName ? String(props.normalizedName) : undefined,
    telegramPeerId: props.telegramPeerId ? String(props.telegramPeerId) : undefined,
    createdAt: Number(props.createdAt),
    updatedAt: Number(props.updatedAt),
  };
}

export class EntityRepository implements IEntityRepository {
  constructor(private readonly db: MemoryDb) {}

  async findById(id: string): Promise<Entity | undefined> {
    const rows = await this.db.execute<{ props: Record<string, unknown> }>(
      `MATCH (e:${GRAPH_LABEL.Entity} { id: $id }) RETURN properties(e) AS props LIMIT 1`,
      { id },
    );
    return rows[0]?.props ? toEntity(rows[0].props) : undefined;
  }

  async findByTelegramPeerId(telegramPeerId: string): Promise<Entity | undefined> {
    const rows = await this.db.execute<{ props: Record<string, unknown> }>(
      `MATCH (e:${GRAPH_LABEL.Entity} { telegramPeerId: $telegramPeerId }) RETURN properties(e) AS props LIMIT 1`,
      { telegramPeerId },
    );
    return rows[0]?.props ? toEntity(rows[0].props) : undefined;
  }

  async findByType(type: EntityType): Promise<Entity[]> {
    const rows = await this.db.execute<{ props: Record<string, unknown> }>(
      `MATCH (e:${GRAPH_LABEL.Entity} { type: $type }) RETURN properties(e) AS props`,
      { type },
    );
    return rows.map((r) => toEntity(r.props));
  }

  async findAll(): Promise<Entity[]> {
    const rows = await this.db.execute<{ props: Record<string, unknown> }>(
      `MATCH (e:${GRAPH_LABEL.Entity}) RETURN properties(e) AS props`,
    );
    return rows.map((r) => toEntity(r.props));
  }

  /**
   * Find an entity by name (case-insensitive via `normalizedName`).
   */
  async findByName(name: string): Promise<Entity | undefined> {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName) return undefined;
    const rows = await this.db.execute<{ props: Record<string, unknown> }>(
      `MATCH (e:${GRAPH_LABEL.Entity} { normalizedName: $normalizedName }) RETURN properties(e) AS props LIMIT 1`,
      { normalizedName },
    );
    return rows[0]?.props ? toEntity(rows[0].props) : undefined;
  }

  /**
   * BM25 full-text search across `:Entity.name`.
   */
  async searchByName(query: string, limit = 10): Promise<Entity[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const results = await this.db.textSearch(GRAPH_LABEL.Entity, 'name', trimmed, limit);
    if (results.length === 0) return [];
    const nodes = await this.db.getNodesByInternalIds<Record<string, unknown>>(
      GRAPH_LABEL.Entity,
      results.map((r) => r.id),
    );
    const byId = new Map(nodes.map((n) => [n.internalId, toEntity(n.props)]));
    return results.map((r) => byId.get(r.id)).filter((e): e is Entity => Boolean(e));
  }

  async upsert(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entity> {
    const now = Date.now();
    const normalizedName = entity.name.trim().toLowerCase();
    const existing = await this.findByName(entity.name);
    if (existing) {
      const updated: Entity = {
        ...existing,
        ...entity,
        normalizedName,
        updatedAt: now,
      };
      await this.db.upsertNodes(GRAPH_LABEL.Entity, [stripUndefined(updated)], { key: 'id' });
      this.db.bumpRevision();
      return updated;
    }
    const created: Entity = {
      ...entity,
      id: `ent_${uuidv4()}`,
      normalizedName,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.upsertNodes(GRAPH_LABEL.Entity, [stripUndefined(created)], { key: 'id' });
    this.db.bumpRevision();
    return created;
  }

  async save(entity: Entity): Promise<void> {
    const updated: Entity = {
      ...entity,
      normalizedName: entity.name.trim().toLowerCase(),
      updatedAt: Date.now(),
    };
    await this.db.upsertNodes(GRAPH_LABEL.Entity, [stripUndefined(updated)], { key: 'id' });
    this.db.bumpRevision();
  }

  async linkParticipantToDialog(entityId: string, peerId: string): Promise<void> {
    await this.db.upsertNodes(
      GRAPH_LABEL.Dialog,
      [{ id: peerId }],
      { key: 'id' },
    );
    await this.db.upsertEdges(
      GRAPH_EDGE.PARTICIPATES_IN,
      [
        {
          id: `${entityId}->${peerId}`,
          src: entityId,
          dst: peerId,
        },
      ],
      { key: 'id', srcField: 'src', dstField: 'dst', endpointKey: 'id' },
    );
  }
}
