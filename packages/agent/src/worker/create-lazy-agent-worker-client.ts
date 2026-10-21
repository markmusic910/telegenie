import type { AgentWorkerClient } from './create-agent-worker-client';

/**
 * Delay DedicatedWorker construction until the first RPC call (SSR-safe).
 */
export function createLazyAgentWorkerClient(
  factory: () => AgentWorkerClient,
): AgentWorkerClient {
  let inner: AgentWorkerClient | undefined;
  const get = (): AgentWorkerClient => {
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
