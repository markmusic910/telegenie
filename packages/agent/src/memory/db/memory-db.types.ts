import type { IdbStoreSchema } from '@telegenie/libs/foundation/idb';
import { MEMORY_STORE } from './memory-db.constants';

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export type EntityType = 'PERSON' | 'ORGANIZATION' | 'PLACE' | 'THING';

/**
 * AI-layer entity. Does NOT replace Telegram users/chats — it links to them.
 * One entity may correspond to a Telegram user, a chat, or a named thing that
 * appears in messages.
 */
export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  /** Links to Telegram peer ID (string Bot-API style ID, e.g. "12345678", "-1001234567890"). */
  telegramPeerId?: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

export type MemoryType =
  | 'FACT'
  | 'PREFERENCE'
  | 'RELATIONSHIP'
  | 'COMMITMENT'
  | 'EVENT'
  | 'PROJECT'
  | 'TOPIC';

export type MemoryStatus = 'ACTIVE' | 'SUPERSEDED' | 'EXPIRED' | 'DELETED';

/**
 * Core semantic memory derived from one or more Telegram messages.
 * Never use a message id as the memory id — one message can produce many memories.
 */
export interface Memory {
  id: string;
  type: MemoryType;
  /** Entity the memory is about (references Entity.id). */
  subjectId?: string;
  /** Semantic relationship verb, e.g. "works_at", "prefers", "plans_to_move_to". */
  predicate?: string;
  /** Optional second entity (references Entity.id). */
  objectId?: string;
  /** Human-readable representation passed directly to the LLM. */
  content: string;
  /** Extraction confidence 0.0–1.0. */
  confidence: number;
  /** Long-term importance 0.0–1.0. */
  importance: number;
  /** Unix ms when the fact became true (may differ from createdAt). */
  validFrom?: number;
  /** Unix ms when the fact stopped being true. */
  validUntil?: number;
  status: MemoryStatus;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// MemorySource
// ---------------------------------------------------------------------------

/**
 * Traceability link: which Telegram message supports a memory.
 * Invariant: every persisted Memory MUST have ≥1 MemorySource.
 */
export interface MemorySource {
  id: string;
  memoryId: string;
  /** Composite key: `${peerId}:${messageId}` from the SDK cache. */
  messageId: string;
  /** Character offset within the message text (inclusive). */
  sourceStart?: number;
  /** Character offset within the message text (exclusive). */
  sourceEnd?: number;
  /** 0.0–1.0 — how strongly this message supports the memory. */
  relevance: number;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Commitment
// ---------------------------------------------------------------------------

export type CommitmentStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'UNKNOWN';

/**
 * Explicit promise or obligation extracted from messages.
 * Commitments get their own store so they can be queried structurally
 * (e.g. "all PENDING commitments") without LLM/vector search.
 */
export interface Commitment {
  id: string;
  /** Entity who made the promise (references Entity.id). */
  promiserId: string;
  /** Entity who receives the promise (references Entity.id). Optional. */
  recipientId?: string;
  /** Action verb, e.g. "send", "call", "deliver". */
  action: string;
  /** Object of the action, e.g. "proposal", "contract". */
  object?: string;
  /** Unix ms deadline. */
  dueAt?: number;
  status: CommitmentStatus;
  /** 0.0–1.0 extraction confidence. */
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Embedding
// ---------------------------------------------------------------------------

export type EmbeddingOwnerType = 'MESSAGE' | 'MEMORY';

/**
 * Vector embedding for semantic search.
 * Phase 1: stored but not queried (naive text search used instead).
 * Phase 2: used by the Retriever for cosine-similarity ranking.
 */
export interface Embedding {
  id: string;
  ownerType: EmbeddingOwnerType;
  /** Entity.id or memory's composite key. */
  ownerId: string;
  /** Model identifier, e.g. "text-embedding-3-small". */
  model: string;
  /** Raw float32 vector stored as a regular number array (IndexedDB-serialisable). */
  vector: number[];
  createdAt: number;
}

// ---------------------------------------------------------------------------
// IndexedDB store schema
// ---------------------------------------------------------------------------

/** Returns the fixed IdbStoreSchema[] for the Memory IndexedDB. */
export function buildMemoryDbStores(): IdbStoreSchema[] {
  return [
    {
      name: MEMORY_STORE.entities,
      keyPath: 'id',
      indexes: [
        { name: 'byTelegramPeerId', keyPath: 'telegramPeerId' },
        { name: 'byType', keyPath: 'type' },
      ],
    },
    {
      name: MEMORY_STORE.memories,
      keyPath: 'id',
      indexes: [
        { name: 'bySubjectId', keyPath: 'subjectId' },
        { name: 'byType', keyPath: 'type' },
        { name: 'byStatus', keyPath: 'status' },
        { name: 'byImportance', keyPath: 'importance' },
        { name: 'byUpdatedAt', keyPath: 'updatedAt' },
      ],
    },
    {
      name: MEMORY_STORE.memorySources,
      keyPath: 'id',
      indexes: [
        { name: 'byMemoryId', keyPath: 'memoryId' },
        { name: 'byMessageId', keyPath: 'messageId' },
      ],
    },
    {
      name: MEMORY_STORE.commitments,
      keyPath: 'id',
      indexes: [
        { name: 'byPromiserId', keyPath: 'promiserId' },
        { name: 'byRecipientId', keyPath: 'recipientId' },
        { name: 'byStatus', keyPath: 'status' },
        { name: 'byDueAt', keyPath: 'dueAt' },
      ],
    },
    {
      name: MEMORY_STORE.embeddings,
      keyPath: 'id',
      indexes: [{ name: 'byOwnerId', keyPath: 'ownerId' }],
    },
  ];
}
