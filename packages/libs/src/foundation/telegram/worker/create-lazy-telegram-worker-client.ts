import type { TelegramWorkerClient } from './create-telegram-worker-client';

/**
 * Delay Worker construction until the first RPC call so SSR can construct the SDK.
 */
export function createLazyTelegramWorkerClient(
  factory: () => TelegramWorkerClient,
): TelegramWorkerClient {
  let inner: TelegramWorkerClient | undefined;
  const get = (): TelegramWorkerClient => {
    if (!inner) {
      inner = factory();
    }
    return inner;
  };

  return {
    get worker() {
      return get().worker;
    },
    call: (method, args, options) => get().call(method, args, options),
    stream: (method, args, options) => get().stream(method, args, options),
    on: (event, handler) => get().on(event, handler),
    terminate: () => {
      if (inner) {
        inner.terminate();
      }
    },
  };
}
