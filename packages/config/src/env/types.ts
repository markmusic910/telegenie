export type LLMProviderName = 'Google' | 'Anthropic' | 'OpenAI';

export interface LangSmithEnvConfig {
  tracing: boolean;
  endpoint: string;
  apiKey: string;
  agentId: string;
  agentEnvironment: string;
  project: string;
}

export interface AIEnvConfig {
  geminiApiKey: string;
  anthropicApiKey: string;
  openaiApiKey: string;
}

export interface AppEnv {
  // API Configuration
  apiBaseUrl: string;
  apiTimeout: number;

  // Telegram Configuration
  telegramApiId: string;
  telegramApiHash: string;

  // AI Configuration
  ai: AIEnvConfig;

  // LangSmith Monitoring & Tracing
  langsmith: LangSmithEnvConfig;

  // App Configuration
  appName: string;
  appVersion: string;
  appEnvironment: string;

  // Feature Flags
  enableDebug: boolean;
  enableAnalytics: boolean;

  // External Services
  sentryDsn: string;
  googleAnalyticsId: string;
}

export type RawEnvSource = Record<string, string | undefined>;
