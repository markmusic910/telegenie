import { IdbManager } from '../../idb/idb-manager';
import { DB_NAME_PREFIX, FULL_INFO_TTL_MS, LOCAL_DB_VERSION } from './constants';
import type { LocalDbContext } from './context';
import type { LocalDbEntityChange } from './types';
import { buildLocalDbStores } from './types';

export type LocalDbTestHarness = {
  ctx: LocalDbContext;
  idb: IdbManager;
  changes: LocalDbEntityChange[];
  cleanup: () => Promise<void>;
};

export async function openStoreHarness(options?: {
  fullInfoTtlMs?: number;
  slot?: string;
}): Promise<LocalDbTestHarness> {
  const changes: LocalDbEntityChange[] = [];
  const slot = options?.slot ?? `slot-${Date.now()}-${Math.random()}`;
  const idb = new IdbManager({
    name: `${DB_NAME_PREFIX}${slot}`,
    version: LOCAL_DB_VERSION,
    stores: buildLocalDbStores(),
    flushDelayMs: 10_000,
  });
  await idb.open();
  const ctx: LocalDbContext = {
    idb,
    fullInfoTtlMs: options?.fullInfoTtlMs ?? FULL_INFO_TTL_MS,
    notify: (change) => {
      changes.push(change);
    },
  };
  return {
    ctx,
    idb,
    changes,
    cleanup: async () => {
      try {
        await idb.deleteDatabase();
      } catch {
        idb.destroy();
      }
    },
  };
}
