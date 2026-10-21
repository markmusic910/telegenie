/**
 * Environment variables utility
 * Provides type-safe access to environment variables
 */

// API Configuration
export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api',
  timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '10000', 10),
} as const;

// Telegram Configuration
export const TELEGRAM_CONFIG = {
  botToken: process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '',
  apiId: process.env.NEXT_PUBLIC_TELEGRAM_API_ID || '',
  apiHash: process.env.NEXT_PUBLIC_TELEGRAM_API_HASH || '',
} as const;

// App Configuration
export const APP_CONFIG = {
  name: process.env.NEXT_PUBLIC_APP_NAME || 'TeleGenie',
  version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  environment: process.env.NEXT_PUBLIC_APP_ENVIRONMENT || 'development',
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  enableDebug: process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true',
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
} as const;

// External Services
export const EXTERNAL_SERVICES = {
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  googleAnalyticsId: process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || '',
} as const;

// Utility function to check if we're in development mode
export const isDevelopment = () => APP_CONFIG.environment === 'development';

// Utility function to check if we're in production mode
export const isProduction = () => APP_CONFIG.environment === 'production';

// Utility function to get all environment variables (for debugging)
export const getAllEnvVars = () => ({
  API_CONFIG,
  TELEGRAM_CONFIG,
  APP_CONFIG,
  FEATURE_FLAGS,
  EXTERNAL_SERVICES,
});
