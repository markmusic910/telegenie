/**
 * Agent ↔ tab page MessageChannel handshake (port delivery; not worker-rpc).
 * Separate from the SW-only `sw-bridge-protocol` (`sw-telegram` / `sw-leader`).
 */

export const AGENT_PAGE_BRIDGE_KIND_INIT = 'agent-page.init' as const;

export type AgentPageBridgeMessage = {
  kind: typeof AGENT_PAGE_BRIDGE_KIND_INIT;
};

/** Well-known message used when transferring the tab-page API port into the agent worker. */
export const AGENT_PAGE_BRIDGE_INIT: AgentPageBridgeMessage = {
  kind: AGENT_PAGE_BRIDGE_KIND_INIT,
};

export function isAgentPageBridgeInit(
  message: unknown,
): message is AgentPageBridgeMessage {
  return (
    !!message &&
    typeof message === 'object' &&
    (message as AgentPageBridgeMessage).kind === AGENT_PAGE_BRIDGE_KIND_INIT
  );
}
