import type { RpcTransferred } from './rpc-transfer';

/**
 * Map of RPC method name → argument tuple and result type.
 * Shared by main-thread client and worker host.
 */
export type RpcProcedures = Record<string, { args: unknown[]; result: unknown }>;

export type RpcErrorPayload = {
  message: string;
  code?: string;
  name?: string;
  stack?: string;
};

export type RpcRequest<P extends RpcProcedures, K extends keyof P = keyof P> = {
  kind: 'call';
  id: string;
  method: K;
  args: P[K]['args'];
  /** When true, handler may yield multiple stream chunks before a final result. */
  stream?: boolean;
};

export type RpcResponse<P extends RpcProcedures, K extends keyof P = keyof P> =
  | {
      kind: 'result';
      id: string;
      method: K;
      ok: true;
      value: P[K]['result'];
    }
  | {
      kind: 'result';
      id: string;
      method: K;
      ok: false;
      error: RpcErrorPayload;
    };

export type RpcStreamChunk<P extends RpcProcedures, K extends keyof P = keyof P> = {
  kind: 'stream';
  id: string;
  method: K;
  index: number;
  value: P[K]['result'];
};

export type RpcStreamDone = {
  kind: 'stream-done';
  id: string;
  method: string;
};

export type RpcEvent<E extends Record<string, unknown>, K extends keyof E = keyof E> = {
  kind: 'event';
  event: K;
  payload: E[K];
};

export type RpcHostMessage<
  P extends RpcProcedures,
  E extends Record<string, unknown> = Record<string, never>,
> = RpcResponse<P> | RpcStreamChunk<P> | RpcStreamDone | RpcEvent<E>;

export type RpcClientMessage<P extends RpcProcedures> = RpcRequest<P>;

/** Minimal Worker / MessagePort surface used by the bridge. */
export type WorkerLike = {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(
    type: 'message' | 'messageerror',
    listener: (ev: MessageEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: 'message' | 'messageerror',
    listener: (ev: MessageEvent) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  terminate?(): void;
  /** MessagePort / SharedWorker port close (preferred over terminate for shared ports). */
  close?(): void;
  start?(): void;
};

export type CallOptions = {
  transfer?: Transferable[];
};

export class RpcError extends Error {
  readonly code?: string;
  readonly method?: string;

  constructor(message: string, code?: string, name?: string, method?: string) {
    super(method ? `[${method}] ${message}` : message);
    this.name = name ?? 'RpcError';
    this.code = code;
    this.method = method;
  }

  static fromPayload(payload: RpcErrorPayload, method?: string): RpcError {
    const error = new RpcError(payload.message, payload.code, payload.name, method);
    if (payload.stack) {
      error.stack = payload.stack;
    }
    return error;
  }

  toPayload(): RpcErrorPayload {
    return {
      message: this.message,
      code: this.code,
      name: this.name,
      stack: this.stack,
    };
  }
}

export type RpcHandlerResult<T> = T | RpcTransferred<T>;

export type RpcHandlers<P extends RpcProcedures> = {
  [K in keyof P]: (
    ...args: P[K]['args']
  ) =>
    | RpcHandlerResult<P[K]['result']>
    | Promise<RpcHandlerResult<P[K]['result']>>
    | AsyncIterable<P[K]['result']>;
};
