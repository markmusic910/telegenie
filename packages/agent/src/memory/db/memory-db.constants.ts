/**
 * IndexedDB name prefix for the Grafeo Memory Graph store.
 * Full name: `${MEMORY_GRAPH_DB_PREFIX}${accountSlot}`.
 * Differentiated from the deprecated `telegenie-memory_` IndexedDB.
 */
export const MEMORY_GRAPH_DB_PREFIX = 'telegenie-memory-graph_';

/** Default embedding vector dimensions (OpenAI text-embedding-3-small). */
export const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

/** TTL for soft-deleted / expired memories before they can be hard-pruned. */
export const MEMORY_SOFT_DELETE_TTL_DAYS = 90;

/** Canonical node labels in the Grafeo knowledge graph. */
export const GRAPH_LABEL = {
  Entity: 'Entity',
  Memory: 'Memory',
  MessageRef: 'MessageRef',
  Dialog: 'Dialog',
} as const;

export type GraphLabel = (typeof GRAPH_LABEL)[keyof typeof GRAPH_LABEL];

/** Canonical edge types in the Grafeo knowledge graph. */
export const GRAPH_EDGE = {
  ABOUT: 'ABOUT',
  MENTIONS: 'MENTIONS',
  RELATES_TO: 'RELATES_TO',
  SUPERSEDES: 'SUPERSEDES',
  DERIVED_FROM: 'DERIVED_FROM',
  IN_DIALOG: 'IN_DIALOG',
  AUTHORED: 'AUTHORED',
  PARTICIPATES_IN: 'PARTICIPATES_IN',
} as const;

export type GraphEdge = (typeof GRAPH_EDGE)[keyof typeof GRAPH_EDGE];
