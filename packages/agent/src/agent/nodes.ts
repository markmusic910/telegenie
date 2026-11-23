import {
  AIMessage,
  AIMessageChunk,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { END } from '@langchain/langgraph';
import { ContextBuilder, DEFAULT_TONE_PROMPTS } from '../runtime/context-builder';
import type { Retriever } from '../runtime/retriever';
import { getTabPageClient, hasTabPageClient } from '../worker/tab-page-client';
import { createChatModel } from './models';
import {
  INTENT_CLASSIFICATION_PROMPT,
  SYSTEM_PROMPT,
  buildContextPrompt,
} from './prompts';
import type { AgentGraphState } from './state';
import { resolveAgentTools } from './tools';

import { presetService } from '../preset/preset.service';

export const MAX_TOOL_ITERATIONS = 5;

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

    const model = createChatModel({
      ...(state.model ? { model: state.model } : {}),
      ...(state.runId ? { traceId: state.runId } : {}),
    });
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
  const userText = extractText(userMessage?.content);
  const intent = state.intent;

  let retrievedMemories = state.retrievedMemories;
  let retrievedEntities = state.retrievedEntities;
  let retrievedMessages = state.retrievedMessages;
  let dialogPreset = state.dialogPreset;
  let dialogContext = state.dialogContext;

  if (state.peerId) {
    dialogPreset = await retriever.getDialogPreset(state.peerId);
  }

  if (intent === 'PREFERENCE') {
    const prefMemories = await retriever.searchMemories(undefined, 'PREFERENCE');
    if (state.peerId) {
      const graphResult = await retriever.searchKnowledgeGraph(userText, state.peerId);
      const memById = new Map(prefMemories.map((m) => [m.id, m]));
      for (const m of graphResult.memories) {
        if (!memById.has(m.id)) memById.set(m.id, m);
      }
      retrievedMemories = Array.from(memById.values());
      retrievedEntities = graphResult.entities;
    } else {
      retrievedMemories = prefMemories;
      retrievedEntities = [];
    }
  } else {
    // FOLLOW_UP / FACT / GENERAL / other: hybrid knowledge graph search
    const graphResult = await retriever.searchKnowledgeGraph(userText, state.peerId);
    retrievedMemories = graphResult.memories;
    retrievedEntities = graphResult.entities;
  }

  if (state.peerId) {
    // Always include recent conversation messages from the attached dialog
    // (merging cached conversation history and keyword matches).
    const [cachedRecent, matched] = await Promise.all([
      retriever.getConversation(state.peerId, 30).catch(() => []),
      retriever.searchMessages(userText, state.peerId, 15).catch(() => []),
    ]);

    const mergedById = new Map<string, (typeof cachedRecent)[number]>();
    for (const msg of [...cachedRecent, ...matched]) {
      if (!mergedById.has(msg.id)) {
        mergedById.set(msg.id, msg);
      }
    }
    retrievedMessages = Array.from(mergedById.values())
      .sort((a, b) => b.date - a.date)
      .slice(0, 30);

    dialogContext = await retriever
      .getDialogContext(state.peerId, retrievedMessages)
      .catch(() => ({ peerId: state.peerId! }));
  } else if (intent !== 'PREFERENCE') {
    retrievedMessages = await retriever.searchMessages(userText, undefined, 20).catch(() => []);
  }

  return { retrievedMemories, retrievedEntities, retrievedMessages, dialogPreset, dialogContext };
}

// ---------------------------------------------------------------------------
// generateNode — build context + call LLM for the final answer
// ---------------------------------------------------------------------------

export async function generateNode(
  state: AgentGraphState,
): Promise<Partial<AgentGraphState>> {
  const model = createChatModel({
    ...(state.model ? { model: state.model } : {}),
    ...(state.runId ? { traceId: state.runId } : {}),
  });

  let activeSkills: import('../agent-db/agent-db.types').GenieSkill[] = [];
  let userIdentity: string | undefined;
  try {
    const { getWorkerState } = await import('../worker/agent-worker-init');
    const workerState = getWorkerState();
    const installedSkills = workerState.installedSkills || [];
    const activeSkillIds = new Set(state.dialogPreset?.skills || []);
    activeSkills = installedSkills.filter((s) => activeSkillIds.has(s.id));
    userIdentity = workerState.userIdentity;
  } catch {
    // Worker state not initialized (e.g. in standalone tests)
  }

  const context = contextBuilder.build({
    memories: state.retrievedMemories,
    messages: state.retrievedMessages,
    entities: state.retrievedEntities ?? [],
    peerId: state.peerId,
    dialogContext: state.dialogContext,
    dialogPreset: state.dialogPreset,
    activeSkills,
    userIdentity,
  });

  const systemSections = [
    SYSTEM_PROMPT,
  ];

  if (userIdentity?.trim()) {
    systemSections.push(
      `## User Identity & Preferences (USER.md)\nYou are serving this user. Always adhere to their background, identity, role, and stated preferences:\n\n${userIdentity.trim()}`,
    );
  }

  systemSections.push(buildContextPrompt(context));

  if (state.presetId) {
    const preset = presetService.getPresetById(state.presetId);
    if (preset) {
      systemSections.push(`Active Task Preset [${preset.name}]: ${preset.prompt}`);
      if (preset.tone) {
        const toneDirective =
          DEFAULT_TONE_PROMPTS[preset.tone.toLowerCase().trim()] ||
          `Please respond using a ${preset.tone} tone.`;
        systemSections.push(`Tone requirement: ${toneDirective}`);
      }
    }
  }

  const systemMessage = new SystemMessage(systemSections.filter(Boolean).join('\n\n'));
  const conversationMessages = state.messages.filter((m) => m._getType() !== 'system');
  const allMessages = [systemMessage, ...conversationMessages];

  const memCount = state.retrievedMemories?.length ?? 0;
  const msgCount = state.retrievedMessages?.length ?? 0;

  const traceSteps: string[] = [];
  const activePeerId = state.dialogContext?.peerId ?? state.peerId;
  if (activePeerId) {
    const dialogLabel = state.dialogContext?.peerName
      ? `${state.dialogContext.peerName} (${activePeerId})`
      : activePeerId;
    traceSteps.push(`• Active Dialog: ${dialogLabel}`);
  }
  if (state.intent) {
    traceSteps.push(`• Classified Intent: ${state.intent}`);
  }
  if (memCount > 0 || msgCount > 0) {
    traceSteps.push(
      `• Retrieved Context: ${memCount} memories, ${msgCount} chat messages`,
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
  if (state.dialogPreset) {
    const details: string[] = [];
    if (state.dialogPreset.background) details.push('Custom background');
    if (state.dialogPreset.tone) details.push(`Tone: ${state.dialogPreset.tone}`);
    if (details.length > 0) {
      traceSteps.push(`• Dialog Directives: ${details.join(', ')}`);
    }
  }
  if (activeSkills.length > 0) {
    traceSteps.push(`• Active Skills: ${activeSkills.map((s) => s.title).join(', ')}`);
  }
  if (userIdentity?.trim()) {
    traceSteps.push(`• User Identity: Loaded profile (USER.md)`);
  }
  if (state.model) {
    traceSteps.push(`• Model: ${state.model}`);
  }
  if (state.toolTraceSteps?.length) {
    traceSteps.push(...state.toolTraceSteps);
  }

  const runId = state.runId || 'active_run';
  const canCallTools = (state.toolIterations ?? 0) < MAX_TOOL_ITERATIONS;
  const { tools: activeTools } = canCallTools
    ? resolveAgentTools({
        context: { runId, peerId: activePeerId },
        scope: 'chat',
      })
    : { tools: [] };

  const runnableModel =
    activeTools.length > 0 && typeof model.bindTools === 'function'
      ? model.bindTools(activeTools)
      : model;

  if (hasTabPageClient()) {
    try {
      const client = getTabPageClient();
      const stream = await runnableModel.stream(allMessages);
      let fullContent = '';
      let streamThinking = '';
      let aggregatedChunk: AIMessageChunk | undefined;
      for await (const chunk of stream) {
        if (chunk instanceof AIMessageChunk) {
          aggregatedChunk = aggregatedChunk ? aggregatedChunk.concat(chunk) : chunk;
        }
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

      const toolCalls = aggregatedChunk?.tool_calls;
      const aiMessage = new AIMessage({
        content: fullContent,
        ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });

      return {
        messages: [aiMessage],
        thought: fullThought,
      };
    } catch (err) {
      console.warn('[generateNode] Streaming failed, falling back to invoke:', err);
    }
  }

  const response = (await runnableModel.invoke(allMessages)) as AIMessage;
  const text = extractText(response.content);
  const rawThinking = extractThinking(response.content);
  const fullThought = rawThinking.trim()
    ? `${rawThinking.trim()}\n\n---\nExecution trace:\n${traceSteps.join('\n')}`
    : traceSteps.join('\n');

  const toolCalls = Array.isArray(response.tool_calls) ? response.tool_calls : undefined;
  const aiMessage = new AIMessage({
    content: text,
    ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  });

  return {
    messages: [aiMessage],
    thought: fullThought,
  };
}

// ---------------------------------------------------------------------------
// toolsNode — execute LLM tool calls, audit to ToolCallRepository, stream events
// ---------------------------------------------------------------------------

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function toolsNode(
  state: AgentGraphState,
): Promise<Partial<AgentGraphState>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const toolCalls =
    lastMessage instanceof AIMessage && Array.isArray(lastMessage.tool_calls)
      ? lastMessage.tool_calls
      : [];

  if (toolCalls.length === 0) {
    return {};
  }

  const runId = state.runId || 'active_run';
  const activePeerId = state.dialogContext?.peerId ?? state.peerId;
  const { toolsByName } = resolveAgentTools({
    context: { runId, peerId: activePeerId },
    scope: 'chat',
  });

  let toolCallRepo: import('../agent-db/repository/tool-call.repository').ToolCallRepository | undefined;
  try {
    const { getWorkerState } = await import('../worker/agent-worker-init');
    toolCallRepo = getWorkerState().toolCallRepo;
  } catch {
    // Worker state not initialized (e.g. standalone unit tests)
  }

  const client = hasTabPageClient() ? getTabPageClient() : undefined;
  const toolMessages: ToolMessage[] = [];
  const toolTraceSteps: string[] = [];

  for (let index = 0; index < toolCalls.length; index++) {
    const tc = toolCalls[index];
    const toolName = tc.name;
    const toolCallId = tc.id || `${runId}_tc_${state.toolIterations ?? 0}_${index}`;
    const args = (tc.args && typeof tc.args === 'object' ? tc.args : {}) as Record<string, unknown>;

    const auditRecord = toolCallRepo
      ? await toolCallRepo.insert(runId, toolName, args).catch(() => undefined)
      : undefined;

    if (client) {
      void client
        .call('toolCallEvent', [
          {
            runId,
            toolCallId,
            toolName,
            status: 'start',
            args,
          },
        ])
        .catch(() => {});
    }

    const matchedTool = toolsByName.get(toolName);
    if (!matchedTool) {
      const errorMsg = `Tool "${toolName}" is not available.`;
      if (auditRecord && toolCallRepo) {
        await toolCallRepo.updateResult(auditRecord.id, 'FAILED', undefined, errorMsg).catch(() => {});
      }
      if (client) {
        void client
          .call('toolCallEvent', [
            {
              runId,
              toolCallId,
              toolName,
              status: 'error',
              args,
              error: errorMsg,
            },
          ])
          .catch(() => {});
      }
      toolTraceSteps.push(`• Tool ${toolName}: failed (${errorMsg})`);
      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCallId,
          name: toolName,
          content: JSON.stringify({ error: errorMsg }),
        }),
      );
      continue;
    }

    try {
      const rawResult = await matchedTool.invoke(args);
      const contentStr =
        typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult ?? { ok: true });
      const parsedResult = typeof rawResult === 'string' ? safeJsonParse(rawResult) : rawResult;

      if (auditRecord && toolCallRepo) {
        await toolCallRepo.updateResult(auditRecord.id, 'COMPLETED', parsedResult).catch(() => {});
      }
      if (client) {
        void client
          .call('toolCallEvent', [
            {
              runId,
              toolCallId,
              toolName,
              status: 'result',
              args,
              result: parsedResult,
            },
          ])
          .catch(() => {});
      }
      toolTraceSteps.push(`• Tool ${toolName}: completed`);
      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCallId,
          name: toolName,
          content: contentStr,
        }),
      );
    } catch (err) {
      const errorMsg = (err as Error)?.message || `Tool "${toolName}" execution failed.`;
      if (auditRecord && toolCallRepo) {
        await toolCallRepo.updateResult(auditRecord.id, 'FAILED', undefined, errorMsg).catch(() => {});
      }
      if (client) {
        void client
          .call('toolCallEvent', [
            {
              runId,
              toolCallId,
              toolName,
              status: 'error',
              args,
              error: errorMsg,
            },
          ])
          .catch(() => {});
      }
      toolTraceSteps.push(`• Tool ${toolName}: failed (${errorMsg})`);
      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCallId,
          name: toolName,
          content: JSON.stringify({ error: errorMsg }),
        }),
      );
    }
  }

  return {
    messages: toolMessages,
    toolIterations: (state.toolIterations ?? 0) + 1,
    toolTraceSteps,
  };
}

/**
 * Conditional router after `generateNode`: continue to `tools` when the LLM requested
 * tool calls and we are under `MAX_TOOL_ITERATIONS`; otherwise finish.
 */
export function shouldContinueTools(state: AgentGraphState): 'tools' | typeof END {
  if ((state.toolIterations ?? 0) >= MAX_TOOL_ITERATIONS) {
    return END;
  }
  const lastMessage = state.messages[state.messages.length - 1];
  if (
    lastMessage instanceof AIMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length > 0
  ) {
    return 'tools';
  }
  return END;
}
