/**
 * Optional embedding provider for HNSW vector & hybrid search in Grafeo.
 * When undefined, MemoryConsolidator stores memories without vectors and
 * Retriever uses Grafeo's zero-cost BM25 full-text search + graph traversal.
 */
export interface EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  embedText(text: string): Promise<number[] | undefined>;
}
