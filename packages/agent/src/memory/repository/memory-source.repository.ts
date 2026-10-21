import { v4 as uuidv4 } from 'uuid';
import { MEMORY_STORE } from '../db/memory-db.constants';
import type { MemorySource } from '../db/memory-db.types';
import type { MemoryDb } from '../db/memory-db';

export class MemorySourceRepository {
  constructor(private readonly db: MemoryDb) {}

  async findById(id: string): Promise<MemorySource | undefined> {
    return this.db.get<MemorySource>(MEMORY_STORE.memorySources, id);
  }

  async findByMemoryId(memoryId: string): Promise<MemorySource[]> {
    return this.db.getAllByIndex<MemorySource>(
      MEMORY_STORE.memorySources,
      'byMemoryId',
      memoryId,
    );
  }

  async findByMessageId(messageId: string): Promise<MemorySource[]> {
    return this.db.getAllByIndex<MemorySource>(
      MEMORY_STORE.memorySources,
      'byMessageId',
      messageId,
    );
  }

  /**
   * Check whether a given messageId has already been used as a memory source.
   * Used by the Memory Consolidator to skip already-processed messages (dedup key).
   */
  async existsForMessageId(messageId: string): Promise<boolean> {
    const results = await this.findByMessageId(messageId);
    return results.length > 0;
  }

  async insert(
    partial: Omit<MemorySource, 'id' | 'createdAt'>,
  ): Promise<MemorySource> {
    const source: MemorySource = {
      ...partial,
      id: `src_${uuidv4()}`,
      createdAt: Date.now(),
    };
    await this.db.put<MemorySource>(MEMORY_STORE.memorySources, source);
    return source;
  }
}
