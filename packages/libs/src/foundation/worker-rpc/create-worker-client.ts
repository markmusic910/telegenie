import {
  RpcError,
  type CallOptions,
  type RpcClientMessage,
  type RpcEvent,
  type RpcHostMessage,
  type RpcProcedures,
  type WorkerLike,
} from './types';

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

type PendingCall = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

type PendingStream = {
  push: (value: unknown) => void;
  end: () => void;
  fail: (reason?: unknown) => void;
};

export type WorkerClient<
  P extends RpcProcedures,
  E extends Record<string, unknown> = Record<string, never>,
> = {
  call<K extends keyof P & string>(
    method: K,
    args: P[K]['args'],
    options?: CallOptions,
  ): Promise<P[K]['result']>;
  stream<K extends keyof P & string>(
    method: K,
    args: P[K]['args'],
    options?: CallOptions,
  ): AsyncGenerator<P[K]['result'], void, unknown>;
  on<K extends keyof E & string>(event: K, handler: (payload: E[K]) => void): () => void;
  terminate(): void;
  readonly worker: WorkerLike;
};

/**
 * Main-thread RPC client over a Worker (or any WorkerLike MessagePort pair).
 */
export function createWorkerClient<
  P extends RpcProcedures,
  E extends Record<string, unknown> = Record<string, never>,
>(worker: WorkerLike): WorkerClient<P, E> {
  const pending = new Map<string, PendingCall>();
  const streams = new Map<string, PendingStream>();
  const listeners = new Map<keyof E & string, Set<(payload: E[keyof E]) => void>>();

  const onMessage = (ev: MessageEvent<RpcHostMessage<P, E>>) => {
    const msg = ev.data;
    if (!msg || typeof msg !== 'object' || !('kind' in msg)) {
      return;
    }

    if (msg.kind === 'event') {
      const set = listeners.get(msg.event as keyof E & string);
      if (!set) return;
      for (const handler of set) {
        try {
          handler((msg as RpcEvent<E>).payload);
        } catch (err) {
          console.error('[worker-rpc] event handler error', err);
        }
      }
      return;
    }

    if (msg.kind === 'stream') {
      streams.get(msg.id)?.push(msg.value);
      return;
    }

    if (msg.kind === 'stream-done') {
      const stream = streams.get(msg.id);
      if (stream) {
        streams.delete(msg.id);
        stream.end();
      }
      return;
    }

    if (msg.kind === 'result') {
      const stream = streams.get(msg.id);
      if (stream) {
        streams.delete(msg.id);
        // Narrow with `===` so TS discriminates the generic RpcResponse union.
        if (msg.ok === true) {
          stream.push(msg.value);
          stream.end();
        } else {
          stream.fail(RpcError.fromPayload(msg.error, String(msg.method)));
        }
        return;
      }

      const slot = pending.get(msg.id);
      if (!slot) return;
      pending.delete(msg.id);
      if (msg.ok === true) {
        slot.resolve(msg.value);
      } else {
        slot.reject(RpcError.fromPayload(msg.error, String(msg.method)));
      }
    }
  };

  worker.addEventListener('message', onMessage);

  function postCall<K extends keyof P & string>(
    method: K,
    args: P[K]['args'],
    options: CallOptions | undefined,
    stream: boolean,
  ): string {
    const id = newRequestId();
    const message: RpcClientMessage<P> = {
      kind: 'call',
      id,
      method,
      args,
      stream: stream || undefined,
    };
    worker.postMessage(message, options?.transfer);
    return id;
  }

  return {
    worker,

    call<K extends keyof P & string>(
      method: K,
      args: P[K]['args'],
      options?: CallOptions,
    ): Promise<P[K]['result']> {
      const id = postCall(method, args, options, false);
      const { promise, resolve, reject } = Promise.withResolvers<P[K]['result']>();
      pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      return promise;
    },

    async *stream<K extends keyof P & string>(
      method: K,
      args: P[K]['args'],
      options?: CallOptions,
    ): AsyncGenerator<P[K]['result'], void, unknown> {
      const id = postCall(method, args, options, true);

      const queue: unknown[] = [];
      let done = false;
      let error: unknown;
      let wake: (() => void) | undefined;

      const notify = () => {
        wake?.();
        wake = undefined;
      };

      streams.set(id, {
        push: (value) => {
          queue.push(value);
          notify();
        },
        end: () => {
          done = true;
          notify();
        },
        fail: (reason) => {
          error = reason;
          done = true;
          notify();
        },
      });

      try {
        while (true) {
          if (queue.length > 0) {
            yield queue.shift() as P[K]['result'];
            continue;
          }
          if (error) {
            throw error;
          }
          if (done) {
            return;
          }
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
        }
      } finally {
        streams.delete(id);
      }
    },

    on<K extends keyof E & string>(event: K, handler: (payload: E[K]) => void): () => void {
      const set = listeners.get(event) ?? new Set();
      set.add(handler as (payload: E[keyof E]) => void);
      listeners.set(event, set);
      return () => {
        set.delete(handler as (payload: E[keyof E]) => void);
        if (set.size === 0) {
          listeners.delete(event);
        }
      };
    },

    terminate(): void {
      worker.removeEventListener('message', onMessage);
      for (const [, slot] of pending) {
        slot.reject(new RpcError('Worker terminated', 'WORKER_TERMINATED'));
      }
      pending.clear();
      for (const [, stream] of streams) {
        stream.fail(new RpcError('Worker terminated', 'WORKER_TERMINATED'));
      }
      streams.clear();
      listeners.clear();
      if (typeof worker.terminate === 'function') {
        worker.terminate();
      } else {
        worker.close?.();
      }
    },
  };
}
