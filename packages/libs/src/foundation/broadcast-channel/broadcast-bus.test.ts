/**
 * @jest-environment node
 */

import { BroadcastBus } from './broadcast-bus';

type FakeListener = (ev: MessageEvent) => void;

class FakeBroadcastChannel {
  static channels = new Map<string, Set<FakeBroadcastChannel>>();

  readonly name: string;
  private readonly listeners = new Set<FakeListener>();

  constructor(name: string) {
    this.name = name;
    const set = FakeBroadcastChannel.channels.get(name) ?? new Set();
    set.add(this);
    FakeBroadcastChannel.channels.set(name, set);
  }

  postMessage(data: unknown) {
    const peers = FakeBroadcastChannel.channels.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer === this) continue;
      const ev = { data } as MessageEvent;
      for (const listener of peer.listeners) {
        queueMicrotask(() => listener(ev));
      }
    }
  }

  addEventListener(_type: 'message', listener: FakeListener) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: FakeListener) {
    this.listeners.delete(listener);
  }

  close() {
    this.listeners.clear();
    FakeBroadcastChannel.channels.get(this.name)?.delete(this);
  }

  static reset() {
    FakeBroadcastChannel.channels.clear();
  }
}

describe('BroadcastBus', () => {
  const Original = globalThis.BroadcastChannel;

  beforeEach(() => {
    FakeBroadcastChannel.reset();
    (globalThis as { BroadcastChannel: typeof BroadcastChannel }).BroadcastChannel =
      FakeBroadcastChannel as unknown as typeof BroadcastChannel;
  });

  afterEach(() => {
    (globalThis as { BroadcastChannel: typeof BroadcastChannel }).BroadcastChannel = Original;
    FakeBroadcastChannel.reset();
  });

  it('delivers typed messages to other instances', async () => {
    const a = new BroadcastBus({ name: 'test', senderId: 'a' });
    const b = new BroadcastBus({ name: 'test', senderId: 'b' });

    const received = new Promise<unknown>((resolve) => {
      b.on('ping', (env) => resolve(env.payload));
    });

    a.post('ping', { n: 1 });
    await expect(received).resolves.toEqual({ n: 1 });

    a.close();
    b.close();
  });

  it('ignores own echoes', async () => {
    const a = new BroadcastBus({ name: 'test', senderId: 'a' });
    let hits = 0;
    a.on('ping', () => {
      hits += 1;
    });
    a.post('ping', true);
    await new Promise((r) => setTimeout(r, 10));
    expect(hits).toBe(0);
    a.close();
  });
});
