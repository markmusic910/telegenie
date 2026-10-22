export type PresetTone =
  | 'concise'
  | 'formal'
  | 'casual'
  | 'technical'
  | 'friendly'
  | 'instructive';

export interface PresetContextOptions {
  /** Whether to retrieve and attach recent Telegram messages from active dialog. */
  includeHistory?: boolean;
  /** Maximum number of history messages to include in context. */
  historyLimit?: number;
  /** Whether to retrieve long-term memories / entities from MemoryEngine. */
  includeMemories?: boolean;
}

export interface AgentPreset {
  id: string;
  name: string;
  description: string;
  icon?: string;
  /** System instruction or prompt template. */
  prompt: string;
  /** Chosen / default LLM model id (e.g. 'gemini-3.8', 'gpt-4o', 'claude-sonnet-5-5'). */
  model: string;
  /** Communication tone. */
  tone: PresetTone;
  /** Context retrieval configuration. */
  context?: PresetContextOptions;
  /** Whether this preset is a built-in system template. */
  isBuiltin?: boolean;
  createdAt?: number;
  updatedAt?: number;
}
