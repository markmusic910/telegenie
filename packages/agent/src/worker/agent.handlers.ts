import { AIMessage, HumanMessage } from '@langchain/core/messages';
import type { RpcHandlers } from '@telegenie/libs/foundation/worker-rpc';
import type { AgentWorkerApi, ChatOptions, ChatResult } from './agent.api';
import { getTabPageClient } from './tab-page-client';
import { configureAgentModel, getWorkerState } from './agent-worker-init';
import { getGraph } from '../agent/graph';
import { extractText } from '../agent/nodes';
import { presetService } from '../preset/preset.service';
import { createChatModel, type ModelConfig } from '../agent/models';
import type { AgentPreset } from '../preset/preset.types';
import { getLangSmithTracer, getLangSmithConfig } from '../monitoring';

/** Helper to generate and persist a concise AI title for a run. */
async function generateAndSaveTitle(
  runId: string,
  options?: { apiKeys?: import('../agent/models').ProviderApiKeys; model?: string },
): Promise<string> {
  const { agentRunRepo, agentMessageRepo } = getWorkerState();
  const run = await agentRunRepo.findById(runId);
  const messages = await agentMessageRepo.findByRunId(runId);

  const firstUserMsg = messages.find((m) => m.role === 'USER')?.content || run?.userMessage || '';
  const firstAstMsg = messages.find((m) => m.role === 'ASSISTANT')?.content || '';

  let title = '';
  const prompt = `Generate a concise, punchy title (maximum 3 to 5 words) summarizing the conversation topic. Return ONLY the title text, with no quotes, formatting, or punctuation at the end.\n\nUser: ${firstUserMsg.slice(0, 300)}${firstAstMsg ? `\nAssistant: ${firstAstMsg.slice(0, 300)}` : ''}`;

  const candidateModels = [
    options?.model,
    run?.model,
    'gpt-4o-mini',
    'gemini-3.8',
    'gpt-4o',
  ].filter(Boolean) as string[];

  const uniqueModels = [...new Set(candidateModels)];

  for (const modelName of uniqueModels) {
    try {
      const model = createChatModel({
        model: modelName,
        apiKeys: options?.apiKeys,
        temperature: 0.3,
      });
      const response = await model.invoke([new HumanMessage(prompt)]);
      const rawTitle = extractText(response.content).trim();
      const cleaned = rawTitle.replace(/^["'`]+|["'`]+$/g, '').trim();
      if (cleaned) {
        title = cleaned;
        break;
      }
    } catch (err) {
      console.warn(`[AgentHandlers] Failed to generate AI title with model '${modelName}':`, err);
    }
  }

  if (!title) {
    title = firstUserMsg.length > 35 ? `${firstUserMsg.slice(0, 35)}...` : firstUserMsg || 'New Chat';
  }

  await agentRunRepo.updateTitle(runId, title);
  return title;
}

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
     * Run the agent on a user message with IndexedDB persistence.
     * Records the run & user message in IDB, streams tokens,
     * persists the assistant response, and marks the run completed.
     */
    chat: async (
      userMessage: string,
      options?: string | ChatOptions,
    ): Promise<ChatResult> => {
      const opts: ChatOptions =
        typeof options === 'string'
          ? { peerId: options }
          : (options ?? {});

      const { agentRunRepo, agentMessageRepo } = getWorkerState();

      let runId = opts.runId;
      const historyMessages: Array<HumanMessage | AIMessage> = [];

      if (runId) {
        // Continuing an existing conversation run
        await agentRunRepo.updateStatus(runId, 'RUNNING');
        const pastMessages = await agentMessageRepo.findByRunId(runId);
        for (const m of pastMessages) {
          if (m.role === 'USER') {
            historyMessages.push(new HumanMessage(m.content));
          } else if (m.role === 'ASSISTANT') {
            historyMessages.push(new AIMessage(m.content));
          }
        }
      } else {
        // 1. Record a new agent run in IndexedDB (telegenie-agent_${tabId})
        const run = await agentRunRepo.create(userMessage, {
          model: opts.model,
          presetId: opts.presetId,
          peerId: opts.peerId,
        });
        runId = run.id;
      }

      // 2. Persist the user message
      await agentMessageRepo.insert(runId, 'USER', userMessage);
      historyMessages.push(new HumanMessage(userMessage));

      try {
        const graph = getGraph();
        const tracer = getLangSmithTracer();
        const lsConfig = getLangSmithConfig();

        const result = (await graph.invoke(
          {
            messages: historyMessages,
            peerId: opts.peerId,
            model: opts.model,
            presetId: opts.presetId,
            runId,
          },
          {
            configurable: { thread_id: `thread_${runId}` },
            callbacks: tracer ? [tracer] : undefined,
            metadata: {
              runId,
              peerId: opts.peerId,
              model: opts.model,
              presetId: opts.presetId,
              agent_id: lsConfig.agentId,
              environment: lsConfig.agentEnvironment,
            },
            tags: [
              'telegenie-chat',
              `agent:${lsConfig.agentId || 'telegenie'}`,
              `env:${lsConfig.agentEnvironment || 'local'}`,
              opts.model ? `model:${opts.model}` : '',
            ].filter(Boolean),
          },
        )) as {
          messages?: Array<{ content?: string }>;
          thought?: string;
        };

        // The last message in the state is the assistant's response
        const messages = result.messages ?? [];
        const lastMessage = messages[messages.length - 1];
        const assistantText = extractText(lastMessage?.content);
        const thoughtText = result.thought || '';

        // 3. Persist the assistant message with thought and update run status
        await agentMessageRepo.insert(runId, 'ASSISTANT', assistantText, thoughtText);
        await agentRunRepo.updateStatus(runId, 'COMPLETED');

        // If this was a new run without a custom title, trigger AI title generation in the background
        if (!opts.runId) {
          setTimeout(() => {
            void generateAndSaveTitle(runId);
          }, 50);
        }

        return { text: assistantText, thought: thoughtText };
      } catch (err) {
        const errorMsg = (err as Error).message || 'Agent chat failed';
        await agentRunRepo.updateStatus(runId, 'FAILED', errorMsg);
        throw err;
      }
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
     */
    configureModel: async (
      configOrApiKey: string | ModelConfig,
      model?: string,
    ): Promise<void> => {
      configureAgentModel(configOrApiKey, model);
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

    /** Get recent conversation runs stored in IndexedDB. */
    getRecentRuns: async (limit?: number) => {
      const { agentRunRepo } = getWorkerState();
      return agentRunRepo.getRecent(limit);
    },

    /** Get messages for a specific conversation run. */
    getRunMessages: async (runId: string) => {
      const { agentMessageRepo } = getWorkerState();
      return agentMessageRepo.findByRunId(runId);
    },

    /** Update the title of a conversation run. */
    updateRunTitle: async (runId: string, title: string) => {
      const { agentRunRepo } = getWorkerState();
      await agentRunRepo.updateTitle(runId, title);
    },

    /** Generate an AI summary title for a conversation run and persist it. */
    generateRunTitle: async (
      runId: string,
      options?: { apiKeys?: import('../agent/models').ProviderApiKeys; model?: string },
    ) => {
      return generateAndSaveTitle(runId, options);
    },

    /** Get all available presets (builtin + custom). */
    getPresets: async () => {
      return presetService.getAllPresets();
    },

    /** Save a custom preset. */
    savePreset: async (preset: AgentPreset) => {
      presetService.registerPreset(preset);
    },
  };
}
