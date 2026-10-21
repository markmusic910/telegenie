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

export async function understandNode(
  state: AgentGraphState,
): Promise<Partial<AgentGraphState>> {
  const userMessage = state.messages[state.messages.length - 1];
  const userText =
    typeof userMessage?.content === 'string' ? userMessage.content : '';

  const model = createChatModel();
  const prompt = INTENT_CLASSIFICATION_PROMPT.replace('{question}', userText);
  const response = await model.invoke([{ role: 'user', content: prompt }]);
  const intent =
    typeof response.content === 'string' ? response.content.trim().toUpperCase() : 'GENERAL';

  return { intent };
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
  const model = createChatModel();

  const context = contextBuilder.build({
    memories: state.retrievedMemories,
    commitments: state.retrievedCommitments,
    messages: state.retrievedMessages,
    entities: [],
    dialogPreset: state.dialogPreset,
  });

  const systemMessages = [
    new SystemMessage(SYSTEM_PROMPT),
    new SystemMessage(buildContextPrompt(context)),
  ];

  if (hasTabPageClient()) {
    try {
      const client = getTabPageClient();
      const stream = await model.stream([...systemMessages, ...state.messages]);
      let fullContent = '';
      for await (const chunk of stream) {
        const text = typeof chunk.content === 'string' ? chunk.content : '';
        if (text) {
          fullContent += text;
          void client.call('streamToken', ['active_run', text]).catch(() => {});
        }
      }
      return {
        messages: [new AIMessage(fullContent)],
      };
    } catch {
      // Fallback to standard invoke if stream fails
    }
  }

  const response = await model.invoke([...systemMessages, ...state.messages]);

  return {
    messages: [response],
  };
}
