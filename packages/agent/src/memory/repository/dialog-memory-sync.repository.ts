import { MEMORY_STORE } from '../db/memory-db.constants';
import type { DialogMemorySync } from '../db/memory-db.types';
import type { MemoryDb } from '../db/memory-db';

export class DialogMemorySyncRepository {
  constructor(private readonly db: MemoryDb) {}

  async findByPeerId(peerId: string): Promise<DialogMemorySync | undefined> {
    return this.db.get<DialogMemorySync>(MEMORY_STORE.dialogSync, peerId);
  }

  async findAll(): Promise<DialogMemorySync[]> {
    const list = await this.db.getAll<DialogMemorySync>(MEMORY_STORE.dialogSync);
    // Sort descending by lastSyncAt
    return list.sort((a, b) => b.lastSyncAt - a.lastSyncAt);
  }

  async upsert(data: Partial<DialogMemorySync> & { peerId: string }): Promise<DialogMemorySync> {
    const now = Date.now();
    const existing = await this.findByPeerId(data.peerId);

    // Calculate cumulative date span if fromDate / toDate are supplied
    let fromDate = data.fromDate;
    let toDate = data.toDate;
    if (existing) {
      if (existing.fromDate != null && fromDate != null) {
        fromDate = Math.min(existing.fromDate, fromDate);
      } else if (existing.fromDate != null) {
        fromDate = existing.fromDate;
      }

      if (existing.toDate != null && toDate != null) {
        toDate = Math.max(existing.toDate, toDate);
      } else if (existing.toDate != null) {
        toDate = existing.toDate;
      }
    }

    const merged: DialogMemorySync = {
      peerId: data.peerId,
      lastSyncAt: data.lastSyncAt ?? now,
      fromDate,
      toDate,
      syncedMessageCount:
        (existing?.syncedMessageCount ?? 0) + (data.syncedMessageCount ?? 0),
      incrementalSync:
        data.incrementalSync ?? existing?.incrementalSync ?? false,
      status: data.status ?? existing?.status ?? 'idle',
      error: data.error,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await this.db.put<DialogMemorySync>(MEMORY_STORE.dialogSync, merged);
    return merged;
  }

  async setIncrementalSync(peerId: string, enabled: boolean): Promise<DialogMemorySync> {
    const now = Date.now();
    const existing = await this.findByPeerId(peerId);
    const updated: DialogMemorySync = {
      peerId,
      lastSyncAt: existing?.lastSyncAt ?? 0,
      fromDate: existing?.fromDate,
      toDate: existing?.toDate,
      syncedMessageCount: existing?.syncedMessageCount ?? 0,
      incrementalSync: enabled,
      status: existing?.status ?? 'idle',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.db.put<DialogMemorySync>(MEMORY_STORE.dialogSync, updated);
    return updated;
  }

  async delete(peerId: string): Promise<void> {
    await this.db.delete(MEMORY_STORE.dialogSync, peerId);
  }
}

