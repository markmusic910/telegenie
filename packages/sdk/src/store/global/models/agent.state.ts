/** Persistable agent fields (no computeds, no store refs). */
export type AgentSnapshot = {
  agent?: {
    selectedModel?: string;
  };
};

/** Agent UI / model state. No actions. */
export interface AgentState {
  /** Currently selected AI model id (e.g. 'gpt-4o'). */
  readonly selectedModel: string;
}
