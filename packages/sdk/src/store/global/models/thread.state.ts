import type { TypeMessageEntity } from '@telegenie/libs/foundation/telegram/types/api-types';
import type { MessageCacheIndex } from '../../utils/message-cache-index';
import type { FlatListItem } from '../../utils/message-grouper';

export const MAIN_THREAD_ID = '-1';

export interface MessageDraft {
  text: string;
  entities?: TypeMessageEntity[];
  replyToMsgId?: string;
}

/** Pending forward into this thread. Session-only — not part of {@link ThreadUISnapshot}. */
export type StagedForward = {
  fromPeerId: string;
  messageId: string;
  dropAuthor: boolean;
};

/** Persistable thread UI fields (no computeds, no store refs). */
export type ThreadUISnapshot = {
  scrollOffset?: number;
  scrollAnchorItemId?: string;
  scrollAnchorOffsetInItem?: number;
  scrollListedMinId?: string;
  scrollListedMaxId?: string;
  pinToBottom?: boolean;
  listedFollowsNewest?: boolean;
  pendingNewerCount?: number;
  unreadDividerId?: string;
  historyLoaded?: boolean;
  isLoadingHistory?: boolean;
  hasMoreHistory?: boolean;
  oldestMessageId?: string;
  listedIds?: string[];
  msgIndexes?: MessageCacheIndex;
  draft?: MessageDraft;
  editingId?: string;
  editingText?: string;
  replyingToId?: string;
  replyStack?: string[];
  focusedMessageId?: string;
  focusNoHighlight?: boolean;
  focusPending?: boolean;
  focusGeneration?: number;
};

/**
 * UI-facing thread state: observable fields plus computeds. No actions.
 * `hasMoreOlder` / `hasMoreNewer` / `flatItems` are class getters on `ThreadSlice`.
 */
export interface ThreadUIState {
  /** Distance from bottom: scrollHeight - scrollTop - viewportHeight */
  scrollOffset: number;
  /** First visible listed row used to restore scroll after remount / height changes */
  scrollAnchorItemId?: string;
  /** Pixels from the top of scrollAnchorItemId when the offset was saved */
  scrollAnchorOffsetInItem?: number;
  /** Listed window that the scroll anchor belongs to */
  scrollListedMinId?: string;
  scrollListedMaxId?: string;
  /**
   * Follow the live tail on the newest window: scroller is at the bottom and new
   * messages stay in view. Requires `listedFollowsNewest`. False when scrolled up
   * on the newest window or when viewing a historical `listedIds` island.
   */
  pinToBottom: boolean;
  /**
   * `listedIds` is still the live tail: opened/jumped to latest and the window
   * has not been slid (trim dropped the newest end) or replaced around an older id.
   * Stays true if the user only scrolls up *inside* this island (newest row off-viewport).
   * Updated only when `listedIds` changes — not when `topMessageId` patches alone.
   */
  listedFollowsNewest: boolean;
  /** Live arrivals while the newest message is off-viewport (jump-to-bottom badge). */
  pendingNewerCount: number;
  /** Anchor for 'Unread Messages' banner, frozen on chat open */
  unreadDividerId?: string;
  /** Initial around-fetch completed for this thread */
  historyLoaded?: boolean;
  /** History fetch in flight */
  isLoadingHistory?: boolean;
  /**
   * More older history may exist on the server beyond the cache start.
   * False means we have confirmed no older history exists on the server.
   */
  hasMoreHistory?: boolean;
  /**
   * Oldest message ID known for this chat/thread.
   * Recorded from message entity store or server history boundaries.
   */
  oldestMessageId?: string;
  /**
   * Computed: the listed window can still grow older. True while
   * `hasMoreHistory !== false`, or while `listedIds[0]` is not the oldest
   * message id. Not stored or persisted.
   */
  readonly hasMoreOlder: boolean;
  /**
   * Computed: `listedIds` max !== `dialog.topMessageId`.
   * Not stored or persisted. Not “left the newest window” — a live `topMessageId`
   * patch makes this true before `listedIds` catch up.
   */
  readonly hasMoreNewer: boolean;
  /** Contiguous listed window currently in the message scroller (existing messages only) */
  listedIds: string[];
  /**
   * Cache index for this thread (not the listed scroller window).
   * `listedIds` is only the on-screen island. `msgIndexes` remembers every
   * loaded/deleted id so scroll can slide listedIds from cache first.
   * Private chats: `breaksAfter` is an island split (left id not connected to
   * the next cached id) — fill with getHistory, never by enumerating ids.
   * Channels: `resolvedRanges` mark known ID spans; holes inside are deleted,
   * holes outside are unknown (getMessages).
   */
  msgIndexes: MessageCacheIndex;
  /** Active draft for this thread */
  draft?: MessageDraft;
  /** Message ID currently being edited inline */
  editingId?: string;
  /** Composer buffer for the in-progress edit. Not synced as a server draft. */
  editingText?: string;
  /** Message ID being replied to in the composer */
  replyingToId?: string;
  /**
   * Forward waiting in the composer. Not persisted: a reload must not keep it.
   */
  forwarding?: StagedForward;
  /**
   * Message selection mode for this thread (copy / delete). Session-only: not
   * persisted. True while the toolbar is up, even with zero ids selected.
   */
  readonly isSelectMode: boolean;
  /** Selected message ids in selection order. The last one anchors shift-range. */
  readonly selectedMessageIds: readonly string[];
  isMessageSelected(messageId: string): boolean;
  /**
   * Back trail of quote taps in this thread — not a walk of the reply linked list.
   * Tapping a quote pushes the message you were on; `focusNextReply` pops it to
   * jump back. Empty stack means return to the bottom. Cleared on dialog change.
   */
  replyStack: string[];
  /** Message to flash/highlight (search jump, reply jump) */
  focusedMessageId?: string;
  /** Skip highlight ring when scrolling (reply-stack unwind, unread open, scroll-to-bottom) */
  focusNoHighlight?: boolean;
  /** Waiting for history fetch before scrolling to focused message */
  focusPending?: boolean;
  /** Monotonic counter to cancel stale scroll/highlight attempts */
  focusGeneration: number;
  /**
   * Session-only. True while an animated scroll, jump, or focus transition is running in this thread.
   * Silences intersection observers (history triggers, read marking, emoji decoders).
   */
  isScrollFrozen?: boolean;
  /** Listed scroller rows for this thread (computed from `listedIds` × message store). */
  readonly flatItems: FlatListItem[];
}
