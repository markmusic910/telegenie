import type { IdbStoreSchema } from '@telegenie/libs/foundation/idb';
import { AGENT_STORE } from './agent-db.constants';

// ---------------------------------------------------------------------------
// AgentRun
// ---------------------------------------------------------------------------

export type AgentRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/**
 * One record per user-initiated agent invocation.
 * Root object for the full execution tree.
 */
export interface AgentRun {
  id: string;
  userMessage: string;
  title?: string;
  status: AgentRunStatus;
  startedAt: number;
  completedAt?: number;
  error?: string;
  model?: string;
  presetId?: string;
  peerId?: string;
}

// ---------------------------------------------------------------------------
// AgentMessage
// ---------------------------------------------------------------------------

export type AgentMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';

/**
 * Individual message within an agent run's conversation.
 * Separated from AgentRun to allow streaming / incremental appends.
 */
export interface AgentMessage {
  id: string;
  runId: string;
  role: AgentMessageRole;
  content: string;
  thought?: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// ToolCall
// ---------------------------------------------------------------------------

export type ToolCallStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/**
 * Audit record for every tool the agent invoked.
 * Phase 1: populated manually by nodes; Phase 2: populated by LangGraph tool executor.
 */
export interface ToolCall {
  id: string;
  runId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: ToolCallStatus;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// AgentCheckpoint
// ---------------------------------------------------------------------------

export type AgentPhase = 'UNDERSTAND' | 'RETRIEVE' | 'GENERATE' | 'COMPLETE' | 'FAILED';

/**
 * Snapshot of agent state at each phase transition.
 * Phase 1: written by nodes; Phase 2: may be replaced by LangGraph's IDB checkpointer.
 */
export interface AgentCheckpoint {
  id: string;
  runId: string;
  step: number;
  phase: AgentPhase;
  /** Arbitrary JSON state snapshot — intent, retrieved ids, etc. */
  state: Record<string, unknown>;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// DialogPreset
// ---------------------------------------------------------------------------

/**
 * User-authored background context and prompt rules for a specific Telegram chat/dialog.
 * Persisted permanently in Agent DB — never hard-purged by TTL cleanup.
 */
export interface DialogPreset {
  /** Bot-API style peer ID (e.g. "12345678", "-1001234567890"). KeyPath. */
  peerId: string;
  /** Explicit background description (e.g. "This is the chat for my key client"). */
  background?: string;
  /** Desired response tone (e.g. "formal", "friendly", "concise"). */
  tone?: string;
  /** Custom system instructions specific to this dialog. */
  customInstructions?: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// IndexedDB store schema
// ---------------------------------------------------------------------------

/** Returns the fixed IdbStoreSchema[] for the Agent State IndexedDB. */
export function buildAgentDbStores(): IdbStoreSchema[] {
  return [
    {
      name: AGENT_STORE.agentRuns,
      keyPath: 'id',
      indexes: [
        { name: 'byStatus', keyPath: 'status' },
        { name: 'byStartedAt', keyPath: 'startedAt' },
      ],
    },
    {
      name: AGENT_STORE.agentMessages,
      keyPath: 'id',
      indexes: [
        { name: 'byRunId', keyPath: 'runId' },
        { name: 'byRunIdCreatedAt', keyPath: ['runId', 'createdAt'] },
      ],
    },
    {
      name: AGENT_STORE.toolCalls,
      keyPath: 'id',
      indexes: [
        { name: 'byRunId', keyPath: 'runId' },
        { name: 'byStatus', keyPath: 'status' },
        { name: 'byStartedAt', keyPath: 'startedAt' },
      ],
    },
    {
      name: AGENT_STORE.agentCheckpoints,
      keyPath: 'id',
      indexes: [
        { name: 'byRunId', keyPath: 'runId' },
        { name: 'byRunIdStep', keyPath: ['runId', 'step'] },
        { name: 'byPhase', keyPath: 'phase' },
        { name: 'byCreatedAt', keyPath: 'createdAt' },
      ],
    },
    {
      name: AGENT_STORE.dialogPresets,
      keyPath: 'peerId',
      indexes: [{ name: 'byUpdatedAt', keyPath: 'updatedAt' }],
    },
  ];
}
