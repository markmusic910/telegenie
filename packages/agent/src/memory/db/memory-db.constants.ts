/** IndexedDB name for the Memory Engine store. Full name: `${MEMORY_DB_PREFIX}${accountSlot}`. */
export const MEMORY_DB_PREFIX = 'telegenie-memory_';

/** Schema version — bump when adding or changing stores/indexes. */
export const MEMORY_DB_VERSION = 1;

/** TTL for soft-deleted / expired memories before they can be hard-pruned (not used in Phase 1). */
export const MEMORY_SOFT_DELETE_TTL_DAYS = 90;

export const MEMORY_STORE = {
  entities: 'entities',
  memories: 'memories',
  memorySources: 'memory_sources',
  commitments: 'commitments',
  embeddings: 'embeddings',
} as const;

export type MemoryStoreName = (typeof MEMORY_STORE)[keyof typeof MEMORY_STORE];
