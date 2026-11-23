'use client';

import { useSDK } from '@/lib/contexts/sdk.context';
import type { ChatModelAdapter, ChatModelRunOptions, ChatModelRunResult } from '@assistant-ui/react';
import { useLocalRuntime } from '@assistant-ui/react';
import { useMemo, useRef } from 'react';
import {
  getAllStoredApiKeys,
  hasApiKeyForProvider,
} from './genie-api-keys';
import { getInstalledSkills } from './genie-skills.storage';
import { getUserIdentity } from './genie-user-identity.storage';
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
 * runs & messages in IndexedDB (telegenie-agent_${accountSlot}).
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
        const isBYOK = hasApiKeyForProvider(provider);
        const backendToken = sdk.auth.getBackendToken();

        // If not BYOK, user must be authenticated with TeleGenie Cloud to use proxy
        if (!isBYOK && !backendToken) {
          yield {
            content: [
              {
                type: 'text',
                text: `⚠️ **Authentication or API Key Required**: Please connect to **TeleGenie Cloud** in Settings to use free AI credits, or configure your own **${provider}** API key in Settings.`,
              },
            ],
          };
          return;
        }

        // Configure the agent worker with the latest keys, model, installed skills, and user identity
        try {
          const apiKeys = getAllStoredApiKeys();
          await sdk.agent.configureModel({
            provider,
            model: activeModel,
            apiKeys,
          });
          await sdk.agent.configureSkills(getInstalledSkills());
          await sdk.agent.configureUserIdentity(getUserIdentity());
        } catch (err) {
          console.warn('[GenieRuntime] Failed to configure model:', err);
        }

        let accumulated = '';
        const tokenQueue: string[] = [];
        const toolCallsMap = new Map<
          string,
          {
            toolCallId: string;
            toolName: string;
            args: Record<string, unknown>;
            argsText: string;
            result?: unknown;
            isError?: boolean;
          }
        >();
        let toolDirty = false;
        let isDone = false;
        let resolveWait: (() => void) | null = null;

        const wake = () => {
          if (resolveWait) {
            resolveWait();
            resolveWait = null;
          }
        };

        const buildToolCallParts = () =>
          Array.from(toolCallsMap.values()).map((tc) => ({
            type: 'tool-call' as const,
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args as any,
            argsText: tc.argsText,
            ...(tc.result !== undefined ? { result: tc.result } : {}),
            ...(tc.isError ? { isError: true } : {}),
          }));

        const unsubscribeTokens = sdk.agent.onStreamToken((_runId, token) => {
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
            wake();
          }
        });

        const unsubscribeTools = sdk.agent.onToolCallEvent((event) => {
          const existing = toolCallsMap.get(event.toolCallId);
          const args = event.args ?? existing?.args ?? {};
          const argsText = existing?.argsText ?? JSON.stringify(args);
          if (event.status === 'start') {
            toolCallsMap.set(event.toolCallId, {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              args,
              argsText,
            });
          } else if (event.status === 'result') {
            toolCallsMap.set(event.toolCallId, {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              args,
              argsText,
              result: event.result ?? { ok: true },
              isError: false,
            });
          } else if (event.status === 'error') {
            toolCallsMap.set(event.toolCallId, {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              args,
              argsText,
              result: event.error || 'Tool call failed',
              isError: true,
            });
          }
          toolDirty = true;
          wake();
        });

        const chatPromise = sdk.agent
          .chat(userText, {
            peerId: peerIdRef.current,
            model: activeModel,
            presetId: presetIdRef.current,
          })
          .catch((err: unknown) => {
            const rawMsg =
              err instanceof Error
                ? err.message
                : typeof err === 'object' && err !== null && 'message' in (err as Record<string, unknown>)
                  ? String((err as Record<string, unknown>).message)
                  : String(err || 'Agent chat failed');
            if (rawMsg.includes('402') || rawMsg.toLowerCase().includes('insufficient credits')) {
              return '⚠️ **Daily Free Credits Exhausted**: You have used up your daily free AI credits. Please configure your own API key in Settings (gear icon) or wait for tomorrow.';
            }
            return `Error: ${rawMsg}`;
          })
          .finally(() => {
            isDone = true;
            unsubscribeTokens();
            unsubscribeTools();
            wake();
            if (!isBYOK) {
              void sdk.auth.getBackendMe();
            }
            onRunCompletedRef.current?.();
          });

        while (!isDone || tokenQueue.length > 0 || toolDirty) {
          if (tokenQueue.length > 0 || toolDirty) {
            while (tokenQueue.length > 0) {
              accumulated += tokenQueue.shift()!;
            }
            toolDirty = false;
            yield {
              content: [
                ...buildToolCallParts(),
                ...(accumulated ? [{ type: 'text' as const, text: accumulated }] : []),
              ],
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
            : finalResult && typeof finalResult === 'object' && 'text' in (finalResult as unknown as Record<string, unknown>)
              ? String((finalResult as unknown as Record<string, unknown>).text)
              : finalResult
                ? JSON.stringify(finalResult)
                : '';
        const thoughtStr =
          finalResult && typeof finalResult === 'object' && 'thought' in (finalResult as unknown as Record<string, unknown>)
            ? String((finalResult as unknown as Record<string, unknown>).thought || '')
            : '';
        const finalText = accumulated || resultStr;

        const contentParts: ChatModelRunResult['content'] = [
          ...(thoughtStr ? [{ type: 'reasoning' as const, text: thoughtStr }] : []),
          ...buildToolCallParts(),
          { type: 'text' as const, text: finalText },
        ];

        yield {
          content: contentParts,
        };
      },
    };
  }, [sdk]);

  return useLocalRuntime(adapter);
}
