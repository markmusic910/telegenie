import type { ThreadUISnapshot, ThreadUIState } from './thread.state';

/** Persistable dialog UI fields. */
export type DialogUISnapshot = {
  activeThreadId?: string;
  /** Cached unread mention message ids (client-side, from GetUnreadMentions). */
  unreadMentionIds?: string[];
  /** Cached unread reaction message ids (client-side, from GetUnreadReactions). */
  unreadReactionIds?: string[];
  isPinnedViewOpen?: boolean;
  pinnedMessageIds?: number[];
  pinnedMessagesCount?: number;
  threads?: Record<string, ThreadUISnapshot>;
};

/** UI-facing dialog chrome: active thread, unread/pinned caches. No allocate-on-read. */
export interface DialogUIState {
  /** Currently active thread ID ('-1' for main chat, or topic/comment root ID) */
  readonly activeThreadId: string;
  /** Cached unread mention message ids for jump-to-mention FAB. */
  readonly unreadMentionIds: readonly string[];
  /** Cached unread reaction message ids for jump-to-reaction FAB. */
  readonly unreadReactionIds: readonly string[];
  /** Pinned message view state */
  readonly isPinnedViewOpen: boolean;
  readonly pinnedMessageIds: readonly number[];
  readonly pinnedMessagesCount: number;
  readonly currentPinnedIndex: number;
  getThread(threadId: string): ThreadUIState | undefined;
}
