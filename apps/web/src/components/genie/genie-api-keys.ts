import type { LLMProvider } from './genie-models.constants';
import {
  getEnvApiKey,
  getLangSmithEnvConfig,
} from '@/env';
import {
  AI_KEY_STORAGE_KEY_PREFIX,
  DEFAULT_LANGSMITH_ENDPOINT,
  LANGSMITH_STORAGE_KEY,
  LANGSMITH_ENABLED_STORAGE_KEY,
  LANGSMITH_ENDPOINT_STORAGE_KEY,
  isValidLangSmithApiKey,
  type LangSmithEnvConfig,
  type LLMProviderName,
} from '@telegenie/config';

export interface ProviderApiKeys {
  google?: string;
  anthropic?: string;
  openai?: string;
}

/** Get raw user-saved key from localStorage. */
export function getLocalStorageApiKey(provider: LLMProvider): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(`${AI_KEY_STORAGE_KEY_PREFIX}${provider.toLowerCase()}`) || '';
}

/** Save API key to localStorage. */
export function setStoredApiKey(provider: LLMProvider, key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(`${AI_KEY_STORAGE_KEY_PREFIX}${provider.toLowerCase()}`, trimmed);
  } else {
    localStorage.removeItem(`${AI_KEY_STORAGE_KEY_PREFIX}${provider.toLowerCase()}`);
  }
}

/**
 * Get effective API key for provider.
 * Environment variables (.env) take precedence over localStorage.
 */
export function getStoredApiKey(provider: LLMProvider): string {
  // 1. .env takes precedence
  const envKey = getEnvApiKey(provider as LLMProviderName);
  if (envKey) return envKey;

  // 2. Fallback to localStorage
  return getLocalStorageApiKey(provider);
}

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

// ---------------------------------------------------------------------------
// LangSmith Observability & Monitoring

/** Check if global LangSmith tracing switch is enabled by user. Default is false (disabled). */
export function getLocalStorageLangSmithTracingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(LANGSMITH_ENABLED_STORAGE_KEY) === 'true';
}

/** Toggle the global LangSmith tracing switch in localStorage. */
export function setStoredLangSmithTracingEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LANGSMITH_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
}

export function getLocalStorageLangSmithApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(LANGSMITH_STORAGE_KEY) || '';
}

export function setStoredLangSmithApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(LANGSMITH_STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(LANGSMITH_STORAGE_KEY);
  }
}

export function getLocalStorageLangSmithEndpoint(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(LANGSMITH_ENDPOINT_STORAGE_KEY) || '';
}

export function setStoredLangSmithEndpoint(endpoint: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = endpoint.trim();
  if (trimmed) {
    localStorage.setItem(LANGSMITH_ENDPOINT_STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(LANGSMITH_ENDPOINT_STORAGE_KEY);
  }
}

export function getEffectiveLangSmithEndpoint(): string {
  const custom = getLocalStorageLangSmithEndpoint();
  if (custom) return custom;
  return getLangSmithEnvConfig().endpoint || DEFAULT_LANGSMITH_ENDPOINT;
}

export function getEffectiveLangSmithApiKey(): string {
  const envConfig = getLangSmithEnvConfig();
  if (isValidLangSmithApiKey(envConfig.apiKey)) {
    return envConfig.apiKey;
  }
  return getLocalStorageLangSmithApiKey();
}

/**
 * Returns effective LangSmith config for Genie Agent chat.
 * Default is disabled unless the user explicitly turns on the global switch.
 */
export function getEffectiveLangSmithConfig(): LangSmithEnvConfig {
  const envConfig = getLangSmithEnvConfig();
  const tracing = getLocalStorageLangSmithTracingEnabled();
  const endpoint = getEffectiveLangSmithEndpoint();
  const effectiveKey = getEffectiveLangSmithApiKey();

  return {
    ...envConfig,
    tracing,
    endpoint,
    apiKey: effectiveKey,
  };
}

