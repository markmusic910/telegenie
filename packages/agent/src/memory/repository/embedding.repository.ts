import { v4 as uuidv4 } from 'uuid';
import { MEMORY_STORE } from '../db/memory-db.constants';
import type { Embedding, EmbeddingOwnerType } from '../db/memory-db.types';
import type { MemoryDb } from '../db/memory-db';

export class EmbeddingRepository {
  constructor(private readonly db: MemoryDb) {}

  async findById(id: string): Promise<Embedding | undefined> {
    return this.db.get<Embedding>(MEMORY_STORE.embeddings, id);
  }

  async findByOwnerId(ownerId: string): Promise<Embedding[]> {
    return this.db.getAllByIndex<Embedding>(MEMORY_STORE.embeddings, 'byOwnerId', ownerId);
  }

  async findAll(): Promise<Embedding[]> {
    return this.db.getAll<Embedding>(MEMORY_STORE.embeddings);
  }

  /**
   * Upsert: replaces the existing embedding for a given ownerId + model pair.
   * Phase 1: written but not queried (naive text search used by Retriever).
   * Phase 2: Retriever will use cosine similarity on these vectors.
   */
  async upsert(
    ownerId: string,
    ownerType: EmbeddingOwnerType,
    model: string,
    vector: number[],
  ): Promise<Embedding> {
    const existing = (await this.findByOwnerId(ownerId)).find((e) => e.model === model);
    const embedding: Embedding = {
      id: existing?.id ?? `emb_${uuidv4()}`,
      ownerType,
      ownerId,
      model,
      vector,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await this.db.put<Embedding>(MEMORY_STORE.embeddings, embedding);
    return embedding;
  }
}
