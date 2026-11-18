import { v4 as uuidv4 } from 'uuid';
import { GRAPH_EDGE, GRAPH_LABEL } from '../db/memory-db.constants';
import type { MemoryDb } from '../db/memory-db';
import type { Entity, EntityType, Memory, MemoryStatus, MemoryType } from '../db/memory-db.types';
import type { IMemoryRepository, MemoryGraphNeighborhood } from './repository.types';

function stripUndefined(obj: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function toMemory(props: Record<string, unknown>): Memory {
  return {
    id: String(props.id),
    type: props.type as MemoryType,
    subjectId: props.subjectId ? String(props.subjectId) : undefined,
    predicate: props.predicate ? String(props.predicate) : undefined,
    objectId: props.objectId ? String(props.objectId) : undefined,
    content: String(props.content),
    confidence: Number(props.confidence),
    importance: Number(props.importance),
    validFrom: props.validFrom != null ? Number(props.validFrom) : undefined,
    validUntil: props.validUntil != null ? Number(props.validUntil) : undefined,
    status: props.status as MemoryStatus,
    embedding: Array.isArray(props.embedding) ? (props.embedding as number[]) : undefined,
    createdAt: Number(props.createdAt),
    updatedAt: Number(props.updatedAt),
  };
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

export class MemoryRepository implements IMemoryRepository {
  constructor(private readonly db: MemoryDb) {}

  async findById(id: string): Promise<Memory | undefined> {
    const rows = await this.db.execute<{ props: Record<string, unknown> }>(
      `MATCH (m:${GRAPH_LABEL.Memory} { id: $id }) RETURN properties(m) AS props LIMIT 1`,
      { id },
    );
    return rows[0]?.props ? toMemory(rows[0].props) : undefined;
  }

  async findBySubject(subjectId: string): Promise<Memory[]> {
    const rows = await this.db.execute<{ props: Record<string, unknown> }>(
      `MATCH (m:${GRAPH_LABEL.Memory})-[:${GRAPH_EDGE.ABOUT}]->(e:${GRAPH_LABEL.Entity} { id: $subjectId })
       RETURN properties(m) AS props`,
      { subjectId },
    );
    return rows.map((r) => toMemory(r.props));
  }

  async findByType(type: MemoryType): Promise<Memory[]> {
    const rows = await this.db.execute<{ props: Record<string, unknown> }>(
      `MATCH (m:${GRAPH_LABEL.Memory} { type: $type }) RETURN properties(m) AS props`,
      { type },
    );
    return rows.map((r) => toMemory(r.props));
  }

  async findByStatus(status: MemoryStatus): Promise<Memory[]> {
    const rows = await this.db.execute<{ props: Record<string, unknown> }>(
      `MATCH (m:${GRAPH_LABEL.Memory} { status: $status }) RETURN properties(m) AS props`,
      { status },
    );
    return rows.map((r) => toMemory(r.props));
  }

  async findActive(subjectId?: string): Promise<Memory[]> {
    if (subjectId) {
      const rows = await this.db.execute<{ props: Record<string, unknown> }>(
        `MATCH (m:${GRAPH_LABEL.Memory} { status: 'ACTIVE' })-[:${GRAPH_EDGE.ABOUT}]->(e:${GRAPH_LABEL.Entity} { id: $subjectId })
         RETURN properties(m) AS props`,
        { subjectId },
      );
      return rows.map((r) => toMemory(r.props));
    }
    return this.findByStatus('ACTIVE');
  }

  async findAll(): Promise<Memory[]> {
    const rows = await this.db.execute<{ props: Record<string, unknown> }>(
      `MATCH (m:${GRAPH_LABEL.Memory}) RETURN properties(m) AS props`,
    );
    return rows.map((r) => toMemory(r.props));
  }

  async findActiveBySubjectAndPredicate(
    subjectId: string,
    predicate: string,
  ): Promise<Memory | undefined> {
    const rows = await this.db.execute<{ props: Record<string, unknown> }>(
      `MATCH (m:${GRAPH_LABEL.Memory} { status: 'ACTIVE', predicate: $predicate })-[:${GRAPH_EDGE.ABOUT}]->(e:${GRAPH_LABEL.Entity} { id: $subjectId })
       RETURN properties(m) AS props LIMIT 1`,
      { subjectId, predicate },
    );
    return rows[0]?.props ? toMemory(rows[0].props) : undefined;
  }

  async save(memory: Memory): Promise<void> {
    const updated: Memory = { ...memory, updatedAt: Date.now() };
    await this.db.upsertNodes(GRAPH_LABEL.Memory, [stripUndefined(updated)], { key: 'id' });
    this.db.bumpRevision();
  }

  async create(
    partial: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  ): Promise<Memory> {
    const now = Date.now();
    const memory: Memory = {
      ...partial,
      id: `mem_${uuidv4()}`,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    if (memory.embedding) {
      await this.db.ensureVectorIndex();
    }

    await this.db.upsertNodes(GRAPH_LABEL.Memory, [stripUndefined(memory)], { key: 'id' });

    if (memory.subjectId) {
      await this.db.upsertEdges(
        GRAPH_EDGE.ABOUT,
        [{ id: `${memory.id}->${memory.subjectId}`, src: memory.id, dst: memory.subjectId }],
        { key: 'id', srcField: 'src', dstField: 'dst', endpointKey: 'id' },
      );
    }

    if (memory.objectId) {
      await this.db.upsertEdges(
        GRAPH_EDGE.MENTIONS,
        [{ id: `${memory.id}->${memory.objectId}`, src: memory.id, dst: memory.objectId }],
        { key: 'id', srcField: 'src', dstField: 'dst', endpointKey: 'id' },
      );

      if (memory.subjectId && memory.predicate) {
        await this.db.upsertEdges(
          GRAPH_EDGE.RELATES_TO,
          [
            {
              id: `${memory.id}:${memory.subjectId}->${memory.objectId}`,
              src: memory.subjectId,
              dst: memory.objectId,
              predicate: memory.predicate,
              memoryId: memory.id,
              status: 'ACTIVE',
              createdAt: now,
            },
          ],
          { key: 'id', srcField: 'src', dstField: 'dst', endpointKey: 'id' },
        );
      }
    }

    this.db.bumpRevision();
    return memory;
  }

  /**
   * Soft-mark an existing memory as SUPERSEDED, update any RELATES_TO edge,
   * and optionally link `(newMemory)-[:SUPERSEDES]->(oldMemory)`.
   */
  async markSuperseded(
    id: string,
    validUntil = Date.now(),
    supersededByMemoryId?: string,
  ): Promise<void> {
    const memory = await this.findById(id);
    if (!memory) return;

    await this.save({ ...memory, status: 'SUPERSEDED', validUntil });

    await this.db.execute(
      `MATCH ()-[r:${GRAPH_EDGE.RELATES_TO} { memoryId: $id }]->() SET r.status = 'SUPERSEDED'`,
      { id },
    );

    if (supersededByMemoryId) {
      await this.db.upsertEdges(
        GRAPH_EDGE.SUPERSEDES,
        [{ id: `${supersededByMemoryId}->${id}`, src: supersededByMemoryId, dst: id }],
        { key: 'id', srcField: 'src', dstField: 'dst', endpointKey: 'id' },
      );
    }

    this.db.bumpRevision();
  }

  async markDeleted(id: string): Promise<void> {
    const memory = await this.findById(id);
    if (!memory) return;
    await this.save({ ...memory, status: 'DELETED' });
    await this.db.execute(
      `MATCH ()-[r:${GRAPH_EDGE.RELATES_TO} { memoryId: $id }]->() SET r.status = 'DELETED'`,
      { id },
    );
  }

  /**
   * BM25 full-text search across ACTIVE `:Memory.content`.
   */
  async searchByText(query: string, topK = 20): Promise<Memory[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const results = await this.db.textSearch(GRAPH_LABEL.Memory, 'content', trimmed, topK, {
      filters: { status: 'ACTIVE' },
    });

    if (results.length === 0) {
      // Fallback: case-insensitive substring match for short/partial tokens
      const active = await this.findActive();
      const lower = trimmed.toLowerCase();
      return active.filter((m) => m.content.toLowerCase().includes(lower)).slice(0, topK);
    }

    const nodes = await this.db.getNodesByInternalIds<Record<string, unknown>>(
      GRAPH_LABEL.Memory,
      results.map((r) => r.id),
    );
    const byId = new Map(nodes.map((n) => [n.internalId, toMemory(n.props)]));
    return results
      .map((r) => byId.get(r.id))
      .filter((m): m is Memory => Boolean(m && m.status === 'ACTIVE'));
  }

  /**
   * Hybrid BM25 + HNSW vector search when `queryVector` is available,
   * otherwise falls back to BM25 `searchByText`.
   */
  async searchHybrid(
    queryText: string,
    queryVector?: number[],
    topK = 20,
  ): Promise<Memory[]> {
    if (!queryVector || queryVector.length === 0) {
      return this.searchByText(queryText, topK);
    }

    const [hybridResults, vectorResults] = await Promise.all([
      this.db
        .hybridSearch(GRAPH_LABEL.Memory, 'content', 'embedding', queryText, topK, {
          filters: { status: 'ACTIVE' },
        })
        .catch(() => []),
      this.db
        .vectorSearch(GRAPH_LABEL.Memory, 'embedding', new Float32Array(queryVector), topK, {
          filters: { status: 'ACTIVE' },
        })
        .catch(() => []),
    ]);

    // Merge scores (RRF-style) across hybrid + vector results
    const scoreMap = new Map<number, number>();
    hybridResults.forEach((r, idx) => {
      scoreMap.set(r.id, (scoreMap.get(r.id) ?? 0) + 1 / (60 + idx));
    });
    vectorResults.forEach((r, idx) => {
      scoreMap.set(r.id, (scoreMap.get(r.id) ?? 0) + 1 / (60 + idx));
    });

    const rankedIds = Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([id]) => id);

    if (rankedIds.length === 0) {
      return this.searchByText(queryText, topK);
    }

    const nodes = await this.db.getNodesByInternalIds<Record<string, unknown>>(
      GRAPH_LABEL.Memory,
      rankedIds,
    );
    const byId = new Map(nodes.map((n) => [n.internalId, toMemory(n.props)]));
    return rankedIds
      .map((id) => byId.get(id))
      .filter((m): m is Memory => Boolean(m && m.status === 'ACTIVE'));
  }

  /**
   * 1..2 hop bounded neighborhood traversal from seed entities and/or active dialog.
   */
  async traverseEntityNeighborhood(
    entityIds: string[],
    options?: { peerId?: string; limit?: number },
  ): Promise<MemoryGraphNeighborhood> {
    const limit = options?.limit ?? 25;
    const memoriesMap = new Map<string, Memory>();
    const entitiesMap = new Map<string, Entity>();

    if (entityIds.length > 0) {
      const memRows = await this.db.execute<{ props: Record<string, unknown> }>(
        `MATCH (e:${GRAPH_LABEL.Entity})<-[:${GRAPH_EDGE.ABOUT}|${GRAPH_EDGE.MENTIONS}]-(m:${GRAPH_LABEL.Memory} { status: 'ACTIVE' })
         WHERE e.id IN $entityIds
         RETURN properties(m) AS props
         LIMIT $limit`,
        { entityIds, limit },
      );
      for (const r of memRows) {
        const mem = toMemory(r.props);
        memoriesMap.set(mem.id, mem);
      }

      const relRows = await this.db.execute<{ props: Record<string, unknown> }>(
        `MATCH (e:${GRAPH_LABEL.Entity})-[:${GRAPH_EDGE.RELATES_TO}*1..2]-(neighbor:${GRAPH_LABEL.Entity})
         WHERE e.id IN $entityIds
         RETURN properties(neighbor) AS props
         LIMIT $limit`,
        { entityIds, limit },
      );
      for (const r of relRows) {
        const ent = toEntity(r.props);
        entitiesMap.set(ent.id, ent);
      }
    }

    if (options?.peerId) {
      const dialogRows = await this.db.execute<{ props: Record<string, unknown> }>(
        `MATCH (m:${GRAPH_LABEL.Memory} { status: 'ACTIVE' })-[:${GRAPH_EDGE.DERIVED_FROM}]->(:${GRAPH_LABEL.MessageRef})-[:${GRAPH_EDGE.IN_DIALOG}]->(:${GRAPH_LABEL.Dialog} { id: $peerId })
         RETURN properties(m) AS props
         LIMIT $limit`,
        { peerId: options.peerId, limit },
      );
      for (const r of dialogRows) {
        const mem = toMemory(r.props);
        memoriesMap.set(mem.id, mem);
      }
    }

    return {
      memories: Array.from(memoriesMap.values()).slice(0, limit),
      entities: Array.from(entitiesMap.values()).slice(0, limit),
    };
  }
}
