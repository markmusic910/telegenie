import { v4 as uuidv4 } from 'uuid';
import { GRAPH_EDGE, GRAPH_LABEL } from '../db/memory-db.constants';
import type { MemoryDb } from '../db/memory-db';
import type { MemorySource } from '../db/memory-db.types';
import type { IMemorySourceRepository, MessageRefMetadata } from './repository.types';

function stripUndefined(obj: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function toMemorySource(
  edgeProps: Record<string, unknown>,
  memoryId: string,
  messageId: string,
): MemorySource {
  return {
    id: String(edgeProps.id),
    memoryId,
    messageId,
    sourceStart: edgeProps.sourceStart != null ? Number(edgeProps.sourceStart) : undefined,
    sourceEnd: edgeProps.sourceEnd != null ? Number(edgeProps.sourceEnd) : undefined,
    relevance: Number(edgeProps.relevance),
    createdAt: Number(edgeProps.createdAt),
  };
}

export class MemorySourceRepository implements IMemorySourceRepository {
  constructor(private readonly db: MemoryDb) {}

  async findById(id: string): Promise<MemorySource | undefined> {
    const rows = await this.db.execute<{
      edge: Record<string, unknown>;
      memoryId: string;
      messageId: string;
    }>(
      `MATCH (m:${GRAPH_LABEL.Memory})-[r:${GRAPH_EDGE.DERIVED_FROM} { id: $id }]->(msg:${GRAPH_LABEL.MessageRef})
       RETURN properties(r) AS edge, m.id AS memoryId, msg.id AS messageId LIMIT 1`,
      { id },
    );
    const row = rows[0];
    return row ? toMemorySource(row.edge, row.memoryId, row.messageId) : undefined;
  }

  async findByMemoryId(memoryId: string): Promise<MemorySource[]> {
    const rows = await this.db.execute<{
      edge: Record<string, unknown>;
      messageId: string;
    }>(
      `MATCH (m:${GRAPH_LABEL.Memory} { id: $memoryId })-[r:${GRAPH_EDGE.DERIVED_FROM}]->(msg:${GRAPH_LABEL.MessageRef})
       RETURN properties(r) AS edge, msg.id AS messageId`,
      { memoryId },
    );
    return rows.map((r) => toMemorySource(r.edge, memoryId, r.messageId));
  }

  async findByMessageId(messageId: string): Promise<MemorySource[]> {
    const rows = await this.db.execute<{
      edge: Record<string, unknown>;
      memoryId: string;
    }>(
      `MATCH (m:${GRAPH_LABEL.Memory})-[r:${GRAPH_EDGE.DERIVED_FROM}]->(msg:${GRAPH_LABEL.MessageRef} { id: $messageId })
       RETURN properties(r) AS edge, m.id AS memoryId`,
      { messageId },
    );
    return rows.map((r) => toMemorySource(r.edge, r.memoryId, messageId));
  }

  async existsForMessageId(messageId: string): Promise<boolean> {
    const rows = await this.db.execute<{ memoryId: string }>(
      `MATCH (m:${GRAPH_LABEL.Memory})-[:${GRAPH_EDGE.DERIVED_FROM}]->(msg:${GRAPH_LABEL.MessageRef} { id: $messageId })
       RETURN m.id AS memoryId LIMIT 1`,
      { messageId },
    );
    return rows.length > 0;
  }

  async insert(
    partial: Omit<MemorySource, 'id' | 'createdAt'>,
    meta?: MessageRefMetadata,
  ): Promise<MemorySource> {
    const now = Date.now();
    const source: MemorySource = {
      ...partial,
      id: `src_${uuidv4()}`,
      createdAt: now,
    };

    const peerId = meta?.peerId ?? partial.messageId.split(':')[0] ?? 'unknown';

    // 1. Upsert lightweight :MessageRef and :Dialog container
    await this.db.upsertNodes(
      GRAPH_LABEL.MessageRef,
      [
        stripUndefined({
          id: partial.messageId,
          peerId,
          date: meta?.date ?? Math.floor(now / 1000),
          fromId: meta?.fromId,
        }),
      ],
      { key: 'id' },
    );
    await this.db.upsertNodes(GRAPH_LABEL.Dialog, [{ id: peerId }], { key: 'id' });

    // 2. Wire (:MessageRef)-[:IN_DIALOG]->(:Dialog)
    await this.db.upsertEdges(
      GRAPH_EDGE.IN_DIALOG,
      [{ id: `${partial.messageId}->${peerId}`, src: partial.messageId, dst: peerId }],
      { key: 'id', srcField: 'src', dstField: 'dst', endpointKey: 'id' },
    );

    // 3. Wire (:Entity)-[:AUTHORED]->(:MessageRef) if authorEntityId is known
    if (meta?.authorEntityId) {
      await this.db.upsertEdges(
        GRAPH_EDGE.AUTHORED,
        [
          {
            id: `${meta.authorEntityId}->${partial.messageId}`,
            src: meta.authorEntityId,
            dst: partial.messageId,
          },
        ],
        { key: 'id', srcField: 'src', dstField: 'dst', endpointKey: 'id' },
      );
    }

    // 4. Wire (:Memory)-[:DERIVED_FROM]->(:MessageRef)
    await this.db.upsertEdges(
      GRAPH_EDGE.DERIVED_FROM,
      [
        stripUndefined({
          id: source.id,
          src: partial.memoryId,
          dst: partial.messageId,
          sourceStart: partial.sourceStart,
          sourceEnd: partial.sourceEnd,
          relevance: partial.relevance,
          createdAt: source.createdAt,
        }),
      ],
      { key: 'id', srcField: 'src', dstField: 'dst', endpointKey: 'id' },
    );

    this.db.bumpRevision();
    return source;
  }
}
