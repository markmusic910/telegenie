import { StateGraph, START, END } from '@langchain/langgraph';
import { AgentStateAnnotation } from './state';
import {
  understandNode,
  retrieveNode,
  generateNode,
  toolsNode,
  shouldContinueTools,
} from './nodes';
import { createCheckpointer } from './checkpointer';

export type TeleGenieGraph = ReturnType<typeof createGraph>;

/**
 * Compile and return the TeleGenie agent graph.
 *
 * Flow: UNDERSTAND → RETRIEVE → GENERATE → (tool calls?) → TOOLS → GENERATE → END
 *
 * @see https://langchain-ai.github.io/langgraphjs/
 */
export function createGraph() {
  const checkpointer = createCheckpointer();

  return new StateGraph(AgentStateAnnotation)
    .addNode('understand', understandNode)
    .addNode('retrieve', retrieveNode)
    .addNode('generate', generateNode)
    .addNode('tools', toolsNode)
    .addEdge(START, 'understand')
    .addEdge('understand', 'retrieve')
    .addEdge('retrieve', 'generate')
    .addConditionalEdges('generate', shouldContinueTools, {
      tools: 'tools',
      [END]: END,
    })
    .addEdge('tools', 'generate')
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
 * Initialized lazily for local agent graph inspection / dev tooling.
 */
export const graph = {
  get instance() {
    return getGraph();
  },
};
