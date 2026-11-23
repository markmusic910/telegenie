import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';
import { ContextBuilder, DEFAULT_TONE_PROMPTS } from '../runtime/context-builder';
import type { Retriever } from '../runtime/retriever';
import type {
  AgentMessageRecord,
  DialogMemoryContext,
} from '../types/agent-message-record';
import type {
  InputCompletionOption,
  InputCompletionRequest,
  InputCompletionResult,
} from '../worker/agent.api';
import { getWorkerState } from '../worker/agent-worker-init';
import { createChatModel } from './models';
import { extractText } from './nodes';
import { resolveAgentTools } from './tools';

export const COMPOSER_TOOL_SUGGEST_INPUT_COMPLETIONS = 'suggest_input_completions';

const contextBuilder = new ContextBuilder();

export type RunInputCompletionDeps = {
  retriever?: Retriever;
  createModel?: typeof createChatModel;
  resolveTools?: typeof resolveAgentTools;
};

type ResolvedReplyContext = {
  id: string;
  text: string;
  senderName?: string;
  out?: boolean;
};

type ResolvedEditingContext = {
  id: string;
  originalText: string;
};

function matchesMessageId(record: AgentMessageRecord, peerId: string, messageId: string): boolean {
  return record.id === messageId || record.id === `${peerId}:${messageId}`;
}

function normalizeOptions(raw: unknown, maxOptions: number): InputCompletionOption[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: InputCompletionOption[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const text = item.trim();
      if (text && !seen.has(text)) {
        seen.add(text);
        out.push({ text });
      }
    } else if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      const text = typeof rec.text === 'string' ? rec.text.trim() : '';
      const label = typeof rec.label === 'string' && rec.label.trim() ? rec.label.trim() : undefined;
      if (text && !seen.has(text)) {
        seen.add(text);
        out.push(label ? { text, label } : { text });
      }
    }
    if (out.length >= maxOptions) break;
  }
  return out;
}

function parseFallbackOptions(rawText: string, maxOptions: number): InputCompletionOption[] {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!cleaned) return [];

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (Array.isArray(parsed)) {
      return normalizeOptions(parsed, maxOptions);
    }
    if (parsed && typeof parsed === 'object' && 'suggestions' in (parsed as Record<string, unknown>)) {
      return normalizeOptions((parsed as Record<string, unknown>).suggestions, maxOptions);
    }
  } catch {
    // Fall back to line-based extraction if not valid JSON
  }

  const lines = cleaned
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  return normalizeOptions(lines, maxOptions);
}

function buildCompletionPrompts(params: {
  request: InputCompletionRequest;
  replyTo?: ResolvedReplyContext;
  editing?: ResolvedEditingContext;
  contextText: string;
  userIdentity?: string;
  maxOptions: number;
  hasSuggestTool: boolean;
}): { system: string; user: string } {
  const { request, replyTo, editing, contextText, userIdentity, maxOptions, hasSuggestTool } = params;
  const systemParts: string[] = [
    `You are TeleGenie's inline message completion assistant inside a Telegram chat composer.`,
    `Your job is to propose ${maxOptions} distinct, natural, ready-to-send message options for the user.`,
    `Guidelines:
- Match the language, style, and register of the conversation and the user's draft.
- If the user has already started typing in the input box, provide ${maxOptions} full completed/refined versions that naturally continue or polish their draft (do not return only a fragment — return the complete message ready to place into the input box).
- If the input box is empty, propose ${maxOptions} contextual reply options based on the recent messages and any message being replied to.
- If the user is replying to a specific message, directly address that message.
- If the user is editing an existing message, propose improved/completed versions of the edit.
- Vary the options slightly (e.g. "Natural", "Concise", "Warm" or similar 1-2 word labels).
- Keep messages concise and authentic to Telegram chat — avoid robotic or overly formal phrasing unless the dialog tone calls for it.`,
  ];

  if (hasSuggestTool) {
    systemParts.push(
      `You MUST deliver the options by calling the \`${COMPOSER_TOOL_SUGGEST_INPUT_COMPLETIONS}\` tool with a \`suggestions\` array of ${maxOptions} objects ({ text, label }).`,
    );
  } else {
    systemParts.push(
      `Return ONLY valid JSON: { "suggestions": [{ "text": "...", "label": "..." }] } with ${maxOptions} items.`,
    );
  }

  if (userIdentity?.trim()) {
    systemParts.push(`## User Identity (USER.md)\n${userIdentity.trim()}`);
  }

  if (contextText.trim()) {
    systemParts.push(`## Dialog Context, Memories & Recent Messages\n${contextText}`);
  }

  const composerLines: string[] = ['## Current Composer State'];
  if (replyTo) {
    const sender = replyTo.out
      ? 'Me'
      : replyTo.senderName || 'Participant';
    composerLines.push(`- Replying to message from ${sender}: "${replyTo.text}"`);
  }
  if (editing) {
    composerLines.push(`- Editing existing message (original): "${editing.originalText}"`);
  }
  if (request.currentInput.trim()) {
    composerLines.push(`- User's current draft in input box: "${request.currentInput}"`);
    composerLines.push(
      `\nGenerate ${maxOptions} distinct full completions/continuations of the user's draft above.`,
    );
  } else {
    composerLines.push(`- User's current draft in input box: (empty)`);
    composerLines.push(
      `\nGenerate ${maxOptions} distinct contextual reply options for this chat.`,
    );
  }

  return {
    system: systemParts.join('\n\n'),
    user: composerLines.join('\n'),
  };
}

/**
 * Execute a Tab-triggered composer input completion inside the agent worker.
 * Assembles recent messages, reply-to/editing messages, dialog context, preset,
 * user identity, and relevant memories via Retriever, then invokes the `'composer'`-scoped
 * tab tool (`suggest_input_completions`) so the composer renders multiple selectable options.
 */
export async function runInputCompletion(
  request: InputCompletionRequest,
  deps: RunInputCompletionDeps = {},
): Promise<InputCompletionResult> {
  const maxOptions = Math.min(Math.max(request.maxOptions ?? 3, 1), 4);
  const runId = `complete_${uuidv4()}`;

  let retriever = deps.retriever;
  let installedSkills: import('../agent-db/agent-db.types').GenieSkill[] = [];
  let userIdentity: string | undefined;

  try {
    const state = getWorkerState();
    retriever ??= state.retriever;
    installedSkills = state.installedSkills || [];
    userIdentity = state.userIdentity;
  } catch {
    // Standalone test mode
  }

  // 1. Assemble recent messages, reply-to/editing messages, dialog preset, and dialog context in worker
  const [dialogPreset, recentDesc] = retriever
    ? await Promise.all([
        retriever.getDialogPreset(request.peerId).catch(() => undefined),
        retriever.getConversation(request.peerId, 20).catch(() => []),
      ])
    : [undefined, [] as AgentMessageRecord[]];

  const recentMessages = [...recentDesc].sort((a, b) => a.date - b.date);

  let replyMsg: AgentMessageRecord | undefined;
  if (request.replyToMessageId) {
    replyMsg =
      recentMessages.find((m) => matchesMessageId(m, request.peerId, request.replyToMessageId!)) ??
      (await retriever?.getMessageById(request.peerId, request.replyToMessageId).catch(() => undefined));
  }

  let editMsg: AgentMessageRecord | undefined;
  if (request.editingMessageId) {
    editMsg =
      recentMessages.find((m) => matchesMessageId(m, request.peerId, request.editingMessageId!)) ??
      (await retriever?.getMessageById(request.peerId, request.editingMessageId).catch(() => undefined));
  }

  const contextMessages = replyMsg && !recentMessages.some((m) => m.id === replyMsg!.id)
    ? [...recentMessages, replyMsg]
    : recentMessages;

  const dialogContext: DialogMemoryContext | undefined = retriever
    ? await retriever
        .getDialogContext(request.peerId, contextMessages)
        .catch(() => ({ peerId: request.peerId }))
    : { peerId: request.peerId };

  let replyTo: ResolvedReplyContext | undefined;
  if (replyMsg && replyMsg.message?.trim()) {
    const senderInfo = replyMsg.fromId ? dialogContext?.peers?.[replyMsg.fromId] : undefined;
    replyTo = {
      id: replyMsg.id,
      text: replyMsg.message.trim(),
      ...(senderInfo?.name ? { senderName: senderInfo.name } : {}),
      out: replyMsg.out,
    };
  }

  const editing: ResolvedEditingContext | undefined = editMsg
    ? { id: editMsg.id, originalText: editMsg.message ?? '' }
    : undefined;

  const latestMessageText = recentMessages[recentMessages.length - 1]?.message ?? '';
  const memoryQuery = [request.currentInput, replyTo?.text, latestMessageText]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(' ')
    .slice(0, 300);

  const graphResult =
    retriever && memoryQuery.trim()
      ? await retriever
          .searchKnowledgeGraph(memoryQuery, request.peerId)
          .catch(() => ({ memories: [], entities: [] }))
      : { memories: [], entities: [] };

  const activeSkillIds = new Set(dialogPreset?.skills || []);
  const activeSkills = installedSkills.filter((s) => activeSkillIds.has(s.id));

  let contextText = contextBuilder.build({
    memories: graphResult.memories,
    messages: recentMessages,
    entities: graphResult.entities,
    peerId: request.peerId,
    dialogContext,
    dialogPreset,
    activeSkills,
    userIdentity,
  });

  if (dialogPreset?.tone) {
    const toneDirective =
      DEFAULT_TONE_PROMPTS[dialogPreset.tone.toLowerCase().trim()] ||
      `Tone: ${dialogPreset.tone}`;
    contextText = `${contextText}\n\nPreferred Dialog Tone: ${toneDirective}`;
  }

  // 2. Resolve composer-scoped tab tools
  const resolveToolsFn = deps.resolveTools ?? resolveAgentTools;
  const { tools: composerTools, toolsByName } = resolveToolsFn({
    context: { runId, peerId: request.peerId },
    scope: 'composer',
  });
  const hasSuggestTool = toolsByName.has(COMPOSER_TOOL_SUGGEST_INPUT_COMPLETIONS);

  const { system, user } = buildCompletionPrompts({
    request,
    replyTo,
    editing,
    contextText,
    userIdentity,
    maxOptions,
    hasSuggestTool,
  });

  // 3. Call LLM with composer tool bound
  const createModelFn = deps.createModel ?? createChatModel;
  const baseModel = createModelFn({
    ...(request.model ? { model: request.model } : {}),
    temperature: 0.7,
    costSource: 'input completion',
    traceId: runId,
  });

  const runnable =
    composerTools.length > 0 && typeof baseModel.bindTools === 'function'
      ? baseModel.bindTools(composerTools)
      : baseModel;

  const response = (await runnable.invoke([
    new SystemMessage(system),
    new HumanMessage(user),
  ])) as AIMessage;

  // 4. Execute composer tool call (pushes suggestions directly to MessageComposer via TabPageApi)
  const toolCalls = Array.isArray(response.tool_calls) ? response.tool_calls : [];
  for (const tc of toolCalls) {
    const matchedTool = toolsByName.get(tc.name);
    if (!matchedTool) continue;
    try {
      await matchedTool.invoke(tc.args ?? {});
    } catch (err) {
      console.warn(`[InputCompletion] Composer tool "${tc.name}" invocation failed:`, err);
    }
    if (tc.name === COMPOSER_TOOL_SUGGEST_INPUT_COMPLETIONS) {
      const argsObj = (tc.args ?? {}) as Record<string, unknown>;
      const options = normalizeOptions(argsObj.suggestions, maxOptions);
      if (options.length > 0) {
        return { options };
      }
    }
  }

  // 5. Fallback: parse JSON/text response if model didn't invoke the tool
  const fallbackOptions = parseFallbackOptions(extractText(response.content), maxOptions);
  if (fallbackOptions.length > 0 && hasSuggestTool) {
    const suggestTool = toolsByName.get(COMPOSER_TOOL_SUGGEST_INPUT_COMPLETIONS);
    try {
      await suggestTool?.invoke({ suggestions: fallbackOptions });
    } catch {
      // ignore fallback push error; still return options
    }
  }

  return { options: fallbackOptions };
}
