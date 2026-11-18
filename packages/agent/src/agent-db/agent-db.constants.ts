/**
 * IndexedDB for Agent State — namespaced per account slot so conversation history
 * and presets persist across tabs and browser restarts for the current user.
 * Full name: `${AGENT_DB_PREFIX}${accountSlot}`
 */
export const AGENT_DB_PREFIX = 'telegenie-agent_';

/** Schema version — bump when adding or changing stores/indexes. */
export const AGENT_DB_VERSION = 2;

/** Agent run records older than this many days are auto-deleted on worker startup. */
export const AGENT_RUN_TTL_DAYS = 30;

export const AGENT_STORE = {
  agentRuns: 'agent_runs',
  agentMessages: 'agent_messages',
  toolCalls: 'tool_calls',
  agentCheckpoints: 'agent_checkpoints',
  dialogPresets: 'dialog_presets',
  dialogMemorySyncs: 'dialog_memory_syncs',
} as const;

export type AgentStoreName = (typeof AGENT_STORE)[keyof typeof AGENT_STORE];
