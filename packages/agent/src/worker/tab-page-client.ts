import type { WorkerClient } from '@telegenie/libs/foundation/worker-rpc';
import type { TabPageApi } from '@telegenie/libs/types/tab-page.api';
import { isAgentPageBridgeInit } from './page-bridge-protocol';

export type TabPageClient = WorkerClient<TabPageApi>;

let tabPageClient: TabPageClient | undefined;
let bridgeListenerAttached = false;

/**
 * worker-rpc client for the tab-hosted {@link TabPageApi}.
 * Set when the page transfers an `agent-page.init` MessagePort.
 */
export function getTabPageClient(): TabPageClient {
  if (!tabPageClient) {
    throw new Error(
      'TabPageApi bridge not connected — call AgentModule.connectPageBridge() from the tab first',
    );
  }
  return tabPageClient;
}

export function hasTabPageClient(): boolean {
  return tabPageClient !== undefined;
}

/** Clear the page client (e.g. after bridge replace / worker dispose). */
export function clearTabPageClient(): void {
  tabPageClient?.terminate();
  tabPageClient = undefined;
}

/**
 * Listen on the DedicatedWorker global for `agent-page.init` + transferred port.
 * Safe to call once at worker bootstrap.
 */
export function attachTabPageBridgeListener(
  createClient: (port: MessagePort) => TabPageClient,
): void {
  if (bridgeListenerAttached || typeof self === 'undefined') {
    return;
  }
  bridgeListenerAttached = true;

  self.addEventListener('message', (ev: MessageEvent) => {
    if (!isAgentPageBridgeInit(ev.data)) {
      return;
    }
    const port = ev.ports[0];
    if (!port) {
      return;
    }

    clearTabPageClient();
    port.start();
    tabPageClient = createClient(port);
  });
}
