const SDK_CACHE_PREFIX = 'telegenie-sdk-cache_';
const FOUNDATION_PREFIX = 'telegenie-foundation_';

export type IdbStoreRef = {
  dbName: string;
  storeName: string;
};

export async function listIdbStores(kind: 'sdk' | 'foundation'): Promise<IdbStoreRef[]> {
  const prefix = kind === 'sdk' ? SDK_CACHE_PREFIX : FOUNDATION_PREFIX;
  const dbNames = await listDatabaseNames(prefix);
  const refs: IdbStoreRef[] = [];
  for (const dbName of dbNames) {
    const storeNames = await listObjectStoreNames(dbName);
    for (const storeName of storeNames) {
      refs.push({ dbName, storeName });
    }
  }
  return refs;
}

export async function dumpIdbStore(dbName: string, storeName: string): Promise<unknown[]> {
  return withExistingStore(dbName, storeName, (objectStore) =>
    requestToPromise(objectStore.getAll()),
  );
}

export async function listIdbKeys(dbName: string, storeName: string): Promise<IDBValidKey[]> {
  return withExistingStore(dbName, storeName, (objectStore) =>
    requestToPromise(objectStore.getAllKeys()),
  );
}

export async function getIdbRecord(
  dbName: string,
  storeName: string,
  key: IDBValidKey,
): Promise<unknown> {
  return withExistingStore(dbName, storeName, (objectStore) =>
    requestToPromise(objectStore.get(key)),
  );
}

async function listDatabaseNames(prefix: string): Promise<string[]> {
  if (typeof indexedDB.databases === 'function') {
    const dbs = await indexedDB.databases();
    return dbs
      .map((db) => db.name)
      .filter((name): name is string => Boolean(name?.startsWith(prefix)))
      .sort();
  }

  const fallback = `${prefix}default`;
  const stores = await listObjectStoreNames(fallback);
  return stores.length > 0 ? [fallback] : [];
}

function listObjectStoreNames(dbName: string): Promise<string[]> {
  return new Promise((resolve) => {
    let created = false;
    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => {
      created = true;
    };
    request.onsuccess = () => {
      const db = request.result;
      if (created) {
        db.close();
        indexedDB.deleteDatabase(dbName);
        resolve([]);
        return;
      }
      const names = Array.from(db.objectStoreNames).sort();
      db.close();
      resolve(names);
    };
    request.onerror = () => resolve([]);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withExistingStore<T>(
  dbName: string,
  storeName: string,
  read: (objectStore: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openExistingDatabase(dbName);
  if (!db) {
    throw new Error(`IndexedDB "${dbName}" is not available`);
  }
  try {
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(`Store "${storeName}" is missing from "${dbName}"`);
    }
    const tx = db.transaction(storeName, 'readonly');
    return await read(tx.objectStore(storeName));
  } finally {
    db.close();
  }
}

function openExistingDatabase(dbName: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let created = false;
    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => {
      created = true;
    };
    request.onsuccess = () => {
      const db = request.result;
      if (created) {
        db.close();
        indexedDB.deleteDatabase(dbName);
        resolve(null);
        return;
      }
      resolve(db);
    };
    request.onerror = () => resolve(null);
  });
}
