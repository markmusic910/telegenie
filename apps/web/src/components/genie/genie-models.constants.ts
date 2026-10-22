export type LLMProvider = 'OpenAI' | 'Google' | 'Anthropic';

export interface ModelOption {
  id: string;
  name: string;
  provider: LLMProvider;
}

export const DEFAULT_MODEL_ID = 'gpt-4o';

export const SUPPORTED_MODELS: ModelOption[] = [
  // OpenAI (Default)
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'OpenAI' },

  // Google
  { id: 'gemini-3.8', name: 'Gemini 3.8', provider: 'Google' },

  // Anthropic
  { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', provider: 'Anthropic' },
  { id: 'claude-haiku-5-5', name: 'Haiku 5.5', provider: 'Anthropic' },
];

export const MODEL_PROVIDERS: LLMProvider[] = ['OpenAI', 'Google', 'Anthropic'];

export function getModelProvider(modelId: string): LLMProvider {
  if (modelId.toLowerCase().includes('claude') || modelId.toLowerCase().includes('sonnet') || modelId.toLowerCase().includes('haiku')) {
    return 'Anthropic';
  }
  if (modelId.toLowerCase().includes('gemini')) {
    return 'Google';
  }
  const found = SUPPORTED_MODELS.find((m) => m.id === modelId || m.name === modelId);
  return found?.provider ?? 'OpenAI';
}
