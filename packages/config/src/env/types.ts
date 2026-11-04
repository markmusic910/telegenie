export type LLMProviderName = 'Google' | 'Anthropic' | 'OpenAI';

export type BackendAuthStatus =
  | 'idle'
  | 'challenging'
  | 'verifying'
  | 'authenticated'
  | 'error';

export interface BackendAuthChallenge {
  nonce: string;
  botUsername: string;
  expiresAt: number;
}

export interface BackendClaimResponse {
  token: string;
  telegramId: string;
  expiresIn: number;
}

export interface BackendUserCredits {
  dailyFreeLimit: number;
  dailyFreeUsed: number;
  dailyFreeRemaining: number;
  paidCredits: number;
  totalAvailable: number;
  lastResetDate: string;
}

export interface BackendUserStatus {
  isBlocked: boolean;
  createdAt: number;
  lastActiveAt: number;
}

export interface BackendUserProfile {
  telegramId: string;
  enableTracing: boolean;
  credits: BackendUserCredits;
  status: BackendUserStatus;
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
  telegramBotUsername?: string;

  // AI Configuration
  ai: AIEnvConfig;

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
