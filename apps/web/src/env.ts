/**
 * Type-safe environment variables and validation helpers.
 * Access all client environment variables through this module.
 */
import {
  createAppEnv,
  getEnvApiKey as configGetEnvApiKey,
  isApiKeyFromEnv as configIsApiKeyFromEnv,
  type AppEnv,
  type LLMProviderName,
} from '@telegenie/config';

/**
 * Client-safe web application environment instance.
 * Explicitly maps Next.js process.env values so they are properly inlined by Next.js client bundler.
 */
export const env: AppEnv = createAppEnv({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_API_TIMEOUT: process.env.NEXT_PUBLIC_API_TIMEOUT,
  NEXT_PUBLIC_TELEGRAM_API_ID: process.env.NEXT_PUBLIC_TELEGRAM_API_ID,
  NEXT_PUBLIC_TELEGRAM_API_HASH: process.env.NEXT_PUBLIC_TELEGRAM_API_HASH,
  NEXT_PUBLIC_GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
  NEXT_PUBLIC_GOOGLE_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
  NEXT_PUBLIC_ANTHROPIC_API_KEY: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
  NEXT_PUBLIC_OPENAI_API_KEY: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_APP_ENVIRONMENT: process.env.NEXT_PUBLIC_APP_ENVIRONMENT,
  NEXT_PUBLIC_ENABLE_DEBUG: process.env.NEXT_PUBLIC_ENABLE_DEBUG,
  NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
});

/** Retrieve model API key defined in environment variables for a given provider. */
export function getEnvApiKey(provider: LLMProviderName): string {
  return configGetEnvApiKey(provider, env);
}

/** Check if API key for provider is supplied via environment variables. */
export function isApiKeyFromEnv(provider: LLMProviderName): boolean {
  return configIsApiKeyFromEnv(provider, env);
}
