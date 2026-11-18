import { AGENT_STORE } from '../agent-db.constants';
import type { AgentDb } from '../agent-db';
import type { DialogMemorySync } from '../agent-db.types';

export class DialogMemorySyncRepository {
  constructor(private readonly db: AgentDb) {}

  async findByPeerId(peerId: string): Promise<DialogMemorySync | undefined> {
    return this.db.get<DialogMemorySync>(AGENT_STORE.dialogMemorySyncs, peerId);
  }

  async findAll(): Promise<DialogMemorySync[]> {
    const list = await this.db.getAll<DialogMemorySync>(AGENT_STORE.dialogMemorySyncs);
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

    await this.db.put<DialogMemorySync>(AGENT_STORE.dialogMemorySyncs, merged);
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
    await this.db.put<DialogMemorySync>(AGENT_STORE.dialogMemorySyncs, updated);
    return updated;
  }

  async delete(peerId: string): Promise<void> {
    await this.db.delete(AGENT_STORE.dialogMemorySyncs, peerId);
  }
}
