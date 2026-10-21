/**
 * Minimal Telegram message shape used inside the Agent package.
 * Mirrors the subset of `MessageEntity` from `@telegenie/sdk` that
 * the Memory Engine and Retriever actually need.
 *
 * Passed to the agent worker via AgentWorkerApi.processNewMessages().
 * The full MessageEntity lives in @telegenie/sdk — do not import that
 * package from here (agent must not depend on sdk).
 */
export type AgentMessageRecord = {
  /** Composite SDK cache key: `${peerId}:${messageId}` */
  id: string;
  peerId: string;
  fromId?: string;
  /** Unix seconds (Telegram date field). */
  date: number;
  /** Plain text body of the message. Empty for service/empty messages. */
  message: string;
  /** True when sent by the current user. */
  out?: boolean;
};
