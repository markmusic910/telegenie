import {
  DEFAULT_API_BASE_URL,
  DEFAULT_API_TIMEOUT,
  DEFAULT_APP_ENVIRONMENT,
  DEFAULT_APP_NAME,
  DEFAULT_APP_VERSION,
  DEFAULT_LANGSMITH_AGENT_ENVIRONMENT,
  DEFAULT_LANGSMITH_AGENT_ID,
  DEFAULT_LANGSMITH_ENDPOINT,
  DEFAULT_LANGSMITH_PROJECT,
} from '../constants';
import type { AppEnv, RawEnvSource } from './types';

function getGlobalEnvSource(): RawEnvSource {
  if (
    typeof globalThis !== 'undefined' &&
    'process' in globalThis &&
    (globalThis as unknown as { process?: { env?: RawEnvSource } }).process?.env
  ) {
    return (globalThis as unknown as { process?: { env?: RawEnvSource } }).process?.env || {};
  }
  return {};
}

/**
 * Resolves an environment variable value from a raw dictionary checking:
 * 1. Exact key (e.g. `TELEGRAM_API_ID` or already prefixed `NEXT_PUBLIC_TELEGRAM_API_ID`)
 * 2. Next.js: `NEXT_PUBLIC_${key}`
 * 3. Vite / Tauri: `VITE_${key}`
 * 4. Expo / Mobile: `EXPO_PUBLIC_${key}`
 */
export function getEnvValue(
  key: string,
  source: RawEnvSource,
  defaultValue = '',
  required = false,
): string {
  const direct = source[key];
  const nextPublic = source[`NEXT_PUBLIC_${key}`];
  const vite = source[`VITE_${key}`];
  const expo = source[`EXPO_PUBLIC_${key}`];

  const val = direct ?? nextPublic ?? vite ?? expo ?? defaultValue ?? '';
  const trimmed = val.trim();

  if (!trimmed && required) {
    console.warn(`[config:env] Required environment variable "${key}" is not set.`);
  }

  return trimmed;
}

/**
 * Factory to create a fully-typed `AppEnv` configuration.
 *
 * Supports multi-platform environment sources:
 * - Web (Next.js): pass explicit map or process.env
 * - Desktop (Vite / Tauri): pass `import.meta.env` or process.env
 * - Mobile (Expo / React Native): pass `process.env`
 * - Node.js / CLI: defaults to `globalThis.process.env` when omitted
 */
export function createAppEnv(customSource?: RawEnvSource): AppEnv {
  const source = customSource ?? getGlobalEnvSource();

  // Helper for concise lookup
  const get = (key: string, defaultValue = '', required = false) =>
    getEnvValue(key, source, defaultValue, required);

  const geminiApiKey =
    get('GEMINI_API_KEY') || get('GOOGLE_API_KEY') || '';

  return {
    apiBaseUrl: get('API_BASE_URL', DEFAULT_API_BASE_URL),
    apiTimeout: parseInt(get('API_TIMEOUT', String(DEFAULT_API_TIMEOUT)), 10),

    telegramApiId: get('TELEGRAM_API_ID'),
    telegramApiHash: get('TELEGRAM_API_HASH'),

    ai: {
      geminiApiKey,
      anthropicApiKey: get('ANTHROPIC_API_KEY'),
      openaiApiKey: get('OPENAI_API_KEY'),
    },

    langsmith: {
      tracing: get('LANGSMITH_TRACING') === 'true',
      endpoint: get('LANGSMITH_ENDPOINT', DEFAULT_LANGSMITH_ENDPOINT),
      apiKey: get('LANGSMITH_API_KEY'),
      agentId: get('LANGSMITH_AGENT_ID', DEFAULT_LANGSMITH_AGENT_ID),
      agentEnvironment: get(
        'LANGSMITH_AGENT_ENVIRONMENT',
        DEFAULT_LANGSMITH_AGENT_ENVIRONMENT,
      ),
      project: get('LANGSMITH_PROJECT', DEFAULT_LANGSMITH_PROJECT),
    },

    appName: get('APP_NAME', DEFAULT_APP_NAME),
    appVersion: get('APP_VERSION', DEFAULT_APP_VERSION),
    appEnvironment: get('APP_ENVIRONMENT', DEFAULT_APP_ENVIRONMENT),

    enableDebug: get('ENABLE_DEBUG', 'true') === 'true',
    enableAnalytics: get('ENABLE_ANALYTICS', 'false') === 'true',

    sentryDsn: get('SENTRY_DSN'),
    googleAnalyticsId: get('GOOGLE_ANALYTICS_ID'),
  };
}

/**
 * Default singleton instance initialized with runtime environment.
 */
export const defaultEnv: AppEnv = createAppEnv();
