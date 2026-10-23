import type { AppEnv, LangSmithEnvConfig, LLMProviderName } from './types';

/**
 * Validate whether a provided LangSmith API key is non-empty and not a placeholder.
 */
export function isValidLangSmithApiKey(key?: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return (
    trimmed.length > 0 &&
    trimmed !== '<your-api-key>' &&
    !trimmed.startsWith('<') &&
    !trimmed.endsWith('>')
  );
}

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

/**
 * Retrieve LangSmith configuration defined in environment variables.
 */
export function getLangSmithEnvConfig(appEnv: AppEnv): LangSmithEnvConfig {
  return {
    tracing: appEnv.langsmith.tracing,
    endpoint: appEnv.langsmith.endpoint,
    apiKey: appEnv.langsmith.apiKey,
    agentId: appEnv.langsmith.agentId,
    agentEnvironment: appEnv.langsmith.agentEnvironment,
    project: appEnv.langsmith.project,
  };
}

/**
 * Check if LangSmith API key is supplied via environment variables and is valid.
 */
export function isLangSmithApiKeyFromEnv(appEnv: AppEnv): boolean {
  return isValidLangSmithApiKey(appEnv.langsmith.apiKey);
}
