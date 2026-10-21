import { getTabId } from '@telegenie/decorators';
import { createAgentWorkerClient, type AgentWorkerClient } from './create-agent-worker-client';

export type CreateDefaultAgentWorkerOptions = {
  tabId?: string;
};

/**
 * Browser/Turbopack entry: static `new URL(..., import.meta.url)` so the bundler
 * emits a dedicated agent worker chunk (one per tab).
 *
 * Tab ID is passed via the worker `name` property (`telegenie-agent:${tabId}`)
 * so the DedicatedWorker can read it synchronously on startup via `self.name`.
 */
export function createDefaultAgentWorker(
  options: CreateDefaultAgentWorkerOptions = {},
): AgentWorkerClient {
  if (typeof Worker === 'undefined') {
    throw new Error('createDefaultAgentWorker requires a browser Worker environment');
  }
  const tabId = options.tabId || getTabId();
  const workerName =
    tabId && tabId !== 'unknown-tab' ? `telegenie-agent:${tabId}` : 'telegenie-agent';

  return createAgentWorkerClient({
    createWorker: () =>
      new Worker(new URL('./agent.worker.js', import.meta.url), {
        type: 'module',
        name: workerName,
      }),
  });
}
