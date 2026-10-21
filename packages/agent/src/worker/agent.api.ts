import type { AgentMessageRecord } from '../types/agent-message-record';
import type { DialogPreset } from '../agent-db/agent-db.types';

/**
 * Per-tab agent DedicatedWorker RPC surface (tab → agent).
 *
 * API boundary:
 * - AgentWorkerApi: Telegram data payloads + triggering operations
 * - TabPageApi: UI-only operations (e.g. updateUiState, streaming tokens)
 */
export type AgentWorkerApi = {
  ping: { args: []; result: 'pong' };
  /** Calls TabPageApi.ping over the page bridge (agent → tab). */
  demoRoundTrip: { args: []; result: 'pong' };

  /**
   * Run the agent on a user message and return the response string.
   * Optionally pass peerId to retrieve dialog presets and chat-specific history.
   * The tab should display this; streaming is via TabPageApi.streamToken.
   */
  chat: { args: [userMessage: string, peerId?: string]; result: string };

  /**
   * Process new Telegram messages through the Memory Engine.
   * MUST only be called by the leader tab — follower tabs must skip.
   * Messages are passed as AgentMessageRecord[] (not fetched by the worker)
   * to keep the data flow: tab fetches from SDK cache → sends to agent.
   */
  processNewMessages: { args: [messages: AgentMessageRecord[]]; result: void };

  /**
   * Configure the LLM used by the agent.
   * Called once during SDK initialization after the user's API key is available.
   */
  configureModel: { args: [apiKey: string, model: string]; result: void };

  /** Get user-configured preset for a specific dialog. */
  getDialogPreset: { args: [peerId: string]; result: DialogPreset | undefined };

  /** Save/update user-configured preset for a specific dialog. */
  setDialogPreset: { args: [preset: DialogPreset]; result: void };

  /** Delete user-configured preset for a specific dialog. */
  deleteDialogPreset: { args: [peerId: string]; result: void };
};

export type AgentWorkerEvents = {
  /** Streaming LLM token — agent pushes partial tokens to the tab. */
  token: { runId: string; token: string };
  /** Agent run status update. */
  runStatus: { runId: string; status: 'RUNNING' | 'COMPLETED' | 'FAILED' };
};

export type { AgentMessageRecord };
