import type {
  AgentMessageForwardContext,
  AgentMessageMediaContext,
  AgentMessageMention,
  AgentMessageRecord,
  AgentMessageReplyContext,
  DialogMemoryContext,
  DialogParticipantInfo,
  DialogPeerKind,
} from '../types/agent-message-record';
import type { TabPageToolDescriptor } from '@telegenie/libs/types/tab-page.api';
import type { AgentMessage, AgentRun, DialogMemorySync, DialogPreset, GenieSkill } from '../agent-db/agent-db.types';
import type { ModelConfig } from '../agent/models';
import type { AgentPreset } from '../preset/preset.types';
import type { ProcessMessagesResult } from '../memory/engine/memory-engine';

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

export interface InputCompletionRequest {
  peerId: string;
  currentInput: string;
  replyToMessageId?: string;
  editingMessageId?: string;
  model?: string;
  maxOptions?: number;
}

export interface InputCompletionOption {
  text: string;
  label?: string;
}

export interface InputCompletionResult {
  options: InputCompletionOption[];
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
  processNewMessages: {
    args: [messages: AgentMessageRecord[], dialogContext?: DialogMemoryContext];
    result: void;
  };

  /**
   * Configure the LLM used by the agent.
   */
  configureModel: {
    args: [configOrApiKey: string | ModelConfig, model?: string];
    result: void;
  };

  /**
   * Configure the list of installed skills available to the agent.
   */
  configureSkills: {
    args: [skills: GenieSkill[]];
    result: void;
  };

  /**
   * Configure the user identity (conforming to USER.md) for the agent.
   */
  configureUserIdentity: {
    args: [identity: string];
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

  /**
   * Process Telegram messages through Memory Engine with cost source attribution.
   */
  processMessagesWithCost: {
    args: [
      messages: AgentMessageRecord[],
      costSource?: string,
      dialogContext?: DialogMemoryContext,
    ];
    result: ProcessMessagesResult;
  };

  /** Get memory sync record for a specific dialog. */
  getDialogMemorySync: { args: [peerId: string]; result: DialogMemorySync | undefined };

  /** Get all dialog memory sync records across the account. */
  getAllDialogMemorySyncs: { args: []; result: DialogMemorySync[] };

  /** Upsert/update memory sync record for a specific dialog. */
  upsertDialogMemorySync: {
    args: [data: Partial<DialogMemorySync> & { peerId: string }];
    result: DialogMemorySync;
  };

  /** Toggle incremental memory extraction for a specific dialog. */
  setIncrementalMemorySync: {
    args: [peerId: string, enabled: boolean];
    result: DialogMemorySync;
  };

  /** Delete dialog memory sync record. */
  deleteDialogMemorySync: { args: [peerId: string]; result: void };

  /**
   * Invalidate the in-memory Grafeo WASM instance so the next query reloads
   * the latest IndexedDB snapshot written by the Leader tab.
   */
  invalidateMemoryGraph: { args: []; result: void };

  /**
   * Replace the set of tab-page tool descriptors available to the agent.
   */
  setTabTools: {
    args: [tools: TabPageToolDescriptor[]];
    result: void;
  };

  /**
   * Generate multiple contextual message completions for the active composer input
   * (triggered on Tab in MessageComposer). Does not create an AgentRun in chat history.
   */
  completeInput: {
    args: [request: InputCompletionRequest];
    result: InputCompletionResult;
  };
};

export type AgentWorkerEvents = {
  /** Streaming LLM token — agent pushes partial tokens to the tab. */
  token: { runId: string; token: string };
  /** Agent run status update. */
  runStatus: { runId: string; status: 'RUNNING' | 'COMPLETED' | 'FAILED' };
};

export type {
  AgentMessageForwardContext,
  AgentMessageMediaContext,
  AgentMessageMention,
  AgentMessageRecord,
  AgentMessageReplyContext,
  DialogMemoryContext,
  DialogParticipantInfo,
  DialogPeerKind,
};
