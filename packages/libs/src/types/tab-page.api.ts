/**
 * Typed API each tab page exposes to its per-tab Agent DedicatedWorker over
 * the `agent-page` MessageChannel bridge (worker-rpc). Hosted by `TabPage`
 * in the SDK AgentModule — not the SW bridge protocol.
 *
 * API boundary: all methods here are UI-only operations.
 * Telegram data and agent triggering flows tab → agent via AgentWorkerApi.
 */

/** Demo / agent-driven UI updates on the hosting tab. */
export type UpdateUiStatePayload = {
  isLoading?: boolean;
  statusMessage?: string;
};

export type TabPageApi = {
  ping: { args: []; result: 'pong' };
  updateUiState: { args: [payload: UpdateUiStatePayload]; result: void };
  /** Demo: proxy via the tab's Telegram SharedWorker client. */
  telegramIsAuthorized: { args: []; result: boolean };
  /**
   * Push a streaming LLM token to the tab UI.
   * Called by the agent worker during generate phase for real-time display.
   */
  streamToken: { args: [runId: string, token: string]; result: void };
};
