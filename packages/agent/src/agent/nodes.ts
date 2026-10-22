import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { AgentGraphState } from './state';
import { createChatModel } from './models';
import {
  SYSTEM_PROMPT,
  INTENT_CLASSIFICATION_PROMPT,
  buildContextPrompt,
} from './prompts';
import type { Retriever } from '../runtime/retriever';
import { ContextBuilder } from '../runtime/context-builder';
import { getTabPageClient, hasTabPageClient } from '../worker/tab-page-client';

import { presetService } from '../preset/preset.service';

// Module-level retriever injected via initNodes() during worker startup
let _retriever: Retriever | undefined;
const contextBuilder = new ContextBuilder();

/**
 * Inject the Retriever instance used by retrieveNode and generateNode.
 * Called once during agent worker initialization.
 */
export function initNodes(retriever: Retriever): void {
  _retriever = retriever;
}

function getRetriever(): Retriever {
  if (!_retriever) {
    throw new Error('Nodes not initialized. Call initNodes(retriever) first.');
  }
  return _retriever;
}

// ---------------------------------------------------------------------------
// understandNode — classify user intent via LLM
// ---------------------------------------------------------------------------

export function extractThinking(content: unknown): string {
  if (!content) return '';
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === 'object') {
          if ('type' in part && (part as { type?: string }).type === 'thinking') {
            const t = (part as { thinking?: unknown }).thinking;
            if (typeof t === 'string') return t;
          }
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }
  if (typeof content === 'string') {
    const thinkMatch = /<think>([\s\S]*?)<\/think>/i.exec(content);
    if (thinkMatch) {
      return thinkMatch[1].trim();
    }
  }
  return '';
}

export function extractText(content: unknown): string {
  if (!content) return '';
  let raw = '';
  if (typeof content === 'string') {
    raw = content;
  } else if (Array.isArray(content)) {
    raw = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          if ('type' in part && (part as { type?: string }).type === 'thinking') {
            return '';
          }
          if ('text' in part && typeof (part as { text?: unknown }).text === 'string') {
            return (part as { text: string }).text;
          }
        }
        return '';
      })
      .join('');
  } else if (typeof content === 'object' && 'text' in (content as Record<string, unknown>)) {
    const t = (content as { text: unknown }).text;
    if (typeof t === 'string') raw = t;
  }
  return raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
}

// ---------------------------------------------------------------------------
// understandNode — classify user intent via LLM
// ---------------------------------------------------------------------------

export async function understandNode(
  state: AgentGraphState,
): Promise<Partial<AgentGraphState>> {
  try {
    const userMessage = state.messages[state.messages.length - 1];
    const userText = extractText(userMessage?.content);
    if (!userText.trim()) {
      return { intent: 'GENERAL' };
    }

    const model = createChatModel(state.model ? { model: state.model } : undefined);
    const prompt = INTENT_CLASSIFICATION_PROMPT.replace('{question}', userText);
    const response = await model.invoke([{ role: 'user', content: prompt }]);
    const rawText = extractText(response.content);
    const intent = rawText ? rawText.trim().toUpperCase() : 'GENERAL';

    return { intent };
  } catch (err) {
    console.warn('[understandNode] Intent classification failed, using GENERAL fallback:', err);
    return { intent: 'GENERAL' };
  }
}

// ---------------------------------------------------------------------------
// retrieveNode — retrieve memories + messages based on intent
// ---------------------------------------------------------------------------

export async function retrieveNode(
  state: AgentGraphState,
): Promise<Partial<AgentGraphState>> {
  const retriever = getRetriever();
  const userMessage = state.messages[state.messages.length - 1];
  const userText =
    typeof userMessage?.content === 'string' ? userMessage.content : '';
  const intent = state.intent;

  let retrievedMemories = state.retrievedMemories;
  let retrievedCommitments = state.retrievedCommitments;
  let retrievedMessages = state.retrievedMessages;
  let dialogPreset = state.dialogPreset;

  if (state.peerId) {
    dialogPreset = await retriever.getDialogPreset(state.peerId);
  }

  if (intent === 'FOLLOW_UP') {
    retrievedCommitments = await retriever.getPendingCommitments();
    retrievedMemories = await retriever.searchMemories(undefined, 'COMMITMENT');
  } else if (intent === 'PREFERENCE') {
    retrievedMemories = await retriever.searchMemories(undefined, 'PREFERENCE');
  } else if (intent === 'FACT') {
    retrievedMemories = await retriever.searchMemoriesByText(userText);
  } else {
    // GENERAL / other: text search across memories + messages
    retrievedMemories = await retriever.searchMemoriesByText(userText);
    retrievedMessages = await retriever.searchMessages(userText, state.peerId);
  }

  return { retrievedMemories, retrievedCommitments, retrievedMessages, dialogPreset };
}

// ---------------------------------------------------------------------------
// generateNode — build context + call LLM for the final answer
// ---------------------------------------------------------------------------

export async function generateNode(
  state: AgentGraphState,
): Promise<Partial<AgentGraphState>> {
  const model = createChatModel(state.model ? { model: state.model } : undefined);

  const context = contextBuilder.build({
    memories: state.retrievedMemories,
    commitments: state.retrievedCommitments,
    messages: state.retrievedMessages,
    entities: [],
    dialogPreset: state.dialogPreset,
  });

  const systemSections = [
    SYSTEM_PROMPT,
    buildContextPrompt(context),
  ];

  if (state.presetId) {
    const preset = presetService.getPresetById(state.presetId);
    if (preset) {
      systemSections.push(`Active Task Preset [${preset.name}]: ${preset.prompt}`);
      if (preset.tone) {
        systemSections.push(`Tone requirement: Please respond using a ${preset.tone} tone.`);
      }
    }
  }

  const systemMessage = new SystemMessage(systemSections.filter(Boolean).join('\n\n'));
  const conversationMessages = state.messages.filter((m) => m._getType() !== 'system');
  const allMessages = [systemMessage, ...conversationMessages];

  const memCount = state.retrievedMemories?.length ?? 0;
  const commitCount = state.retrievedCommitments?.length ?? 0;
  const msgCount = state.retrievedMessages?.length ?? 0;

  const traceSteps: string[] = [];
  if (state.intent) {
    traceSteps.push(`• Classified Intent: ${state.intent}`);
  }
  if (memCount > 0 || commitCount > 0 || msgCount > 0) {
    traceSteps.push(
      `• Retrieved Context: ${memCount} memories, ${commitCount} commitments, ${msgCount} chat messages`,
    );
  } else {
    traceSteps.push(`• Retrieved Context: No stored memories or matching dialogue found for this query`);
  }

  if (state.presetId) {
    const preset = presetService.getPresetById(state.presetId);
    if (preset) {
      traceSteps.push(`• Preset: Applied "${preset.name}" (${preset.tone || 'standard'} tone)`);
    }
  }
  if (state.model) {
    traceSteps.push(`• Model: ${state.model}`);
  }

  const runId = state.runId || 'active_run';

  if (hasTabPageClient()) {
    try {
      const client = getTabPageClient();
      const stream = await model.stream(allMessages);
      let fullContent = '';
      let streamThinking = '';
      for await (const chunk of stream) {
        const chunkThinking = extractThinking(chunk.content);
        if (chunkThinking) {
          streamThinking += chunkThinking;
        }
        const text = extractText(chunk.content);
        if (text) {
          fullContent += text;
          void client.call('streamToken', [runId, text]).catch(() => {});
        }
      }
      const fullThought = streamThinking.trim()
        ? `${streamThinking.trim()}\n\n---\nExecution trace:\n${traceSteps.join('\n')}`
        : traceSteps.join('\n');

      return {
        messages: [new AIMessage(fullContent)],
        thought: fullThought,
      };
    } catch (err) {
      console.warn('[generateNode] Streaming failed, falling back to invoke:', err);
    }
  }

  const response = await model.invoke(allMessages);
  const text = extractText(response.content);
  const rawThinking = extractThinking(response.content);
  const fullThought = rawThinking.trim()
    ? `${rawThinking.trim()}\n\n---\nExecution trace:\n${traceSteps.join('\n')}`
    : traceSteps.join('\n');

  return {
    messages: [new AIMessage(text)],
    thought: fullThought,
  };
}
