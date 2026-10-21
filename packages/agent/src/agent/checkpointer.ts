import { MemorySaver } from '@langchain/langgraph';

/**
 * Create the LangGraph checkpointer.
 *
 * Phase 1: MemorySaver (in-memory, per-worker-lifetime).
 * Phase 2: swap for an IDB-backed BaseCheckpointSaver using the
 *   `telegenie-agent_${tabId}` `agent_checkpoints` store.
 */
export function createCheckpointer(): MemorySaver {
  return new MemorySaver();
}
