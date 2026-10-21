'use client';

import { useSDK } from '@/lib/contexts/sdk.context';
import type { ChatModelAdapter, ChatModelRunOptions, ChatModelRunResult } from '@assistant-ui/react';
import { useLocalRuntime } from '@assistant-ui/react';
import { useMemo, useRef } from 'react';

export type GenieRuntimeOptions = {
  peerId?: string;
};

/**
 * Creates an assistant-ui runtime connected to TeleGenie's Agent DedicatedWorker.
 * Streams partial tokens in real-time via TabPageApi.streamToken.
 */
export function useGenieRuntime({ peerId }: GenieRuntimeOptions = {}) {
  const sdk = useSDK();
  const peerIdRef = useRef(peerId);
  peerIdRef.current = peerId;

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

        let accumulated = '';
        const tokenQueue: string[] = [];
        let isDone = false;
        let resolveWait: (() => void) | null = null;

        const unsubscribe = sdk.agent.onStreamToken((_runId, token) => {
          tokenQueue.push(token);
          if (resolveWait) {
            resolveWait();
            resolveWait = null;
          }
        });

        const chatPromise = sdk.agent
          .chat(userText, peerIdRef.current)
          .catch((err: Error) => `Error: ${err.message || 'Agent chat failed'}`)
          .finally(() => {
            isDone = true;
            unsubscribe();
            if (resolveWait) {
              resolveWait();
              resolveWait = null;
            }
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
        // If no tokens were streamed, use the final promise result
        const finalText = accumulated || finalResult;

        yield {
          content: [{ type: 'text', text: finalText }],
        };
      },
    };
  }, [sdk]);

  return useLocalRuntime(adapter);
}
