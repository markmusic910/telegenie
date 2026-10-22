import type { LLMProvider } from './genie-models.constants';

const STORAGE_KEY_PREFIX = 'telegenie_ai_key_';

export interface ProviderApiKeys {
  google?: string;
  anthropic?: string;
  openai?: string;
}

/**
 * Retrieve API key defined in environment variables (.env / .env.local).
 * In Next.js client-side code, only NEXT_PUBLIC_* variables are available.
 */
export function getEnvApiKey(provider: LLMProvider): string {
  if (provider === 'Google') {
    return (
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_API_KEY ||
      ''
    ).trim();
  }
  if (provider === 'Anthropic') {
    return (process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '').trim();
  }
  if (provider === 'OpenAI') {
    return (process.env.NEXT_PUBLIC_OPENAI_API_KEY || '').trim();
  }
  return '';
}

/** Check if the API key for this provider is supplied via environment variables (.env). */
export function isApiKeyFromEnv(provider: LLMProvider): boolean {
  return Boolean(getEnvApiKey(provider));
}

/** Get raw user-saved key from localStorage. */
export function getLocalStorageApiKey(provider: LLMProvider): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(`${STORAGE_KEY_PREFIX}${provider.toLowerCase()}`) || '';
}

/** Save API key to localStorage. */
export function setStoredApiKey(provider: LLMProvider, key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${provider.toLowerCase()}`, trimmed);
  } else {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${provider.toLowerCase()}`);
  }
}

/**
 * Get effective API key for provider.
 * Environment variables (.env) take precedence over localStorage.
 */
export function getStoredApiKey(provider: LLMProvider): string {
  // 1. .env takes precedence
  const envKey = getEnvApiKey(provider);
  if (envKey) return envKey;

  // 2. Fallback to localStorage
  return getLocalStorageApiKey(provider);
}

export const getEffectiveApiKey = getStoredApiKey;

/**
 * Get all active API keys, with .env taking precedence over localStorage.
 */
export function getAllStoredApiKeys(): ProviderApiKeys {
  return {
    google: getStoredApiKey('Google'),
    anthropic: getStoredApiKey('Anthropic'),
    openai: getStoredApiKey('OpenAI'),
  };
}

export function hasApiKeyForProvider(provider: LLMProvider): boolean {
  return Boolean(getStoredApiKey(provider));
}
