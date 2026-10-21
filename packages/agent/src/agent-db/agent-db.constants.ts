/**
 * IndexedDB for Agent State — namespaced per-tab to avoid cross-tab conflicts.
 * Full name: `${AGENT_DB_PREFIX}${tabId}`
 */
export const AGENT_DB_PREFIX = 'telegenie-agent_';

/** Schema version — bump when adding or changing stores/indexes. */
export const AGENT_DB_VERSION = 1;

/** Agent run records older than this many days are auto-deleted on worker startup. */
export const AGENT_RUN_TTL_DAYS = 7;

export const AGENT_STORE = {
  agentRuns: 'agent_runs',
  agentMessages: 'agent_messages',
  toolCalls: 'tool_calls',
  agentCheckpoints: 'agent_checkpoints',
  dialogPresets: 'dialog_presets',
} as const;

export type AgentStoreName = (typeof AGENT_STORE)[keyof typeof AGENT_STORE];
