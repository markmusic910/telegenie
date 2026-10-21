import { observable, type ObservableMap } from 'mobx';
import { GlobalStoreSlice } from '../global-store.slice';
import { ThreadSlice } from './thread.slice';
import { type DialogUISnapshot, type DialogUIState } from './dialog.state';
import { MAIN_THREAD_ID, type ThreadUISnapshot } from './thread.state';

type MakeThread = (threadId: string, snapshot?: ThreadUISnapshot) => ThreadSlice;

/** Per-dialog UI: active thread and thread map. Message selection lives on `ThreadSlice`. */
export class DialogSlice extends GlobalStoreSlice implements DialogUIState {
  private readonly makeThread: MakeThread;

  activeThreadId = MAIN_THREAD_ID;
  unreadMentionIds: string[] = [];
  unreadReactionIds: string[] = [];
  /** Reactions the user already opened. Not persisted; blocks a stale server list from restoring them. */
  private seenReactionIds!: Set<string>;
  isPinnedViewOpen = false;
  pinnedMessageIds: number[] = [];
  pinnedMessagesCount = 0;
  currentPinnedIndex = 0;
  threads: ObservableMap<string, ThreadSlice>;

  constructor(makeThread: MakeThread, snapshot?: DialogUISnapshot) {
    super();
    this.makeThread = makeThread;
    this.threads = observable.map();
    this.applySnapshot(snapshot);
    this.observe({ makeThread: false, getThread: false });
    this.seenReactionIds = new Set();
  }

  markReactionsSeen(ids: readonly string[]): void {
    for (const id of ids) {
      if (id) this.seenReactionIds.add(id);
    }
  }

  hasSeenReaction(id: string): boolean {
    return this.seenReactionIds.has(id);
  }

  getThread(threadId: string): ThreadSlice | undefined {
    return this.threads.get(threadId);
  }

  getOrCreateThread(threadId: string): ThreadSlice {
    let thread = this.threads.get(threadId);
    if (!thread) {
      thread = this.makeThread(threadId);
      this.threads.set(threadId, thread);
    }
    return thread;
  }

  setActiveThreadId(threadId: string) {
    if (threadId !== this.activeThreadId) {
      // Selection mode belongs to the thread on screen.
      this.threads.get(this.activeThreadId)?.clearSelection();
    }
    this.activeThreadId = threadId;
  }

  deleteThread(threadId: string) {
    this.threads.delete(threadId);
    if (this.activeThreadId !== threadId) return;
    if (this.threads.has(MAIN_THREAD_ID)) {
      this.activeThreadId = MAIN_THREAD_ID;
      return;
    }
    const first = this.threads.keys().next().value;
    if (first) this.activeThreadId = first;
  }

  setUnreadMentionIds(ids: string[]) {
    this.unreadMentionIds = [...ids];
  }

  removeUnreadMentionIds(ids: string[]) {
    if (!ids.length) return;
    const remove = new Set(ids);
    this.unreadMentionIds = this.unreadMentionIds.filter((id) => !remove.has(id));
  }

  clearUnreadMentionIds() {
    this.unreadMentionIds = [];
  }

  setUnreadReactionIds(ids: string[]) {
    this.unreadReactionIds = [...ids];
  }

  removeUnreadReactionIds(ids: string[]) {
    if (!ids.length) return;
    const remove = new Set(ids);
    this.unreadReactionIds = this.unreadReactionIds.filter((id) => !remove.has(id));
  }

  clearUnreadReactionIds() {
    this.unreadReactionIds = [];
  }

  setPinnedViewOpen(open: boolean) {
    this.isPinnedViewOpen = open;
  }

  setPinnedMessages(ids: number[], count?: number) {
    this.pinnedMessageIds = [...ids];
    this.pinnedMessagesCount = count ?? ids.length;
    if (this.currentPinnedIndex >= this.pinnedMessageIds.length) {
      this.currentPinnedIndex = 0;
    }
  }

  setCurrentPinnedIndex(index: number) {
    if (this.pinnedMessageIds.length === 0) {
      this.currentPinnedIndex = 0;
      return;
    }
    this.currentPinnedIndex = index % this.pinnedMessageIds.length;
  }

  cyclePinnedIndex(): number | undefined {
    if (this.pinnedMessageIds.length === 0) return undefined;
    this.currentPinnedIndex = (this.currentPinnedIndex + 1) % this.pinnedMessageIds.length;
    return this.pinnedMessageIds[this.currentPinnedIndex];
  }

  clearPinnedMessages() {
    this.pinnedMessageIds = [];
    this.pinnedMessagesCount = 0;
    this.currentPinnedIndex = 0;
    this.isPinnedViewOpen = false;
  }

  toSnapshot(): DialogUISnapshot {
    const threads: Record<string, ThreadUISnapshot> = {};
    for (const [threadId, thread] of this.threads.entries()) {
      threads[threadId] = thread.toJS();
    }
    return {
      activeThreadId: this.activeThreadId,
      unreadMentionIds: this.unreadMentionIds.length ? this.unreadMentionIds.slice() : undefined,
      unreadReactionIds: this.unreadReactionIds.length ? this.unreadReactionIds.slice() : undefined,
      isPinnedViewOpen: this.isPinnedViewOpen,
      pinnedMessageIds: this.pinnedMessageIds.slice(),
      pinnedMessagesCount: this.pinnedMessagesCount,
      threads,
    };
  }

  toJS(): Record<string, unknown> {
    return this.toSnapshot();
  }

  hydrateFromSnapshot(snapshot: Record<string, unknown> | undefined) {
    this.applySnapshot(snapshot as DialogUISnapshot | undefined);
  }

  static fromSnapshot(makeThread: MakeThread, snapshot?: DialogUISnapshot): DialogSlice {
    return new DialogSlice(makeThread, snapshot);
  }

  private applySnapshot(snapshot?: DialogUISnapshot) {
    if (!snapshot) return;
    if (typeof snapshot.activeThreadId === 'string') {
      this.activeThreadId = snapshot.activeThreadId;
    }
    if (Array.isArray(snapshot.unreadMentionIds)) {
      this.unreadMentionIds = [...snapshot.unreadMentionIds];
    }
    if (Array.isArray(snapshot.unreadReactionIds)) {
      this.unreadReactionIds = [...snapshot.unreadReactionIds];
    }
    if (typeof snapshot.isPinnedViewOpen === 'boolean') {
      this.isPinnedViewOpen = snapshot.isPinnedViewOpen;
    }
    if (Array.isArray(snapshot.pinnedMessageIds)) {
      this.pinnedMessageIds = [...snapshot.pinnedMessageIds];
    }
    if (typeof snapshot.pinnedMessagesCount === 'number') {
      this.pinnedMessagesCount = snapshot.pinnedMessagesCount;
    }
    if (snapshot.threads) {
      this.threads.clear();
      for (const [threadId, threadSnap] of Object.entries(snapshot.threads)) {
        this.threads.set(threadId, this.makeThread(threadId, threadSnap));
      }
    }
  }
}
