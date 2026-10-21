import { Controller, ListRequestDebounce, Method, RequestLog } from '@telegenie/decorators';
import type { TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';
import {
  GET_HISTORY_LIMIT,
  GET_MESSAGES_FILL_LIMIT,
  type LoadHistoryOptions,
  type MessagesByIdsResult,
  type LoadHistoryResult as WorkerLoadHistoryResult,
} from '@telegenie/libs/foundation/telegram/worker/telegram.api';
import { Dialog } from '../../store/entity/models/dialog.model';
import { Message } from '../../store/entity/models/message.model';
import type GlobalStore from '../../store/global/global.store';
import { MAIN_THREAD_ID } from '../../store/global/models/thread.state';
import type StoreManager from '../../store/store.manager';
import type { MessageEntity, MessageStore } from '../../store/types';
import { findUnresolvedChannelHole } from '../../store/utils/message-cache-index';
import { ConversionService } from '../common/services/convert.service';
import { missingReplyTargets, stampMessagesForStore } from '../common/stamp-reply-verification';
import { updateMessagesByPeer } from '../common/update-messages-by-peer';

export type FocusMessageOptions = {
  messageId: string;
  threadId?: string;
  replyFromMessageId?: string;
  noHighlight?: boolean;
};

export type FocusNextReplyResult = { scrollToBottom: true } | { scrollToBottom?: false };

type MessageLoadControllerOptions = {
  sm: StoreManager;
  globalStore: GlobalStore;
  debug?: boolean;
  worker: TelegramWorkerClient;
  ensureMessageStore: (peerId: string) => MessageStore;
  resolveUsername?: (username: string) => Promise<string | undefined>;
  /** SDK cache IDB point-read. Empty when persist is closed (tests, pre-init). */
  loadCachedMessages?: (peerId: string, ids: string[]) => Promise<MessageEntity[]>;
  /** Loads unread reaction message ids when a chat opens. Each one is read when that message is on screen. */
  loadUnreadReactionsOnOpen?: (peerId: string) => Promise<void>;
  flushPendingInboxRead?: (peerId?: string) => void;
  adoptDialogDraft?: (peerId: string, threadId?: string) => void;
};

const FOCUS_HISTORY_LIMIT = GET_HISTORY_LIMIT;

@Controller
export class MessageLoadController {
  worker: TelegramWorkerClient;
  sm: StoreManager;
  private readonly globalStore: GlobalStore;
  converter: ConversionService;
  private readonly ensureMessageStore: (peerId: string) => MessageStore;
  private readonly resolveUsername?: (username: string) => Promise<string | undefined>;
  private readonly loadCachedMessages?: (peerId: string, ids: string[]) => Promise<MessageEntity[]>;
  private readonly loadUnreadReactionsOnOpen?: (peerId: string) => Promise<void>;
  private readonly flushPendingInboxRead?: (peerId?: string) => void;
  private readonly adoptDialogDraft?: (peerId: string, threadId?: string) => void;

  constructor({
    sm,
    globalStore,
    debug,
    worker,
    ensureMessageStore,
    resolveUsername,
    loadCachedMessages,
    loadUnreadReactionsOnOpen,
    flushPendingInboxRead,
    adoptDialogDraft,
  }: MessageLoadControllerOptions) {
    this.converter = new ConversionService({
      debug: debug ?? false,
    });
    this.worker = worker;
    this.sm = sm;
    this.globalStore = globalStore;
    this.ensureMessageStore = ensureMessageStore;
    this.resolveUsername = resolveUsername;
    this.loadCachedMessages = loadCachedMessages;
    this.loadUnreadReactionsOnOpen = loadUnreadReactionsOnOpen;
    this.flushPendingInboxRead = flushPendingInboxRead;
    this.adoptDialogDraft = adoptDialogDraft;
  }

  @RequestLog()
  @ListRequestDebounce({ delay: 500, concurrency: 3 })
  @Method()
  async getMessages(
    chatId: string | string[],
  ): Promise<[Message[], number] | Map<string, [Message[], number]>> {
    if (Array.isArray(chatId)) {
      const uniqueIds = [...new Set(chatId)];
      const results = await Promise.all(
        uniqueIds.map(async (id) => [id, await this.fetchMessagesForChat(id)] as const),
      );
      return new Map(results);
    }

    return this.fetchMessagesForChat(chatId);
  }

  @RequestLog()
  @ListRequestDebounce({ delay: 500, concurrency: 3 })
  @Method()
  async getMessagesByIds(peerId: string, ids: string[]): Promise<Message[]> {
    const requested = this.normalizeMessageIds(ids);
    if (requested.length === 0) return [];

    const found = new Map<string, Message>();
    const missing: string[] = [];
    for (const id of requested) {
      if (this.messageStoreExists(peerId) && this.isMessageLoaded(peerId, id)) {
        found.set(id, this.ensureMessageStore(peerId).getAllData().get(id) as Message);
      } else {
        missing.push(id);
      }
    }

    if (missing.length) {
      for (const entity of await this.hydrateMessagesFromCache(peerId, missing)) {
        const model = this.ensureMessageStore(peerId).getAllData().get(String(entity.id));
        if (model) found.set(String(entity.id), model as Message);
      }
    }

    const toFetch = requested.filter((id) => !found.has(id));
    if (toFetch.length) {
      for (const entity of await this.fetchAndIngestMessagesByIds(peerId, toFetch)) {
        found.set(String(entity.id), new Message(entity));
      }
    }

    return requested
      .map((id) => found.get(id))
      .filter((message): message is Message => Boolean(message));
  }

  /** Confirms the replied-to message still exists on the server (not deleted). */
  @RequestLog()
  @Method()
  async verifyReplyTargetExists(peerId: string, messageId: string): Promise<boolean> {
    const messages = await this.fetchAndIngestMessagesByIds(peerId, [messageId]);
    return messages.some(
      (entry) => String(entry.id) === String(messageId) && !entry.isEmpty && entry.date,
    );
  }

  /**
   * Jump to a specific message, switching dialogs if needed. This is the entry
   * point from anywhere that has a target id — not from a dialog-list click
   * (`selectDialog`).
   *
   * Examples:
   * - Tap a reply quote: pass `replyFromMessageId` so Back can unwind `replyStack`.
   * - Notification / SW click: open that chat on the notified message.
   * - Search or mention jump: highlight the hit (`noHighlight` omitted).
   * - `focusNextReply`: pop the quote trail with `noHighlight`.
   */
  @RequestLog()
  @Method()
  async focusMessage(peerId: string, opts: FocusMessageOptions): Promise<void> {
    const threadId = opts.threadId ?? MAIN_THREAD_ID;
    const { messageId, replyFromMessageId, noHighlight } = opts;

    const previousPeerId = this.globalStore.nav.selectedDialogId;
    const previousThreadId =
      previousPeerId != null
        ? this.globalStore.getOrCreateDialogUI(previousPeerId).activeThreadId
        : undefined;

    if (previousPeerId !== peerId) {
      this.globalStore.nav.setSelectedDialogId(peerId);
      this.globalStore.getOrCreateDialogUI(peerId).setActiveThreadId(threadId);
    }

    const sameThread = previousPeerId === peerId && previousThreadId === threadId;
    await this.applyFocus(peerId, threadId, messageId, {
      noHighlight,
      replyFromMessageId: sameThread ? replyFromMessageId : undefined,
    });
  }

  @Method()
  setPinToBottom(peerId: string, pinned: boolean, threadId: string = MAIN_THREAD_ID): void {
    this.globalStore.getOrCreateThreadUI(peerId, threadId).setPinToBottom(pinned);
  }

  @Method()
  recordScrollOffset(
    peerId: string,
    scrollOffset: number,
    threadId: string = MAIN_THREAD_ID,
  ): void {
    this.globalStore.getOrCreateThreadUI(peerId, threadId).recordScrollOffset(scrollOffset);
  }

  @RequestLog()
  @Method()
  clearFocus(peerId: string, threadId: string = MAIN_THREAD_ID): void {
    this.globalStore.getOrCreateThreadUI(peerId, threadId).clearFocus();
  }

  @Method()
  setScrollFrozen(peerId: string, frozen: boolean, threadId: string = MAIN_THREAD_ID): void {
    this.globalStore.getOrCreateThreadUI(peerId, threadId).setScrollFrozen(frozen);
  }

  @RequestLog()
  @ListRequestDebounce({ delay: 500, concurrency: 3 })
  @Method()
  loadPinnedMessages(peerId: string | string[]): Message[] | Map<string, Message[]> {
    const peerIds = Array.isArray(peerId) ? [...new Set(peerId)] : [peerId];
    const loaded = new Map<string, Message[]>();

    for (const id of peerIds) {
      void this.worker
        .call('message.getPinnedMessages', [id])
        .then(async (result) => {
          this.mergeHistoryPeers(result);
          const converted = this.converter.convertMessages(result.messages);
          await this.ingestMessageEntities(converted);
          const messageIds = result.messages
            .map((m) => Number(m.id))
            .filter((mid) => Number.isFinite(mid) && mid > 0);
          this.globalStore.getOrCreateDialogUI(id).setPinnedMessages(messageIds, result.count);
        })
        .catch(() => undefined);

      const messages: Message[] = [];
      for (const pinnedId of this.globalStore.getOrCreateDialogUI(id).pinnedMessageIds) {
        const messageId = String(pinnedId);
        if (this.messageStoreExists(id) && this.isMessageLoaded(id, messageId)) {
          messages.push(this.ensureMessageStore(id).getAllData().get(messageId) as Message);
        }
      }
      loaded.set(id, messages);
    }

    return Array.isArray(peerId) ? loaded : loaded.get(peerIds[0]!)!;
  }

  @RequestLog()
  @Method()
  async openPinnedView(peerId: string): Promise<void> {
    this.globalStore.getOrCreateDialogUI(peerId).setPinnedViewOpen(true);
    this.loadPinnedMessages(peerId);
  }

  @RequestLog()
  @Method()
  closePinnedView(peerId: string): void {
    this.globalStore.getOrCreateDialogUI(peerId).setPinnedViewOpen(false);
  }

  @RequestLog()
  @Method()
  async cyclePinnedMessage(peerId: string): Promise<void> {
    const nextPinnedId = this.globalStore.getOrCreateDialogUI(peerId).cyclePinnedIndex();
    if (nextPinnedId != null) {
      await this.focusMessage(peerId, { messageId: String(nextPinnedId) });
    }
  }

  @RequestLog()
  @Method()
  async unpinAllMessages(peerId: string): Promise<void> {
    await this.worker.call('message.unpinAllMessages', [peerId]);
    const messageStore = this.ensureMessageStore(peerId);
    const all = messageStore.getAllData();
    const patched: MessageEntity[] = [];
    for (const [id, msg] of all.entries()) {
      if (msg.pinned) {
        patched.push({ id, pinned: false } as MessageEntity);
      }
    }
    if (patched.length > 0) {
      messageStore.update(patched);
    }
    this.globalStore.getOrCreateDialogUI(peerId).clearPinnedMessages();
  }

  @RequestLog()
  @Method()
  async jumpToBottom(peerId: string, threadId: string = MAIN_THREAD_ID): Promise<void> {
    const threadUI = this.globalStore.getOrCreateThreadUI(peerId, threadId);
    if (threadUI.listedFollowsNewest) {
      await this.ensureListedIdsCached(peerId, threadId);
      this.finishJumpToBottom(peerId, threadId);
      return;
    }

    this.globalStore
      .getOrCreateThreadUI(peerId, threadId)
      .setHistoryState({ isLoadingHistory: true });
    try {
      const dialog = this.sm.has('dialog')
        ? (this.sm.get('dialog').get(peerId) as Dialog | undefined)
        : undefined;
      const topId = Number(dialog?.topMessageId);
      const anchor = Number.isFinite(topId) && topId > 0 ? topId : undefined;

      if (anchor != null) {
        const cached = this.globalStore
          .getOrCreateThreadUI(peerId, threadId)
          .takeCachedNewest(anchor, GET_HISTORY_LIMIT);
        if (cached.length >= GET_HISTORY_LIMIT) {
          this.globalStore
            .getOrCreateThreadUI(peerId, threadId)
            .replaceListedFromCacheNewest(anchor, GET_HISTORY_LIMIT);
          await this.ensureListedIdsCached(peerId, threadId);
          this.finishJumpToBottom(peerId, threadId);
          return;
        }
      }

      const result = await this.loadHistory(peerId, {
        direction: 'backwards',
        offsetId: anchor,
        limit: GET_HISTORY_LIMIT,
      });
      this.globalStore
        .getOrCreateThreadUI(peerId, threadId)
        .applyListedMessages(result.messages, 'replace');
      this.finishJumpToBottom(peerId, threadId);
    } finally {
      this.globalStore
        .getOrCreateThreadUI(peerId, threadId)
        .setHistoryState({ isLoadingHistory: false });
    }
  }

  @RequestLog()
  @Method()
  async findDisplayedGap(
    peerId: string,
    from: number,
    to: number,
    threadId: string = MAIN_THREAD_ID,
  ): Promise<[number, number] | null> {
    if (this.isChannelPeer(peerId)) {
      const index = this.globalStore.getOrCreateThreadUI(peerId, threadId).msgIndexes;
      return findUnresolvedChannelHole(index, from, to);
    }
    return null;
  }

  @RequestLog()
  @Method()
  async fillDisplayedGap(
    peerId: string,
    from: number,
    to: number,
    threadId: string = MAIN_THREAD_ID,
  ): Promise<{ messages: Message[]; gap: [number, number] | null }> {
    const gap = await this.findDisplayedGap(peerId, from, to, threadId);
    if (!gap) return { messages: [], gap: null };

    const ids: string[] = [];
    for (let id = gap[0]; id <= gap[1] && ids.length < GET_MESSAGES_FILL_LIMIT; id += 1) {
      ids.push(String(id));
    }
    const messages = await this.getMessagesByIds(peerId, ids);
    this.recordChannelFill(peerId, gap, messages, threadId);
    const listedMin = Number(this.globalStore.getThreadUI(peerId, threadId)?.listedIds[0]);
    const mode = Number.isFinite(listedMin) && gap[1] < listedMin ? 'prepend' : 'append';
    this.globalStore.getOrCreateThreadUI(peerId, threadId).applyListedMessages(messages, mode);
    return { messages, gap };
  }

  /**
   * Open a chat from the dialog list (left-column click, or after creating a
   * group/channel). Restores the listed window, or lands on the first unread
   * when pinned to bottom.
   *
   * Do not use this to jump to a message — that is `focusMessage`.
   */
  @RequestLog()
  @Method()
  async selectDialogByUsername(username: string, threadId: string = MAIN_THREAD_ID): Promise<void> {
    if (!this.resolveUsername) {
      return;
    }
    const peerId = await this.resolveUsername(username);
    if (!peerId) {
      return;
    }
    await this.selectDialog(peerId, threadId);
  }

  @RequestLog()
  @Method()
  async selectDialog(peerId: string, threadId: string = MAIN_THREAD_ID): Promise<void> {
    const previousPeerId = this.globalStore.nav.selectedDialogId;
    if (previousPeerId && previousPeerId !== peerId) {
      this.flushPendingInboxRead?.(previousPeerId);
    }
    this.adoptDialogDraft?.(peerId, threadId);

    if (this.loadUnreadReactionsOnOpen) {
      void this.loadUnreadReactionsOnOpen(peerId).catch(() => undefined);
    }

    const threadUI = this.globalStore.getThreadUI(peerId, threadId);

    // Unreads: land on the first unread instead of the newest message.
    // No highlight — this is open positioning, not a tap.
    const unreadId = this.resolveOpenUnreadFocusId(peerId, threadId);
    if (unreadId) {
      await this.applyFocus(peerId, threadId, unreadId, { noHighlight: true });
      this.globalStore.getOrCreateThreadUI(peerId, threadId).freezeUnreadDivider();
      this.globalStore.nav.setSelectedDialogId(peerId);
      return;
    }

    this.globalStore.nav.setSelectedDialogId(peerId);

    // Already have a listed window — keep it, do not rebuild around latest.
    // Re-freeze so a reopen with no unreads clears last session's divider.
    // Persist / reconcile can leave listedIds that are no longer in cachedIds;
    // fetch those so the scroller has entities to render.
    if (Boolean(threadUI?.historyLoaded) || (threadUI?.listedIds.length ?? 0) > 0) {
      this.globalStore.getOrCreateThreadUI(peerId, threadId).freezeUnreadDivider();
      await this.ensureListedIdsCached(peerId, threadId);
      return;
    }

    // Empty listed window: fill around latest. msgIndexes can still have a
    // connected run after persist / resetThreadHistoryState even when
    // historyLoaded and listedIds are empty — that is not the same as "no cache".
    this.globalStore
      .getOrCreateThreadUI(peerId, threadId)
      .setHistoryState({ isLoadingHistory: true });
    try {
      const dialog = this.sm.has('dialog')
        ? (this.sm.get('dialog').get(peerId) as Dialog | undefined)
        : undefined;
      const topId = Number(dialog?.topMessageId);
      const anchor = Number.isFinite(topId) && topId > 0 ? topId : undefined;

      if (anchor != null) {
        const cached = this.globalStore
          .getOrCreateThreadUI(peerId, threadId)
          .replaceListedFromCacheAround(anchor, GET_HISTORY_LIMIT);
        if (cached.length >= GET_HISTORY_LIMIT) {
          await this.ensureListedIdsCached(peerId, threadId);
          this.globalStore.getOrCreateThreadUI(peerId, threadId).freezeUnreadDivider();
          return;
        }
      }

      const result = await this.loadHistory(peerId, {
        direction: 'around',
        offsetId: anchor,
        limit: GET_HISTORY_LIMIT,
      });
      this.globalStore
        .getOrCreateThreadUI(peerId, threadId)
        .applyListedMessages(result.messages, 'replace');
      this.globalStore.getOrCreateThreadUI(peerId, threadId).freezeUnreadDivider();
    } finally {
      this.globalStore
        .getOrCreateThreadUI(peerId, threadId)
        .setHistoryState({ isLoadingHistory: false, historyLoaded: true });
    }
  }

  /**
   * Grow the listed scroller window by one page older or newer.
   *
   * Use case: the message list is already open and the user hits an edge —
   * scroll up near the oldest listed row (`older`) or scroll down near the
   * newest listed row while viewing a historical island (`newer`). The UI
   * hook is `useMessageListHistory`. This is not how you open a chat
   * (`selectDialog`), jump to a specific id (`focusMessage`), or snap back
   * to the live tail (`jumpToBottom`).
   *
   * Cache first, then network — same order as `selectDialog` / `jumpToBottom`
   * / `ensureListedAroundFocus`:
   * 1. `slideListedFromCache` walks `msgIndexes` from the listed edge until
   *    `GET_HISTORY_LIMIT`, a private `breaksAfter` island split, or an
   *    unresolved channel hole. A full cache page skips `getHistory`.
   * 2. Missing bodies: in-memory store, then SDK cache IDB, then `getMessages`.
   * 3. Short id page: channels may `fillDisplayedGap`; otherwise `loadHistory`
   *    from the (possibly already-slid) listed edge, then prepend/append.
   *
   * Skips when a history load is already in flight, when `older` is already
   * on the oldest listed message (`!hasMoreOlder`), or when `newer` would
   * hit the live tail (`listedFollowsNewest` or `!hasMoreNewer`) — new
   * messages there arrive through updates, not `getHistory`.
   * `hasMoreHistory === false` only means the cache includes the start of
   * the chat; the listed window can still slide older until that edge.
   */
  @RequestLog()
  @Method()
  async slideListedWindow(
    peerId: string,
    direction: 'older' | 'newer',
    threadId: string = MAIN_THREAD_ID,
    opts?: { preload?: boolean },
  ): Promise<void> {
    const threadUI = this.globalStore.getThreadUI(peerId, threadId);
    if (threadUI?.isLoadingHistory) return;
    if (direction === 'older' && !threadUI?.hasMoreOlder) return;
    if (direction === 'newer' && (threadUI?.listedFollowsNewest || !threadUI?.hasMoreNewer)) {
      return;
    }

    this.globalStore
      .getOrCreateThreadUI(peerId, threadId)
      .setHistoryState({ isLoadingHistory: true });
    try {
      // Connected run already in msgIndexes — show it before hitting the network.
      const slid = this.globalStore
        .getOrCreateThreadUI(peerId, threadId)
        .slideListedFromCache(direction, GET_HISTORY_LIMIT);
      if (slid.length < GET_HISTORY_LIMIT) {
        const current = this.globalStore.getThreadUI(peerId, threadId);
        // Cache slide reached the confirmed start of the chat — do not refetch.
        if (direction === 'older' && current && !current.hasMoreOlder) return;
        // Cache slide reached the confirmed end of the chat — do not refetch.
        if (direction === 'newer' && current && (current.listedFollowsNewest || !current.hasMoreNewer)) return;
        // Cache island ended (or was empty). Fetch from the new listed edge.
        const listed = current?.listedIds ?? [];
        const edge = Number(direction === 'older' ? listed[0] : listed[listed.length - 1]);
        if (Number.isFinite(edge)) {
          let filledGap = false;
          if (this.isChannelPeer(peerId)) {
            const from =
              direction === 'older' ? Math.max(1, edge - GET_MESSAGES_FILL_LIMIT) : edge + 1;
            const to = direction === 'older' ? edge - 1 : edge + GET_MESSAGES_FILL_LIMIT;
            if (from <= to) {
              const filled = await this.fillDisplayedGap(peerId, from, to, threadId);
              filledGap = Boolean(filled.gap);
            }
          }
          if (!filledGap) {
            const result = await this.loadHistory(peerId, {
              direction: direction === 'older' ? 'backwards' : 'forwards',
              offsetId: edge,
              limit: GET_HISTORY_LIMIT,
            });
            this.globalStore
              .getOrCreateThreadUI(peerId, threadId)
              .applyListedMessages(
                result.messages,
                direction === 'older' ? 'prepend' : 'append',
                String(edge),
              );
            const fetched = result.messages.filter(
              (message) => !message.isEmpty && message.date,
            ).length;
            if (direction === 'older' && fetched < GET_HISTORY_LIMIT) {
              const currentThread = this.globalStore.getOrCreateThreadUI(peerId, threadId);
              const oldest = currentThread.effectiveOldestMessageId;
              if (oldest === String(edge) || listed[0] === oldest) {
                this.globalStore
                  .getOrCreateThreadUI(peerId, threadId)
                  .setHistoryState({ hasMoreHistory: false, oldestMessageId: oldest });
              }
            }
          }
        }
      }
    } finally {
      this.globalStore
        .getOrCreateThreadUI(peerId, threadId)
        .setHistoryState({ isLoadingHistory: false });
      if (opts?.preload) {
        void this.preloadHistory(peerId, direction, threadId);
      }
    }
  }

  /**
   * 1-step budget preload: check cache first, hydrate any missing bodies into the
   * message store, and only fetch missing history beyond the cached run without updating listedIds.
   */
  private preloadHistory(peerId: string, direction: 'older' | 'newer', threadId: string): Promise<void> {
    const threadUI = this.globalStore.getThreadUI(peerId, threadId);
    if (!threadUI || threadUI.isLoadingHistory) return Promise.resolve();
    if (direction === 'older' && !threadUI.hasMoreOlder) return Promise.resolve();
    if (direction === 'newer' && (threadUI.listedFollowsNewest || !threadUI.hasMoreNewer)) {
      return Promise.resolve();
    }

    const listed = threadUI.listedIds ?? [];
    const edge = Number(direction === 'older' ? listed[0] : listed[listed.length - 1]);
    if (!Number.isFinite(edge)) return Promise.resolve();

    return (async () => {
      try {
        const cached = threadUI.takeCachedRun(edge, direction, GET_HISTORY_LIMIT);
        if (cached.length > 0) {
          const missing = cached.filter((id) => !this.isMessageLoaded(peerId, String(id)));
          if (missing.length > 0) {
            await this.hydrateMessagesFromCache(peerId, missing.map(String));
          }
          if (cached.length >= GET_HISTORY_LIMIT) {
            return;
          }
        }

        const current = this.globalStore.getThreadUI(peerId, threadId);
        if (direction === 'older') {
          if (current && !current.hasMoreOlder) return;
          if (cached.length > 0) {
            const oldest = current?.effectiveOldestMessageId;
            if (oldest != null && String(cached[0]) === oldest) return;
          }
        } else if (direction === 'newer') {
          if (current && (current.listedFollowsNewest || !current.hasMoreNewer)) return;
        }

        const fetchEdge =
          cached.length > 0
            ? Number(direction === 'older' ? cached[0] : cached[cached.length - 1])
            : edge;

        await this.loadHistory(peerId, {
          direction: direction === 'older' ? 'backwards' : 'forwards',
          offsetId: fetchEdge,
          limit: GET_HISTORY_LIMIT,
        });
      } catch {
        // Preload failure is non-fatal
      }
    })();
  }

  /**
   * Jump back one quote tap. Pops `replyStack` (the message you tapped a quote from)
   * and focuses it. If the stack is empty, the UI should scroll to the bottom instead.
   */
  @RequestLog()
  @Method()
  async focusNextReply(
    peerId: string,
    threadId: string = MAIN_THREAD_ID,
  ): Promise<FocusNextReplyResult> {
    const previousId = this.globalStore.getOrCreateThreadUI(peerId, threadId).popReplyStack();
    if (!previousId) {
      return { scrollToBottom: true };
    }

    await this.focusMessage(peerId, {
      messageId: previousId,
      threadId,
      noHighlight: true,
    });
    return {};
  }

  /**
   * Store unread-mention history. `MessageReadController` calls this after
   * `message.getUnreadMentions`.
   */
  @RequestLog()
  @Method()
  async ingestUnreadMentionHistory(
    peerId: string,
    result: WorkerLoadHistoryResult,
  ): Promise<void> {
    this.mergeHistoryPeers(result);
    const messageEntities = await this.ingestMessageEntities([
      ...this.converter.convertMessages(result.messages ?? []),
      ...this.converter.convertServiceMessages(result.messageServices ?? []),
      ...this.attachPeerToEmptyMessages(
        this.converter.convertEmptyMessages(result.emptyMessages ?? []),
        peerId,
      ),
    ]);
    this.recordHistoryIndex(
      peerId,
      messageEntities.map((entity) => new Message(entity)),
      {
        direction: 'around',
        limit: messageEntities.length,
      },
    );
  }

  private async fetchMessagesForChat(chatId: string): Promise<[Message[], number]> {
    const [rawMessages, count] = await this.worker.call('message.getMessages', [chatId]);

    const messageEntities = await this.ingestMessageEntities(
      this.converter.convertMessages(rawMessages),
    );

    const messages = messageEntities.map((entity) => new Message(entity));
    return [messages, count];
  }

  /**
   * Fetch reply targets (if needed), stamp `replyTargetVerified`, then write to the store.
   * The UI can render a reply chip from the first paint without a later height change.
   */
  private async ingestMessageEntities(entities: MessageEntity[]): Promise<MessageEntity[]> {
    if (!entities.length) return entities;

    const extras = await this.fetchMissingReplyTargets(entities);
    const originalKeys = new Set(entities.map((entity) => `${entity.peerId}:${entity.id}`));
    const stamped = stampMessagesForStore([...entities, ...extras], this.ensureMessageStore);
    updateMessagesByPeer(this.ensureMessageStore, stamped);

    return stamped.filter((entity) => originalKeys.has(`${entity.peerId}:${entity.id}`));
  }

  private async fetchMissingReplyTargets(entities: MessageEntity[]): Promise<MessageEntity[]> {
    const missing = missingReplyTargets(entities, this.ensureMessageStore);
    if (missing.size === 0) return [];

    const batches = await Promise.all(
      [...missing].map(([peerId, ids]) => this.fetchMessageEntitiesByIds(peerId, ids)),
    );
    return batches.flat();
  }

  private async fetchMessageEntitiesByIds(peerId: string, ids: string[]): Promise<MessageEntity[]> {
    const requested = this.normalizeMessageIds(ids);
    if (requested.length === 0) return [];

    const cached = await this.readCachedMessages(peerId, requested);
    const have = new Set(cached.map((entity) => String(entity.id)));
    const toFetch = requested.filter((id) => !have.has(id));
    if (toFetch.length === 0) return cached;

    return [
      ...cached,
      ...this.convertMessagesByIdsResult(peerId, await this.fetchMessagesByIdsRaw(peerId, toFetch)),
    ];
  }

  private normalizeMessageIds(ids: string[]): string[] {
    return ids
      .map((id) => parseInt(id, 10))
      .filter((id) => Number.isFinite(id))
      .map(String);
  }

  private isCachedMessageUsable(row: MessageEntity | undefined): row is MessageEntity {
    return Boolean(row?.id && (row.isEmpty || row.date));
  }

  private async readCachedMessages(peerId: string, ids: string[]): Promise<MessageEntity[]> {
    if (!this.loadCachedMessages || ids.length === 0) return [];
    try {
      const rows = await this.loadCachedMessages(peerId, ids);
      return rows.filter((row) => this.isCachedMessageUsable(row));
    } catch {
      return [];
    }
  }

  /** Restore evicted bodies from SDK cache IDB without write-through. */
  private async hydrateMessagesFromCache(peerId: string, ids: string[]): Promise<MessageEntity[]> {
    const cached = await this.readCachedMessages(peerId, ids);
    if (cached.length === 0) return [];
    this.ensureMessageStore(peerId).hydrate(cached);
    return cached;
  }

  private async fetchMessagesByIdsRaw(peerId: string, ids: string[]): Promise<MessagesByIdsResult> {
    const numericIds = ids.map((id) => parseInt(id, 10)).filter((id) => Number.isFinite(id));
    return this.worker.call('message.getMessagesByIds', [peerId, numericIds]);
  }

  private convertMessagesByIdsResult(peerId: string, raw: MessagesByIdsResult): MessageEntity[] {
    return [
      ...this.converter.convertMessages(raw.messages),
      ...this.converter.convertServiceMessages(raw.messageServices),
      ...this.attachPeerToEmptyMessages(
        this.converter.convertEmptyMessages(raw.emptyMessages ?? []),
        peerId,
      ),
    ];
  }

  private async fetchAndIngestMessagesByIds(
    peerId: string,
    ids: string[],
  ): Promise<MessageEntity[]> {
    const requested = this.normalizeMessageIds(ids);
    if (requested.length === 0) return [];
    return this.ingestMessageEntities(
      this.convertMessagesByIdsResult(peerId, await this.fetchMessagesByIdsRaw(peerId, requested)),
    );
  }

  private mergeHistoryPeers(
    result:
      | {
          users?: Parameters<ConversionService['convertUsers']>[0];
          chats?: Parameters<ConversionService['convertChat']>[0][];
          channels?: Parameters<ConversionService['convertChannel']>[0][];
        }
      | undefined,
  ): void {
    if (result?.users?.length) {
      this.sm.get('user').update(this.converter.convertUsers(result.users));
    }
    if (result?.chats?.length) {
      this.sm.get('chat').update(result.chats.map((chat) => this.converter.convertChat(chat)));
    }
    if (result?.channels?.length) {
      this.sm
        .get('channel')
        .update(result.channels.map((channel) => this.converter.convertChannel(channel)));
    }
  }

  private isChannelPeer(peerId: string): boolean {
    return Dialog.peerKindFromId(peerId) === 'channel';
  }

  private recordHistoryIndex(peerId: string, messages: Message[], opts: LoadHistoryOptions): void {
    const cachedIds = messages
      .filter((message) => !message.isEmpty && message.date && message.date > 0)
      .map((message) => Number(message.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const emptyIds = messages
      .filter((message) => message.isEmpty)
      .map((message) => Number(message.id))
      .filter((id) => Number.isFinite(id) && id > 0);

    const direction =
      opts.direction === 'backwards'
        ? 'older'
        : opts.direction === 'forwards'
          ? 'newer'
          : opts.direction === 'around'
            ? 'around'
            : 'replace';
    const limit = opts.limit ?? GET_HISTORY_LIMIT;
    this.globalStore.getOrCreateThreadUI(peerId).ingestHistorySlice(cachedIds, {
      edgeId: opts.offsetId,
      direction,
      reachedEnd: cachedIds.length < limit && direction === 'older',
    });

    if (this.isChannelPeer(peerId) && cachedIds.length > 0) {
      this.globalStore.getOrCreateThreadUI(peerId).ingestChannelSpan({
        min: Math.min(...cachedIds),
        max: Math.max(...cachedIds),
        cachedIds,
        deletedIds: emptyIds,
      });
    } else if (emptyIds.length > 0) {
      this.globalStore.getOrCreateThreadUI(peerId).markCachedDeleted(emptyIds);
    }
  }

  private recordChannelFill(
    peerId: string,
    gap: [number, number],
    messages: Message[],
    threadId: string,
  ): void {
    const cachedIds = messages
      .filter((message) => !message.isEmpty && message.date && message.date > 0)
      .map((message) => Number(message.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const emptyIds = messages
      .filter((message) => message.isEmpty)
      .map((message) => Number(message.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    this.globalStore
      .getOrCreateThreadUI(peerId, threadId)
      .ingestChannelSpan({ min: gap[0], max: gap[1], cachedIds, deletedIds: emptyIds });
  }

  private attachPeerToEmptyMessages(entities: MessageEntity[], peerId: string): MessageEntity[] {
    return entities.map((entity) =>
      entity.isEmpty && !entity.peerId ? { ...entity, peerId } : entity,
    );
  }

  private isMessageLoaded(peerId: string, messageId: string): boolean {
    const message = this.ensureMessageStore(peerId).getAllData().get(messageId) as
      | Message
      | undefined;
    return Boolean(message && !message.isEmpty && message.date);
  }

  private messageStoreExists(peerId: string): boolean {
    return this.sm.has(`${peerId}-message`);
  }

  private dropDeletedListedIds(peerId: string, threadId: string): void {
    const threadUI = this.globalStore.getThreadUI(peerId, threadId);
    if (!threadUI?.listedIds.length) return;
    const deleted = new Set(threadUI.msgIndexes.deletedIds);
    const stale = threadUI.listedIds.filter((id) => deleted.has(Number(id)));
    if (stale.length) {
      this.globalStore.getOrCreateThreadUI(peerId, threadId).dropListedIds(stale);
    }
  }

  /** Listed ids with no renderable entity in the peer message store. */
  private listedIdsMissingFromStore(peerId: string, threadId: string): string[] {
    const threadUI = this.globalStore.getThreadUI(peerId, threadId);
    if (!threadUI?.listedIds.length) return [];
    const deleted = new Set(threadUI.msgIndexes.deletedIds);
    return threadUI.listedIds.filter((id) => {
      const numeric = Number(id);
      if (!Number.isFinite(numeric) || numeric <= 0 || deleted.has(numeric)) return false;
      return !this.messageStoreExists(peerId) || !this.isMessageLoaded(peerId, id);
    });
  }

  /** Listed ids that are loaded in the store but missing from `msgIndexes.cachedIds`. */
  private listedIdsMissingFromIndex(peerId: string, threadId: string): string[] {
    const threadUI = this.globalStore.getThreadUI(peerId, threadId);
    if (!threadUI?.listedIds.length) return [];
    const cached = new Set(threadUI.msgIndexes.cachedIds);
    const deleted = new Set(threadUI.msgIndexes.deletedIds);
    return threadUI.listedIds.filter((id) => {
      const numeric = Number(id);
      return (
        Number.isFinite(numeric) &&
        numeric > 0 &&
        !cached.has(numeric) &&
        !deleted.has(numeric) &&
        this.messageStoreExists(peerId) &&
        this.isMessageLoaded(peerId, id)
      );
    });
  }

  /**
   * After persist / reconcile / in-memory eviction, `listedIds` can outlive
   * the entity store. Cover every remaining listed id: reuse the store, then
   * SDK cache IDB, then `getMessages`.
   *
   * The message list calls this on open so a restored selected dialog paints
   * from IDB even when the in-memory message store is still empty.
   */
  @RequestLog()
  @Method()
  async ensureListedIdsCached(peerId: string, threadId: string = MAIN_THREAD_ID): Promise<void> {
    this.dropDeletedListedIds(peerId, threadId);
    const toFetch = this.listedIdsMissingFromStore(peerId, threadId);
    if (toFetch.length === 0) {
      if (this.listedIdsMissingFromIndex(peerId, threadId).length) {
        this.coverListedInIndex(peerId, threadId, []);
      }
      return;
    }

    const threadUI = this.globalStore.getThreadUI(peerId, threadId);
    const alreadyLoading = Boolean(threadUI?.isLoadingHistory);
    if (!alreadyLoading) {
      this.globalStore
        .getOrCreateThreadUI(peerId, threadId)
        .setHistoryState({ isLoadingHistory: true });
    }
    try {
      const messages = await this.getMessagesByIds(peerId, toFetch);
      const emptyIds = messages
        .filter((message) => message.isEmpty)
        .map((message) => Number(message.id))
        .filter((id) => Number.isFinite(id) && id > 0);
      this.coverListedInIndex(peerId, threadId, emptyIds);
    } finally {
      if (!alreadyLoading) {
        this.globalStore
          .getOrCreateThreadUI(peerId, threadId)
          .setHistoryState({ isLoadingHistory: false });
      }
    }
  }

  /** Record present listed ids in `msgIndexes` (and drop empties from the window). */
  private coverListedInIndex(peerId: string, threadId: string, emptyIds: number[]): void {
    const listed = this.globalStore.getThreadUI(peerId, threadId)?.listedIds ?? [];
    const present = listed
      .map((id) => Number(id))
      .filter(
        (id) =>
          Number.isFinite(id) &&
          id > 0 &&
          this.messageStoreExists(peerId) &&
          this.isMessageLoaded(peerId, String(id)),
      );

    if (this.isChannelPeer(peerId)) {
      for (const id of present) {
        this.globalStore
          .getOrCreateThreadUI(peerId, threadId)
          .ingestChannelSpan({ min: id, max: id, cachedIds: [id] });
      }
      for (const id of emptyIds) {
        this.globalStore
          .getOrCreateThreadUI(peerId, threadId)
          .ingestChannelSpan({ min: id, max: id, cachedIds: [], deletedIds: [id] });
      }
      return;
    }

    if (present.length) {
      this.globalStore.getOrCreateThreadUI(peerId, threadId).ingestHistorySlice(present);
    }
    if (emptyIds.length) {
      this.globalStore.getOrCreateThreadUI(peerId, threadId).markCachedDeleted(emptyIds);
    }
  }

  /** First unread to open onto, or `undefined` if this dialog has no unreads. */
  private resolveOpenUnreadFocusId(peerId: string, threadId: string): string | undefined {
    const dialog = this.sm.has('dialog')
      ? (this.sm.get('dialog').get(peerId) as Dialog | undefined)
      : undefined;
    if (!dialog || (dialog.unreadCount <= 0 && !dialog.unreadMark)) {
      return undefined;
    }

    this.globalStore.getOrCreateThreadUI(peerId, threadId).freezeUnreadDivider();
    const frozen = this.globalStore.getThreadUI(peerId, threadId)?.unreadDividerId;
    if (frozen) return frozen;

    const readMax = dialog.readInboxMaxId ?? 0;
    const topId = Number(dialog.topMessageId);
    if (Number.isFinite(topId) && topId > readMax) {
      return String(readMax + 1);
    }
    return undefined;
  }

  /**
   * Record focus and fill `listedIds` around it. Caller must already have this
   * dialog/thread selected — `focusMessage` handles switching from outside.
   */
  private async applyFocus(
    peerId: string,
    threadId: string,
    messageId: string,
    opts?: { noHighlight?: boolean; replyFromMessageId?: string },
  ): Promise<void> {
    if (opts?.replyFromMessageId) {
      this.globalStore
        .getOrCreateThreadUI(peerId, threadId)
        .pushReplyStack(opts.replyFromMessageId);
    }
    this.globalStore.getOrCreateThreadUI(peerId, threadId).beginFocus(messageId, {
      noHighlight: opts?.noHighlight,
    });
    await this.ensureListedAroundFocus(peerId, threadId, messageId);
    this.globalStore.getOrCreateThreadUI(peerId, threadId).setFocusPending(false);
  }

  /** Make sure we show messages around the selected message – first we check if it's already listed,
   * then if it's cached in the msgIndexes, then we try loading history, and finally we fetch the message directly if needed. */
  private async ensureListedAroundFocus(
    peerId: string,
    threadId: string,
    messageId: string,
  ): Promise<void> {
    if (this.globalStore.getThreadUI(peerId, threadId)?.listedIds.includes(messageId) ?? false) {
      await this.ensureListedIdsCached(peerId, threadId);
      return;
    }

    if (this.globalStore.getThreadUI(peerId, threadId)?.isCachedInMsgIndexes(messageId) ?? false) {
      const offsetId = Number(messageId);
      this.globalStore
        .getOrCreateThreadUI(peerId, threadId)
        .replaceListedFromCacheAround(offsetId, FOCUS_HISTORY_LIMIT);
      await this.ensureListedIdsCached(peerId, threadId);
      return;
    }

    const offsetId = Number(messageId);
    if (Number.isFinite(offsetId)) {
      const result = await this.loadHistory(peerId, {
        direction: 'around',
        offsetId,
        limit: FOCUS_HISTORY_LIMIT,
      });
      this.globalStore
        .getOrCreateThreadUI(peerId, threadId)
        .applyListedMessages(result.messages, 'replace');
    }

    if (this.isMessageLoaded(peerId, messageId)) {
      if (!this.globalStore.getThreadUI(peerId, threadId)?.listedIds.includes(messageId)) {
        this.globalStore
          .getOrCreateThreadUI(peerId, threadId)
          .applyListedMessages(
            [this.ensureMessageStore(peerId).getAllData().get(messageId) as Message],
            'replace',
          );
      }
      return;
    }

    await this.getMessagesByIds(peerId, [messageId]);
    if (this.isMessageLoaded(peerId, messageId)) {
      this.globalStore
        .getOrCreateThreadUI(peerId, threadId)
        .applyListedMessages(
          [this.ensureMessageStore(peerId).getAllData().get(messageId) as Message],
          'replace',
        );
    }
  }

  private finishJumpToBottom(peerId: string, threadId: string): void {
    this.globalStore.getOrCreateThreadUI(peerId, threadId).finishJumpToBottom();
  }

  @RequestLog()
  private async loadHistory(
    peerId: string,
    opts: LoadHistoryOptions,
  ): Promise<{ messages: Message[]; count?: number }> {
    const result = await this.worker.call('message.loadHistory', [peerId, opts]);

    if (result) {
      this.mergeHistoryPeers(result);
    }

    const messageEntities = await this.ingestMessageEntities([
      ...this.converter.convertMessages(result?.messages ?? []),
      ...this.converter.convertServiceMessages(result?.messageServices ?? []),
      ...this.attachPeerToEmptyMessages(
        this.converter.convertEmptyMessages(result?.emptyMessages ?? []),
        peerId,
      ),
    ]);

    const messages = messageEntities.map((entity) => new Message(entity));
    this.recordHistoryIndex(peerId, messages, opts);

    return {
      messages,
      count: result?.count,
    };
  }
}

export type { LoadHistoryOptions };
export type LoadHistoryResult = { messages: Message[]; count?: number };
