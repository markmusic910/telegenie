import type { IdbManager } from '../../idb/idb-manager';
import type { LocalDbEntityChange } from './types';

export type LocalDbContext = {
  idb: IdbManager;
  fullInfoTtlMs: number;
  notify: (change: LocalDbEntityChange) => void;
};

export async function getFullWithTtl<T extends { id: string }>(
  ctx: LocalDbContext,
  store: string,
  id: string,
): Promise<T | undefined> {
  const row = await ctx.idb.get<{ id: string; entity: T; storedAt: number }>(store, id);
  if (!row) return undefined;
  if (Date.now() - row.storedAt > ctx.fullInfoTtlMs) {
    void ctx.idb.deleteQueued(store, id);
    return undefined;
  }
  return row.entity;
}
