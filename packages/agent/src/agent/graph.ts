import { StateGraph, START, END, type CompiledStateGraph } from '@langchain/langgraph';
import { AgentStateAnnotation } from './state';
import { understandNode, retrieveNode, generateNode } from './nodes';
import { createCheckpointer } from './checkpointer';

export type TeleGenieGraph = ReturnType<typeof createGraph>;

/**
 * Compile and return the TeleGenie Phase 1 agent graph.
 *
 * Linear flow: UNDERSTAND → RETRIEVE → GENERATE → END
 *
 * Phase 2 will add conditional routing for tool calls:
 *   GENERATE → (tool calls?) → TOOL → GENERATE → END
 *
 * @see https://langchain-ai.github.io/langgraphjs/
 */
export function createGraph() {
  const checkpointer = createCheckpointer();

  return new StateGraph(AgentStateAnnotation)
    .addNode('understand', understandNode)
    .addNode('retrieve', retrieveNode)
    .addNode('generate', generateNode)
    .addEdge(START, 'understand')
    .addEdge('understand', 'retrieve')
    .addEdge('retrieve', 'generate')
    .addEdge('generate', END)
    .compile({ checkpointer });
}

/**
 * Singleton graph instance for the agent worker.
 * Initialized lazily on first use via initAgentWorker().
 */
let _graph: TeleGenieGraph | undefined;

export function getGraph(): TeleGenieGraph {
  if (!_graph) {
    _graph = createGraph();
  }
  return _graph;
}

/**
 * Named export for `langgraph.json` tooling convention.
 * Initialized lazily — only used for LangSmith / dev tooling.
 */
export const graph = {
  get instance() {
    return getGraph();
  },
};
