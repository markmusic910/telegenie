import { yieldToMain } from '../../utils/scheduler/yield';
import { DEFAULT_FLUSH_DELAY_MS, DEFAULT_MAX_BATCH_SIZE } from './constants';
import type {
  IdbKey,
  IdbOpenOptions,
  IdbPutEntry,
  IdbStoreSchema,
  IdbTransactionMode,
} from './types';
import { settleResolvers, WriteQueue } from './write-queue';

type QueuedEntry = ReturnType<WriteQueue['take']>[number];

/**
 * Thin IndexedDB wrapper with schema open/upgrade, CRUD, and a coalesce-by-key
 * write queue. Reads consult the pending queue first (read-your-writes).
 */
export class IdbManager {
  private readonly name: string;
  private readonly version: number;
  private readonly stores: IdbStoreSchema[];
  private readonly factory: IDBFactory | undefined;
  private readonly flushDelayMs: number;
  private readonly maxBatchSize: number;
  private readonly storeSchemaByName: Map<string, IdbStoreSchema>;
  private readonly writeQueue = new WriteQueue();

  private db: IDBDatabase | undefined;
  private openPromise: Promise<IDBDatabase> | undefined;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private flushPromise: Promise<void> | undefined;
  private closed = false;

  constructor(options: IdbOpenOptions) {
    this.name = options.name;
    this.version = options.version;
    this.stores = options.stores;
    this.factory = options.factory ?? getDefaultFactory();
    this.flushDelayMs = options.flushDelayMs ?? DEFAULT_FLUSH_DELAY_MS;
    this.maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    this.storeSchemaByName = new Map(options.stores.map((s) => [s.name, s]));
  }

  static isSupported(factory?: IDBFactory): boolean {
    const f = factory ?? getDefaultFactory();
    return Boolean(f && typeof f.open === 'function');
  }

  async open(): Promise<void> {
    this.assertNotClosed();
    await this.ensureDb();
  }

  close(): void {
    this.clearFlushTimer();
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
    this.openPromise = undefined;
  }

  destroy(): void {
    this.clearFlushTimer();
    this.writeQueue.settleAll(new Error('IdbManager destroyed'));
    this.close();
    this.closed = true;
  }

  async deleteDatabase(): Promise<void> {
    this.clearFlushTimer();
    this.writeQueue.settleAll();
    this.close();

    const factory = this.requireFactory();
    await requestToPromise(factory.deleteDatabase(this.name));
  }

  async get<T = unknown>(store: string, key: IdbKey): Promise<T | undefined> {
    const pending = this.writeQueue.peek(store, key);
    if (pending) {
      if (pending.type === 'delete') return undefined;
      return pending.value as T;
    }

    const db = await this.ensureDb();
    return this.withStore(db, store, 'readonly', (objectStore) =>
      requestToPromise<T | undefined>(objectStore.get(key)),
    );
  }

  async getMany<T = unknown>(store: string, keys: IdbKey[]): Promise<Array<T | undefined>> {
    if (keys.length === 0) return [];

    const results: Array<T | undefined> = new Array(keys.length);
    const missingIndexes: number[] = [];
    const missingKeys: IdbKey[] = [];

    for (let i = 0; i < keys.length; i++) {
      const pending = this.writeQueue.peek(store, keys[i]);
      if (pending) {
        results[i] = pending.type === 'delete' ? undefined : (pending.value as T);
      } else {
        missingIndexes.push(i);
        missingKeys.push(keys[i]);
      }
    }

    if (missingKeys.length === 0) return results;

    const db = await this.ensureDb();
    await this.withStore(db, store, 'readonly', async (objectStore) => {
      await Promise.all(
        missingKeys.map(async (key, j) => {
          const value = await requestToPromise<T | undefined>(objectStore.get(key));
          results[missingIndexes[j]] = value;
        }),
      );
    });

    return results;
  }

  async getAll<T = unknown>(
    store: string,
    query?: IDBValidKey | IDBKeyRange,
    count?: number,
  ): Promise<T[]> {
    await this.flush();
    const db = await this.ensureDb();
    return this.withStore(db, store, 'readonly', (objectStore) =>
      requestToPromise<T[]>(objectStore.getAll(query, count)),
    );
  }

  async getAllKeys(
    store: string,
    query?: IDBValidKey | IDBKeyRange,
    count?: number,
  ): Promise<IdbKey[]> {
    await this.flush();
    const db = await this.ensureDb();
    return this.withStore(db, store, 'readonly', (objectStore) =>
      requestToPromise<IdbKey[]>(objectStore.getAllKeys(query, count)),
    );
  }

  async put<T = unknown>(store: string, value: T, key?: IdbKey): Promise<IdbKey> {
    const resolvedKey = this.resolveKey(store, value, key);
    this.writeQueue.settleKey(store, resolvedKey);

    const db = await this.ensureDb();
    return this.withStore(db, store, 'readwrite', (objectStore) =>
      requestToPromise<IdbKey>(
        key === undefined && this.hasKeyPath(store)
          ? objectStore.put(value)
          : objectStore.put(value, resolvedKey),
      ),
    );
  }

  async putMany<T = unknown>(store: string, entries: IdbPutEntry<T>[]): Promise<void> {
    if (entries.length === 0) return;

    for (const entry of entries) {
      const resolvedKey = this.resolveKey(store, entry.value, entry.key);
      this.writeQueue.settleKey(store, resolvedKey);
    }

    const db = await this.ensureDb();
    await this.withStore(db, store, 'readwrite', async (objectStore) => {
      for (const entry of entries) {
        const resolvedKey = this.resolveKey(store, entry.value, entry.key);
        await requestToPromise(
          entry.key === undefined && this.hasKeyPath(store)
            ? objectStore.put(entry.value)
            : objectStore.put(entry.value, resolvedKey),
        );
      }
    });
  }

  async delete(store: string, key: IdbKey): Promise<void> {
    this.writeQueue.settleKey(store, key);
    const db = await this.ensureDb();
    await this.withStore(db, store, 'readwrite', (objectStore) =>
      requestToPromise(objectStore.delete(key)),
    );
  }

  async deleteMany(store: string, keys: IdbKey[]): Promise<void> {
    if (keys.length === 0) return;
    for (const key of keys) {
      this.writeQueue.settleKey(store, key);
    }
    const db = await this.ensureDb();
    await this.withStore(db, store, 'readwrite', async (objectStore) => {
      for (const key of keys) {
        await requestToPromise(objectStore.delete(key));
      }
    });
  }

  async clear(store: string): Promise<void> {
    this.writeQueue.settleStore(store);
    const db = await this.ensureDb();
    await this.withStore(db, store, 'readwrite', (objectStore) =>
      requestToPromise(objectStore.clear()),
    );
  }

  async count(store: string, query?: IDBValidKey | IDBKeyRange): Promise<number> {
    await this.flush();
    const db = await this.ensureDb();
    return this.withStore(db, store, 'readonly', (objectStore) =>
      requestToPromise<number>(objectStore.count(query)),
    );
  }

  async has(store: string, key: IdbKey): Promise<boolean> {
    const pending = this.writeQueue.peek(store, key);
    if (pending) {
      return pending.type === 'put';
    }
    const value = await this.get(store, key);
    return value !== undefined;
  }

  async keys(store: string): Promise<IdbKey[]> {
    return this.getAllKeys(store);
  }

  async getByIndex<T = unknown>(
    store: string,
    indexName: string,
    key: IdbKey,
  ): Promise<T | undefined> {
    await this.flush();
    const db = await this.ensureDb();
    return this.withStore(db, store, 'readonly', (objectStore) =>
      requestToPromise<T | undefined>(objectStore.index(indexName).get(key)),
    );
  }

  async getAllByIndex<T = unknown>(
    store: string,
    indexName: string,
    query?: IDBValidKey | IDBKeyRange,
    count?: number,
  ): Promise<T[]> {
    await this.flush();
    const db = await this.ensureDb();
    return this.withStore(db, store, 'readonly', (objectStore) =>
      requestToPromise<T[]>(objectStore.index(indexName).getAll(query, count)),
    );
  }

  async iterate<T = unknown>(
    store: string,
    callback: (value: T, key: IdbKey) => void | Promise<void>,
  ): Promise<void> {
    await this.flush();
    const db = await this.ensureDb();
    await this.withStore(db, store, 'readonly', (objectStore) => {
      return new Promise<void>((resolve, reject) => {
        const request = objectStore.openCursor();
        request.onerror = () => reject(request.error ?? new Error('Cursor failed'));
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve();
            return;
          }
          Promise.resolve(callback(cursor.value as T, cursor.key))
            .then(() => {
              cursor.continue();
            })
            .catch(reject);
        };
      });
    });
  }

  async runTransaction<T>(
    storeNames: string | string[],
    mode: IdbTransactionMode,
    fn: (stores: Record<string, IDBObjectStore>, tx: IDBTransaction) => Promise<T> | T,
  ): Promise<T> {
    if (mode !== 'readonly') {
      await this.flush();
    }
    const db = await this.ensureDb();
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const tx = db.transaction(names, mode);
    const stores: Record<string, IDBObjectStore> = {};
    for (const name of names) {
      stores[name] = tx.objectStore(name);
    }

    try {
      const result = await fn(stores, tx);
      await transactionDone(tx);
      return result;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // ignore abort errors if already finished
      }
      throw error;
    }
  }

  putQueued<T = unknown>(store: string, value: T, key?: IdbKey): Promise<void> {
    this.assertNotClosed();
    const resolvedKey = this.resolveKey(store, value, key);
    const promise = this.writeQueue.enqueue('put', store, resolvedKey, value);
    this.scheduleFlush();
    return promise;
  }

  deleteQueued(store: string, key: IdbKey): Promise<void> {
    this.assertNotClosed();
    const promise = this.writeQueue.enqueue('delete', store, key);
    this.scheduleFlush();
    return promise;
  }

  flush(): Promise<void> {
    this.clearFlushTimer();
    if (this.flushPromise) return this.flushPromise;
    if (this.writeQueue.size === 0) return Promise.resolve();

    this.flushPromise = this.drainQueue().finally(() => {
      this.flushPromise = undefined;
    });

    return this.flushPromise;
  }

  private async drainQueue(): Promise<void> {
    while (this.writeQueue.size > 0) {
      const batch = this.writeQueue.take(this.maxBatchSize);
      if (batch.length === 0) break;

      try {
        await this.writeBatch(batch);
        for (const entry of batch) {
          settleResolvers(entry.resolvers);
        }
      } catch (error) {
        this.writeQueue.requeue(batch);
        for (const entry of batch) {
          settleResolvers(entry.resolvers, error);
        }
        throw error;
      }

      if (this.writeQueue.size > 0) {
        await yieldToMain();
      }
    }
  }

  private async writeBatch(batch: QueuedEntry[]): Promise<void> {
    const db = await this.ensureDb();
    const byStore = new Map<string, QueuedEntry[]>();
    for (const entry of batch) {
      const list = byStore.get(entry.op.store) ?? [];
      list.push(entry);
      byStore.set(entry.op.store, list);
    }

    for (const [storeName, entries] of byStore) {
      await this.withStore(db, storeName, 'readwrite', async (objectStore) => {
        for (const entry of entries) {
          if (entry.op.type === 'put') {
            await requestToPromise(
              this.hasKeyPath(storeName)
                ? objectStore.put(entry.op.value)
                : objectStore.put(entry.op.value, entry.op.key),
            );
          } else {
            await requestToPromise(objectStore.delete(entry.op.key));
          }
        }
      });
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== undefined) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.flush().catch((err) => {
        console.warn('IdbManager flush failed:', err);
      });
    }, this.flushDelayMs);
  }

  private clearFlushTimer(): void {
    if (this.flushTimer !== undefined) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  private async ensureDb(): Promise<IDBDatabase> {
    this.assertNotClosed();
    if (this.db) return this.db;
    if (this.openPromise) return this.openPromise;

    const factory = this.requireFactory();
    const stores = this.stores;

    this.openPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(this.name, this.version);

      request.onerror = () => {
        this.openPromise = undefined;
        reject(request.error ?? new Error(`Failed to open IndexedDB "${this.name}"`));
      };

      request.onblocked = () => {
        console.warn(`IdbManager open blocked for "${this.name}"`);
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        const tx = request.transaction;
        if (!tx) {
          reject(new Error(`Missing upgrade transaction for "${this.name}"`));
          return;
        }
        applySchemaUpgrade(db, tx, stores);
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          if (this.db === db) {
            this.db = undefined;
            this.openPromise = undefined;
          }
        };
        this.db = db;
        resolve(db);
      };
    });

    try {
      return await this.openPromise;
    } catch (error) {
      this.openPromise = undefined;
      throw error;
    }
  }

  private requireFactory(): IDBFactory {
    if (!this.factory) {
      throw new Error('IndexedDB is not available in this environment');
    }
    return this.factory;
  }

  private assertNotClosed(): void {
    if (this.closed) {
      throw new Error('IdbManager has been destroyed');
    }
  }

  private hasKeyPath(store: string): boolean {
    return this.storeSchemaByName.get(store)?.keyPath !== undefined;
  }

  private resolveKey(store: string, value: unknown, key?: IdbKey): IdbKey {
    if (key !== undefined) return key;

    const schema = this.storeSchemaByName.get(store);
    if (!schema?.keyPath) {
      throw new Error(
        `Explicit key required for store "${store}" (no keyPath in schema)`,
      );
    }

    const extracted = extractKeyPath(value, schema.keyPath);
    if (extracted === undefined) {
      throw new Error(`Could not extract keyPath from value for store "${store}"`);
    }
    return extracted;
  }

  private async withStore<T>(
    db: IDBDatabase,
    store: string,
    mode: IdbTransactionMode,
    fn: (objectStore: IDBObjectStore) => Promise<T> | T,
  ): Promise<T> {
    const tx = db.transaction(store, mode);
    const objectStore = tx.objectStore(store);
    try {
      const result = await fn(objectStore);
      await transactionDone(tx);
      return result;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // ignore
      }
      throw error;
    }
  }
}

function getDefaultFactory(): IDBFactory | undefined {
  if (typeof indexedDB !== 'undefined') return indexedDB;
  if (typeof globalThis !== 'undefined' && 'indexedDB' in globalThis) {
    return (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  }
  return undefined;
}

export function applySchemaUpgrade(
  db: IDBDatabase,
  tx: IDBTransaction,
  stores: IdbStoreSchema[],
): void {
  for (const schema of stores) {
    let objectStore: IDBObjectStore;
    if (!db.objectStoreNames.contains(schema.name)) {
      objectStore = db.createObjectStore(schema.name, {
        keyPath: schema.keyPath,
        autoIncrement: schema.autoIncrement,
      });
    } else {
      objectStore = tx.objectStore(schema.name);
    }

    for (const index of schema.indexes ?? []) {
      if (!objectStore.indexNames.contains(index.name)) {
        objectStore.createIndex(index.name, index.keyPath, {
          unique: index.unique,
          multiEntry: index.multiEntry,
        });
      }
    }
  }
}

export function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function extractKeyPath(value: unknown, keyPath: string | string[]): IdbKey | undefined {
  if (typeof keyPath === 'string') {
    return getPath(value, keyPath) as IdbKey | undefined;
  }
  const parts = keyPath.map((path) => getPath(value, path));
  if (parts.some((p) => p === undefined)) return undefined;
  return parts as IdbKey[];
}

function getPath(value: unknown, path: string): unknown {
  if (value === null || value === undefined) return undefined;
  const segments = path.split('.');
  let current: unknown = value;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
