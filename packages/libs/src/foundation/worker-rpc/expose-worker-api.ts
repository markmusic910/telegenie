import { readRpcTransfer } from './rpc-transfer';
import {
  RpcError,
  type RpcErrorPayload,
  type RpcHandlers,
  type RpcHostMessage,
  type RpcProcedures,
  type RpcRequest,
  type WorkerLike,
} from './types';

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function'
  );
}

function toErrorPayload(err: unknown): RpcErrorPayload {
  if (err instanceof RpcError) {
    return err.toPayload();
  }
  if (err instanceof Error) {
    return {
      message: err.message,
      name: err.name,
      stack: err.stack,
      code:
        'code' in err && typeof (err as { code?: unknown }).code === 'string'
          ? (err as { code: string }).code
          : undefined,
    };
  }
  return { message: String(err) };
}

function getNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export type WorkerRpcRequestLog = {
  tag: string;
  name?: string;
  color?: string;
  id: string;
  method: string;
  args: unknown[];
  duration: string;
  success: boolean;
  timestamp: string;
  response?: unknown;
  truncated?: boolean;
  error?: RpcErrorPayload;
  stream?: boolean;
  streamChunks?: number;
};

export const DEFAULT_TAG_COLORS: Record<string, string> = {
  'telegram-worker': '#0ea5e9',
  'telegram-sw-bridge': '#06b6d4',
  'agent-worker': '#a855f7',
  'rlottie-worker': '#f97316',
  'leader-tab': '#10b981',
  'tab-page': '#ec4899',
  'worker-rpc': '#6366f1',
};

/**
 * Truncates responses that exceed maxLen (default: 1000 chars) when serialized to JSON.
 */
export function truncateResponse(
  val: unknown,
  maxLen: number = 1000,
): { value: unknown; truncated: boolean } {
  if (val == null || maxLen <= 0 || !Number.isFinite(maxLen)) {
    return { value: val, truncated: false };
  }
  if (typeof val === 'string') {
    if (val.length > maxLen) {
      return {
        value: `${val.slice(0, maxLen)}... [truncated ${val.length - maxLen} chars]`,
        truncated: true,
      };
    }
    return { value: val, truncated: false };
  }
  if (typeof val === 'object') {
    const json = safeJsonStringify(val);
    if (json.length > maxLen) {
      return {
        value: `${json.slice(0, maxLen)}... [truncated ${json.length - maxLen} chars]`,
        truncated: true,
      };
    }
  }
  return { value: val, truncated: false };
}

/**
 * Safely serializes data to a single-line JSON string, gracefully handling
 * circular references, BigInt, Errors, typed arrays, functions, and symbols.
 */
export function safeJsonStringify(root: unknown, space?: number): string {
  const seen = new WeakSet();
  try {
    return JSON.stringify(
      root,
      (_key, val) => {
        if (typeof val === 'bigint') {
          return val.toString();
        }
        if (typeof val === 'function') {
          return `[Function ${val.name || 'anonymous'}]`;
        }
        if (typeof val === 'symbol') {
          return val.toString();
        }
        if (val instanceof Error) {
          return {
            name: val.name,
            message: val.message,
            code: 'code' in val ? (val as { code?: unknown }).code : undefined,
            stack: val.stack,
          };
        }
        if (typeof val === 'object' && val !== null) {
          if (typeof ArrayBuffer !== 'undefined') {
            if (val instanceof ArrayBuffer) {
              return `[ArrayBuffer ${val.byteLength} bytes]`;
            }
            if (ArrayBuffer.isView(val)) {
              return `[${val.constructor.name} ${val.byteLength} bytes]`;
            }
          }
          if (typeof MessagePort !== 'undefined' && val instanceof MessagePort) {
            return '[MessagePort]';
          }
          if (typeof ImageBitmap !== 'undefined' && val instanceof ImageBitmap) {
            return `[ImageBitmap ${val.width}x${val.height}]`;
          }
          if (typeof Blob !== 'undefined' && val instanceof Blob) {
            return `[Blob ${val.size} bytes]`;
          }
          if (seen.has(val)) {
            return '[Circular]';
          }
          seen.add(val);
        }
        return val;
      },
      space,
    );
  } catch (err) {
    return JSON.stringify({
      error: '[safeJsonStringify failed]',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export type ExposeWorkerApiOptions<
  P extends RpcProcedures,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  E extends Record<string, unknown> = Record<string, never>,
> = {
  handlers: RpcHandlers<P>;
  /** Target to post replies/events to. Defaults to `self` in a Worker. */
  port?: WorkerLike;
  /** Tag identifying this worker in JSON request logs. Defaults to options.name or 'worker-rpc'. */
  tag?: string;
  /** Optional name identifying this worker/host (e.g. 'TelegramWorker', 'AgentWorker'). */
  name?: string;
  /** Custom CSS color for console logs (e.g. '#0ea5e9'). Defaults to tag-based color. */
  color?: string;
  /** Max character length for serialized response before truncating. Defaults to 1000. Set 0 or Infinity to disable. */
  maxResponseLength?: number;
  /**
   * Request logging configuration.
   * - `true`: enable JSON request logging (default in non-production).
   * - `false`: disable request logging.
   * - function: custom sink `(logJson: string, logEntry: WorkerRpcRequestLog) => void`.
   */
  logRequests?: boolean | ((logJson: string, logEntry: WorkerRpcRequestLog) => void);
};

export type ExposedWorkerApi<E extends Record<string, unknown>> = {
  emit: <K extends keyof E & string>(event: K, payload: E[K]) => void;
  dispose: () => void;
};

/**
 * Dedicated Worker: dispatch typed RPC calls and emit push events to the main thread.
 */
export function exposeWorkerApi<
  P extends RpcProcedures,
  E extends Record<string, unknown> = Record<string, never>,
>(options: ExposeWorkerApiOptions<P, E>): ExposedWorkerApi<E> {
  const port: WorkerLike =
    options.port ??
    (typeof self !== 'undefined'
      ? (self as unknown as WorkerLike)
      : (() => {
          throw new Error('exposeWorkerApi: no Worker global `self` and no port provided');
        })());

  const { handlers } = options;
  const tag = options.tag ?? options.name ?? 'worker-rpc';
  const maxResponseLength = options.maxResponseLength ?? 1000;

  const isProduction =
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  const shouldLog =
    typeof options.logRequests === 'function'
      ? true
      : options.logRequests ?? !isProduction;

  const emitLog = (entry: WorkerRpcRequestLog) => {
    if (!shouldLog) return;
    try {
      const defaultColor = entry.success
        ? (DEFAULT_TAG_COLORS[entry.tag] ?? '#6366f1')
        : '#ef4444';
      const color = options.color ?? defaultColor;
      entry.color = color;

      const json = safeJsonStringify(entry);
      if (typeof options.logRequests === 'function') {
        options.logRequests(json, entry);
      } else {
        console.log(`%c${json}`, `color: ${color};`);
      }
    } catch {
      // Never crash the RPC handler if logging fails
    }
  };

  const post = (message: RpcHostMessage<P, E>, transfer?: Transferable[]) => {
    port.postMessage(message, transfer);
  };

  const postResult = (id: string, method: keyof P, result: unknown): unknown => {
    const delivered = readRpcTransfer(result);
    post(
      {
        kind: 'result',
        id,
        method,
        ok: true,
        value: delivered.value as P[typeof method]['result'],
      },
      delivered.transfer,
    );
    return delivered.value;
  };

  const onMessage = async (ev: MessageEvent<RpcRequest<P>>) => {
    const msg = ev.data;
    if (!msg || typeof msg !== 'object' || msg.kind !== 'call') {
      return;
    }

    const { id, method, args, stream } = msg;
    const start = getNow();
    const timestamp = new Date().toISOString();

    const calcDuration = (): string => {
      const elapsed = getNow() - start;
      const rounded = Math.round(elapsed * 100) / 100;
      return `${rounded}ms`;
    };

    const handler = handlers[method];
    if (!handler) {
      const error: RpcErrorPayload = {
        message: `Unknown method: ${String(method)}`,
        code: 'UNKNOWN_METHOD',
      };
      post({
        kind: 'result',
        id,
        method,
        ok: false,
        error,
      });
      emitLog({
        tag,
        ...(options.name ? { name: options.name } : {}),
        id,
        method: String(method),
        args,
        duration: calcDuration(),
        success: false,
        timestamp,
        error,
        ...(stream ? { stream: true } : {}),
      });
      return;
    }

    try {
      const result = await handler(...args);

      if (stream || isAsyncIterable(result)) {
        if (!isAsyncIterable(result)) {
          const value = postResult(id, method, result);
          const truncated = truncateResponse(value, maxResponseLength);
          emitLog({
            tag,
            ...(options.name ? { name: options.name } : {}),
            id,
            method: String(method),
            args,
            duration: calcDuration(),
            success: true,
            timestamp,
            response: truncated.value,
            ...(truncated.truncated ? { truncated: true } : {}),
            stream: true,
          });
          return;
        }

        let index = 0;
        for await (const value of result) {
          post({
            kind: 'stream',
            id,
            method,
            index: index++,
            value: value as P[typeof method]['result'],
          });
        }
        post({ kind: 'stream-done', id, method: String(method) });
        emitLog({
          tag,
          ...(options.name ? { name: options.name } : {}),
          id,
          method: String(method),
          args,
          duration: calcDuration(),
          success: true,
          timestamp,
          stream: true,
          streamChunks: index,
        });
        return;
      }

      const value = postResult(id, method, result);
      const truncated = truncateResponse(value, maxResponseLength);
      emitLog({
        tag,
        ...(options.name ? { name: options.name } : {}),
        id,
        method: String(method),
        args,
        duration: calcDuration(),
        success: true,
        timestamp,
        response: truncated.value,
        ...(truncated.truncated ? { truncated: true } : {}),
      });
    } catch (err) {
      const error = toErrorPayload(err);
      post({
        kind: 'result',
        id,
        method,
        ok: false,
        error,
      });
      emitLog({
        tag,
        ...(options.name ? { name: options.name } : {}),
        id,
        method: String(method),
        args,
        duration: calcDuration(),
        success: false,
        timestamp,
        error,
        ...(stream ? { stream: true } : {}),
      });
    }
  };

  port.addEventListener('message', onMessage);

  return {
    emit<K extends keyof E & string>(event: K, payload: E[K]) {
      post({ kind: 'event', event, payload });
    },
    dispose() {
      port.removeEventListener('message', onMessage);
    },
  };
}
