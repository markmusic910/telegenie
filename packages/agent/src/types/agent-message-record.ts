export type DialogPeerKind = 'user' | 'chat' | 'channel';

export type DialogParticipantInfo = {
  /** Bot-API style peer ID (e.g. "12345678", "-1001234567890"). */
  id: string;
  /** Display name (e.g. "Alice Smith" or group/channel title). */
  name?: string;
  /** Telegram handle without leading '@' (e.g. "alice_s"). */
  username?: string;
  type?: DialogPeerKind;
  /** True when this participant is the logged-in user. */
  isSelf?: boolean;
};

/**
 * Dialog-level metadata and participant lookup map for a batch of messages in one dialog.
 * `peers` is scoped strictly to the peers referenced in the current message batch
 * (`fromId`, `replyTo.fromId`, `fwdFrom.fromId`, `mentions[].peerId`, plus current user).
 */
export type DialogMemoryContext = {
  peerId: string;
  peerName?: string;
  peerType?: DialogPeerKind;
  /** Optional forum topic directory keyed by threadId/topicId. */
  topics?: Record<string, { title: string }>;
  /** Scoped participant map keyed by Bot-API style peerId. */
  peers?: Record<string, DialogParticipantInfo>;
};

export type AgentMessageReplyContext = {
  /** Target message ID (numeric string or composite `${peerId}:${msgId}`). */
  messageId: string;
  /** Sender peerId of the replied-to message (if known). */
  fromId?: string;
  /** Quoted text or summary preview of the replied-to message. */
  quoteText?: string;
};

export type AgentMessageMention = {
  /** Resolved Telegram peerId if available (e.g. from MessageEntityMentionName or store lookup). */
  peerId?: string;
  /** Username without '@' if mentioned via @handle. */
  username?: string;
  /** Raw surface text in the message (e.g. "@alice" or "Alice"). */
  text: string;
};

export type AgentMessageForwardContext = {
  fromId?: string;
  fromName?: string;
  date?: number;
};

export type AgentMessageMediaContext = {
  /** e.g. 'photo' | 'video' | 'document' | 'voice' | 'poll' | 'location' | 'contact' | 'invoice' */
  type: string;
  fileName?: string;
  /** Human-readable summary (e.g. poll question, document title, contact name). */
  summary?: string;
};

/**
 * Minimal Telegram message shape used inside the Agent package.
 * Mirrors the subset of `MessageEntity` from `@telegenie/sdk` that
 * the Memory Engine and Retriever actually need.
 *
 * Passed to the agent worker via AgentWorkerApi.processNewMessages() / processMessagesWithCost().
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
  /** Forum topic / reply thread identifier if the message belongs to a thread. */
  threadId?: string;
  /** Reply header and quoted/target message preview when replying to another message. */
  replyTo?: AgentMessageReplyContext;
  /** Explicit @mentions or user text-mentions within the message. */
  mentions?: AgentMessageMention[];
  /** Forwarding provenance when the message was forwarded from another source. */
  fwdFrom?: AgentMessageForwardContext;
  /** Attachment / media metadata when the message includes non-text media. */
  media?: AgentMessageMediaContext;
};
