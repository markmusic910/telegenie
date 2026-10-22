'use client';

import { useSDK } from '@/lib/contexts/sdk.context';
import type { ChatModelAdapter, ChatModelRunOptions, ChatModelRunResult } from '@assistant-ui/react';
import { useLocalRuntime } from '@assistant-ui/react';
import { useMemo, useRef } from 'react';
import { getAllStoredApiKeys, hasApiKeyForProvider } from './genie-api-keys';
import { DEFAULT_MODEL_ID, getModelProvider } from './genie-models.constants';

export type GenieRuntimeOptions = {
  peerId?: string;
  model?: string;
  presetId?: string;
  onRunCompleted?: () => void;
};

/**
 * Creates an assistant-ui runtime connected to TeleGenie's Agent DedicatedWorker.
 * Streams partial tokens in real-time via TabPageApi.streamToken and stores
 * runs & messages in IndexedDB (telegenie-agent_${tabId}).
 */
export function useGenieRuntime({
  peerId,
  model = DEFAULT_MODEL_ID,
  presetId,
  onRunCompleted,
}: GenieRuntimeOptions = {}) {
  const sdk = useSDK();
  const peerIdRef = useRef(peerId);
  peerIdRef.current = peerId;

  const modelRef = useRef(model);
  modelRef.current = model;

  const presetIdRef = useRef(presetId);
  presetIdRef.current = presetId;

  const onRunCompletedRef = useRef(onRunCompleted);
  onRunCompletedRef.current = onRunCompleted;

  const adapter = useMemo<ChatModelAdapter>(() => {
    return {
      async *run(options: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult, void> {
        // Extract the user prompt from the last user message
        const lastUserMessage = [...options.messages].reverse().find((m) => m.role === 'user');
        let userText = '';
        if (lastUserMessage) {
          if (typeof lastUserMessage.content === 'string') {
            userText = lastUserMessage.content;
          } else if (Array.isArray(lastUserMessage.content)) {
            userText = lastUserMessage.content
              .map((part) => (part.type === 'text' ? part.text : ''))
              .join('');
          }
        }

        if (!userText.trim()) {
          yield {
            content: [{ type: 'text', text: 'No message content provided.' }],
          };
          return;
        }

        const activeModel = modelRef.current || DEFAULT_MODEL_ID;
        const provider = getModelProvider(activeModel);

        // Check if API key is configured
        if (!hasApiKeyForProvider(provider)) {
          yield {
            content: [
              {
                type: 'text',
                text: `⚠️ **API Key Required**: Please configure your **${provider}** API key in Settings (gear icon or sidebar) to use **${activeModel}**.`,
              },
            ],
          };
          return;
        }

        // Configure the agent worker with the latest keys and active model
        try {
          const apiKeys = getAllStoredApiKeys();
          await sdk.agent.configureModel({
            provider,
            model: activeModel,
            apiKeys,
          });
        } catch (err) {
          console.warn('[GenieRuntime] Failed to configure model:', err);
        }

        let accumulated = '';
        const tokenQueue: string[] = [];
        let isDone = false;
        let resolveWait: (() => void) | null = null;

        const unsubscribe = sdk.agent.onStreamToken((_runId, token) => {
          let tokenStr = '';
          if (typeof token === 'string') {
            tokenStr = token;
          } else if (token && typeof token === 'object') {
            tokenStr =
              typeof (token as { text?: unknown }).text === 'string'
                ? (token as { text: string }).text
                : JSON.stringify(token);
          } else if (token != null) {
            tokenStr = String(token);
          }

          if (tokenStr) {
            tokenQueue.push(tokenStr);
            if (resolveWait) {
              resolveWait();
              resolveWait = null;
            }
          }
        });

        const chatPromise = sdk.agent
          .chat(userText, {
            peerId: peerIdRef.current,
            model: activeModel,
            presetId: presetIdRef.current,
          })
          .catch((err: unknown) => {
            const msg =
              err instanceof Error
                ? err.message
                : typeof err === 'object' && err !== null && 'message' in (err as Record<string, unknown>)
                  ? String((err as Record<string, unknown>).message)
                  : String(err || 'Agent chat failed');
            return `Error: ${msg}`;
          })
          .finally(() => {
            isDone = true;
            unsubscribe();
            if (resolveWait) {
              resolveWait();
              resolveWait = null;
            }
            onRunCompletedRef.current?.();
          });

        while (!isDone || tokenQueue.length > 0) {
          if (tokenQueue.length > 0) {
            while (tokenQueue.length > 0) {
              accumulated += tokenQueue.shift()!;
            }
            yield {
              content: [{ type: 'text', text: accumulated }],
            };
          } else if (!isDone) {
            await new Promise<void>((resolve) => {
              resolveWait = resolve;
            });
          }
        }

        const finalResult = await chatPromise;
        const resultStr =
          typeof finalResult === 'string'
            ? finalResult
            : finalResult && typeof finalResult === 'object' && 'text' in (finalResult as Record<string, unknown>)
              ? String((finalResult as Record<string, unknown>).text)
              : finalResult
                ? JSON.stringify(finalResult)
                : '';
        const thoughtStr =
          finalResult && typeof finalResult === 'object' && 'thought' in (finalResult as Record<string, unknown>)
            ? String((finalResult as Record<string, unknown>).thought || '')
            : '';
        const finalText = accumulated || resultStr;

        const contentParts: Array<{ type: 'text'; text: string } | { type: 'reasoning'; text: string }> = [];
        if (thoughtStr) {
          contentParts.push({ type: 'reasoning', text: thoughtStr });
        }
        contentParts.push({ type: 'text', text: finalText });

        yield {
          content: contentParts,
        };
      },
    };
  }, [sdk]);

  return useLocalRuntime(adapter);
}
