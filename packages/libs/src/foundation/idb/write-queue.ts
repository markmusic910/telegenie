import type { IdbKey, IdbQueuedOp, IdbQueuedOpType } from './types';

type Resolver = {
  resolve: () => void;
  reject: (error: unknown) => void;
};

type QueuedEntry = {
  op: IdbQueuedOp;
  resolvers: Resolver[];
};

/**
 * Coalesce-by-key write queue. Last write for a (store, key) wins.
 * Does not talk to IndexedDB — the owner flushes entries.
 */
export class WriteQueue {
  private readonly pending = new Map<string, QueuedEntry>();

  static queueKey(store: string, key: IdbKey): string {
    return `${store}\0${stableSerializeKey(key)}`;
  }

  get size(): number {
    return this.pending.size;
  }

  peek(store: string, key: IdbKey): IdbQueuedOp | undefined {
    return this.pending.get(WriteQueue.queueKey(store, key))?.op;
  }

  enqueue(
    type: IdbQueuedOpType,
    store: string,
    key: IdbKey,
    value?: unknown,
  ): Promise<void> {
    const mapKey = WriteQueue.queueKey(store, key);
    const existing = this.pending.get(mapKey);

    return new Promise<void>((resolve, reject) => {
      const resolver: Resolver = { resolve, reject };

      if (existing) {
        existing.op = { type, store, key, value };
        existing.resolvers.push(resolver);
        return;
      }

      this.pending.set(mapKey, {
        op: { type, store, key, value },
        resolvers: [resolver],
      });
    });
  }

  /** Snapshot and remove up to `limit` entries (insertion order). */
  take(limit: number): QueuedEntry[] {
    const taken: QueuedEntry[] = [];
    for (const [mapKey, entry] of this.pending) {
      if (taken.length >= limit) break;
      taken.push(entry);
      this.pending.delete(mapKey);
    }
    return taken;
  }

  /**
   * Put failed ops back for a later flush. Skips keys that already have a newer pending op.
   * Waiters are not preserved (callers should have rejected them already).
   */
  requeue(entries: QueuedEntry[]): void {
    for (const entry of entries) {
      const mapKey = WriteQueue.queueKey(entry.op.store, entry.op.key);
      if (this.pending.has(mapKey)) continue;
      this.pending.set(mapKey, { op: entry.op, resolvers: [] });
    }
  }

  /** Remove pending ops for a store+key, resolving their waiters. */
  settleKey(store: string, key: IdbKey, error?: unknown): void {
    const mapKey = WriteQueue.queueKey(store, key);
    const entry = this.pending.get(mapKey);
    if (!entry) return;
    this.pending.delete(mapKey);
    settleResolvers(entry.resolvers, error);
  }

  /** Remove all pending ops for a store, resolving their waiters. */
  settleStore(store: string, error?: unknown): void {
    const prefix = `${store}\0`;
    for (const [mapKey, entry] of this.pending) {
      if (!mapKey.startsWith(prefix)) continue;
      this.pending.delete(mapKey);
      settleResolvers(entry.resolvers, error);
    }
  }

  /** Reject or resolve everything still pending. */
  settleAll(error?: unknown): void {
    for (const entry of this.pending.values()) {
      settleResolvers(entry.resolvers, error);
    }
    this.pending.clear();
  }

  clear(): void {
    this.pending.clear();
  }
}

export function settleResolvers(resolvers: Resolver[], error?: unknown): void {
  for (const { resolve, reject } of resolvers) {
    if (error !== undefined) {
      reject(error);
    } else {
      resolve();
    }
  }
}

function stableSerializeKey(key: IdbKey): string {
  if (typeof key === 'string' || typeof key === 'number' || typeof key === 'boolean') {
    return JSON.stringify(key);
  }
  if (key instanceof Date) {
    return `Date:${key.getTime()}`;
  }
  if (Array.isArray(key)) {
    return `[${key.map(stableSerializeKey).join(',')}]`;
  }
  // ArrayBuffer / typed arrays — rare for our peer keys; fall back to string tag
  return String(key);
}
