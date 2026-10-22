import type { AgentMessageRecord } from '../types/agent-message-record';
import type { AgentMessage, AgentRun, DialogPreset } from '../agent-db/agent-db.types';
import type { ModelConfig } from '../agent/models';
import type { AgentPreset } from '../preset/preset.types';

export interface ChatOptions {
  peerId?: string;
  model?: string;
  presetId?: string;
  runId?: string;
}

export interface ChatResult {
  text: string;
  thought?: string;
}

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
   * Streaming is via TabPageApi.streamToken.
   */
  chat: {
    args: [userMessage: string, options?: string | ChatOptions];
    result: ChatResult;
  };

  /**
   * Process new Telegram messages through the Memory Engine.
   * MUST only be called by the leader tab — follower tabs must skip.
   */
  processNewMessages: { args: [messages: AgentMessageRecord[]]; result: void };

  /**
   * Configure the LLM used by the agent.
   */
  configureModel: {
    args: [configOrApiKey: string | ModelConfig, model?: string];
    result: void;
  };

  /** Get user-configured preset for a specific dialog. */
  getDialogPreset: { args: [peerId: string]; result: DialogPreset | undefined };

  /** Save/update user-configured preset for a specific dialog. */
  setDialogPreset: { args: [preset: DialogPreset]; result: void };

  /** Delete user-configured preset for a specific dialog. */
  deleteDialogPreset: { args: [peerId: string]; result: void };

  /** Get recent conversation runs stored in IndexedDB. */
  getRecentRuns: { args: [limit?: number]; result: AgentRun[] };

  /** Get messages for a specific conversation run. */
  getRunMessages: { args: [runId: string]; result: AgentMessage[] };

  /** Update the title of a conversation run in IndexedDB. */
  updateRunTitle: { args: [runId: string, title: string]; result: void };

  /** Generate an AI summary title for a conversation run and persist it. */
  generateRunTitle: {
    args: [
      runId: string,
      options?: { apiKeys?: import('../agent/models').ProviderApiKeys; model?: string },
    ];
    result: string;
  };

  /** Get all available presets (builtin + custom). */
  getPresets: { args: []; result: AgentPreset[] };

  /** Save a custom preset. */
  savePreset: { args: [preset: AgentPreset]; result: void };
};

export type AgentWorkerEvents = {
  /** Streaming LLM token — agent pushes partial tokens to the tab. */
  token: { runId: string; token: string };
  /** Agent run status update. */
  runStatus: { runId: string; status: 'RUNNING' | 'COMPLETED' | 'FAILED' };
};

export type { AgentMessageRecord };
