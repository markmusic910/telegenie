import { v4 as uuidv4 } from 'uuid';
import { MEMORY_STORE } from '../db/memory-db.constants';
import type { Memory, MemoryType, MemoryStatus } from '../db/memory-db.types';
import type { MemoryDb } from '../db/memory-db';

export class MemoryRepository {
  constructor(private readonly db: MemoryDb) {}

  async findById(id: string): Promise<Memory | undefined> {
    return this.db.get<Memory>(MEMORY_STORE.memories, id);
  }

  async findBySubject(subjectId: string): Promise<Memory[]> {
    return this.db.getAllByIndex<Memory>(MEMORY_STORE.memories, 'bySubjectId', subjectId);
  }

  async findByType(type: MemoryType): Promise<Memory[]> {
    return this.db.getAllByIndex<Memory>(MEMORY_STORE.memories, 'byType', type);
  }

  async findByStatus(status: MemoryStatus): Promise<Memory[]> {
    return this.db.getAllByIndex<Memory>(MEMORY_STORE.memories, 'byStatus', status);
  }

  /** All ACTIVE memories, optionally filtered by subjectId. */
  async findActive(subjectId?: string): Promise<Memory[]> {
    if (subjectId) {
      const all = await this.findBySubject(subjectId);
      return all.filter((m) => m.status === 'ACTIVE');
    }
    return this.findByStatus('ACTIVE');
  }

  async findAll(): Promise<Memory[]> {
    return this.db.getAll<Memory>(MEMORY_STORE.memories);
  }

  /**
   * Find an ACTIVE memory with the same subjectId + predicate combination.
   * Used by the consolidator to detect supersedable memories.
   */
  async findActiveBySubjectAndPredicate(
    subjectId: string,
    predicate: string,
  ): Promise<Memory | undefined> {
    const bySubject = await this.findBySubject(subjectId);
    return bySubject.find((m) => m.status === 'ACTIVE' && m.predicate === predicate);
  }

  async save(memory: Memory): Promise<void> {
    await this.db.put<Memory>(MEMORY_STORE.memories, { ...memory, updatedAt: Date.now() });
  }

  async create(
    partial: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  ): Promise<Memory> {
    const now = Date.now();
    const memory: Memory = {
      ...partial,
      id: `mem_${uuidv4()}`,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    await this.db.put<Memory>(MEMORY_STORE.memories, memory);
    return memory;
  }

  /** Soft-mark an existing memory as SUPERSEDED. */
  async markSuperseded(id: string, validUntil = Date.now()): Promise<void> {
    const memory = await this.findById(id);
    if (!memory) return;
    await this.save({ ...memory, status: 'SUPERSEDED', validUntil });
  }

  /** Soft-delete a memory (user-initiated). */
  async markDeleted(id: string): Promise<void> {
    const memory = await this.findById(id);
    if (!memory) return;
    await this.save({ ...memory, status: 'DELETED' });
  }
}
