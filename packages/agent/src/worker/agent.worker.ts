import { createWorkerClient, exposeWorkerApi } from '@telegenie/libs/foundation/worker-rpc';
import type { TabPageApi } from '@telegenie/libs/types/tab-page.api';
import type { AgentWorkerApi, AgentWorkerEvents } from './agent.api';
import { createAgentWorkerHandlers } from './agent.handlers';
import { attachTabPageBridgeListener } from './tab-page-client';
import { initAgentWorker, resolveWorkerTabId } from './agent-worker-init';

// Initialize databases and LangGraph infrastructure on startup.
// configureModel() must still be called before chat/processNewMessages.
const tabId = resolveWorkerTabId();
initAgentWorker('default', tabId).catch((err) => {
  console.error('[AgentWorker] Failed to initialize:', err);
});

exposeWorkerApi<AgentWorkerApi, AgentWorkerEvents>({
  handlers: createAgentWorkerHandlers(),
  tag: 'agent-worker',
});

attachTabPageBridgeListener((port) => createWorkerClient<TabPageApi>(port));
