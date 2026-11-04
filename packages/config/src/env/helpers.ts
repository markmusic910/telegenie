import type { AppEnv, LLMProviderName } from './types';

/**
 * Retrieve model API key defined in environment variables for a given provider.
 */
export function getEnvApiKey(provider: LLMProviderName, appEnv: AppEnv): string {
  if (provider === 'Google') return appEnv.ai.geminiApiKey;
  if (provider === 'Anthropic') return appEnv.ai.anthropicApiKey;
  if (provider === 'OpenAI') return appEnv.ai.openaiApiKey;
  return '';
}

/**
 * Check if API key for provider is supplied via environment variables.
 */
export function isApiKeyFromEnv(provider: LLMProviderName, appEnv: AppEnv): boolean {
  return Boolean(getEnvApiKey(provider, appEnv));
}
