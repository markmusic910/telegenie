/**
 * Shared constants across TeleGenie applications (Web, Desktop, Mobile).
 */

// LocalStorage / Persistence keys
export const AI_KEY_STORAGE_KEY_PREFIX = 'telegenie_ai_key_';
export const TRACING_ENABLED_STORAGE_KEY = 'telegenie_tracing_enabled';
export const BACKEND_TOKEN_STORAGE_KEY = 'telegenie_backend_token';

// Default Endpoints & Timeouts
export const DEFAULT_API_BASE_URL = 'https://api.example.com';
export const DEFAULT_API_TIMEOUT = 10000;
export const BACKEND_BOT_USERNAME = 'telegenie_ai';

// Default Application Metadata
export const DEFAULT_APP_NAME = 'TeleGenie';
export const DEFAULT_APP_VERSION = '1.0.0';
export const DEFAULT_APP_ENVIRONMENT = 'development';

// AI / LLM Configuration
export type LLMProvider = 'Google' | 'Anthropic' | 'OpenAI';
export const DEFAULT_MODEL_ID = 'gpt-4o';

export function resolveModelProvider(model: string, explicitProvider?: LLMProvider): LLMProvider {
  if (explicitProvider) return explicitProvider;
  const lower = model.toLowerCase();
  if (lower.startsWith('gemini')) return 'Google';
  if (lower.startsWith('claude') || lower.includes('sonnet') || lower.includes('haiku')) return 'Anthropic';
  return 'OpenAI';
}
