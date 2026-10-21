/**
 * Host-side marker for a call result that must move across the port.
 * ImageBitmap and other Transferables are copied by structured clone unless
 * they are listed here. The wrapper itself is never posted.
 */
const transferred = new WeakSet<object>();

export type RpcTransferred<T> = {
  readonly value: T;
  readonly transfer: readonly Transferable[];
};

export function rpcTransfer<T>(value: T, transfer: readonly Transferable[]): RpcTransferred<T> {
  const wrapped: RpcTransferred<T> = { value, transfer };
  transferred.add(wrapped);
  return wrapped;
}

export function readRpcTransfer(result: unknown): {
  value: unknown;
  transfer?: Transferable[];
} {
  if (typeof result === 'object' && result !== null && transferred.has(result)) {
    const wrapped = result as RpcTransferred<unknown>;
    return {
      value: wrapped.value,
      transfer: wrapped.transfer.length > 0 ? [...wrapped.transfer] : undefined,
    };
  }
  return { value: result };
}
