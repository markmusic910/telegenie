import { IdbManager } from '@telegenie/libs/foundation/idb';
import type { IdbKey, IdbPutEntry } from '@telegenie/libs/foundation/idb';
import { AGENT_DB_PREFIX, AGENT_DB_VERSION } from './agent-db.constants';
import { buildAgentDbStores } from './agent-db.types';

export type AgentDbOptions = {
  /** Per-tab identifier — use `getTabId()` from `@telegenie/decorators`. */
  tabId: string;
  factory?: IDBFactory;
  flushDelayMs?: number;
  maxBatchSize?: number;
};

/**
 * Thin IdbManager wrapper for the Agent State IndexedDB.
 * Namespaced per-tab: `telegenie-agent_${tabId}`.
 * This prevents cross-tab conflicts since each tab's agent runs are independent.
 */
export class AgentDb {
  private readonly idb: IdbManager;

  constructor(options: AgentDbOptions) {
    this.idb = new IdbManager({
      name: `${AGENT_DB_PREFIX}${options.tabId}`,
      version: AGENT_DB_VERSION,
      stores: buildAgentDbStores(),
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

  async getAllKeys(store: string): Promise<IdbKey[]> {
    return this.idb.getAllKeys(store);
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
