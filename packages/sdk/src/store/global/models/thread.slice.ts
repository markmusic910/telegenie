import { observable } from 'mobx';
import type { Channel } from '../../entity/models/channel.model';
import type { Dialog } from '../../entity/models/dialog.model';
import type { Message } from '../../entity/models/message.model';
import type { MessageStore } from '../../types';
import { GlobalStoreSlice } from '../global-store.slice';
import {
  LISTED_WINDOW_MAX,
  MESSAGE_LIST_SLICE,
  MESSAGE_LIST_VIEWPORT_LIMIT,
  getViewportSlice,
  listedIdsFromMessages,
  mergeListedIds,
  removeListedIds,
  sortMessageIds,
} from '../../utils/listed-message-ids';
import {
  coerceMessageCacheIndex,
  emptyMessageCacheIndex,
  ingestChannelSpan,
  ingestHistorySlice,
  ingestLiveIds,
  isCachedId,
  markCachedDeleted,
  reconcileIndex,
  takeCachedAround,
  takeCachedNewest,
  takeCachedRun,
  type HistoryIngestDirection,
  type MessageCacheIndex,
  type MessageCacheKind,
} from '../../utils/message-cache-index';
import { buildFlatMessageItems, type FlatListItem } from '../../utils/message-grouper';
import type { MessageScrollAnchor } from '../../utils/message-scroll-anchor';
import type { MessageDraft, StagedForward, ThreadUISnapshot, ThreadUIState } from './thread.state';

export type ThreadSliceContext = {
  peerId: string;
  getTopMessageId: () => string | undefined;
  getDialog: () => Dialog | undefined;
  getChannel: () => Channel | undefined;
  getMessageStore: () => MessageStore | undefined;
};

/** Per-thread listed window, cache index, viewport, composer, and focus. */
export class ThreadSlice extends GlobalStoreSlice implements ThreadUIState {
  private readonly ctx: ThreadSliceContext;

  scrollOffset = 0;
  scrollAnchorItemId?: string;
  scrollAnchorOffsetInItem?: number;
  scrollListedMinId?: string;
  scrollListedMaxId?: string;
  pinToBottom = true;
  listedFollowsNewest = true;
  pendingNewerCount = 0;
  unreadDividerId?: string;
  historyLoaded?: boolean = false;
  isLoadingHistory?: boolean = false;
  hasMoreHistory?: boolean = true;
  oldestMessageId?: string;
  listedIds: string[] = [];
  msgIndexes: MessageCacheIndex = emptyMessageCacheIndex();
  draft?: MessageDraft;
  editingId?: string;
  editingText?: string;
  replyingToId?: string;
  /** Session-only. Omitted from {@link toSnapshot}. */
  forwarding?: StagedForward;
  replyStack: string[] = [];
  /** Session-only. Omitted from {@link toSnapshot}. */
  isSelectMode = false;
  /** Session-only. A set so a toggle only notifies rows reading that id. */
  private readonly selectedIdSet = observable.set<string>();
  focusedMessageId?: string;
  focusNoHighlight?: boolean;
  focusPending?: boolean;
  focusGeneration = 0;
  /** Session-only. Omitted from {@link toSnapshot}. */
  isScrollFrozen = false;

  constructor(ctx: ThreadSliceContext, snapshot?: ThreadUISnapshot) {
    super();
    this.ctx = ctx;
    this.applySnapshot(snapshot);
    this.observe({ ctx: false, getMessageList: false });
  }

  get minStoreMessageId(): string | undefined {
    const messageStore = this.ctx.getMessageStore();
    if (!messageStore) return undefined;
    let minId: number | undefined;
    for (const message of messageStore.getAllData().values()) {
      if (message.isEmpty || !(message.date && message.date > 0)) continue;
      const id = Number(message.id);
      if (Number.isFinite(id) && id > 0) {
        if (minId === undefined || id < minId) {
          minId = id;
        }
      }
    }
    return minId !== undefined ? String(minId) : undefined;
  }

  get effectiveOldestMessageId(): string | undefined {
    const storeMin = this.minStoreMessageId;
    if (this.oldestMessageId && storeMin) {
      return Number(this.oldestMessageId) < Number(storeMin)
        ? this.oldestMessageId
        : storeMin;
    }
    return this.oldestMessageId ?? storeMin;
  }

  get hasMoreOlder(): boolean {
    if (this.hasMoreHistory) return true;
    const listedMin = this.listedIds[0];
    const oldestId = this.effectiveOldestMessageId;
    return Boolean(listedMin && oldestId != null && Number(listedMin) > Number(oldestId));
  }

  get hasMoreNewer(): boolean {
    const listedMax = this.listedIds[this.listedIds.length - 1];
    const topId = this.ctx.getTopMessageId();
    return Boolean(listedMax && topId && listedMax !== topId);
  }

  get flatItems(): FlatListItem[] {
    return this.getMessageList();
  }

  getMessageList(customMessages?: Iterable<Message>, customIsGroup?: boolean): FlatListItem[] {
    const messageStore = this.ctx.getMessageStore();
    let messages: Iterable<Message>;
    if (customMessages) {
      messages = customMessages;
    } else if (messageStore) {
      if (this.listedIds.length > 0) {
        const data = messageStore.getAllData();
        messages = this.listedIds
          .map((id) => data.get(id) as Message | undefined)
          .filter((message): message is Message =>
            Boolean(message && !message.isEmpty && message.date),
          );
      } else {
        messages = [];
      }
    } else {
      messages = [];
    }

    const dialog = this.ctx.getDialog();
    const channel = this.ctx.getChannel();
    const isGroup =
      customIsGroup ??
      (dialog?.peerKind === 'chat' || (dialog?.peerKind === 'channel' && !channel?.broadcast));

    return buildFlatMessageItems(messages, isGroup, {
      unreadDividerBeforeId: this.unreadDividerId,
    });
  }

  setDraft(draft: MessageDraft | undefined) {
    this.draft = draft;
  }

  setEditingId(messageId: string | undefined) {
    this.editingId = messageId;
  }

  setEditingText(text: string | undefined) {
    this.editingText = text;
  }

  setReplyingToId(messageId: string | undefined) {
    this.replyingToId = messageId;
  }

  setForwarding(forwarding: StagedForward | undefined) {
    this.forwarding = forwarding;
  }

  get selectedMessageIds(): string[] {
    return Array.from(this.selectedIdSet);
  }

  isMessageSelected(messageId: string): boolean {
    return this.selectedIdSet.has(messageId);
  }

  /** Turn selection mode on, optionally selecting `ids` right away. */
  enterSelectMode(ids: readonly string[] = []) {
    this.isSelectMode = true;
    for (const id of ids) this.selectedIdSet.add(id);
  }

  /**
   * Toggle one row (an album passes all its ids). If every id is already
   * selected they are removed; otherwise they are added, plus `range` for a
   * shift-click. Leaves select mode when the last id is removed.
   */
  toggleSelected(ids: readonly string[], range?: readonly string[]) {
    if (ids.length === 0) return;
    this.isSelectMode = true;
    const allSelected = ids.every((id) => this.selectedIdSet.has(id));
    if (allSelected) {
      for (const id of ids) this.selectedIdSet.delete(id);
      if (this.selectedIdSet.size === 0) this.isSelectMode = false;
      return;
    }
    for (const id of range ?? []) this.selectedIdSet.add(id);
    for (const id of ids) this.selectedIdSet.add(id);
  }

  /** Drop ids that no longer exist. Leaves select mode if that empties the set. */
  pruneSelected(ids: readonly string[]) {
    let removed = false;
    for (const id of ids) {
      if (this.selectedIdSet.delete(id)) removed = true;
    }
    if (removed && this.selectedIdSet.size === 0) this.isSelectMode = false;
  }

  clearSelection() {
    this.selectedIdSet.clear();
    this.isSelectMode = false;
  }

  pushReplyStack(messageId: string) {
    this.replyStack.push(messageId);
  }

  popReplyStack(): string | undefined {
    return this.replyStack.pop();
  }

  clearReplyStack() {
    this.replyStack.length = 0;
  }

  beginFocus(messageId: string, opts?: { noHighlight?: boolean }): number {
    this.focusGeneration += 1;
    this.focusedMessageId = messageId;
    this.focusNoHighlight = opts?.noHighlight ?? false;
    this.focusPending = true;
    this.pinToBottom = false;
    return this.focusGeneration;
  }

  setFocusPending(pending: boolean) {
    this.focusPending = pending;
  }

  clearFocus() {
    this.focusedMessageId = undefined;
    this.focusNoHighlight = undefined;
    this.focusPending = undefined;
  }

  setScrollFrozen(frozen: boolean) {
    this.isScrollFrozen = frozen;
  }

  recordScrollOffset(scrollOffset: number) {
    if (this.scrollOffset === scrollOffset) return;
    this.scrollOffset = scrollOffset;
  }

  setScrollOffset(scrollOffset: number, anchor?: MessageScrollAnchor | null) {
    this.scrollOffset = scrollOffset;
    const pinned = this.listedFollowsNewest && scrollOffset <= 50;
    this.pinToBottom = pinned;
    this.scrollListedMinId = this.listedIds[0];
    this.scrollListedMaxId = this.listedIds[this.listedIds.length - 1];
    if (this.pinToBottom || anchor === null) {
      this.scrollAnchorItemId = undefined;
      this.scrollAnchorOffsetInItem = undefined;
      return;
    }
    if (anchor) {
      this.scrollAnchorItemId = anchor.itemId;
      this.scrollAnchorOffsetInItem = anchor.offsetInItem;
    }
  }

  setPinToBottom(pinned: boolean) {
    if (pinned && !this.listedFollowsNewest) return;
    if (this.pinToBottom === pinned) return;
    this.pinToBottom = pinned;
  }

  finishJumpToBottom() {
    this.listedFollowsNewest = true;
    this.pendingNewerCount = 0;
    this.pinToBottom = true;
    this.clearFocus();
  }

  setListedFollowsNewest(follows: boolean) {
    this.listedFollowsNewest = follows;
  }

  setPendingNewerCount(count: number) {
    this.pendingNewerCount = count;
  }

  setHistoryState(
    patch: Partial<
      Pick<
        ThreadUIState,
        'historyLoaded' | 'isLoadingHistory' | 'hasMoreHistory' | 'oldestMessageId'
      >
    >,
  ) {
    if (patch.historyLoaded !== undefined) this.historyLoaded = patch.historyLoaded;
    if (patch.isLoadingHistory !== undefined) this.isLoadingHistory = patch.isLoadingHistory;
    if (patch.hasMoreHistory !== undefined) this.hasMoreHistory = patch.hasMoreHistory;
    if (patch.oldestMessageId !== undefined) this.oldestMessageId = patch.oldestMessageId;
  }

  setOldestMessageId(messageId?: string) {
    this.oldestMessageId = messageId;
  }

  updateOldestMessageId(messageId: string | number) {
    const idNum = Number(messageId);
    if (!Number.isFinite(idNum) || idNum <= 0) return;
    if (this.oldestMessageId === undefined || idNum < Number(this.oldestMessageId)) {
      this.oldestMessageId = String(idNum);
    }
  }

  /** Place the session divider from current unread state. Call on dialog open only. */
  freezeUnreadDivider() {
    const dialog = this.ctx.getDialog();
    if (!dialog || (dialog.unreadCount <= 0 && !dialog.unreadMark)) {
      this.unreadDividerId = undefined;
      return;
    }

    const readMax = dialog.readInboxMaxId ?? 0;
    const messageStore = this.ctx.getMessageStore();
    if (!messageStore) return;

    const listed = this.listedIds;
    const source =
      listed.length > 0
        ? listed
            .map((id) => messageStore.getAllData().get(id) as Message | undefined)
            .filter((m): m is Message => Boolean(m))
        : Array.from(messageStore.getAllData().values());
    const sorted = source
      .filter((m) => !m.isEmpty && m.date > 0 && !m.out)
      .sort((a, b) => Number(a.id) - Number(b.id));

    const firstUnread = sorted.find((m) => Number(m.id) > readMax);
    this.unreadDividerId = firstUnread ? String(firstUnread.id) : undefined;
  }

  resetThreadHistoryState() {
    this.historyLoaded = false;
    this.isLoadingHistory = false;
    this.hasMoreHistory = true;
    this.oldestMessageId = undefined;
    this.listedIds = [];
    this.unreadDividerId = undefined;
    this.scrollOffset = 0;
    this.pinToBottom = true;
    this.listedFollowsNewest = true;
    this.pendingNewerCount = 0;
    this.scrollAnchorItemId = undefined;
    this.scrollAnchorOffsetInItem = undefined;
    this.scrollListedMinId = undefined;
    this.scrollListedMaxId = undefined;
  }

  isMessageListed(messageId: string): boolean {
    return this.listedIds.includes(messageId);
  }

  replaceListedWindow(ids: string[], anchorId?: string) {
    if (anchorId != null) {
      this.listedIds = getViewportSlice(sortMessageIds(ids), anchorId, 'around').newViewportIds;
    } else {
      this.listedIds = sortMessageIds(ids);
    }
    this.syncListedWindowFlags();
  }

  prependListedIds(ids: string[], offsetId?: string) {
    if (ids.length === 0) return;
    const merged = mergeListedIds(ids, this.listedIds);
    if (merged.length === this.listedIds.length) return;
    const edge = offsetId ?? this.listedIds[0];
    this.listedIds = getViewportSlice(merged, edge, 'backwards').newViewportIds;
    this.syncListedWindowFlags();
  }

  appendListedIds(ids: string[], offsetId?: string) {
    if (ids.length === 0) return;
    const merged = mergeListedIds(this.listedIds, ids);
    if (merged.length === this.listedIds.length) return;
    const edge = offsetId ?? this.listedIds[this.listedIds.length - 1];
    this.listedIds = getViewportSlice(merged, edge, 'forwards').newViewportIds;
    this.syncListedWindowFlags();
  }

  dropListedIds(ids: string[]) {
    if (this.listedIds.length === 0 || ids.length === 0) return;
    this.listedIds = removeListedIds(this.listedIds, ids);
    this.syncListedWindowFlags();
  }

  appendLiveMessage(messageId: string) {
    if (this.listedIds.includes(messageId)) return;
    if (this.listedIds.length === 0 && !this.historyLoaded) return;
    if (!this.listedFollowsNewest) {
      this.pendingNewerCount += 1;
      return;
    }
    this.listedIds = mergeListedIds(this.listedIds, [messageId]);
    if (!this.pinToBottom) this.pendingNewerCount += 1;
  }

  applyListedMessages(
    messages: Iterable<{ id: string | number; isEmpty?: boolean; date?: number; peerId?: string }>,
    mode: 'replace' | 'prepend' | 'append',
    anchorId?: string,
  ) {
    for (const message of messages) {
      if (!message.isEmpty && message.date && message.date > 0) {
        this.updateOldestMessageId(message.id);
      }
    }
    const ids = listedIdsFromMessages(messages, this.ctx.peerId);
    if (mode === 'replace') {
      this.replaceListedWindow(ids, anchorId);
      return;
    }
    if (mode === 'prepend') {
      this.prependListedIds(ids, anchorId);
      return;
    }
    this.appendListedIds(ids, anchorId);
  }

  ingestHistorySlice(
    ids: number[],
    opts: {
      edgeId?: number;
      direction?: HistoryIngestDirection;
      reachedEnd?: boolean;
    } = {},
  ) {
    this.msgIndexes = ingestHistorySlice(this.msgIndexes, ids, { edgeId: opts.edgeId });
    if (ids.length > 0) {
      const minId = Math.min(...ids);
      if (Number.isFinite(minId) && minId > 0) {
        this.updateOldestMessageId(minId);
      }
    }
    if (opts.reachedEnd && opts.direction === 'older') {
      const oldest = this.effectiveOldestMessageId;
      if (oldest != null && (opts.edgeId == null || opts.edgeId === Number(oldest))) {
        this.hasMoreHistory = false;
        this.oldestMessageId = oldest;
      }
    }
  }

  ingestChannelSpan(span: {
    min: number;
    max: number;
    cachedIds: number[];
    deletedIds?: number[];
  }) {
    this.msgIndexes = ingestChannelSpan(
      this.msgIndexes,
      span.min,
      span.max,
      span.cachedIds,
      span.deletedIds,
    );
  }

  markCachedDeleted(ids: Array<string | number>) {
    const numeric = ids.map(Number).filter((id) => Number.isFinite(id) && id > 0);
    if (numeric.length === 0) return;
    this.msgIndexes = markCachedDeleted(this.msgIndexes, numeric);
    this.dropListedIds(numeric.map(String));
  }

  ingestLiveMessage(messageId: string) {
    const id = Number(messageId);
    if (!Number.isFinite(id) || id <= 0) return;
    this.updateOldestMessageId(id);
    this.msgIndexes = ingestLiveIds(this.msgIndexes, [id]);
    this.appendLiveMessage(messageId);
  }

  takeCachedRun(fromId: number, direction: 'older' | 'newer', limit: number): number[] {
    return takeCachedRun(this.msgIndexes, fromId, direction, limit, this.messageCacheKind());
  }

  slideListedFromCache(direction: 'older' | 'newer', limit: number): number[] {
    const listed = this.listedIds;
    if (listed.length === 0) return [];
    const fromId = Number(direction === 'older' ? listed[0] : listed[listed.length - 1]);
    if (!Number.isFinite(fromId)) return [];
    const ids = this.takeCachedRun(fromId, direction, limit);
    if (ids.length === 0) return [];
    if (direction === 'older') {
      this.prependListedIds(ids.map(String), String(fromId));
    } else {
      this.appendListedIds(ids.map(String), String(fromId));
    }
    return ids;
  }

  replaceListedFromCacheAround(anchorId: number, limit: number = MESSAGE_LIST_SLICE): number[] {
    const ids = takeCachedAround(
      this.msgIndexes,
      anchorId,
      Math.min(limit, MESSAGE_LIST_VIEWPORT_LIMIT),
      this.messageCacheKind(),
    );
    if (ids.length === 0) return [];
    this.replaceListedWindow(ids.map(String), String(anchorId));
    return ids;
  }

  takeCachedNewest(topId: number, limit: number = MESSAGE_LIST_SLICE): number[] {
    return takeCachedNewest(
      this.msgIndexes,
      topId,
      Math.min(limit, MESSAGE_LIST_VIEWPORT_LIMIT),
      this.messageCacheKind(),
    );
  }

  replaceListedFromCacheNewest(topId: number, limit: number = MESSAGE_LIST_SLICE): number[] {
    const ids = this.takeCachedNewest(topId, limit);
    if (ids.length === 0) return [];
    this.replaceListedWindow(ids.map(String));
    return ids;
  }

  isCachedInMsgIndexes(messageId: string): boolean {
    const id = Number(messageId);
    if (!Number.isFinite(id)) return false;
    return isCachedId(this.msgIndexes, id);
  }

  reconcileIndexWithStore() {
    const messageStore = this.ctx.getMessageStore();
    const present: number[] = [];
    if (messageStore) {
      for (const message of messageStore.getAllData().values()) {
        if (message.isEmpty || !(message.date && message.date > 0)) continue;
        const id = Number(message.id);
        if (Number.isFinite(id) && id > 0) present.push(id);
      }
    }
    this.msgIndexes = reconcileIndex(this.msgIndexes, present);
    if (present.length > 0) {
      this.updateOldestMessageId(Math.min(...present));
    }
  }

  toSnapshot(): ThreadUISnapshot {
    return {
      scrollOffset: this.scrollOffset,
      scrollAnchorItemId: this.scrollAnchorItemId,
      scrollAnchorOffsetInItem: this.scrollAnchorOffsetInItem,
      scrollListedMinId: this.scrollListedMinId,
      scrollListedMaxId: this.scrollListedMaxId,
      pinToBottom: this.pinToBottom,
      listedFollowsNewest: this.listedFollowsNewest,
      pendingNewerCount: this.pendingNewerCount,
      unreadDividerId: this.unreadDividerId,
      historyLoaded: this.historyLoaded,
      isLoadingHistory: this.isLoadingHistory,
      hasMoreHistory: this.hasMoreHistory,
      oldestMessageId: this.oldestMessageId,
      listedIds: this.listedIds.slice(),
      msgIndexes: {
        cachedIds: this.msgIndexes.cachedIds.slice(),
        deletedIds: this.msgIndexes.deletedIds.slice(),
        breaksAfter: this.msgIndexes.breaksAfter.slice(),
        resolvedRanges: this.msgIndexes.resolvedRanges.map(
          (range) => [range[0], range[1]] as [number, number],
        ),
      },
      draft: this.draft,
      editingId: this.editingId,
      editingText: this.editingText,
      replyingToId: this.replyingToId,
      replyStack: this.replyStack.slice(),
      focusedMessageId: this.focusedMessageId,
      focusNoHighlight: this.focusNoHighlight,
      focusPending: this.focusPending,
      focusGeneration: this.focusGeneration,
    };
  }

  toJS(): ThreadUISnapshot {
    return this.toSnapshot();
  }

  hydrateFromSnapshot(snapshot: Record<string, unknown> | undefined) {
    this.applySnapshot(snapshot as ThreadUISnapshot | undefined);
  }

  static fromSnapshot(ctx: ThreadSliceContext, snapshot?: ThreadUISnapshot): ThreadSlice {
    return new ThreadSlice(ctx, snapshot);
  }

  private applySnapshot(snapshot?: ThreadUISnapshot) {
    if (!snapshot) return;
    if (snapshot.scrollOffset != null) this.scrollOffset = snapshot.scrollOffset;
    this.scrollAnchorItemId = snapshot.scrollAnchorItemId;
    this.scrollAnchorOffsetInItem = snapshot.scrollAnchorOffsetInItem;
    this.scrollListedMinId = snapshot.scrollListedMinId;
    this.scrollListedMaxId = snapshot.scrollListedMaxId;
    if (snapshot.pinToBottom != null) this.pinToBottom = snapshot.pinToBottom;
    this.pendingNewerCount = snapshot.pendingNewerCount ?? 0;
    this.unreadDividerId = snapshot.unreadDividerId;
    if (snapshot.historyLoaded != null) this.historyLoaded = snapshot.historyLoaded;
    this.isLoadingHistory = false;
    if (snapshot.hasMoreHistory != null) this.hasMoreHistory = snapshot.hasMoreHistory;
    if (snapshot.oldestMessageId !== undefined) this.oldestMessageId = snapshot.oldestMessageId;
    this.listedIds = snapshot.listedIds ? [...snapshot.listedIds] : [];
    this.msgIndexes = coerceMessageCacheIndex(snapshot.msgIndexes);
    this.draft = snapshot.draft;
    this.editingId = snapshot.editingId;
    this.editingText = snapshot.editingText;
    this.replyingToId = snapshot.replyingToId;
    this.replyStack = snapshot.replyStack ? [...snapshot.replyStack] : [];
    this.focusedMessageId = snapshot.focusedMessageId;
    this.focusNoHighlight = snapshot.focusNoHighlight;
    this.focusPending = snapshot.focusPending;
    if (snapshot.focusGeneration != null) this.focusGeneration = snapshot.focusGeneration;

    if (snapshot.listedFollowsNewest == null) {
      const listedMax = this.listedIds[this.listedIds.length - 1];
      const topId = this.ctx.getTopMessageId();
      this.listedFollowsNewest = Boolean(listedMax && topId && listedMax === topId);
    } else {
      this.listedFollowsNewest = snapshot.listedFollowsNewest;
    }
    if (!this.listedFollowsNewest) {
      this.pinToBottom = false;
    }
  }

  private messageCacheKind(): MessageCacheKind {
    return this.ctx.getDialog()?.peerKind === 'channel' ? 'channel' : 'private';
  }

  private syncListedWindowFlags() {
    const listedMax = this.listedIds[this.listedIds.length - 1];
    const topId = this.ctx.getTopMessageId();
    const follows = Boolean(listedMax && topId && listedMax === topId);
    const wasFollowing = this.listedFollowsNewest;
    this.listedFollowsNewest = follows;
    if (follows && !wasFollowing) {
      this.pendingNewerCount = 0;
    }
    if (!follows) {
      this.pinToBottom = false;
    }
  }
}
