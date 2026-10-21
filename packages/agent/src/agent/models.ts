import { ChatOpenAI } from '@langchain/openai';

export type ModelConfig = {
  apiKey: string;
  model: string;
  temperature?: number;
};

/** Module-level config set via configureModel RPC from the tab on worker startup. */
let currentConfig: ModelConfig | undefined;

/** Set the LLM configuration. Called by agent.handlers via AgentWorkerApi.configureModel. */
export function setModelConfig(config: ModelConfig): void {
  currentConfig = config;
}

/**
 * Create a ChatOpenAI instance from the current config.
 * Throws if configureModel has not been called yet.
 */
export function createChatModel(): ChatOpenAI {
  if (!currentConfig) {
    throw new Error(
      'Agent model not configured. Call AgentWorkerApi.configureModel(apiKey, model) first.',
    );
  }
  return new ChatOpenAI({
    apiKey: currentConfig.apiKey,
    model: currentConfig.model,
    temperature: currentConfig.temperature ?? 0,
  });
}
