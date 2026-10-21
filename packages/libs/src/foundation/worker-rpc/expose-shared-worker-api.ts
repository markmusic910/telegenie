import {
  exposeWorkerApi,
  type ExposedWorkerApi,
  type WorkerRpcRequestLog,
} from './expose-worker-api';
import type { RpcHandlers, RpcProcedures, WorkerLike } from './types';

export type ExposeSharedWorkerApiOptions<
  P extends RpcProcedures,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  E extends Record<string, unknown> = Record<string, never>,
> = {
  handlers: RpcHandlers<P>;
  /**
   * SharedWorker global that emits `connect`. Defaults to `self`.
   * Tests can pass a fake with addEventListener('connect', ...).
   */
  scope?: SharedWorkerScopeLike;
  onConnect?: (port: WorkerLike) => void;
  /** Optional name identifying this shared worker host. */
  name?: string;
  /** Tag identifying this shared worker in JSON request logs. Defaults to 'worker-rpc'. */
  tag?: string;
  /** Custom CSS color for console logs (e.g. '#0ea5e9'). Defaults to tag-based color. */
  color?: string;
  /** Max character length for serialized response before truncating. Defaults to 1000. Set 0 or Infinity to disable. */
  maxResponseLength?: number;
  /** Request logging configuration passed to exposeWorkerApi. */
  logRequests?: boolean | ((logJson: string, logEntry: WorkerRpcRequestLog) => void);
};

export type SharedWorkerScopeLike = {
  addEventListener(
    type: 'connect',
    listener: (ev: MessageEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: 'connect',
    listener: (ev: MessageEvent) => void,
    options?: boolean | EventListenerOptions,
  ): void;
};

export type ExposedSharedWorkerApi<E extends Record<string, unknown>> = {
  emit: <K extends keyof E & string>(event: K, payload: E[K]) => void;
  dispose: () => void;
  getPorts: () => readonly WorkerLike[];
};

type PortEntry<E extends Record<string, unknown>> = {
  port: WorkerLike;
  host: ExposedWorkerApi<E>;
};

/**
 * SharedWorker host: one handlers map, per-connect `exposeWorkerApi`, fan-out `emit`.
 */
export function exposeSharedWorkerApi<
  P extends RpcProcedures,
  E extends Record<string, unknown> = Record<string, never>,
>(options: ExposeSharedWorkerApiOptions<P, E>): ExposedSharedWorkerApi<E> {
  const scope: SharedWorkerScopeLike =
    options.scope ??
    (typeof self !== 'undefined'
      ? (self as unknown as SharedWorkerScopeLike)
      : (() => {
          throw new Error('exposeSharedWorkerApi: no SharedWorker `self` and no scope provided');
        })());

  const ports = new Map<WorkerLike, PortEntry<E>>();

  const dropPort = (port: WorkerLike) => {
    const entry = ports.get(port);
    if (!entry) return;
    entry.host.dispose();
    ports.delete(port);
  };

  const onConnect = (ev: MessageEvent) => {
    const port = (ev as MessageEvent & { ports: MessagePort[] }).ports?.[0] as
      | WorkerLike
      | undefined;
    if (!port) {
      return;
    }
    port.start?.();

    const host = exposeWorkerApi<P, E>({
      handlers: options.handlers,
      port,
      name: options.name,
      tag: options.tag,
      color: options.color,
      maxResponseLength: options.maxResponseLength,
      logRequests: options.logRequests,
    });

    ports.set(port, { port, host });
    options.onConnect?.(port);

    port.addEventListener('messageerror', () => dropPort(port));
  };

  scope.addEventListener('connect', onConnect);

  return {
    emit<K extends keyof E & string>(event: K, payload: E[K]) {
      for (const [port, { host }] of [...ports.entries()]) {
        try {
          host.emit(event, payload);
        } catch (err) {
          console.error('[exposeSharedWorkerApi] emit failed; dropping port', err);
          dropPort(port);
        }
      }
    },
    getPorts() {
      return [...ports.keys()];
    },
    dispose() {
      scope.removeEventListener('connect', onConnect);
      for (const { host, port } of ports.values()) {
        host.dispose();
        port.close?.();
      }
      ports.clear();
    },
  };
}
