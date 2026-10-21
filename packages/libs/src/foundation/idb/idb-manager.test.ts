import { IdbManager } from './idb-manager';
import type { IdbOpenOptions, IdbStoreSchema } from './types';

function createManager(overrides: Partial<IdbOpenOptions> = {}): IdbManager {
  const name = overrides.name ?? `test-idb-${Date.now()}-${Math.random()}`;
  return new IdbManager({
    version: 1,
    stores: [
      {
        name: 'users',
        keyPath: 'id',
        indexes: [{ name: 'byUsername', keyPath: 'username', unique: false }],
      },
      {
        name: 'kv',
        // out-of-line keys
      },
    ],
    flushDelayMs: 10_000, // disable auto-flush during tests unless we flush()
    maxBatchSize: overrides.maxBatchSize ?? 500,
    ...overrides,
    name,
  });
}

describe('IdbManager', () => {
  let manager: IdbManager;

  afterEach(async () => {
    if (manager) {
      try {
        await manager.deleteDatabase();
      } catch {
        manager.destroy();
      }
    }
  });

  it('reports support when IndexedDB is available', () => {
    expect(IdbManager.isSupported()).toBe(true);
  });

  it('opens and creates stores with indexes; reopen works', async () => {
    const name = `reopen-${Date.now()}`;
    manager = createManager({ name });
    await manager.open();

    await manager.put('users', { id: 'u1', username: 'alice', name: 'Alice' });

    manager.close();

    const again = createManager({ name });
    manager = again;
    await again.open();
    await expect(again.get('users', 'u1')).resolves.toEqual({
      id: 'u1',
      username: 'alice',
      name: 'Alice',
    });
  });

  it('put then get returns value from IDB', async () => {
    manager = createManager();
    await manager.open();

    await manager.put('users', { id: '1', username: 'bob', name: 'Bob' });
    await expect(manager.get('users', '1')).resolves.toEqual({
      id: '1',
      username: 'bob',
      name: 'Bob',
    });
  });

  it('supports putMany, getMany, delete, clear, count', async () => {
    manager = createManager();
    await manager.open();

    await manager.putMany('users', [
      { value: { id: '1', username: 'a' } },
      { value: { id: '2', username: 'b' } },
    ]);

    await expect(manager.getMany('users', ['1', '2', '3'])).resolves.toEqual([
      { id: '1', username: 'a' },
      { id: '2', username: 'b' },
      undefined,
    ]);
    await expect(manager.count('users')).resolves.toBe(2);

    await manager.delete('users', '1');
    await expect(manager.get('users', '1')).resolves.toBeUndefined();
    await expect(manager.count('users')).resolves.toBe(1);

    await manager.clear('users');
    await expect(manager.count('users')).resolves.toBe(0);
  });

  it('queries by index', async () => {
    manager = createManager();
    await manager.open();

    await manager.put('users', { id: '1', username: 'alice' });
    await manager.put('users', { id: '2', username: 'bob' });

    await expect(manager.getByIndex('users', 'byUsername', 'bob')).resolves.toEqual({
      id: '2',
      username: 'bob',
    });
    const all = await manager.getAllByIndex('users', 'byUsername');
    expect(all).toHaveLength(2);
  });

  it('coalesces putQueued for the same key into one durable row', async () => {
    manager = createManager();
    await manager.open();

    const p1 = manager.putQueued('users', { id: '1', username: 'v1' });
    const p2 = manager.putQueued('users', { id: '1', username: 'v2' });
    await manager.flush();
    await Promise.all([p1, p2]);

    await expect(manager.get('users', '1')).resolves.toEqual({ id: '1', username: 'v2' });
    await expect(manager.count('users')).resolves.toBe(1);
  });

  it('putQueued then get before flush returns queued value (read-your-writes)', async () => {
    manager = createManager();
    await manager.open();

    void manager.putQueued('users', { id: '1', username: 'queued' });
    await expect(manager.get('users', '1')).resolves.toEqual({ id: '1', username: 'queued' });
    await expect(manager.has('users', '1')).resolves.toBe(true);
  });

  it('deleteQueued then get before flush returns undefined', async () => {
    manager = createManager();
    await manager.open();

    await manager.put('users', { id: '1', username: 'x' });
    void manager.deleteQueued('users', '1');
    await expect(manager.get('users', '1')).resolves.toBeUndefined();
    await expect(manager.has('users', '1')).resolves.toBe(false);
  });

  it('flush persists so a new manager can read the data', async () => {
    const name = `persist-${Date.now()}`;
    manager = createManager({ name });
    await manager.open();

    void manager.putQueued('users', { id: '1', username: 'persisted' });
    await manager.flush();
    manager.close();

    const next = createManager({ name });
    manager = next;
    await next.open();
    await expect(next.get('users', '1')).resolves.toEqual({ id: '1', username: 'persisted' });
  });

  it('maxBatchSize splits flush into multiple transactions without data loss', async () => {
    manager = createManager({ maxBatchSize: 2 });
    await manager.open();

    const puts = [
      manager.putQueued('users', { id: '1', username: 'a' }),
      manager.putQueued('users', { id: '2', username: 'b' }),
      manager.putQueued('users', { id: '3', username: 'c' }),
      manager.putQueued('users', { id: '4', username: 'd' }),
      manager.putQueued('users', { id: '5', username: 'e' }),
    ];
    await manager.flush();
    await Promise.all(puts);

    await expect(manager.count('users')).resolves.toBe(5);
    await expect(manager.get('users', '5')).resolves.toEqual({ id: '5', username: 'e' });
  });

  it('deleteDatabase removes data', async () => {
    const name = `wipe-${Date.now()}`;
    manager = createManager({ name });
    await manager.open();
    await manager.put('users', { id: '1', username: 'gone' });
    await manager.deleteDatabase();

    const next = createManager({ name });
    manager = next;
    await next.open();
    await expect(next.get('users', '1')).resolves.toBeUndefined();
  });

  it('throws when used after destroy', async () => {
    manager = createManager();
    await manager.open();
    manager.destroy();
    expect(() => manager.putQueued('users', { id: '1' })).toThrow(/destroyed/);
  });

  it('supports out-of-line keys on kv store', async () => {
    manager = createManager();
    await manager.open();

    await manager.put('kv', { hello: 'world' }, 'k1');
    await expect(manager.get('kv', 'k1')).resolves.toEqual({ hello: 'world' });

    void manager.putQueued('kv', { hello: 'queued' }, 'k2');
    await expect(manager.get('kv', 'k2')).resolves.toEqual({ hello: 'queued' });
    await manager.flush();
    await expect(manager.get('kv', 'k2')).resolves.toEqual({ hello: 'queued' });
  });

  it('getMany read-through returns pending puts and deletes without hitting IDB', async () => {
    manager = createManager();
    await manager.open();

    await manager.put('users', { id: '1', username: 'stored' });
    void manager.putQueued('users', { id: '2', username: 'queued' });
    void manager.deleteQueued('users', '1');

    await expect(manager.getMany('users', ['1', '2', '3'])).resolves.toEqual([
      undefined,
      { id: '2', username: 'queued' },
      undefined,
    ]);
    await expect(manager.getMany('users', [])).resolves.toEqual([]);
  });

  it('getAll, getAllKeys, and keys return persisted rows', async () => {
    manager = createManager();
    await manager.open();

    await manager.put('users', { id: '1', username: 'a' });
    await manager.put('users', { id: '2', username: 'b' });

    const all = await manager.getAll('users');
    expect(all).toHaveLength(2);

    const keys = await manager.getAllKeys('users');
    expect(keys).toEqual(['1', '2']);
    await expect(manager.keys('users')).resolves.toEqual(['1', '2']);

    const range = IDBKeyRange.lowerBound('1');
    await expect(manager.getAll('users', range, 1)).resolves.toHaveLength(1);
    await expect(manager.getAllKeys('users', range, 1)).resolves.toEqual(['1']);
  });

  it('iterate walks the store via cursor', async () => {
    manager = createManager();
    await manager.open();

    await manager.put('users', { id: '1', username: 'a' });
    await manager.put('users', { id: '2', username: 'b' });

    const seen: Array<{ key: string; username: string }> = [];
    await manager.iterate<{ id: string; username: string }>('users', async (value, key) => {
      seen.push({ key: String(key), username: value.username });
    });

    expect(seen).toEqual([
      { key: '1', username: 'a' },
      { key: '2', username: 'b' },
    ]);
  });

  it('iterate rejects when callback throws', async () => {
    manager = createManager();
    await manager.open();
    await manager.put('users', { id: '1', username: 'a' });

    await expect(
      manager.iterate('users', () => Promise.reject(new Error('callback failed'))),
    ).rejects.toThrow('callback failed');
  });

  it('runTransaction commits on success and aborts on error', async () => {
    manager = createManager();
    await manager.open();

    const result = await manager.runTransaction(['users', 'kv'], 'readwrite', async (stores) => {
      await new Promise<void>((resolve, reject) => {
        const req = stores.users.put({ id: 'tx1', username: 'from-tx' });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve, reject) => {
        const req = stores.kv.put({ via: 'tx' }, 'tx-k');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return 'ok';
    });
    expect(result).toBe('ok');
    await expect(manager.get('users', 'tx1')).resolves.toEqual({ id: 'tx1', username: 'from-tx' });
    await expect(manager.get('kv', 'tx-k')).resolves.toEqual({ via: 'tx' });

    await expect(
      manager.runTransaction('users', 'readwrite', async () => {
        throw new Error('tx failed');
      }),
    ).rejects.toThrow('tx failed');
  });

  it('deleteMany removes multiple keys', async () => {
    manager = createManager();
    await manager.open();

    await manager.putMany('users', [
      { value: { id: '1', username: 'a' } },
      { value: { id: '2', username: 'b' } },
    ]);
    await manager.deleteMany('users', ['1', '2']);
    await expect(manager.count('users')).resolves.toBe(0);
    await manager.deleteMany('users', []);
  });

  it('has reads from IDB when no pending queue entry exists', async () => {
    manager = createManager();
    await manager.open();
    await manager.put('users', { id: '1', username: 'x' });
    await expect(manager.has('users', '1')).resolves.toBe(true);
    await expect(manager.has('users', 'missing')).resolves.toBe(false);
  });

  it('throws when explicit key is required but omitted', async () => {
    manager = createManager();
    await manager.open();

    await expect(manager.put('kv', { hello: 'world' })).rejects.toThrow(/Explicit key required/);
    expect(() => manager.putQueued('kv', { hello: 'world' })).toThrow(/Explicit key required/);
  });

  it('throws when keyPath value is missing from put payload', async () => {
    manager = createManager();
    await manager.open();

    await expect(manager.put('users', { username: 'no-id' })).rejects.toThrow(
      /Could not extract keyPath/,
    );
  });

  it('supports compound and nested keyPath extraction', async () => {
    const stores: IdbStoreSchema[] = [
      {
        name: 'compound',
        keyPath: ['tenantId', 'eventId'],
      },
      {
        name: 'nested',
        keyPath: 'meta.id',
      },
    ];
    manager = createManager({ stores, version: 1 });
    await manager.open();

    await manager.put('compound', { tenantId: 't1', eventId: 'e1', data: 'x' });
    await manager.put('nested', { meta: { id: 'n1' }, payload: true });

    await expect(manager.get('compound', ['t1', 'e1'])).resolves.toEqual({
      tenantId: 't1',
      eventId: 'e1',
      data: 'x',
    });
    await expect(manager.get('nested', 'n1')).resolves.toEqual({
      meta: { id: 'n1' },
      payload: true,
    });

    await expect(
      manager.put('compound', { tenantId: 't1', data: 'missing eventId' }),
    ).rejects.toThrow(/Could not extract keyPath/);
  });

  it('reports unsupported when factory lacks open()', () => {
    expect(IdbManager.isSupported({} as IDBFactory)).toBe(false);
  });

  it('throws when IndexedDB factory is unavailable', async () => {
    const originalIndexedDb = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: undefined,
    });

    try {
      manager = new IdbManager({
        name: `no-idb-${Date.now()}`,
        version: 1,
        stores: [{ name: 'users', keyPath: 'id' }],
      });
      await expect(manager.open()).rejects.toThrow(/not available/);
      await expect(manager.deleteDatabase()).rejects.toThrow(/not available/);
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: originalIndexedDb,
      });
    }
  });

  it('rejects open when factory open() fails', async () => {
    const failingFactory: IDBFactory = {
      open() {
        const request = {
          error: new DOMException('open failed', 'AbortError'),
          onerror: null as ((ev: Event) => void) | null,
        } as IDBOpenDBRequest;
        queueMicrotask(() => request.onerror?.(new Event('error')));
        return request;
      },
      deleteDatabase() {
        throw new Error('unexpected deleteDatabase');
      },
      cmp: indexedDB.cmp,
    };

    manager = createManager({ factory: failingFactory });
    await expect(manager.open()).rejects.toThrow('open failed');
    await expect(manager.open()).rejects.toThrow('open failed');
  });

  it('warns when open is blocked', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const blockedFactory: IDBFactory = {
      open(name, version) {
        const request = indexedDB.open(name, version);
        queueMicrotask(() => request.onblocked?.(new Event('blocked')));
        return request;
      },
      deleteDatabase: (...args) => indexedDB.deleteDatabase(...args),
      cmp: indexedDB.cmp,
    };

    manager = createManager({ factory: blockedFactory });
    await manager.open();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('open blocked'));
    warn.mockRestore();
  });

  it('rejects open when upgrade transaction is missing', async () => {
    const missingTxFactory: IDBFactory = {
      open() {
        const request = {
          onerror: null as ((ev: Event) => void) | null,
          onsuccess: null as ((ev: Event) => void) | null,
          onblocked: null as ((ev: Event) => void) | null,
          onupgradeneeded: null as ((ev: IDBVersionChangeEvent) => void) | null,
          transaction: null,
          result: null,
          error: null,
        } as IDBOpenDBRequest;
        queueMicrotask(() => request.onupgradeneeded?.({} as IDBVersionChangeEvent));
        return request;
      },
      deleteDatabase: (...args) => indexedDB.deleteDatabase(...args),
      cmp: indexedDB.cmp,
    };

    manager = createManager({ factory: missingTxFactory });
    await expect(manager.open()).rejects.toThrow(/Missing upgrade transaction/);
  });

  it('clears cached db handle on versionchange', async () => {
    const name = `versionchange-${Date.now()}`;
    manager = createManager({ name, version: 1 });
    await manager.open();
    expect((manager as unknown as { db: IDBDatabase | undefined }).db).toBeDefined();

    const v2 = createManager({
      name,
      version: 2,
      stores: [{ name: 'users', keyPath: 'id' }],
    });
    const openV2 = v2.open();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect((manager as unknown as { db: IDBDatabase | undefined }).db).toBeUndefined();
    await openV2;
    manager = v2;
  });

  it('withStore aborts transaction when operation fails', async () => {
    manager = createManager();
    await manager.open();

    const db = (manager as unknown as { db: IDBDatabase }).db;
    const originalTransaction = db.transaction.bind(db);
    db.transaction = (...args: Parameters<IDBDatabase['transaction']>) => {
      const tx = originalTransaction(...args);
      const originalObjectStore = tx.objectStore.bind(tx);
      tx.objectStore = (storeName: string) => {
        const store = originalObjectStore(storeName);
        store.get = ((...getArgs: Parameters<IDBObjectStore['get']>) => {
          throw new Error('store get failed');
        }) as IDBObjectStore['get'];
        return store;
      };
      return tx;
    };

    await expect(manager.get('users', '1')).rejects.toThrow('store get failed');
  });

  it('flush rejects queued puts when write batch fails', async () => {
    manager = createManager();
    await manager.open();

    const p = manager.putQueued('users', { id: '1', username: 'x' });
    const db = (manager as unknown as { db: IDBDatabase }).db;
    const originalTransaction = db.transaction.bind(db);
    db.transaction = (...args: Parameters<IDBDatabase['transaction']>) => {
      const tx = originalTransaction(...args);
      const originalObjectStore = tx.objectStore.bind(tx);
      tx.objectStore = (storeName: string) => {
        const store = originalObjectStore(storeName);
        store.put = ((...putArgs: Parameters<IDBObjectStore['put']>) => {
          throw new Error('store put failed');
        }) as IDBObjectStore['put'];
        return store;
      };
      return tx;
    };

    await expect(manager.flush()).rejects.toThrow('store put failed');
    await expect(p).rejects.toThrow('store put failed');
  });

  it('scheduleFlush auto-flushes after delay', async () => {
    manager = createManager({ flushDelayMs: 5 });
    await manager.open();

    const p = manager.putQueued('users', { id: '1', username: 'auto' });
    await p;
    await expect(manager.get('users', '1')).resolves.toEqual({ id: '1', username: 'auto' });
  });

  it('scheduleFlush logs when background flush fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    manager = createManager({ flushDelayMs: 5 });
    await manager.open();

    void manager.putQueued('users', { id: '1', username: 'x' }).catch(() => {});
    const db = (manager as unknown as { db: IDBDatabase }).db;
    const originalTransaction = db.transaction.bind(db);
    db.transaction = (...args: Parameters<IDBDatabase['transaction']>) => {
      const tx = originalTransaction(...args);
      const originalObjectStore = tx.objectStore.bind(tx);
      tx.objectStore = (storeName: string) => {
        const store = originalObjectStore(storeName);
        store.put = ((...putArgs: Parameters<IDBObjectStore['put']>) => {
          throw new Error('background put failed');
        }) as IDBObjectStore['put'];
        return store;
      };
      return tx;
    };

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(warn).toHaveBeenCalledWith('IdbManager flush failed:', expect.any(Error));
    warn.mockRestore();
  });

  it('applies schema upgrade on existing stores when version bumps', async () => {
    const name = `upgrade-${Date.now()}`;
    manager = createManager({
      name,
      version: 1,
      stores: [{ name: 'users', keyPath: 'id' }],
    });
    await manager.open();
    await manager.put('users', { id: '1', username: 'a' });
    manager.close();

    const upgraded = createManager({
      name,
      version: 2,
      stores: [
        {
          name: 'users',
          keyPath: 'id',
          indexes: [{ name: 'byUsername', keyPath: 'username', unique: false }],
        },
      ],
    });
    manager = upgraded;
    await upgraded.open();
    await expect(upgraded.getByIndex('users', 'byUsername', 'a')).resolves.toEqual({
      id: '1',
      username: 'a',
    });
  });

  it('flush persists queued deletes', async () => {
    manager = createManager();
    await manager.open();
    await manager.put('users', { id: '1', username: 'gone' });
    void manager.putQueued('users', { id: '2', username: 'stay' });
    void manager.deleteQueued('users', '1');
    await manager.flush();
    await expect(manager.get('users', '1')).resolves.toBeUndefined();
    await expect(manager.get('users', '2')).resolves.toEqual({ id: '2', username: 'stay' });
  });
});
