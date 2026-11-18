// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export type EntityType =
  | 'PERSON'
  | 'ORGANIZATION'
  | 'PLACE'
  | 'PROJECT'
  | 'TOPIC'
  | 'THING';

/**
 * AI-layer entity stored as an `:Entity` node in Grafeo.
 * Does NOT replace Telegram users/chats — it links to them via `telegramPeerId`.
 */
export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  /** Lowercased trimmed name for case-insensitive lookup. */
  normalizedName?: string;
  /** Links to Telegram peer ID (Bot-API style ID, e.g. "12345678", "-1001234567890"). */
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
  | 'EVENT'
  | 'DECISION'
  | 'COMMITMENT'
  | 'PROJECT'
  | 'TOPIC';

export type MemoryStatus = 'ACTIVE' | 'SUPERSEDED' | 'EXPIRED' | 'DELETED';

/**
 * Core semantic memory stored as a `:Memory` node in Grafeo.
 * Connected to `:Entity` via `ABOUT` / `MENTIONS` and to `:MessageRef` via `DERIVED_FROM`.
 */
export interface Memory {
  id: string;
  type: MemoryType;
  /** Entity the memory is about (references Entity.id; wired via ABOUT edge). */
  subjectId?: string;
  /** Semantic relationship verb, e.g. "works_at", "prefers", "plans_to_move_to". */
  predicate?: string;
  /** Optional second entity (references Entity.id; wired via MENTIONS edge). */
  objectId?: string;
  /** Human-readable representation passed directly to the LLM (BM25 indexed). */
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
  /** Optional embedding vector stored on the node for HNSW hybrid search. */
  embedding?: number[];
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// MemorySource & MessageRef
// ---------------------------------------------------------------------------

/**
 * Traceability link (`DERIVED_FROM` edge) from `:Memory` to `:MessageRef`.
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

/**
 * Lightweight pointer to an original Telegram message stored in SDK cache.
 */
export interface MessageRef {
  id: string;
  peerId: string;
  date: number;
  fromId?: string;
}

/**
 * Direct entity-to-entity semantic edge (`RELATES_TO`) derived from a memory.
 */
export interface EntityRelationship {
  fromEntityId: string;
  toEntityId: string;
  predicate: string;
  memoryId: string;
  status: MemoryStatus;
  createdAt: number;
}
