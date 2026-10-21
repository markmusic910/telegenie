/**
 * Type-safe environment variables
 * Access environment variables through this module for better type safety
 */

// Helper to validate and return environment variables
function validateEnv(key: string, value: string | undefined, defaultValue?: string): string {
  if (!value && !defaultValue) {
    console.warn(`Environment variable ${key} is not set`);
    return '';
  }
  
  return value || defaultValue || '';
}

export const env = {
  // API Configuration
  apiBaseUrl: validateEnv('NEXT_PUBLIC_API_BASE_URL', process.env.NEXT_PUBLIC_API_BASE_URL, 'https://api.example.com'),
  apiTimeout: parseInt(validateEnv('NEXT_PUBLIC_API_TIMEOUT', process.env.NEXT_PUBLIC_API_TIMEOUT, '10000'), 10),
  
  // Telegram Configuration
  telegramApiId: validateEnv('NEXT_PUBLIC_TELEGRAM_API_ID', process.env.NEXT_PUBLIC_TELEGRAM_API_ID),
  telegramApiHash: validateEnv('NEXT_PUBLIC_TELEGRAM_API_HASH', process.env.NEXT_PUBLIC_TELEGRAM_API_HASH),
  
  // App Configuration
  appName: validateEnv('NEXT_PUBLIC_APP_NAME', process.env.NEXT_PUBLIC_APP_NAME, 'TeleGenie'),
  appVersion: validateEnv('NEXT_PUBLIC_APP_VERSION', process.env.NEXT_PUBLIC_APP_VERSION, '1.0.0'),
  appEnvironment: validateEnv('NEXT_PUBLIC_APP_ENVIRONMENT', process.env.NEXT_PUBLIC_APP_ENVIRONMENT, 'development'),
  
  // Feature Flags
  enableDebug: validateEnv('NEXT_PUBLIC_ENABLE_DEBUG', process.env.NEXT_PUBLIC_ENABLE_DEBUG, 'true') === 'true',
  enableAnalytics: validateEnv('NEXT_PUBLIC_ENABLE_ANALYTICS', process.env.NEXT_PUBLIC_ENABLE_ANALYTICS, 'false') === 'true',
  
  // External Services
  sentryDsn: validateEnv('NEXT_PUBLIC_SENTRY_DSN', process.env.NEXT_PUBLIC_SENTRY_DSN),
  googleAnalyticsId: validateEnv('NEXT_PUBLIC_GOOGLE_ANALYTICS_ID', process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID),
} as const;
