import type { LLMProvider } from './genie-models.constants';
import { AI_KEY_STORAGE_KEY_PREFIX } from '@telegenie/config';

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
 * Get all active BYOK API keys from localStorage.
 */
export function getAllStoredApiKeys(): ProviderApiKeys {
  return {
    google: getLocalStorageApiKey('Google'),
    anthropic: getLocalStorageApiKey('Anthropic'),
    openai: getLocalStorageApiKey('OpenAI'),
  };
}

export function hasApiKeyForProvider(provider: LLMProvider): boolean {
  return Boolean(getLocalStorageApiKey(provider));
}
