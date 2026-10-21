import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import type { Memory, Commitment } from '../memory/db/memory-db.types';
import type { AgentMessageRecord } from '../types/agent-message-record';

/**
 * Graph state for the TeleGenie Phase 1 agent.
 *
 * Channels:
 * - `messages` — full conversation history (from MessagesAnnotation)
 * - `intent` — classified intent string (e.g. "FOLLOW_UP", "PREFERENCE", "FACT")
 * - `retrievedMemories` — memories retrieved from telegenie-memory DB
 * - `retrievedCommitments` — commitments retrieved from telegenie-memory DB
 * - `retrievedMessages` — raw Telegram messages retrieved from telegenie-sdk-cache
 * - `runId` — the AgentRun.id written to telegenie-agent DB for audit
 */
export const AgentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  intent: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  retrievedMemories: Annotation<Memory[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  retrievedCommitments: Annotation<Commitment[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  retrievedMessages: Annotation<AgentMessageRecord[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  runId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  peerId: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  dialogPreset: Annotation<import('../agent-db/agent-db.types').DialogPreset | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
});

export type AgentGraphState = typeof AgentStateAnnotation.State;
