/**
 * Typed API each tab page exposes to its per-tab Agent DedicatedWorker over
 * the `agent-page` MessageChannel bridge (worker-rpc). Hosted by `TabPage`
 * in the SDK AgentModule — not the SW bridge protocol.
 *
 * API boundary: UI operations, token/tool-call streaming, and tab-registered tool execution.
 * Telegram data and agent triggering flows tab → agent via AgentWorkerApi.
 */

/** Demo / agent-driven UI updates on the hosting tab. */
export type UpdateUiStatePayload = {
  isLoading?: boolean;
  statusMessage?: string;
};

/** Controls which agent flows expose a tab-registered tool. */
export type TabPageToolScope = 'chat' | 'composer' | 'all';

/** Structured-cloneable tool descriptor synced from tab → agent worker. */
export type TabPageToolDescriptor = {
  name: string;
  description: string;
  /** JSON Schema object produced via Zod v4 `z.toJSONSchema(schema)`. */
  parameters: Record<string, unknown>;
  /** Controls which agent flows expose this tool. Defaults to `'chat'`. */
  scope?: TabPageToolScope;
};

/** Execution context passed from agent worker → tab when invoking a tool. */
export type TabPageToolContext = {
  runId: string;
  peerId?: string;
};

/** Structured result returned from tab → agent worker for a tool invocation. */
export type TabPageToolResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

/** Live tool-call lifecycle event streamed from agent worker → tab UI. */
export type TabPageToolCallEvent = {
  runId: string;
  toolCallId: string;
  toolName: string;
  status: 'start' | 'result' | 'error';
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
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
  /**
   * Invoke a tab-registered tool on the hosting tab page.
   * Called by the agent worker when the LLM invokes a tool registered from the tab.
   */
  invokeTool: {
    args: [name: string, args: Record<string, unknown>, context: TabPageToolContext];
    result: TabPageToolResult;
  };
  /**
   * Push a live tool-call lifecycle event (`start` / `result` / `error`) to the tab UI.
   */
  toolCallEvent: {
    args: [event: TabPageToolCallEvent];
    result: void;
  };
};
