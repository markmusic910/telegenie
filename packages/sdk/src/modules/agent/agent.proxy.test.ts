import { AgentController } from './agent.controller';
import { createChatModel, setModelConfig } from '@telegenie/agent';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

describe('Agent Controller and AI Proxy Configuration', () => {
  it('automatically injects proxy configuration into configureModel when no personal key is supplied', async () => {
    let capturedArgs: unknown[] = [];
    const mockWorkerClient = {
      call: jest.fn().mockImplementation((method: string, args: unknown[]) => {
        if (method === 'configureModel') {
          capturedArgs = args;
        }
        return Promise.resolve();
      }),
      worker: {} as any,
    };

    const agent = new AgentController({
      createWorkerClient: () => mockWorkerClient as any,
      getBackendBaseUrl: () => 'https://app-stage.telegenie.link',
      getBackendToken: () => 'test-jwt-token-123',
    });

    await agent.configureModel({
      provider: 'OpenAI',
      model: 'gpt-4o',
    });

    expect(capturedArgs).toHaveLength(2);
    const config = capturedArgs[0] as any;
    expect(config.proxy).toEqual({
      baseUrl: 'https://app-stage.telegenie.link',
      token: 'test-jwt-token-123',
    });
  });

  describe('createChatModel BYOK vs Proxy routing', () => {
    it('uses BYOK direct call when personal API key is provided for OpenAI', () => {
      const model = createChatModel({
        provider: 'OpenAI',
        model: 'gpt-4o',
        apiKey: 'sk-personal-key',
        proxy: {
          baseUrl: 'https://app-stage.telegenie.link',
          token: 'jwt-token',
        },
      });

      expect(model).toBeInstanceOf(ChatOpenAI);
      const openAiModel = model as ChatOpenAI;
      expect(openAiModel.apiKey).toBe('sk-personal-key');
      expect((openAiModel as any).clientConfig.baseURL).toBeUndefined();
    });

    it('routes via Cloudflare Worker proxy when no personal API key is provided for OpenAI', () => {
      const model = createChatModel({
        provider: 'OpenAI',
        model: 'gpt-4o',
        proxy: {
          baseUrl: 'https://app-stage.telegenie.link',
          token: 'jwt-token-abc',
        },
      });

      expect(model).toBeInstanceOf(ChatOpenAI);
      const openAiModel = model as ChatOpenAI;
      expect((openAiModel as any).clientConfig.baseURL).toBe(
        'https://app-stage.telegenie.link/api/chat/openai/v1',
      );
      expect((openAiModel as any).clientConfig.defaultHeaders).toEqual({
        Authorization: 'Bearer jwt-token-abc',
      });
    });

    it('routes via Cloudflare Worker proxy when no personal API key is provided for Anthropic', () => {
      const model = createChatModel({
        provider: 'Anthropic',
        model: 'claude-sonnet-5-5',
        proxy: {
          baseUrl: 'https://app-stage.telegenie.link',
          token: 'jwt-token-anthropic',
        },
      });

      expect(model).toBeInstanceOf(ChatAnthropic);
      const anthropicModel = model as ChatAnthropic;
      expect((anthropicModel as any).clientOptions.baseURL).toBe(
        'https://app-stage.telegenie.link/api/chat/anthropic',
      );
      expect((anthropicModel as any).clientOptions.defaultHeaders).toEqual({
        Authorization: 'Bearer jwt-token-anthropic',
      });
    });

    it('routes via Cloudflare Worker proxy when no personal API key is provided for Google', () => {
      const model = createChatModel({
        provider: 'Google',
        model: 'gemini-3.8',
        proxy: {
          baseUrl: 'https://app-stage.telegenie.link',
          token: 'jwt-token-google',
        },
      });

      expect(model).toBeInstanceOf(ChatGoogleGenerativeAI);
      const googleModel = model as ChatGoogleGenerativeAI;
      expect(googleModel.baseUrl).toBe('https://app-stage.telegenie.link/api/chat/google');
    });

    it('propagates traceId to Cloudflare Agent Tracing headers in proxy mode', () => {
      const model = createChatModel({
        provider: 'OpenAI',
        model: 'gpt-4o',
        traceId: 'run-trace-12345',
        proxy: {
          baseUrl: 'https://app-stage.telegenie.link',
          token: 'jwt-token-abc',
        },
      });

      expect(model).toBeInstanceOf(ChatOpenAI);
      const openAiModel = model as ChatOpenAI;
      expect((openAiModel as any).clientConfig.defaultHeaders).toEqual({
        Authorization: 'Bearer jwt-token-abc',
        'x-trace-id': 'run-trace-12345',
        'cf-aig-trace-id': 'run-trace-12345',
      });
    });

    it('propagates costSource to x-cost-source header in proxy mode', () => {
      const model = createChatModel({
        provider: 'OpenAI',
        model: 'gpt-4o',
        costSource: 'memory extraction',
        proxy: {
          baseUrl: 'https://app-stage.telegenie.link',
          token: 'jwt-token-abc',
        },
      });

      expect(model).toBeInstanceOf(ChatOpenAI);
      const openAiModel = model as ChatOpenAI;
      expect((openAiModel as any).clientConfig.defaultHeaders).toEqual({
        Authorization: 'Bearer jwt-token-abc',
        'x-cost-source': 'memory extraction',
      });
    });

    it('throws error when neither personal API key nor proxy is configured', () => {
      setModelConfig({ model: 'gpt-4o' });
      expect(() => {
        createChatModel({
          provider: 'OpenAI',
          model: 'gpt-4o',
          apiKey: undefined,
          apiKeys: undefined,
          proxy: undefined,
        });
      }).toThrow(/TeleGenie Cloud AI proxy is not available/);
    });
  });
});

