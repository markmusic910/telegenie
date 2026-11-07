import { getTabId } from '@telegenie/decorators';
import { createAgentWorkerClient, type AgentWorkerClient } from './create-agent-worker-client';

export type CreateDefaultAgentWorkerOptions = {
  tabId?: string;
  accountSlot?: string;
};

/**
 * Browser/Turbopack entry: static `new URL(..., import.meta.url)` so the bundler
 * emits a dedicated agent worker chunk (one per tab).
 *
 * Account slot and tab ID are passed via the worker `name` property
 * (`telegenie-agent:${accountSlot}:${tabId}`) so the DedicatedWorker can read them
 * synchronously on startup via `self.name`.
 */
export function createDefaultAgentWorker(
  options: CreateDefaultAgentWorkerOptions = {},
): AgentWorkerClient {
  if (typeof Worker === 'undefined') {
    throw new Error('createDefaultAgentWorker requires a browser Worker environment');
  }
  const tabId = options.tabId || getTabId();
  const accountSlot = options.accountSlot || 'default';
  const workerName = `telegenie-agent:${accountSlot}:${tabId || 'unknown-tab'}`;

  return createAgentWorkerClient({
    createWorker: () =>
      new Worker(new URL('./agent.worker.js', import.meta.url), {
        type: 'module',
        name: workerName,
      }),
  });
}
