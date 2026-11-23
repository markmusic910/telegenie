import { IdbManager } from '@telegenie/libs/foundation/idb';
import {
  DB_NAME_PREFIX as LOCAL_DB_PREFIX,
  LOCAL_DB_VERSION,
  STORE as LOCAL_DB_STORE,
} from '@telegenie/libs/foundation/telegram/local-db/constants';
import {
  buildLocalDbStores,
  type ChannelPeerRow,
  type ChatPeerRow,
  type UserPeerRow,
} from '@telegenie/libs/foundation/telegram/local-db/types';
import type { Memory, Entity } from '../memory/db/memory-db.types';
import type {
  AgentMessageRecord,
  DialogMemoryContext,
  DialogParticipantInfo,
  DialogPeerKind,
} from '../types/agent-message-record';

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
  private readonly foundationIdb: IdbManager;
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
    this.foundationIdb = new IdbManager({
      name: `${LOCAL_DB_PREFIX}${options.accountSlot}`,
      version: LOCAL_DB_VERSION,
      stores: buildLocalDbStores(),
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

  /**
   * Retrieve dialog metadata (name, type, and referenced participants) from LocalDb
   * (`telegenie-foundation_${accountSlot}`) for the given `peerId`.
   */
  async getDialogContext(
    peerId: string,
    messages: AgentMessageRecord[] = [],
  ): Promise<DialogMemoryContext> {
    const peerType = dialogPeerKindFromId(peerId);
    const dialogPeer = await this.lookupPeerInfo(peerId);

    const participantIds = new Set<string>();
    if (peerType === 'user') {
      participantIds.add(peerId);
    }
    for (const msg of messages) {
      if (msg.fromId) participantIds.add(msg.fromId);
      if (msg.replyTo?.fromId) participantIds.add(msg.replyTo.fromId);
      if (msg.fwdFrom?.fromId) participantIds.add(msg.fwdFrom.fromId);
    }

    const peers: Record<string, DialogParticipantInfo> = {};
    if (dialogPeer && participantIds.has(peerId)) {
      peers[peerId] = dialogPeer;
      participantIds.delete(peerId);
    }

    const resolved = await Promise.all(
      Array.from(participantIds).map(async (id) => ({
        id,
        info: await this.lookupPeerInfo(id),
      })),
    );
    for (const { id, info } of resolved) {
      if (info) {
        peers[id] = info;
      }
    }

    return {
      peerId,
      ...(dialogPeer?.name ? { peerName: dialogPeer.name } : {}),
      peerType,
      ...(Object.keys(peers).length > 0 ? { peers } : {}),
    };
  }

  private async lookupPeerInfo(peerId: string): Promise<DialogParticipantInfo | undefined> {
    const kind = dialogPeerKindFromId(peerId);
    try {
      if (kind === 'user') {
        const row = await this.foundationIdb.get<UserPeerRow>(LOCAL_DB_STORE.users, peerId);
        const entity = row?.entity;
        if (!entity) return undefined;
        const name = [entity.firstName, entity.lastName].filter(Boolean).join(' ') || entity.username;
        return {
          id: peerId,
          ...(name ? { name } : {}),
          ...(entity.username ? { username: entity.username } : {}),
          type: 'user',
          ...(entity.self ? { isSelf: true } : {}),
        };
      }

      if (kind === 'channel') {
        const rawId = peerId.replace(/^-100/, '');
        const row =
          (await this.foundationIdb.get<ChannelPeerRow>(LOCAL_DB_STORE.channels, rawId)) ??
          (await this.foundationIdb.get<ChannelPeerRow>(LOCAL_DB_STORE.channels, peerId));
        const entity = row?.entity;
        if (!entity) return undefined;
        const username = 'username' in entity ? entity.username : undefined;
        return {
          id: peerId,
          ...(entity.title ? { name: entity.title } : {}),
          ...(username ? { username } : {}),
          type: 'channel',
        };
      }

      const rawId = peerId.replace(/^-/, '');
      const row =
        (await this.foundationIdb.get<ChatPeerRow>(LOCAL_DB_STORE.chats, rawId)) ??
        (await this.foundationIdb.get<ChatPeerRow>(LOCAL_DB_STORE.chats, peerId));
      const entity = row?.entity;
      if (!entity) return undefined;
      return {
        id: peerId,
        ...('title' in entity && entity.title ? { name: entity.title } : {}),
        type: 'chat',
      };
    } catch {
      return undefined;
    }
  }

  // ---------------------------------------------------------------------------
  // Message searches (SDK cache)
  // ---------------------------------------------------------------------------

  /** Full-text search across cached messages (exact phrase or keyword match). */
  async searchMessages(query: string, peerId?: string, limit = 30): Promise<AgentMessageRecord[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

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

    const keywords = extractSearchKeywords(trimmed);

    const scored: Array<{ row: CachedMessageRow; score: number }> = [];
    for (const row of rows) {
      const text = row.message?.toLowerCase();
      if (!text) continue;

      if (text.includes(trimmed)) {
        scored.push({ row, score: keywords.length + 2 });
        continue;
      }

      if (keywords.length > 0) {
        let hits = 0;
        for (const kw of keywords) {
          if (text.includes(kw)) hits++;
        }
        if (hits > 0) {
          scored.push({ row, score: hits });
        }
      }
    }

    return scored
      .sort((a, b) => b.score - a.score || b.row.date - a.row.date)
      .slice(0, limit)
      .map((entry) => rowToRecord(entry.row));
  }

  /** Retrieve the last N non-empty messages from a specific conversation. */
  async getConversation(peerId: string, limit = 50): Promise<AgentMessageRecord[]> {
    const rows = await this.sdkCacheIdb.getAllByIndex<CachedMessageRow>(
      SDK_MESSAGE_STORE,
      SDK_MESSAGE_PEER_INDEX,
      peerId,
    );
    return rows
      .filter((r) => Boolean(r.message?.trim()))
      .sort((a, b) => b.date - a.date)
      .slice(0, limit)
      .map(rowToRecord);
  }

  /** Retrieve a single cached message by peerId and messageId (or full cacheKey). */
  async getMessageById(peerId: string, messageId: string): Promise<AgentMessageRecord | undefined> {
    const cacheKey = messageId.includes(':') ? messageId : `${peerId}:${messageId}`;
    const row =
      (await this.sdkCacheIdb.get<CachedMessageRow>(SDK_MESSAGE_STORE, cacheKey)) ??
      (cacheKey !== messageId
        ? await this.sdkCacheIdb.get<CachedMessageRow>(SDK_MESSAGE_STORE, messageId)
        : undefined);
    if (!row) return undefined;
    return rowToRecord(row);
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
// Helpers
// ---------------------------------------------------------------------------

function dialogPeerKindFromId(peerId: string): DialogPeerKind {
  if (peerId.startsWith('-100')) return 'channel';
  if (peerId.startsWith('-')) return 'chat';
  return 'user';
}

const SEARCH_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'what', 'about',
  'have', 'has', 'had', 'are', 'was', 'were', 'been', 'will', 'would',
  'could', 'should', 'can', 'did', 'does', 'not', 'but', 'you', 'your',
  'our', 'their', 'they', 'them', 'who', 'whom', 'which', 'when', 'where',
  'why', 'how', 'know', 'tell', 'chat', 'dialog', 'conversation', 'message',
  'messages', 'please',
]);

function extractSearchKeywords(normalizedQuery: string): string[] {
  const tokens = normalizedQuery
    .split(/[^\p{L}\p{N}_-]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !SEARCH_STOP_WORDS.has(t));
  return Array.from(new Set(tokens));
}

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
