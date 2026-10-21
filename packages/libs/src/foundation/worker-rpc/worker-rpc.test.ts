/**
 * @jest-environment node
 */
import { createWorkerClient } from './create-worker-client';
import { exposeWorkerApi } from './expose-worker-api';
import { rpcTransfer } from './rpc-transfer';
import { RpcError, type WorkerLike } from './types';

type TestApi = {
  add: { args: [number, number]; result: number };
  fail: { args: [string]; result: never };
  taggedFail: { args: []; result: never };
  echo: { args: [string]; result: string };
  count: { args: [number]; result: number };
};

type TestEvents = {
  tick: { n: number };
};

class FakePort implements WorkerLike {
  private readonly peers = new Set<FakePort>();
  private readonly listeners = new Map<'message' | 'messageerror', Set<(ev: MessageEvent) => void>>();

  link(peer: FakePort) {
    this.peers.add(peer);
    peer.peers.add(this);
  }

  readonly posted: { message: unknown; transfer?: Transferable[] }[] = [];

  postMessage(message: unknown, transfer?: Transferable[]) {
    this.posted.push({ message, transfer });
    const ev = { data: message } as MessageEvent;
    for (const peer of this.peers) {
      const set = peer.listeners.get('message');
      if (!set) continue;
      for (const listener of set) {
        queueMicrotask(() => listener(ev));
      }
    }
  }

  addEventListener(type: 'message' | 'messageerror', listener: (ev: MessageEvent) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: 'message' | 'messageerror', listener: (ev: MessageEvent) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  start() {}

  close() {
    this.terminate();
  }

  terminate() {
    this.listeners.clear();
    this.peers.clear();
  }
}

function createPair() {
  const main = new FakePort();
  const worker = new FakePort();
  main.link(worker);
  return { main, worker };
}

describe('worker-rpc', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('round-trips a typed call', async () => {
    const { main, worker } = createPair();
    exposeWorkerApi<TestApi>({
      port: worker,
      handlers: {
        add: (a, b) => a + b,
        fail: async (msg) => {
          throw new Error(msg);
        },
        taggedFail: async () => {
          throw new RpcError('nope', 'TAGGED');
        },
        echo: (s) => s,
        count: async function* (n) {
          for (let i = 0; i < n; i++) yield i;
        },
      },
    });

    const client = createWorkerClient<TestApi>(main);
    await expect(client.call('add', [2, 3])).resolves.toBe(5);
    await expect(client.call('echo', ['hi'])).resolves.toBe('hi');
  });

  it('propagates errors as RpcError', async () => {
    const { main, worker } = createPair();
    exposeWorkerApi<TestApi>({
      port: worker,
      handlers: {
        add: (a, b) => a + b,
        fail: async (msg) => {
          throw new Error(msg);
        },
        taggedFail: async () => {
          throw new RpcError('nope', 'TAGGED');
        },
        echo: (s) => s,
        count: async function* () {
          yield 0;
        },
      },
    });

    const client = createWorkerClient<TestApi>(main);
    await expect(client.call('fail', ['boom'])).rejects.toMatchObject({
      message: '[fail] boom',
      name: 'Error',
    });

    try {
      await client.call('taggedFail', []);
      throw new Error('expected reject');
    } catch (err) {
      expect(err).toBeInstanceOf(RpcError);
      expect((err as RpcError).code).toBe('TAGGED');
      expect((err as RpcError).message).toBe('[taggedFail] nope');
      expect((err as RpcError).method).toBe('taggedFail');
      expect((err as RpcError).stack).toEqual(expect.stringContaining('RpcError'));
    }
  });

  it('streams async iterables', async () => {
    const { main, worker } = createPair();
    exposeWorkerApi<TestApi>({
      port: worker,
      handlers: {
        add: (a, b) => a + b,
        fail: async () => {
          throw new Error('x');
        },
        taggedFail: async () => {
          throw new RpcError('x');
        },
        echo: (s) => s,
        count: async function* (n) {
          for (let i = 0; i < n; i++) {
            yield i;
          }
        },
      },
    });

    const client = createWorkerClient<TestApi>(main);
    const values: number[] = [];
    for await (const v of client.stream('count', [3])) {
      values.push(v);
    }
    expect(values).toEqual([0, 1, 2]);
  });

  it('delivers push events', async () => {
    const { main, worker } = createPair();
    const host = exposeWorkerApi<TestApi, TestEvents>({
      port: worker,
      handlers: {
        add: (a, b) => a + b,
        fail: async () => {
          throw new Error('x');
        },
        taggedFail: async () => {
          throw new RpcError('x');
        },
        echo: (s) => s,
        count: async function* () {
          yield 0;
        },
      },
    });

    const client = createWorkerClient<TestApi, TestEvents>(main);
    const ticks: number[] = [];
    const unsub = client.on('tick', (p) => {
      ticks.push(p.n);
    });

    host.emit('tick', { n: 1 });
    host.emit('tick', { n: 2 });
    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });
    expect(ticks).toEqual([1, 2]);

    unsub();
    host.emit('tick', { n: 3 });
    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });
    expect(ticks).toEqual([1, 2]);
  });

  it('moves rpcTransfer results and returns the inner value', async () => {
    type PaintApi = {
      paint: { args: []; result: { width: number } };
    };

    const bitmap = { width: 4 };
    const { main, worker } = createPair();
    exposeWorkerApi<PaintApi>({
      port: worker,
      handlers: {
        paint: () => rpcTransfer(bitmap, [bitmap as unknown as Transferable]),
      },
    });

    const client = createWorkerClient<PaintApi>(main);
    await expect(client.call('paint', [])).resolves.toBe(bitmap);

    const result = worker.posted.find((entry) => {
      const message = entry.message as { kind?: string; ok?: boolean };
      return message?.kind === 'result' && message.ok === true;
    });
    expect(result?.transfer).toEqual([bitmap]);
  });
});

describe('exposeSharedWorkerApi', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  class FakeScope {
    private readonly connectListeners = new Set<(ev: MessageEvent) => void>();

    addEventListener(_type: 'connect', listener: (ev: MessageEvent) => void) {
      this.connectListeners.add(listener);
    }

    removeEventListener(_type: 'connect', listener: (ev: MessageEvent) => void) {
      this.connectListeners.delete(listener);
    }

    connect(port: FakePort) {
      const ev = { ports: [port] } as unknown as MessageEvent;
      for (const listener of this.connectListeners) {
        listener(ev);
      }
    }
  }

  it('fans out events to all connected ports', async () => {
    const { exposeSharedWorkerApi } = await import('./expose-shared-worker-api');
    const scope = new FakeScope();
    const host = exposeSharedWorkerApi<TestApi, TestEvents>({
      scope: scope as never,
      handlers: {
        add: (a, b) => a + b,
        fail: async () => {
          throw new Error('x');
        },
        taggedFail: async () => {
          throw new RpcError('x');
        },
        echo: (s) => s,
        count: async function* () {
          yield 0;
        },
      },
    });

    const mainA = new FakePort();
    const workerA = new FakePort();
    mainA.link(workerA);
    scope.connect(workerA);

    const mainB = new FakePort();
    const workerB = new FakePort();
    mainB.link(workerB);
    scope.connect(workerB);

    const clientA = createWorkerClient<TestApi, TestEvents>(mainA);
    const clientB = createWorkerClient<TestApi, TestEvents>(mainB);

    const ticksA: number[] = [];
    const ticksB: number[] = [];
    clientA.on('tick', (p) => ticksA.push(p.n));
    clientB.on('tick', (p) => ticksB.push(p.n));

    await expect(clientA.call('add', [1, 2])).resolves.toBe(3);
    await expect(clientB.call('add', [4, 5])).resolves.toBe(9);

    host.emit('tick', { n: 7 });
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 0);
    });

    expect(ticksA).toEqual([7]);
    expect(ticksB).toEqual([7]);
    expect(host.getPorts()).toHaveLength(2);

    host.dispose();
  });
});

describe('worker-rpc request logging', () => {
  type MathApi = {
    compute: { args: [number]; result: number };
    throwError: { args: []; result: never };
    streamNumbers: { args: [number]; result: number };
  };

  it('logs successful request with JSON and color to console.log by default', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { main, worker } = createPair();
      exposeWorkerApi<MathApi>({
        port: worker,
        tag: 'telegram-worker',
        name: 'TelegramWorker',
        handlers: {
          compute: (n) => n * 2,
          throwError: async () => {
            throw new Error('math error');
          },
          streamNumbers: async function* (n) {
            for (let i = 0; i < n; i++) yield i;
          },
        },
      });

      const client = createWorkerClient<MathApi>(main);
      await client.call('compute', [21]);

      expect(logSpy).toHaveBeenCalled();
      const lastCall = logSpy.mock.calls[logSpy.mock.calls.length - 1];
      const raw = lastCall[0];
      const style = lastCall[1];
      const json = typeof raw === 'string' && raw.startsWith('%c') ? raw.slice(2) : raw;
      const parsed = JSON.parse(json);

      expect(parsed).toMatchObject({
        tag: 'telegram-worker',
        name: 'TelegramWorker',
        method: 'compute',
        args: [21],
        success: true,
        response: 42,
        color: '#0ea5e9',
      });
      expect(style).toBe('color: #0ea5e9;');
      expect(typeof parsed.id).toBe('string');
      expect(parsed.durationMs).toBeUndefined();
      expect(typeof parsed.duration).toBe('string');
      expect(parsed.duration).toMatch(/^\d+(\.\d+)?ms$/);
      expect(typeof parsed.timestamp).toBe('string');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('logs failed request with error details and red color', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { main, worker } = createPair();
      exposeWorkerApi<MathApi>({
        port: worker,
        tag: 'math-worker',
        name: 'MathWorker',
        handlers: {
          compute: (n) => n,
          throwError: async () => {
            throw new Error('computation failed');
          },
          streamNumbers: async function* () {},
        },
      });

      const client = createWorkerClient<MathApi>(main);
      await expect(client.call('throwError', [])).rejects.toThrow();

      const lastCall = logSpy.mock.calls[logSpy.mock.calls.length - 1];
      const raw = lastCall[0];
      const style = lastCall[1];
      const json = typeof raw === 'string' && raw.startsWith('%c') ? raw.slice(2) : raw;
      const parsed = JSON.parse(json);

      expect(parsed).toMatchObject({
        tag: 'math-worker',
        name: 'MathWorker',
        method: 'throwError',
        args: [],
        success: false,
        color: '#ef4444',
        error: {
          message: 'computation failed',
          name: 'Error',
        },
      });
      expect(style).toBe('color: #ef4444;');
      expect(parsed.durationMs).toBeUndefined();
      expect(typeof parsed.duration).toBe('string');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('logs unknown method request with red color', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { main, worker } = createPair();
      exposeWorkerApi<{ existing: { args: []; result: void } }>({
        port: worker,
        tag: 'empty-worker',
        name: 'EmptyWorker',
        handlers: {
          existing: () => {},
        },
      });

      const client = createWorkerClient<{ missing: { args: []; result: void } }>(main);
      await expect(client.call('missing', [])).rejects.toThrow();

      const lastCall = logSpy.mock.calls[logSpy.mock.calls.length - 1];
      const raw = lastCall[0];
      const style = lastCall[1];
      const json = typeof raw === 'string' && raw.startsWith('%c') ? raw.slice(2) : raw;
      const parsed = JSON.parse(json);

      expect(parsed).toMatchObject({
        tag: 'empty-worker',
        name: 'EmptyWorker',
        method: 'missing',
        success: false,
        color: '#ef4444',
        error: {
          code: 'UNKNOWN_METHOD',
        },
      });
      expect(style).toBe('color: #ef4444;');
      expect(parsed.durationMs).toBeUndefined();
      expect(typeof parsed.duration).toBe('string');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('logs streaming requests with chunk count', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { main, worker } = createPair();
      exposeWorkerApi<MathApi>({
        port: worker,
        handlers: {
          compute: (n) => n,
          throwError: async () => {
            throw new Error('x');
          },
          streamNumbers: async function* (n) {
            for (let i = 0; i < n; i++) yield i;
          },
        },
      });

      const client = createWorkerClient<MathApi>(main);
      const items: number[] = [];
      for await (const chunk of client.stream('streamNumbers', [3])) {
        items.push(chunk);
      }
      expect(items).toEqual([0, 1, 2]);

      const lastCall = logSpy.mock.calls[logSpy.mock.calls.length - 1];
      const raw = lastCall[0];
      const json = typeof raw === 'string' && raw.startsWith('%c') ? raw.slice(2) : raw;
      const parsed = JSON.parse(json);

      expect(parsed).toMatchObject({
        tag: 'worker-rpc',
        method: 'streamNumbers',
        args: [3],
        success: true,
        stream: true,
        streamChunks: 3,
      });
      expect(parsed.durationMs).toBeUndefined();
      expect(typeof parsed.duration).toBe('string');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('truncates long string and object responses based on maxResponseLength', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      type BigApi = {
        bigString: { args: []; result: string };
        bigObject: { args: []; result: { items: number[] } };
        shortObject: { args: []; result: { ok: boolean } };
      };

      const { main, worker } = createPair();
      exposeWorkerApi<BigApi>({
        port: worker,
        tag: 'agent-worker',
        maxResponseLength: 100,
        handlers: {
          bigString: () => 'A'.repeat(300),
          bigObject: () => ({ items: Array.from({ length: 50 }, (_, i) => i) }),
          shortObject: () => ({ ok: true }),
        },
      });

      const client = createWorkerClient<BigApi>(main);

      // 1. Long string
      await client.call('bigString', []);
      let lastCall = logSpy.mock.calls[logSpy.mock.calls.length - 1];
      let json = (lastCall[0] as string).slice(2);
      let parsed = JSON.parse(json);
      expect(parsed.truncated).toBe(true);
      expect(typeof parsed.response).toBe('string');
      expect(parsed.response).toContain('... [truncated 200 chars]');

      // 2. Long object
      await client.call('bigObject', []);
      lastCall = logSpy.mock.calls[logSpy.mock.calls.length - 1];
      json = (lastCall[0] as string).slice(2);
      parsed = JSON.parse(json);
      expect(parsed.truncated).toBe(true);
      expect(typeof parsed.response).toBe('string');
      expect(parsed.response).toContain('... [truncated');

      // 3. Short object (not truncated)
      await client.call('shortObject', []);
      lastCall = logSpy.mock.calls[logSpy.mock.calls.length - 1];
      json = (lastCall[0] as string).slice(2);
      parsed = JSON.parse(json);
      expect(parsed.truncated).toBeUndefined();
      expect(parsed.response).toEqual({ ok: true });
    } finally {
      logSpy.mockRestore();
    }
  });

  it('supports custom log sink, custom color, and logRequests: false', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const customLogs: Array<{ tag?: string; method?: string; response?: unknown; color?: string }> = [];
      const { main, worker } = createPair();
      exposeWorkerApi<MathApi>({
        port: worker,
        tag: 'custom-worker',
        color: '#ff00aa',
        logRequests: (_json, entry) => {
          customLogs.push(entry);
        },
        handlers: {
          compute: (n) => n * 10,
          throwError: async () => {
            throw new Error('x');
          },
          streamNumbers: async function* () {},
        },
      });

      const client = createWorkerClient<MathApi>(main);
      await client.call('compute', [5]);

      expect(customLogs).toHaveLength(1);
      expect(customLogs[0]).toMatchObject({
        tag: 'custom-worker',
        color: '#ff00aa',
        method: 'compute',
        response: 50,
      });

      // console.log should NOT have been called since custom sink was used
      expect(logSpy).not.toHaveBeenCalled();

      // Test logRequests: false
      const { main: main2, worker: worker2 } = createPair();
      exposeWorkerApi<MathApi>({
        port: worker2,
        logRequests: false,
        handlers: {
          compute: (n) => n * 2,
          throwError: async () => {
            throw new Error('x');
          },
          streamNumbers: async function* () {},
        },
      });
      const client2 = createWorkerClient<MathApi>(main2);
      await client2.call('compute', [2]);
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });

  it('safeJsonStringify handles complex types, bigints, cycles, and buffers', async () => {
    const { safeJsonStringify } = await import('./expose-worker-api');
    const complexObj: Record<string, unknown> = {
      big: 9007199254740993n,
      fn: function hello() {},
      sym: Symbol('testSym'),
      err: new Error('nested err'),
      buf: new Uint8Array([1, 2, 3]),
    };
    complexObj.circular = complexObj;

    const json = safeJsonStringify(complexObj);
    const parsed = JSON.parse(json);

    expect(parsed.big).toBe('9007199254740993');
    expect(parsed.fn).toBe('[Function hello]');
    expect(parsed.sym).toBe('Symbol(testSym)');
    expect(parsed.err.message).toBe('nested err');
    expect(parsed.buf).toBe('[Uint8Array 3 bytes]');
    expect(parsed.circular).toBe('[Circular]');
  });
});
