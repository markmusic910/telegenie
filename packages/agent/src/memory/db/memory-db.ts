import {
  GrafeoDB,
  type SearchResult,
  type TextSearchOptions,
  type UpsertEdgesOptions,
  type UpsertNodesOptions,
  type UpsertSummary,
  type VectorIndexOptions,
  type VectorResult,
  type VectorSearchOptions,
} from '@grafeo-db/web';
import {
  GRAPH_LABEL,
  MEMORY_GRAPH_DB_PREFIX,
} from './memory-db.constants';

export type MemoryDbOptions = {
  accountSlot: string;
  /** Run purely in-memory (no IndexedDB persistence). Useful in Node/Jest tests. */
  inMemory?: boolean;
  /** Debounce interval (ms) for IndexedDB persistence. Default: 300. */
  persistIntervalMs?: number;
  /** Optional vector index configuration. */
  vectorIndexOptions?: VectorIndexOptions;
  /** Optional text tokenizer override ('simple' | 'standard' | 'cjk_bigram'). */
  textTokenizer?: 'simple' | 'standard' | 'cjk_bigram';
};

/**
 * Lazy-initialized GrafeoDB wrapper for the Memory Knowledge Graph.
 *
 * - Persistence key: `telegenie-memory-graph_${accountSlot}` (IndexedDB)
 * - Runs in-thread (`worker: false`) because `telegenie-agent` already executes inside a DedicatedWorker.
 * - Lazy-init ensures idle follower tabs allocate 0 MB of Grafeo WASM heap until first access.
 * - Supports `invalidateAndReload()` so follower tabs reload the latest IDB snapshot after Leader writes.
 */
export class MemoryDb {
  readonly dbName: string;
  private readonly options: MemoryDbOptions;
  private db: GrafeoDB | undefined;
  private openPromise: Promise<GrafeoDB> | undefined;
  private vectorIndexInitialized = false;
  private revision = 0;

  constructor(options: MemoryDbOptions) {
    this.options = options;
    this.dbName = `${MEMORY_GRAPH_DB_PREFIX}${options.accountSlot}`;
  }

  /** Returns the local monotonic write/reload revision counter. */
  getRevision(): number {
    return this.revision;
  }

  /** Increment revision after a write batch. */
  bumpRevision(): number {
    this.revision += 1;
    return this.revision;
  }

  /**
   * Lazily open the GrafeoDB instance and ensure BM25 text indexes exist.
   * Safe to call concurrently — deduplicates via `openPromise`.
   */
  async ensureOpen(): Promise<GrafeoDB> {
    if (this.db && this.db.isOpen) {
      return this.db;
    }
    if (this.openPromise) {
      return this.openPromise;
    }

    this.openPromise = (async () => {
      const usePersist =
        !this.options.inMemory && typeof indexedDB !== 'undefined';

      const instance = await GrafeoDB.create({
        ...(usePersist
          ? {
              persist: this.dbName,
              persistInterval: this.options.persistIntervalMs ?? 300,
              onPersistError: (err) => {
                console.error('[MemoryDb] Grafeo IndexedDB persist error:', err);
              },
            }
          : {}),
        worker: false,
      });

      const tokenizer = this.options.textTokenizer ?? 'standard';
      await Promise.all([
        instance
          .createTextIndex(GRAPH_LABEL.Memory, 'content', { tokenizer })
          .catch(() => undefined),
        instance
          .createTextIndex(GRAPH_LABEL.Entity, 'name', { tokenizer })
          .catch(() => undefined),
      ]);

      this.db = instance;
      this.vectorIndexInitialized = false;
      return instance;
    })();

    try {
      return await this.openPromise;
    } catch (err) {
      this.openPromise = undefined;
      throw err;
    }
  }

  /** Eager open alias (kept for lifecycle parity). */
  async open(): Promise<void> {
    await this.ensureOpen();
  }

  /**
   * Ensure the HNSW vector index is created on `:Memory.embedding`.
   * Called lazily when an EmbeddingProvider supplies vectors.
   */
  async ensureVectorIndex(): Promise<void> {
    const db = await this.ensureOpen();
    if (this.vectorIndexInitialized) return;
    await db
      .createVectorIndex(GRAPH_LABEL.Memory, 'embedding', {
        metric: 'cosine',
        ...this.options.vectorIndexOptions,
      })
      .catch(() => undefined);
    this.vectorIndexInitialized = true;
  }

  /**
   * Close the current in-memory WASM instance so the next access reloads
   * the latest IndexedDB snapshot written by the Leader tab.
   */
  async invalidateAndReload(): Promise<void> {
    this.openPromise = undefined;
    this.vectorIndexInitialized = false;
    if (this.db) {
      const prev = this.db;
      this.db = undefined;
      if (prev.isOpen) {
        await prev.close();
      }
    }
  }

  async close(): Promise<void> {
    await this.invalidateAndReload();
  }

  async clear(): Promise<void> {
    const db = await this.ensureOpen();
    await db.clear();
    this.vectorIndexInitialized = false;
    this.bumpRevision();
  }

  async execute<T extends Record<string, unknown> = Record<string, unknown>>(
    query: string,
    params?: Record<string, unknown>,
    language: 'cypher' | 'gql' = 'cypher',
  ): Promise<T[]> {
    const db = await this.ensureOpen();
    return db.execute<T>(query, { language, params });
  }

  async upsertNodes(
    labels: string | string[],
    rows: Record<string, unknown>[],
    options?: UpsertNodesOptions,
  ): Promise<UpsertSummary> {
    const db = await this.ensureOpen();
    return db.upsertNodes(labels, rows, options);
  }

  async upsertEdges(
    edgeType: string,
    rows: Record<string, unknown>[],
    options?: UpsertEdgesOptions,
  ): Promise<UpsertSummary> {
    const db = await this.ensureOpen();
    return db.upsertEdges(edgeType, rows, options);
  }

  async textSearch(
    label: string,
    property: string,
    query: string,
    k: number,
    options?: TextSearchOptions,
  ): Promise<SearchResult[]> {
    const db = await this.ensureOpen();
    return db.textSearch(label, property, query, k, options);
  }

  async vectorSearch(
    label: string,
    property: string,
    query: Float32Array,
    k: number,
    options?: VectorSearchOptions,
  ): Promise<VectorResult[]> {
    await this.ensureVectorIndex();
    const db = await this.ensureOpen();
    return db.vectorSearch(label, property, query, k, options);
  }

  async hybridSearch(
    label: string,
    textProp: string,
    vectorProp: string,
    queryText: string,
    k: number,
    options?: TextSearchOptions,
  ): Promise<SearchResult[]> {
    await this.ensureVectorIndex();
    const db = await this.ensureOpen();
    return db.hybridSearch(label, textProp, vectorProp, queryText, k, options);
  }

  /**
   * Fetch node properties by internal Grafeo node IDs (`id(n) IN $ids`).
   * Used to hydrate `textSearch` / `hybridSearch` / `vectorSearch` results.
   */
  async getNodesByInternalIds<T extends Record<string, unknown>>(
    label: string,
    internalIds: number[],
  ): Promise<Array<{ internalId: number; props: T }>> {
    if (internalIds.length === 0) return [];
    const rows = await this.execute<{ internalId: number; props: T }>(
      `MATCH (n:${label}) WHERE id(n) IN $ids RETURN id(n) AS internalId, properties(n) AS props`,
      { ids: internalIds },
    );
    return rows;
  }
}
