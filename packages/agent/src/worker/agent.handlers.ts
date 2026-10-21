import { HumanMessage } from '@langchain/core/messages';
import type { RpcHandlers } from '@telegenie/libs/foundation/worker-rpc';
import type { AgentWorkerApi } from './agent.api';
import { getTabPageClient } from './tab-page-client';
import { configureAgentModel, getWorkerState } from './agent-worker-init';
import { getGraph } from '../agent/graph';
import { v4 as uuidv4 } from 'uuid';

/** Handlers for tab → agent RPCs. */
export function createAgentWorkerHandlers(): RpcHandlers<AgentWorkerApi> {
  return {
    ping: async (): Promise<'pong'> => 'pong',

    demoRoundTrip: async (): Promise<'pong'> => {
      const result = await getTabPageClient().call('ping', []);
      if (result !== 'pong') {
        throw new Error(`Expected 'pong' from TabPageApi.ping, got ${JSON.stringify(result)}`);
      }
      return result;
    },

    /**
     * Run the agent on a user message.
     * Invokes the compiled LangGraph graph with a thread id derived from a new run id.
     * Returns the final assistant response as a plain string.
     */
    chat: async (userMessage: string, peerId?: string): Promise<string> => {
      const threadId = `thread_${uuidv4()}`;
      const graph = getGraph();

      const result = (await graph.invoke(
        {
          messages: [new HumanMessage(userMessage)],
          peerId,
        },
        { configurable: { thread_id: threadId } },
      )) as { messages?: Array<{ content?: string }> };

      // The last message in the state is the assistant's response
      const messages = result.messages ?? [];
      const lastMessage = messages[messages.length - 1];
      return typeof lastMessage?.content === 'string' ? lastMessage.content : '';
    },

    /**
     * Process new Telegram messages through the Memory Engine.
     * Must only be called by the leader tab (enforced on the tab side).
     */
    processNewMessages: async (messages): Promise<void> => {
      const { memoryEngine } = getWorkerState();
      if (!memoryEngine) {
        throw new Error(
          'Memory Engine not initialized. Call AgentWorkerApi.configureModel first.',
        );
      }
      await memoryEngine.processMessages(messages);
    },

    /**
     * Configure the LLM used by the agent.
     * Must be called before chat or processNewMessages.
     */
    configureModel: async (apiKey: string, model: string): Promise<void> => {
      configureAgentModel(apiKey, model);
    },

    getDialogPreset: async (peerId: string) => {
      const { dialogPresetRepo } = getWorkerState();
      return dialogPresetRepo.findByPeerId(peerId);
    },

    setDialogPreset: async (preset) => {
      const { dialogPresetRepo } = getWorkerState();
      await dialogPresetRepo.upsert(preset);
    },

    deleteDialogPreset: async (peerId: string) => {
      const { dialogPresetRepo } = getWorkerState();
      await dialogPresetRepo.delete(peerId);
    },
  };
}
