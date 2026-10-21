import { STORE } from '../constants';
import type { LocalDbContext } from '../context';
import type { RandomIdRow } from '../types';

export class RandomIdStore {
  constructor(private readonly ctx: LocalDbContext) {}

  async putPendingRandomId(randomId: string, peerId: string): Promise<void> {
    const now = Date.now();
    const existing = await this.ctx.idb.get<RandomIdRow>(STORE.randomIds, randomId);
    const row: RandomIdRow = {
      randomId,
      peerId,
      messageId: existing?.messageId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    void this.ctx.idb.putQueued(STORE.randomIds, row);
  }

  async bindRandomId(randomId: string, messageId: number): Promise<void> {
    const existing = await this.ctx.idb.get<RandomIdRow>(STORE.randomIds, randomId);
    const now = Date.now();
    const row: RandomIdRow = {
      randomId,
      peerId: existing?.peerId ?? '',
      messageId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    void this.ctx.idb.putQueued(STORE.randomIds, row);
  }

  async getRandomId(randomId: string): Promise<RandomIdRow | undefined> {
    return this.ctx.idb.get<RandomIdRow>(STORE.randomIds, randomId);
  }

  async deleteRandomId(randomId: string): Promise<void> {
    void this.ctx.idb.deleteQueued(STORE.randomIds, randomId);
  }
}
