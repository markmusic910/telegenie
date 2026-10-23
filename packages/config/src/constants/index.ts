/**
 * Shared constants across TeleGenie applications (Web, Desktop, Mobile).
 */

// LocalStorage / Persistence keys
export const AI_KEY_STORAGE_KEY_PREFIX = 'telegenie_ai_key_';
export const LANGSMITH_STORAGE_KEY = 'telegenie_langsmith_api_key';
export const LANGSMITH_ENABLED_STORAGE_KEY = 'telegenie_langsmith_tracing_enabled';
export const LANGSMITH_ENDPOINT_STORAGE_KEY = 'telegenie_langsmith_endpoint';

// Default Endpoints & Timeouts
export const DEFAULT_LANGSMITH_ENDPOINT = 'https://www.telegenie.top/api/monitoring';
export const DEFAULT_API_BASE_URL = 'https://api.example.com';
export const DEFAULT_API_TIMEOUT = 10000;

// Default Agent Metadata
export const DEFAULT_LANGSMITH_AGENT_ID = 'telegenie';
export const DEFAULT_LANGSMITH_AGENT_ENVIRONMENT = 'local';
export const DEFAULT_LANGSMITH_PROJECT = 'telegenie';

// Default Application Metadata
export const DEFAULT_APP_NAME = 'TeleGenie';
export const DEFAULT_APP_VERSION = '1.0.0';
export const DEFAULT_APP_ENVIRONMENT = 'development';
