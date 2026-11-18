import { IdbManager } from '@telegenie/libs/foundation/idb';
import type { Memory, Entity } from '../memory/db/memory-db.types';
import type { AgentMessageRecord } from '../types/agent-message-record';

// SDK cache constants (replicated to avoid importing @telegenie/sdk)
const SDK_CACHE_DB_PREFIX = 'telegenie-sdk-cache_';
const SDK_CACHE_VERSION = 1;
const SDK_MESSAGE_STORE = 'message';
const SDK_MESSAGE_PEER_INDEX = 'peerId';

type CachedMessageRow = {
  cacheKey: string;
  peerId: string;
  fromId?: string;
  date: number;
  message: string;
  out?: boolean;
};

import type {
  IEntityRepository,
  IMemoryRepository,
} from '../memory/repository/repository.types';
import type { EmbeddingProvider } from '../memory/engine/embedding-provider';
import type { DialogPresetRepository } from '../agent-db/repository/dialog-preset.repository';
import type { DialogPreset } from '../agent-db/agent-db.types';

export type RetrieverOptions = {
  accountSlot: string;
  memoryRepository: IMemoryRepository;
  entityRepository: IEntityRepository;
  dialogPresetRepository?: DialogPresetRepository;
  embeddingProvider?: EmbeddingProvider;
  factory?: IDBFactory;
};

/**
 * Retrieves data from both the SDK message cache and the Grafeo Memory Graph.
 *
 * Search strategy:
 * - Hybrid BM25 + HNSW vector search when `embeddingProvider` is configured,
 *   or zero-cost Grafeo BM25 full-text search otherwise.
 * - Expanded with 1..2-hop graph neighborhood traversal across connected entities & dialogs.
 */
export class Retriever {
  private readonly sdkCacheIdb: IdbManager;
  private readonly memoryRepo: IMemoryRepository;
  private readonly entityRepo: IEntityRepository;
  private readonly dialogPresetRepo?: DialogPresetRepository;
  private readonly embeddingProvider?: EmbeddingProvider;

  constructor(options: RetrieverOptions) {
    this.sdkCacheIdb = new IdbManager({
      name: `${SDK_CACHE_DB_PREFIX}${options.accountSlot}`,
      version: SDK_CACHE_VERSION,
      stores: [
        {
          name: SDK_MESSAGE_STORE,
          keyPath: 'cacheKey',
          indexes: [{ name: SDK_MESSAGE_PEER_INDEX, keyPath: 'peerId' }],
        },
      ],
      factory: options.factory,
    });
    this.memoryRepo = options.memoryRepository;
    this.entityRepo = options.entityRepository;
    this.dialogPresetRepo = options.dialogPresetRepository;
    this.embeddingProvider = options.embeddingProvider;
  }

  async getDialogPreset(peerId: string): Promise<DialogPreset | undefined> {
    return this.dialogPresetRepo?.findByPeerId(peerId);
  }

  // ---------------------------------------------------------------------------
  // Message searches (SDK cache)
  // ---------------------------------------------------------------------------

  /** Full-text search across all cached messages. */
  async searchMessages(query: string, peerId?: string): Promise<AgentMessageRecord[]> {
    const lower = query.toLowerCase();
    let rows: CachedMessageRow[];

    if (peerId) {
      rows = await this.sdkCacheIdb.getAllByIndex<CachedMessageRow>(
        SDK_MESSAGE_STORE,
        SDK_MESSAGE_PEER_INDEX,
        peerId,
      );
    } else {
      rows = await this.sdkCacheIdb.getAll<CachedMessageRow>(SDK_MESSAGE_STORE);
    }

    return rows
      .filter((r) => r.message?.toLowerCase().includes(lower))
      .map(rowToRecord);
  }

  /** Retrieve the last N messages from a specific conversation. */
  async getConversation(peerId: string, limit = 50): Promise<AgentMessageRecord[]> {
    const rows = await this.sdkCacheIdb.getAllByIndex<CachedMessageRow>(
      SDK_MESSAGE_STORE,
      SDK_MESSAGE_PEER_INDEX,
      peerId,
    );
    return rows
      .sort((a, b) => b.date - a.date)
      .slice(0, limit)
      .map(rowToRecord);
  }

  // ---------------------------------------------------------------------------
  // Memory DB searches
  // ---------------------------------------------------------------------------

  async searchMemories(subjectId?: string, type?: Memory['type']): Promise<Memory[]> {
    let memories: Memory[];
    if (subjectId) {
      memories = await this.memoryRepo.findActive(subjectId);
    } else {
      memories = await this.memoryRepo.findActive();
    }
    if (type) {
      memories = memories.filter((m) => m.type === type);
    }
    return memories;
  }

  /** Full-text / hybrid search across memory content strings. */
  async searchMemoriesByText(query: string, limit = 20): Promise<Memory[]> {
    const queryVector = this.embeddingProvider
      ? await this.embeddingProvider.embedText(query).catch(() => undefined)
      : undefined;
    return this.memoryRepo.searchHybrid(query, queryVector, limit);
  }

  /**
   * Hybrid knowledge graph retrieval:
   * 1. BM25 / Hybrid search on `:Memory.content`
   * 2. Entity name match on `:Entity.name`
   * 3. 1..2-hop neighborhood traversal across connected entities & active dialog
   */
  async searchKnowledgeGraph(
    query: string,
    peerId?: string,
    limit = 20,
  ): Promise<{ memories: Memory[]; entities: Entity[] }> {
    const [seedMemories, matchedEntities] = await Promise.all([
      this.searchMemoriesByText(query, limit),
      this.entityRepo.searchByName(query, 10),
    ]);

    const seedEntityIds = new Set<string>(matchedEntities.map((e) => e.id));
    for (const mem of seedMemories) {
      if (mem.subjectId) seedEntityIds.add(mem.subjectId);
      if (mem.objectId) seedEntityIds.add(mem.objectId);
    }

    const neighborhood = await this.memoryRepo.traverseEntityNeighborhood(
      Array.from(seedEntityIds),
      { peerId, limit },
    );

    const memoriesById = new Map<string, Memory>();
    for (const m of seedMemories) memoriesById.set(m.id, m);
    for (const m of neighborhood.memories) {
      if (!memoriesById.has(m.id)) memoriesById.set(m.id, m);
    }

    const entitiesById = new Map<string, Entity>();
    for (const e of matchedEntities) entitiesById.set(e.id, e);
    for (const e of neighborhood.entities) {
      if (!entitiesById.has(e.id)) entitiesById.set(e.id, e);
    }

    return {
      memories: Array.from(memoriesById.values()).slice(0, limit),
      entities: Array.from(entitiesById.values()).slice(0, limit),
    };
  }

  async getPerson(name: string): Promise<Entity | undefined> {
    return this.entityRepo.findByName(name);
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function rowToRecord(row: CachedMessageRow): AgentMessageRecord {
  return {
    id: row.cacheKey,
    peerId: row.peerId,
    fromId: row.fromId,
    date: row.date,
    message: row.message ?? '',
    out: row.out,
  };
}
