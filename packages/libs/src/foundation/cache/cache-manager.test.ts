import { CacheManager, cacheManager } from './cache-manager';
import {
  ASSET_CACHE_NAME,
  CLEARABLE_CACHE_NAMES,
  DEFAULT_ACCESS_THROTTLE,
  DEFAULT_CACHE_TTL,
  DEFAULT_CLEANUP_INTERVAL,
  LANG_CACHE_NAME,
  LAST_ACCESS_HEADER,
  MEDIA_CACHE_NAME,
  MEDIA_CACHE_NAME_AVATARS,
  MEDIA_PROGRESSIVE_CACHE_NAME,
} from './constants';
import { CacheDataType, Type, type CacheManagerOptions } from './types';

type Store = Map<string, Response>;

type FakeCacheStorage = {
  open: (name: string) => Promise<unknown>;
  has: (name: string) => Promise<boolean>;
  delete: (name: string) => Promise<boolean>;
};

function createFakeCaches() {
  const stores = new Map<string, Store>();

  const openCache = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      async match(req: Request | string) {
        const url = typeof req === 'string' ? req : req.url;
        const response = store.get(url);
        // Real Cache API hands out a fresh Response each time.
        return response ? response.clone() : undefined;
      },
      async put(req: Request | string, res: Response) {
        store.set(typeof req === 'string' ? req : req.url, res);
      },
      async delete(req: Request | string) {
        return store.delete(typeof req === 'string' ? req : req.url);
      },
      async keys() {
        return [...store.keys()].map((url) => new Request(url));
      },
    };
  };

  const caches = {
    open: jest.fn(async (name: string) => openCache(name)),
    has: jest.fn(async (name: string) => stores.has(name)),
    delete: jest.fn(async (name: string) => stores.delete(name)),
  };

  return { caches, stores };
}

function installCaches(caches: unknown): void {
  const g = globalThis as unknown as Record<string, unknown>;
  g.self = g;
  g.caches = caches;
  g.location = { origin: 'http://localhost' };
}

const managers: CacheManager[] = [];

function track<T extends CacheManager>(manager: T): T {
  managers.push(manager);
  return manager;
}

function createManager(options: CacheManagerOptions = {}) {
  const fake = createFakeCaches();
  installCaches(fake.caches);
  const manager = track(new CacheManager({ cleanupInterval: 0, ...options }));
  return { manager, ...fake };
}

function createManagerWith(caches: Partial<FakeCacheStorage>, options: CacheManagerOptions = {}) {
  installCaches(caches);
  return track(new CacheManager({ cleanupInterval: 0, ...options }));
}

function firstStoredResponse(stores: Map<string, Store>, cacheName: string): Response {
  const store = stores.get(cacheName);
  if (!store) throw new Error(`no store named ${cacheName}`);
  const [response] = [...store.values()];
  if (!response) throw new Error(`store ${cacheName} is empty`);
  return response;
}

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  while (managers.length) managers.pop()!.destroy();
  warnSpy.mockRestore();
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.self;
  delete g.caches;
  delete g.location;
});

describe('cache constants', () => {
  it('exposes clearable cache names and defaults', () => {
    expect(CLEARABLE_CACHE_NAMES).toEqual([
      MEDIA_CACHE_NAME,
      MEDIA_CACHE_NAME_AVATARS,
      MEDIA_PROGRESSIVE_CACHE_NAME,
    ]);
    expect(LANG_CACHE_NAME).toBe('tg-lang');
    expect(ASSET_CACHE_NAME).toBe('tg-assets');
    expect(LAST_ACCESS_HEADER).toBe('X-Last-Access');
    expect(DEFAULT_CACHE_TTL).toBeGreaterThan(DEFAULT_ACCESS_THROTTLE);
    expect(DEFAULT_CLEANUP_INTERVAL).toBe(60 * 60 * 1000);
  });

  it('aliases the data type enum', () => {
    expect(Type).toBe(CacheDataType);
    expect(Type.Blob).toBe(CacheDataType.Blob);
  });
});

describe('CacheManager module instance', () => {
  it('exports a default instance', () => {
    expect(cacheManager).toBeInstanceOf(CacheManager);
    // Constructed at import time without a Cache API — every op is a no-op.
    expect(cacheManager.destroy()).toBeUndefined();
  });
});

describe('CacheManager.isCacheApiSupported', () => {
  it('returns true and memoizes the probe', async () => {
    const { manager, caches } = createManager();
    await expect(manager.isCacheApiSupported()).resolves.toBe(true);
    await expect(manager.isCacheApiSupported()).resolves.toBe(true);
    expect(caches.has).toHaveBeenCalledTimes(1);
  });

  it('returns false when the Cache API is missing', async () => {
    installCaches(undefined);
    const manager = track(new CacheManager({ cleanupInterval: 0 }));
    await expect(manager.isCacheApiSupported()).resolves.toBe(false);
  });

  it('returns false when the probe rejects', async () => {
    const manager = createManagerWith({
      has: async () => {
        throw new Error('denied');
      },
    });
    await expect(manager.isCacheApiSupported()).resolves.toBe(false);
  });

  it('returns false when the probe throws synchronously', async () => {
    const manager = createManagerWith({
      has: (() => {
        throw new Error('boom');
      }) as unknown as FakeCacheStorage['has'],
    });
    await expect(manager.isCacheApiSupported()).resolves.toBe(false);
  });
});

describe('CacheManager constructor', () => {
  it('derives the cache key base from self.location.origin', async () => {
    const g = globalThis as unknown as Record<string, unknown>;
    const { manager, stores } = createManager();
    g.location = { origin: 'https://app.example' };
    const scoped = track(new CacheManager({ cleanupInterval: 0 }));
    await manager.save(MEDIA_CACHE_NAME, 'k', 'v');
    await scoped.save(MEDIA_CACHE_NAME, 'k', 'v');
    expect([...stores.get(MEDIA_CACHE_NAME)!.keys()]).toEqual([
      'http://localhost/k',
      'https://app.example/k',
    ]);
  });

  it('falls back to localhost when self is unavailable', async () => {
    const { stores } = createManager();
    const g = globalThis as unknown as Record<string, unknown>;
    const caches = g.caches;
    delete g.self;
    const manager = track(new CacheManager({ cleanupInterval: 0 }));
    // No `self` means no Cache API was captured.
    await expect(manager.save(MEDIA_CACHE_NAME, 'k', 'v')).resolves.toBe(false);
    expect(stores.size).toBe(0);
    g.self = g;
    g.caches = caches;
  });

  it('honours an explicit cacheKeyBase and normalizes colons in keys', async () => {
    const { manager, stores } = createManager({ cacheKeyBase: 'https://cdn.test/base/' });
    await manager.save(MEDIA_CACHE_NAME, 'avatar:42:big', 'x');
    expect([...stores.get(MEDIA_CACHE_NAME)!.keys()]).toEqual([
      'https://cdn.test/base/avatar_42_big',
    ]);
  });
});

describe('CacheManager.match / put / delete', () => {
  it('stores and returns a Response by Request', async () => {
    const { manager } = createManager();
    const request = new Request('https://cdn.example/app.abc123.js');
    const response = new Response('bundle', {
      status: 200,
      headers: { 'Content-Type': 'application/javascript' },
    });

    await expect(manager.put(ASSET_CACHE_NAME, request, response)).resolves.toBe(true);

    const matched = await manager.match(ASSET_CACHE_NAME, request);
    expect(matched).toBeDefined();
    expect(matched!.status).toBe(200);
    expect(matched!.headers.get('Content-Type')).toBe('application/javascript');
    await expect(matched!.text()).resolves.toBe('bundle');
  });

  it('stamps a last-access header on put', async () => {
    const { manager, stores } = createManager();
    const request = new Request('https://cdn.example/app.js');
    await manager.put(ASSET_CACHE_NAME, request, new Response('bundle'));

    const stamp = Number(
      firstStoredResponse(stores, ASSET_CACHE_NAME).headers.get(LAST_ACCESS_HEADER),
    );
    expect(stamp).toBeGreaterThan(0);
  });

  it('refreshes the last-access header past the throttle window', async () => {
    const { manager, stores } = createManager({ accessThrottle: -1 });
    const request = new Request('https://cdn.example/app.js');
    await manager.put(ASSET_CACHE_NAME, request, new Response('bundle'));
    const before = firstStoredResponse(stores, ASSET_CACHE_NAME).headers.get(LAST_ACCESS_HEADER);

    await manager.match(ASSET_CACHE_NAME, request);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const after = firstStoredResponse(stores, ASSET_CACHE_NAME);
    expect(after.headers.get(LAST_ACCESS_HEADER)).not.toBe(null);
    expect(Number(after.headers.get(LAST_ACCESS_HEADER))).toBeGreaterThanOrEqual(Number(before));
    await expect(manager.match(ASSET_CACHE_NAME, request).then((r) => r?.text())).resolves.toBe(
      'bundle',
    );
  });

  it('refreshes entries that have no last-access header at all', async () => {
    const { manager, stores } = createManager();
    const request = new Request('https://cdn.example/app.js');
    await manager.put(ASSET_CACHE_NAME, request, new Response('bundle'));
    const store = stores.get(ASSET_CACHE_NAME)!;
    const [url] = [...store.keys()];
    store.get(url)!.headers.delete(LAST_ACCESS_HEADER);

    await manager.match(ASSET_CACHE_NAME, request);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(store.get(url)!.headers.get(LAST_ACCESS_HEADER)).not.toBeNull();
  });

  it('keeps working when refreshing the access time fails', async () => {
    const { caches, stores } = createFakeCaches();
    const open = caches.open;
    caches.open = jest.fn(async (name: string) => {
      const cache = (await open(name)) as { put: unknown };
      return { ...cache, put: async () => Promise.reject(new Error('readonly')) };
    }) as unknown as typeof caches.open;
    installCaches(caches);
    const manager = track(new CacheManager({ cleanupInterval: 0, accessThrottle: -1 }));
    const request = new Request('https://cdn.example/app.js');

    stores.set(ASSET_CACHE_NAME, new Map([[request.url, new Response('bundle')]]));

    await expect(manager.match(ASSET_CACHE_NAME, request).then((r) => r?.text())).resolves.toBe(
      'bundle',
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to update cache access time:',
      expect.any(Error),
    );
  });

  it('logs when the non-blocking access refresh rejects', async () => {
    const { caches, stores } = createFakeCaches();
    const open = caches.open;
    caches.open = jest.fn(async (name: string) => {
      const cache = (await open(name)) as { put: unknown };
      return {
        ...cache,
        put: async () => {
          throw new Error('readonly');
        },
      };
    }) as unknown as typeof caches.open;
    installCaches(caches);
    const manager = track(new CacheManager({ cleanupInterval: 0, accessThrottle: -1 }));
    const request = new Request('https://cdn.example/app.js');
    stores.set(ASSET_CACHE_NAME, new Map([[request.url, new Response('bundle')]]));

    // The inner handler's own logging blows up, so the refresh promise rejects.
    warnSpy.mockImplementationOnce(() => {
      throw new Error('log unavailable');
    });
    await manager.match(ASSET_CACHE_NAME, request);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(warnSpy).toHaveBeenCalledWith(
      'Non-blocking access time update failed:',
      expect.any(Error),
    );
  });

  it('honours the account slot for Request-based entries', async () => {
    const { manager, stores } = createManager();
    const request = new Request('https://cdn.example/style.css');
    await manager.put(ASSET_CACHE_NAME, request, new Response('css'), { accountSlot: '2' });

    expect(stores.has(`${ASSET_CACHE_NAME}_2`)).toBe(true);
    await expect(manager.match(ASSET_CACHE_NAME, request)).resolves.toBeUndefined();
    await expect(
      manager.match(ASSET_CACHE_NAME, request, { accountSlot: '2' }),
    ).resolves.toBeDefined();
  });

  it('deletes a Request entry and reports misses', async () => {
    const { manager } = createManager();
    const request = new Request('https://cdn.example/missing.js');
    await manager.put(ASSET_CACHE_NAME, request, new Response('x'));

    await expect(manager.delete(ASSET_CACHE_NAME, request)).resolves.toBe(true);
    await expect(manager.match(ASSET_CACHE_NAME, request)).resolves.toBeUndefined();
    await expect(manager.delete(ASSET_CACHE_NAME, request)).resolves.toBe(false);
  });

  it('returns safe defaults without a Cache API', async () => {
    installCaches(undefined);
    const manager = track(new CacheManager({ cleanupInterval: 0 }));
    const request = new Request('https://cdn.example/x.js');

    await expect(manager.match(ASSET_CACHE_NAME, request)).resolves.toBeUndefined();
    await expect(manager.put(ASSET_CACHE_NAME, request, new Response('x'))).resolves.toBe(false);
    await expect(manager.delete(ASSET_CACHE_NAME, request)).resolves.toBeUndefined();
  });

  it('warns and returns safe defaults on failure', async () => {
    const manager = createManagerWith({
      open: async () => {
        throw new Error('locked');
      },
    });
    const request = new Request('https://cdn.example/x.js');

    await expect(manager.match(ASSET_CACHE_NAME, request)).resolves.toBeUndefined();
    await expect(manager.put(ASSET_CACHE_NAME, request, new Response('x'))).resolves.toBe(false);
    await expect(manager.delete(ASSET_CACHE_NAME, request)).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('CacheManager match failed'),
      expect.any(Error),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('CacheManager put failed'),
      expect.any(Error),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('CacheManager delete failed'),
      expect.any(Error),
    );
  });
});

describe('CacheManager.save / fetch / remove (deprecated wrappers)', () => {
  it('stores strings', async () => {
    const { manager } = createManager();
    await expect(manager.save(MEDIA_CACHE_NAME, 'text', 'hello')).resolves.toBe(true);
    await expect(manager.fetch(MEDIA_CACHE_NAME, 'text', CacheDataType.Text)).resolves.toBe(
      'hello',
    );
  });

  it('stores blobs and preserves their content type', async () => {
    const { manager, stores } = createManager();
    const blob = new Blob(['bytes'], { type: 'image/png' });
    await expect(manager.save(MEDIA_CACHE_NAME, 'pic', blob)).resolves.toBe(true);
    expect(firstStoredResponse(stores, MEDIA_CACHE_NAME).headers.get('Content-Type')).toBe(
      'image/png',
    );
  });

  it('stores plain objects and arrays as json', async () => {
    const { manager, stores } = createManager();
    await manager.save(MEDIA_CACHE_NAME, 'obj', { a: 1 });
    await manager.save(MEDIA_CACHE_NAME, 'arr', [1, 2]);
    expect(firstStoredResponse(stores, MEDIA_CACHE_NAME).headers.get('Content-Type')).toBe(
      'application/json',
    );
    await expect(manager.fetch(MEDIA_CACHE_NAME, 'obj', CacheDataType.Json)).resolves.toEqual({
      a: 1,
    });
    await expect(manager.fetch(MEDIA_CACHE_NAME, 'arr', CacheDataType.Json)).resolves.toEqual([
      1, 2,
    ]);
  });

  it('stores array buffers without forcing a json content type', async () => {
    const { manager, stores } = createManager();
    const buffer = new Uint8Array([1, 2, 3]).buffer;
    await expect(manager.save(MEDIA_CACHE_NAME, 'buf', buffer)).resolves.toBe(true);
    expect(firstStoredResponse(stores, MEDIA_CACHE_NAME).headers.get('Content-Type')).toBeNull();
  });

  it('stamps a last-access header via put', async () => {
    const { manager, stores } = createManager();
    await manager.save(MEDIA_CACHE_NAME, 'text', 'hello');
    const stamp = Number(
      firstStoredResponse(stores, MEDIA_CACHE_NAME).headers.get(LAST_ACCESS_HEADER),
    );
    expect(stamp).toBeGreaterThan(0);
  });

  it('returns false without a Cache API', async () => {
    installCaches(undefined);
    const manager = track(new CacheManager({ cleanupInterval: 0 }));
    await expect(manager.save(MEDIA_CACHE_NAME, 'k', 'v')).resolves.toBe(false);
  });

  it('returns false and warns when opening the cache fails', async () => {
    const manager = createManagerWith({
      open: async () => {
        throw new Error('quota');
      },
    });
    await expect(manager.save(MEDIA_CACHE_NAME, 'k', 'v')).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('CacheManager put failed'),
      expect.any(Error),
    );
  });

  it('returns undefined for a missing entry', async () => {
    const { manager } = createManager();
    await expect(
      manager.fetch(MEDIA_CACHE_NAME, 'nope', CacheDataType.Text),
    ).resolves.toBeUndefined();
  });

  it('reads text, json, blob and array buffer payloads', async () => {
    const { manager } = createManager();
    await manager.save(MEDIA_CACHE_NAME, 'text', 'plain');
    await manager.save(MEDIA_CACHE_NAME, 'json', { ok: true });
    await manager.save(MEDIA_CACHE_NAME, 'blob', new Blob(['b'], { type: 'image/webp' }));
    await manager.save(MEDIA_CACHE_NAME, 'buf', new Uint8Array([7, 8]).buffer);

    await expect(manager.fetch(MEDIA_CACHE_NAME, 'text', CacheDataType.Text)).resolves.toBe(
      'plain',
    );
    await expect(manager.fetch(MEDIA_CACHE_NAME, 'json', CacheDataType.Json)).resolves.toEqual({
      ok: true,
    });

    const blob = await manager.fetch<Blob>(MEDIA_CACHE_NAME, 'blob', CacheDataType.Blob);
    expect(blob?.type).toBe('image/webp');

    const buffer = await manager.fetch<ArrayBuffer>(
      MEDIA_CACHE_NAME,
      'buf',
      CacheDataType.ArrayBuffer,
    );
    expect(new Uint8Array(buffer!)).toEqual(new Uint8Array([7, 8]));
  });

  it('returns undefined for an unknown data type', async () => {
    const { manager } = createManager();
    await manager.save(MEDIA_CACHE_NAME, 'text', 'plain');
    await expect(
      manager.fetch(MEDIA_CACHE_NAME, 'text', 99 as unknown as CacheDataType),
    ).resolves.toBeUndefined();
  });

  it('ignores deprecated data-uri avatars stored as text', async () => {
    const { manager } = createManager();
    await manager.save(MEDIA_CACHE_NAME_AVATARS, 'avatar-1', 'data:image/png;base64,AA');
    await expect(
      manager.fetch(MEDIA_CACHE_NAME_AVATARS, 'avatar-1', CacheDataType.Blob),
    ).resolves.toBeUndefined();
  });

  it('strips html from blob types unless explicitly allowed', async () => {
    const { manager } = createManager();
    await manager.save(MEDIA_CACHE_NAME, 'doc', new Blob(['<b/>'], { type: 'text/html' }));

    const sanitized = await manager.fetch<Blob>(MEDIA_CACHE_NAME, 'doc', CacheDataType.Blob);
    expect(sanitized?.type).toBe('text/');

    const raw = await manager.fetch<Blob>(MEDIA_CACHE_NAME, 'doc', CacheDataType.Blob, {
      isHtmlAllowed: true,
    });
    expect(raw?.type).toBe('text/html');
  });

  it('returns the original blob when no type can be resolved', async () => {
    const { manager, stores } = createManager();
    stores.set(
      MEDIA_CACHE_NAME,
      new Map([['http://localhost/untyped', new Response(new Blob(['raw']))]]),
    );
    const blob = await manager.fetch<Blob>(MEDIA_CACHE_NAME, 'untyped', CacheDataType.Blob);
    expect(blob?.type).toBe('');
    await expect(blob!.text()).resolves.toBe('raw');
  });

  it('returns undefined without a Cache API', async () => {
    installCaches(undefined);
    const manager = track(new CacheManager({ cleanupInterval: 0 }));
    await expect(
      manager.fetch(MEDIA_CACHE_NAME, 'k', CacheDataType.Text),
    ).resolves.toBeUndefined();
  });

  it('returns undefined and warns when the read throws', async () => {
    const manager = createManagerWith({
      open: async () => {
        throw new Error('corrupt');
      },
    });
    await expect(
      manager.fetch(MEDIA_CACHE_NAME, 'k', CacheDataType.Text),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('CacheManager match failed'),
      expect.any(Error),
    );
  });

  it('deletes an existing entry and reports misses', async () => {
    const { manager } = createManager();
    await manager.save(MEDIA_CACHE_NAME, 'k', 'v');
    await expect(manager.remove(MEDIA_CACHE_NAME, 'k')).resolves.toBe(true);
    await expect(manager.remove(MEDIA_CACHE_NAME, 'k')).resolves.toBe(false);
  });

  it('honours the account slot on remove', async () => {
    const { manager, stores } = createManager();
    await manager.save(MEDIA_CACHE_NAME, 'k', 'v', { accountSlot: '3' });
    await expect(manager.remove(MEDIA_CACHE_NAME, 'k', { accountSlot: '3' })).resolves.toBe(true);
    expect(stores.get(`${MEDIA_CACHE_NAME}_3`)!.size).toBe(0);
  });

  it('returns undefined from remove without a Cache API', async () => {
    installCaches(undefined);
    const manager = track(new CacheManager({ cleanupInterval: 0 }));
    await expect(manager.remove(MEDIA_CACHE_NAME, 'k')).resolves.toBeUndefined();
  });

  it('returns undefined and warns when remove fails', async () => {
    const manager = createManagerWith({
      open: async () => {
        throw new Error('locked');
      },
    });
    await expect(manager.remove(MEDIA_CACHE_NAME, 'k')).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('CacheManager delete failed'),
      expect.any(Error),
    );
  });
});

describe('CacheManager cache naming', () => {
  it('suffixes cache names with the account slot', async () => {
    const { manager, stores } = createManager();
    const request = new Request('https://cdn.example/k');
    await manager.put(MEDIA_CACHE_NAME, request, new Response('v'), { accountSlot: '2' });
    expect([...stores.keys()]).toEqual([`${MEDIA_CACHE_NAME}_2`]);
    await expect(
      manager.match(MEDIA_CACHE_NAME, request, { accountSlot: '2' }).then((r) => r?.text()),
    ).resolves.toBe('v');
    await expect(manager.match(MEDIA_CACHE_NAME, request)).resolves.toBeUndefined();
  });

  it('never slots the shared language cache', async () => {
    const { manager, stores } = createManager();
    await manager.save(LANG_CACHE_NAME, 'k', 'v', { accountSlot: '2' });
    expect([...stores.keys()]).toEqual([LANG_CACHE_NAME]);
  });
});

describe('CacheManager.cleanup', () => {
  it('evicts Request-keyed entries older than the ttl and keeps the rest', async () => {
    const { manager, stores } = createManager({ cacheTtl: 1_000 });
    const fresh = new Request('https://cdn.example/fresh');
    const stale = new Request('https://cdn.example/stale');
    await manager.put(MEDIA_CACHE_NAME, fresh, new Response('a'));
    await manager.put(MEDIA_CACHE_NAME, stale, new Response('b'));

    const store = stores.get(MEDIA_CACHE_NAME)!;
    store.get(stale.url)!.headers.set(LAST_ACCESS_HEADER, String(Date.now() - 10_000));
    store.set('https://cdn.example/unstamped', new Response('c'));

    await manager.cleanup([MEDIA_CACHE_NAME]);

    expect([...store.keys()].sort()).toEqual([
      'https://cdn.example/fresh',
      'https://cdn.example/unstamped',
    ]);
  });

  it('skips keys whose response has vanished', async () => {
    const remove = jest.fn(async () => true);
    const manager = createManagerWith({
      open: async () => ({
        match: async () => undefined,
        put: async () => undefined,
        delete: remove,
        keys: async () => [new Request('http://localhost/ghost')],
      }),
    });
    await manager.cleanup([MEDIA_CACHE_NAME]);
    expect(remove).not.toHaveBeenCalled();
  });

  it('does nothing without a Cache API', async () => {
    installCaches(undefined);
    const manager = track(new CacheManager({ cleanupInterval: 0 }));
    await expect(manager.cleanup([MEDIA_CACHE_NAME])).resolves.toBeUndefined();
  });

  it('warns when cleanup throws', async () => {
    const manager = createManagerWith({
      open: async () => {
        throw new Error('io');
      },
    });
    await manager.cleanup([MEDIA_CACHE_NAME], { accountSlot: '9' });
    expect(warnSpy).toHaveBeenCalledWith('CacheManager cleanup failed:', expect.any(Error));
  });
});

describe('CacheManager.clear', () => {
  it('drops a whole cache', async () => {
    const { manager, stores } = createManager();
    await manager.put(MEDIA_CACHE_NAME, new Request('https://cdn.example/k'), new Response('v'));
    await expect(manager.clear(MEDIA_CACHE_NAME)).resolves.toBe(true);
    expect(stores.has(MEDIA_CACHE_NAME)).toBe(false);
  });

  it('returns undefined without a Cache API', async () => {
    installCaches(undefined);
    const manager = track(new CacheManager({ cleanupInterval: 0 }));
    await expect(manager.clear(MEDIA_CACHE_NAME)).resolves.toBeUndefined();
  });

  it('returns undefined and warns on failure', async () => {
    const manager = createManagerWith({
      delete: async () => {
        throw new Error('busy');
      },
    });
    await expect(manager.clear(MEDIA_CACHE_NAME, { accountSlot: '1' })).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('CacheManager clear failed'),
      expect.any(Error),
    );
  });
});

describe('CacheManager.purgeClearableCache', () => {
  it('clears every clearable cache for the slot', async () => {
    const { manager, stores } = createManager();
    for (const name of CLEARABLE_CACHE_NAMES) {
      await manager.put(name, new Request('https://cdn.example/k'), new Response('v'), {
        accountSlot: '1',
      });
    }
    expect(stores.size).toBe(CLEARABLE_CACHE_NAMES.length);

    manager.purgeClearableCache({ accountSlot: '1' });
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(stores.size).toBe(0);
  });

  it('only clears the configured names', async () => {
    const { manager, stores } = createManager({ clearableCacheNames: [MEDIA_CACHE_NAME] });
    await manager.put(MEDIA_CACHE_NAME, new Request('https://cdn.example/k'), new Response('v'));
    await manager.put(
      MEDIA_CACHE_NAME_AVATARS,
      new Request('https://cdn.example/k'),
      new Response('v'),
    );

    manager.purgeClearableCache();
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect([...stores.keys()]).toEqual([MEDIA_CACHE_NAME_AVATARS]);
  });

  it('logs when clearing a cache during the purge rejects', async () => {
    const manager = createManagerWith(
      {
        delete: async () => {
          throw new Error('busy');
        },
      },
      { clearableCacheNames: [MEDIA_CACHE_NAME] },
    );

    warnSpy.mockImplementationOnce(() => {
      throw new Error('log unavailable');
    });
    manager.purgeClearableCache();
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(warnSpy).toHaveBeenCalledWith(
      `Failed to clear cache "${MEDIA_CACHE_NAME}" during purge:`,
      expect.any(Error),
    );
  });
});

describe('CacheManager scheduled cleanup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs an initial and a recurring cleanup until destroyed', async () => {
    const { caches } = createFakeCaches();
    installCaches(caches);
    const manager = track(new CacheManager({ cleanupInterval: 5_000 }));

    expect(caches.open).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1_000);
    expect(caches.open).toHaveBeenCalledTimes(CLEARABLE_CACHE_NAMES.length);

    await jest.advanceTimersByTimeAsync(5_000);
    expect(caches.open).toHaveBeenCalledTimes(CLEARABLE_CACHE_NAMES.length * 2);

    manager.destroy();
    await jest.advanceTimersByTimeAsync(20_000);
    expect(caches.open).toHaveBeenCalledTimes(CLEARABLE_CACHE_NAMES.length * 2);

    // destroy is idempotent
    expect(() => manager.destroy()).not.toThrow();
  });

  it('logs when the initial and recurring cleanups fail', async () => {
    installCaches({
      open: async () => {
        throw new Error('io');
      },
      has: async () => true,
      delete: async () => true,
    });
    const manager = track(new CacheManager({ cleanupInterval: 5_000 }));

    warnSpy.mockImplementationOnce(() => {
      throw new Error('log unavailable');
    });
    await jest.advanceTimersByTimeAsync(1_000);
    expect(warnSpy).toHaveBeenCalledWith(
      'CacheManager initial cleanup failed:',
      expect.any(Error),
    );

    warnSpy.mockImplementationOnce(() => {
      throw new Error('log unavailable');
    });
    await jest.advanceTimersByTimeAsync(5_000);
    expect(warnSpy).toHaveBeenCalledWith(
      'CacheManager scheduled cleanup failed:',
      expect.any(Error),
    );

    manager.destroy();
  });

  it('does not schedule anything without a Cache API', async () => {
    installCaches(undefined);
    const manager = track(new CacheManager({ cleanupInterval: 5_000 }));
    await jest.advanceTimersByTimeAsync(10_000);
    expect(jest.getTimerCount()).toBe(0);
    manager.destroy();
  });
});
