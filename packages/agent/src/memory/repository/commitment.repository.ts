import { v4 as uuidv4 } from 'uuid';
import { MEMORY_STORE } from '../db/memory-db.constants';
import type { Commitment, CommitmentStatus } from '../db/memory-db.types';
import type { MemoryDb } from '../db/memory-db';

export class CommitmentRepository {
  constructor(private readonly db: MemoryDb) {}

  async findById(id: string): Promise<Commitment | undefined> {
    return this.db.get<Commitment>(MEMORY_STORE.commitments, id);
  }

  async findByPromisor(promiserId: string): Promise<Commitment[]> {
    return this.db.getAllByIndex<Commitment>(
      MEMORY_STORE.commitments,
      'byPromiserId',
      promiserId,
    );
  }

  async findByRecipient(recipientId: string): Promise<Commitment[]> {
    return this.db.getAllByIndex<Commitment>(
      MEMORY_STORE.commitments,
      'byRecipientId',
      recipientId,
    );
  }

  async findByStatus(status: CommitmentStatus): Promise<Commitment[]> {
    return this.db.getAllByIndex<Commitment>(MEMORY_STORE.commitments, 'byStatus', status);
  }

  async findPending(): Promise<Commitment[]> {
    return this.findByStatus('PENDING');
  }

  async findAll(): Promise<Commitment[]> {
    return this.db.getAll<Commitment>(MEMORY_STORE.commitments);
  }

  async create(
    partial: Omit<Commitment, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Commitment> {
    const now = Date.now();
    const commitment: Commitment = {
      ...partial,
      id: `com_${uuidv4()}`,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.put<Commitment>(MEMORY_STORE.commitments, commitment);
    return commitment;
  }

  async updateStatus(id: string, status: CommitmentStatus): Promise<void> {
    const commitment = await this.findById(id);
    if (!commitment) return;
    await this.db.put<Commitment>(MEMORY_STORE.commitments, {
      ...commitment,
      status,
      updatedAt: Date.now(),
    });
  }

  async save(commitment: Commitment): Promise<void> {
    await this.db.put<Commitment>(MEMORY_STORE.commitments, {
      ...commitment,
      updatedAt: Date.now(),
    });
  }
}
