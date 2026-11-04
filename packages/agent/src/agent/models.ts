import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';

export type LLMProvider = 'Google' | 'Anthropic' | 'OpenAI';

export interface ProviderApiKeys {
  google?: string;
  anthropic?: string;
  openai?: string;
}

export interface ProxyConfig {
  baseUrl: string;
  token?: string;
}

export type ModelConfig = {
  provider?: LLMProvider;
  model: string;
  apiKey?: string;
  apiKeys?: ProviderApiKeys;
  temperature?: number;
  proxy?: ProxyConfig;
  traceId?: string;
};

/** Module-level config set via configureModel RPC from the tab on worker startup or switch. */
let currentConfig: ModelConfig | undefined;

/** Resolve provider from model name if not explicitly specified. */
export function resolveProvider(model: string, explicitProvider?: LLMProvider): LLMProvider {
  if (explicitProvider) return explicitProvider;
  const lower = model.toLowerCase();
  if (lower.startsWith('gemini')) return 'Google';
  if (lower.startsWith('claude') || lower.includes('sonnet') || lower.includes('haiku')) return 'Anthropic';
  return 'OpenAI';
}

/** Set the LLM configuration. Called by agent.handlers via AgentWorkerApi.configureModel. */
export function setModelConfig(config: ModelConfig): void {
  currentConfig = {
    ...config,
    provider: resolveProvider(config.model, config.provider),
  };
}

/** Get current active config. */
export function getModelConfig(): ModelConfig | undefined {
  return currentConfig;
}

/**
 * Resolve the API key for a given provider from ModelConfig.
 */
function resolveApiKey(config: ModelConfig, provider: LLMProvider): string | undefined {
  if (config.apiKeys) {
    if (provider === 'Google' && config.apiKeys.google) return config.apiKeys.google;
    if (provider === 'Anthropic' && config.apiKeys.anthropic) return config.apiKeys.anthropic;
    if (provider === 'OpenAI' && config.apiKeys.openai) return config.apiKeys.openai;
  }
  if (config.apiKey) return config.apiKey;
  return undefined;
}

/**
 * Create a LangChain BaseChatModel instance based on current or override config.
 * Supports Google (gemini-3.8), Anthropic (claude-5.5-sonnet, claude-5.5-haiku), and OpenAI (gpt-4o, etc.).
 */
export function createChatModel(override?: Partial<ModelConfig>): BaseChatModel {
  const targetModel = override?.model ?? currentConfig?.model ?? 'gpt-4o';
  const targetProvider =
    override?.provider ??
    (override?.model
      ? resolveProvider(override.model)
      : (currentConfig?.provider ?? resolveProvider(targetModel)));

  const merged: ModelConfig = {
    ...(currentConfig ?? {}),
    ...(override ?? {}),
    model: targetModel,
    provider: targetProvider,
  };

  const provider = targetProvider;
  const apiKey = resolveApiKey(merged, provider);
  const isBYOK = Boolean(apiKey);
  const proxy = merged.proxy;

  if (!isBYOK && (!proxy || !proxy.baseUrl)) {
    throw new Error(
      `No API key configured for provider '${provider}' (model '${merged.model}') and TeleGenie Cloud AI proxy is not available. Please configure your ${provider} API key or connect to TeleGenie Cloud.`,
    );
  }

  const temperature = merged.temperature ?? 0.7;

  // BYOK mode: directly call LLM provider APIs
  if (isBYOK && apiKey) {
    switch (provider) {
      case 'Google': {
        // Map user-facing model ID to Google Generative AI API model identifier
        const googleModel =
          merged.model === 'gemini-3.8' ? 'gemini-3.8-flash' : merged.model;
        return new ChatGoogleGenerativeAI({
          apiKey,
          model: googleModel,
          temperature,
        });
      }

      case 'Anthropic': {
        let anthropicModel = merged.model;
        if (merged.model === 'claude-5.5-sonnet' || merged.model === 'claude-sonnet-5-5') {
          anthropicModel = 'claude-sonnet-5-5';
        } else if (merged.model === 'claude-5.5-haiku' || merged.model === 'claude-haiku-5-5') {
          anthropicModel = 'claude-haiku-5-5';
        }
        return new ChatAnthropic({
          apiKey,
          model: anthropicModel,
          // Claude 5.5 models do not support custom temperature values; omit unless temperature is 1
          ...(merged.temperature === 1 ? { temperature: 1 } : {}),
        });
      }

      case 'OpenAI':
      default:
        return new ChatOpenAI({
          apiKey,
          model: merged.model,
          temperature,
        });
    }
  }

  // Normal / Proxy mode: forward to Cloudflare Worker AI proxy (/api/chat/*)
  const normalizedProxyBase = proxy!.baseUrl.replace(/\/+$/, '');
  const proxyToken = proxy?.token;

  const proxyHeaders: Record<string, string> = {};
  if (proxyToken) {
    proxyHeaders.Authorization = `Bearer ${proxyToken}`;
  }
  if (merged.traceId) {
    proxyHeaders['x-trace-id'] = merged.traceId;
    proxyHeaders['cf-aig-trace-id'] = merged.traceId;
  }

  switch (provider) {
    case 'Google': {
      const googleModel =
        merged.model === 'gemini-3.8' ? 'gemini-3.8-flash' : merged.model;
      return new ChatGoogleGenerativeAI({
        apiKey: proxyToken || 'telegenie-proxy',
        model: googleModel,
        baseUrl: `${normalizedProxyBase}/api/chat/google`,
        customHeaders: Object.keys(proxyHeaders).length > 0 ? proxyHeaders : undefined,
        temperature,
      });
    }

    case 'Anthropic': {
      let anthropicModel = merged.model;
      if (merged.model === 'claude-5.5-sonnet' || merged.model === 'claude-sonnet-5-5') {
        anthropicModel = 'claude-sonnet-5-5';
      } else if (merged.model === 'claude-5.5-haiku' || merged.model === 'claude-haiku-5-5') {
        anthropicModel = 'claude-haiku-5-5';
      }
      return new ChatAnthropic({
        apiKey: 'telegenie-proxy',
        model: anthropicModel,
        ...(merged.temperature === 1 ? { temperature: 1 } : {}),
        clientOptions: {
          baseURL: `${normalizedProxyBase}/api/chat/anthropic`,
          defaultHeaders: proxyHeaders,
        },
      });
    }

    case 'OpenAI':
    default:
      return new ChatOpenAI({
        apiKey: proxyToken || 'telegenie-proxy',
        model: merged.model,
        temperature,
        configuration: {
          baseURL: `${normalizedProxyBase}/api/chat/openai/v1`,
          defaultHeaders: proxyHeaders,
        },
      });
  }
}
