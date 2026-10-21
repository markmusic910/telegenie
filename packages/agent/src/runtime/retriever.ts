import { IdbManager } from '@telegenie/libs/foundation/idb';
import type { Memory, Commitment, Entity } from '../memory/db/memory-db.types';
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

import type { MemoryRepository } from '../memory/repository/memory.repository';
import type { CommitmentRepository } from '../memory/repository/commitment.repository';
import type { EntityRepository } from '../memory/repository/entity.repository';
import type { DialogPresetRepository } from '../agent-db/repository/dialog-preset.repository';
import type { DialogPreset } from '../agent-db/agent-db.types';

export type RetrieverOptions = {
  accountSlot: string;
  memoryRepository: MemoryRepository;
  commitmentRepository: CommitmentRepository;
  entityRepository: EntityRepository;
  dialogPresetRepository?: DialogPresetRepository;
  factory?: IDBFactory;
};

/**
 * Retrieves data from both the SDK message cache and the Memory DB for the agent.
 *
 * Phase 1 search strategy: naive text matching (iterate + filter).
 * Phase 2: use embeddings store for cosine-similarity ranking.
 */
export class Retriever {
  private readonly sdkCacheIdb: IdbManager;
  private readonly memoryRepo: MemoryRepository;
  private readonly commitmentRepo: CommitmentRepository;
  private readonly entityRepo: EntityRepository;
  private readonly dialogPresetRepo?: DialogPresetRepository;

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
    this.commitmentRepo = options.commitmentRepository;
    this.entityRepo = options.entityRepository;
    this.dialogPresetRepo = options.dialogPresetRepository;
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

  /** Full-text search across memory content strings. */
  async searchMemoriesByText(query: string): Promise<Memory[]> {
    const active = await this.memoryRepo.findActive();
    const lower = query.toLowerCase();
    return active.filter((m) => m.content.toLowerCase().includes(lower));
  }

  async getPerson(name: string): Promise<Entity | undefined> {
    return this.entityRepo.findByName(name);
  }

  async getCommitments(status?: Commitment['status']): Promise<Commitment[]> {
    if (status) {
      return this.commitmentRepo.findByStatus(status);
    }
    return this.commitmentRepo.findAll();
  }

  async getPendingCommitments(): Promise<Commitment[]> {
    return this.commitmentRepo.findPending();
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
