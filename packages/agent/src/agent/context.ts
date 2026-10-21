/**
 * Per-run agent context (thread id, tab-page client accessors, etc.).
 *
 * TODO: Wire TabPageApi client / thread metadata into graph config.
 */

export type AgentRunContext = {
  /** LangGraph thread id for checkpointing. */
  threadId?: string;
  // TODO: tab page / request metadata
};

export function createAgentRunContext(
  _partial?: Partial<AgentRunContext>,
): AgentRunContext {
  // TODO: assemble context from worker + page bridge
  return {};
}
