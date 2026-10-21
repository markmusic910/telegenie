import { IdbManager } from '@telegenie/libs/foundation/idb';
import type { IdbKey, IdbPutEntry } from '@telegenie/libs/foundation/idb';
import { MEMORY_DB_PREFIX, MEMORY_DB_VERSION } from './memory-db.constants';
import { buildMemoryDbStores } from './memory-db.types';

export type MemoryDbOptions = {
  accountSlot: string;
  factory?: IDBFactory;
  flushDelayMs?: number;
  maxBatchSize?: number;
};

/**
 * Thin IdbManager wrapper for the Memory Engine IndexedDB.
 * One instance per accountSlot, opened lazily on first access.
 *
 * DB name: `telegenie-memory_${accountSlot}`
 */
export class MemoryDb {
  private readonly idb: IdbManager;

  constructor(options: MemoryDbOptions) {
    this.idb = new IdbManager({
      name: `${MEMORY_DB_PREFIX}${options.accountSlot}`,
      version: MEMORY_DB_VERSION,
      stores: buildMemoryDbStores(),
      factory: options.factory,
      flushDelayMs: options.flushDelayMs,
      maxBatchSize: options.maxBatchSize,
    });
  }

  async open(): Promise<void> {
    await this.idb.open();
  }

  close(): void {
    this.idb.close();
  }

  destroy(): void {
    this.idb.destroy();
  }

  async get<T = unknown>(store: string, key: IdbKey): Promise<T | undefined> {
    return this.idb.get<T>(store, key);
  }

  async getMany<T = unknown>(store: string, keys: IdbKey[]): Promise<Array<T | undefined>> {
    return this.idb.getMany<T>(store, keys);
  }

  async getAll<T = unknown>(store: string): Promise<T[]> {
    return this.idb.getAll<T>(store);
  }

  async getAllByIndex<T = unknown>(
    store: string,
    indexName: string,
    query: IDBValidKey | IDBKeyRange,
  ): Promise<T[]> {
    return this.idb.getAllByIndex<T>(store, indexName, query);
  }

  async put<T = unknown>(store: string, value: T, key?: IdbKey): Promise<void> {
    await this.idb.put(store, value, key);
  }

  async putMany<T = unknown>(store: string, entries: IdbPutEntry<T>[]): Promise<void> {
    return this.idb.putMany(store, entries);
  }

  async delete(store: string, key: IdbKey): Promise<void> {
    return this.idb.delete(store, key);
  }

  async deleteMany(store: string, keys: IdbKey[]): Promise<void> {
    return this.idb.deleteMany(store, keys);
  }

  async flush(): Promise<void> {
    return this.idb.flush();
  }
}
