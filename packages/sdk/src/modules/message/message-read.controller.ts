import { Controller, Method, RequestLog } from '@telegenie/decorators';
import type { TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';
import type { LoadHistoryResult as WorkerLoadHistoryResult } from '@telegenie/libs/foundation/telegram/worker/telegram.api';
import { Dialog } from '../../store/entity/models/dialog.model';
import { Message } from '../../store/entity/models/message.model';
import type GlobalStore from '../../store/global/global.store';
import { MAIN_THREAD_ID } from '../../store/global/models/thread.state';
import type StoreManager from '../../store/store.manager';
import type { DialogEntity, MessageEntity, MessageStore } from '../../store/types';
import type { FocusMessageOptions } from './message-load.controller';

/** https://core.telegram.org/api/views — send after the inbox pointer is idle 3s. */
const MARK_READ_IDLE_MS = 3_000;
const MARK_MENTIONS_READ_DEBOUNCE_MS = 500;

type MessageReadControllerOptions = {
  sm: StoreManager;
  globalStore: GlobalStore;
  worker: TelegramWorkerClient;
  ensureMessageStore: (peerId: string) => MessageStore;
  focusMessage: (peerId: string, opts: FocusMessageOptions) => Promise<void>;
  ingestUnreadMentionHistory: (
    peerId: string,
    result: WorkerLoadHistoryResult,
  ) => Promise<void>;
};

@Controller
export class MessageReadController {
  private readonly sm: StoreManager;
  private readonly globalStore: GlobalStore;
  private readonly worker: TelegramWorkerClient;
  private readonly ensureMessageStore: (peerId: string) => MessageStore;
  private readonly focusMessage: (peerId: string, opts: FocusMessageOptions) => Promise<void>;
  private readonly ingestUnreadMentionHistory: (
    peerId: string,
    result: WorkerLoadHistoryResult,
  ) => Promise<void>;
  private readonly markReadTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingMarkReadMaxId = new Map<string, number>();
  private readonly sentMarkReadMaxId = new Map<string, number>();
  private readonly markReadInFlight = new Set<string>();
  private readonly pendingMarkMentionIds = new Map<string, Set<string>>();
  private readonly markMentionsReadTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly markMentionsReadInFlight = new Set<string>();

  /**
   * Arrow fields: the idle timers fire outside `@Method`, and `@Controller`
   * rejects prototype methods called from that timer.
   */
  private readonly flushMarkMentionsRead = (peerId: string): void => {
    if (this.markMentionsReadInFlight.has(peerId)) return;
    const pending = this.pendingMarkMentionIds.get(peerId);
    if (!pending?.size) return;

    const ids = [...pending].map((id) => parseInt(id, 10)).filter((id) => Number.isFinite(id));
    if (!ids.length) {
      this.pendingMarkMentionIds.delete(peerId);
      return;
    }

    this.pendingMarkMentionIds.delete(peerId);
    this.markMentionsReadInFlight.add(peerId);
    void this.worker
      .call('message.markMentionsRead', [peerId, ids])
      .catch(() => undefined)
      .finally(() => {
        this.markMentionsReadInFlight.delete(peerId);
        if (this.pendingMarkMentionIds.has(peerId)) {
          this.flushMarkMentionsRead(peerId);
        }
      });
  };
  private readonly cancelMarkReadTimer = (peerId: string): void => {
    const timer = this.markReadTimers.get(peerId);
    if (!timer) return;
    clearTimeout(timer);
    this.markReadTimers.delete(peerId);
  };
  private readonly flushMarkRead = (peerId: string): void => {
    if (this.markReadInFlight.has(peerId)) return;
    const pendingMaxId = this.pendingMarkReadMaxId.get(peerId);
    if (pendingMaxId == null) return;
    const sentMaxId = this.sentMarkReadMaxId.get(peerId) ?? 0;
    if (pendingMaxId <= sentMaxId) {
      this.pendingMarkReadMaxId.delete(peerId);
      return;
    }
    this.pendingMarkReadMaxId.delete(peerId);
    this.sentMarkReadMaxId.set(peerId, pendingMaxId);
    this.markReadInFlight.add(peerId);
    void this.worker
      .call('message.markMessageListRead', [peerId, pendingMaxId])
      .catch(() => {
        // Server read.inbox update reconciles on success; ignore transient RPC errors.
      })
      .finally(() => {
        this.markReadInFlight.delete(peerId);
        if (this.pendingMarkReadMaxId.has(peerId)) {
          this.flushMarkRead(peerId);
        }
      });
  };

  constructor({
    sm,
    globalStore,
    worker,
    ensureMessageStore,
    focusMessage,
    ingestUnreadMentionHistory,
  }: MessageReadControllerOptions) {
    this.sm = sm;
    this.globalStore = globalStore;
    this.worker = worker;
    this.ensureMessageStore = ensureMessageStore;
    this.focusMessage = focusMessage;
    this.ingestUnreadMentionHistory = ingestUnreadMentionHistory;
  }

  @RequestLog()
  @Method()
  markMessageListRead(peerId: string, maxId: number): void {
    this.applyOptimisticRead(peerId, maxId);

    const sentMaxId = this.sentMarkReadMaxId.get(peerId) ?? 0;
    if (maxId <= sentMaxId) return;

    const prev = this.pendingMarkReadMaxId.get(peerId) ?? 0;
    if (maxId > prev) {
      this.pendingMarkReadMaxId.set(peerId, maxId);
    }

    if (this.shouldFlushInboxReadNow(peerId, maxId)) {
      this.flushPendingInboxRead(peerId);
      return;
    }

    this.cancelMarkReadTimer(peerId);
    this.markReadTimers.set(
      peerId,
      setTimeout(() => {
        this.markReadTimers.delete(peerId);
        this.flushMarkRead(peerId);
      }, MARK_READ_IDLE_MS),
    );
  }

  /** Flush pending `readHistory` immediately (chat close, background, suspend). */
  @RequestLog()
  @Method()
  flushPendingInboxRead(peerId?: string): void {
    if (peerId) {
      this.cancelMarkReadTimer(peerId);
      this.flushMarkRead(peerId);
      return;
    }
    for (const id of [...this.pendingMarkReadMaxId.keys()]) {
      this.cancelMarkReadTimer(id);
      this.flushMarkRead(id);
    }
  }

  @RequestLog()
  @Method()
  markMentionsRead(peerId: string, messageIds: string[]): void {
    if (!messageIds.length) return;
    this.applyOptimisticMentionsRead(peerId, messageIds);
    this.enqueueContentsRead(peerId, messageIds);
  }

  /**
   * Mark voice notes or round videos as played (`messages.readMessageContents`).
   * Shares the mention flush because both receipts use the same RPC and flag.
   */
  @RequestLog()
  @Method()
  markMediaRead(peerId: string, messageIds: string[]): void {
    if (!messageIds.length) return;

    const messageStore = this.ensureMessageStore(peerId);
    const mentionIds: string[] = [];
    for (const id of messageIds) {
      const existing = messageStore.get(id) as Message | undefined;
      if (existing?.hasUnreadMention) mentionIds.push(id);
    }
    if (mentionIds.length) {
      this.applyOptimisticMentionsRead(peerId, mentionIds);
    }
    this.applyOptimisticMediaRead(peerId, messageIds);
    this.enqueueContentsRead(peerId, messageIds);
  }

  @RequestLog()
  @Method()
  async fetchUnreadMentions(peerId: string): Promise<string[]> {
    const result = await this.worker.call('message.getUnreadMentions', [peerId]);
    await this.ingestUnreadMentionHistory(peerId, result);
    const sorted = [...result.messageIds].sort((a, b) => Number(b) - Number(a));
    this.globalStore.getOrCreateDialogUI(peerId).setUnreadMentionIds(sorted);
    return sorted;
  }

  @RequestLog()
  @Method()
  async focusClosestUnreadMention(
    peerId: string,
    threadId: string = MAIN_THREAD_ID,
    anchorMessageId?: string,
  ): Promise<void> {
    await this.ensureUnreadMentionsFresh(peerId);
    const targetId = this.pickClosestUnreadMentionId(peerId, threadId, anchorMessageId);
    if (!targetId) return;

    await this.focusMessage(peerId, {
      messageId: targetId,
      threadId,
    });
  }

  @RequestLog()
  @Method()
  async readAllMentions(peerId: string): Promise<void> {
    await this.worker.call('message.readAllMentions', [peerId]);
    this.globalStore.getOrCreateDialogUI(peerId).clearUnreadMentionIds();
    this.patchDialogMentionsCount(peerId, 0);
    this.clearUnreadMentionFlags(peerId);
  }

  private shouldFlushInboxReadNow(peerId: string, maxId: number): boolean {
    if (!this.sm.has('dialog')) return false;
    const dialog = this.sm.get('dialog').get(peerId) as Dialog | undefined;
    if (!dialog) return false;
    if ((dialog.unreadCount ?? 0) <= 0) return true;
    const topId = Number(dialog.topMessageId);
    return Number.isFinite(topId) && topId > 0 && maxId >= topId;
  }

  private async ensureUnreadMentionsFresh(peerId: string): Promise<void> {
    const dialogUI = this.globalStore.getDialogUI(peerId);
    const dialog = this.sm.has('dialog')
      ? (this.sm.get('dialog').get(peerId) as Dialog | undefined)
      : undefined;
    const count = dialog?.unreadMentionsCount ?? 0;
    const cached = dialogUI?.unreadMentionIds ?? [];

    const stale =
      count > 0 &&
      (cached.length === 0 ||
        cached.length !== count ||
        cached.some((id) => {
          const message = this.ensureMessageStore(peerId).get(id) as Message | undefined;
          return !message?.hasUnreadMention;
        }));

    if (stale) {
      await this.fetchUnreadMentions(peerId);
    }
  }

  private pickClosestUnreadMentionId(
    peerId: string,
    threadId: string,
    anchorMessageId?: string,
  ): string | undefined {
    const dialogUI = this.globalStore.getDialogUI(peerId);
    const candidates = (dialogUI?.unreadMentionIds ?? []).filter((id) => {
      const message = this.ensureMessageStore(peerId).get(id) as Message | undefined;
      return message?.hasUnreadMention;
    });
    if (!candidates.length) return undefined;

    const threadUI = this.globalStore.getThreadUI(peerId, threadId);
    const listedIds = threadUI?.listedIds ?? [];
    const anchor = anchorMessageId ?? this.resolveMentionAnchorMessageId(threadUI, listedIds);
    const anchorIndex = anchor ? listedIds.indexOf(anchor) : -1;

    if (anchorIndex >= 0) {
      let bestId = candidates[0];
      let bestDistance = Infinity;
      let bestBelow = false;

      for (const id of candidates) {
        const index = listedIds.indexOf(id);
        if (index < 0) continue;
        const distance = Math.abs(index - anchorIndex);
        const below = index > anchorIndex;
        if (
          distance < bestDistance ||
          (distance === bestDistance && below && !bestBelow) ||
          (distance === bestDistance && below === bestBelow && Number(id) > Number(bestId))
        ) {
          bestId = id;
          bestDistance = distance;
          bestBelow = below;
        }
      }

      if (bestDistance < Infinity) {
        return bestId;
      }
    }

    if (!anchor) {
      return candidates[0];
    }

    const anchorNum = Number(anchor);
    if (!Number.isFinite(anchorNum)) {
      return candidates[0];
    }

    return candidates.reduce((best, id) => {
      const dist = Math.abs(Number(id) - anchorNum);
      const bestDist = Math.abs(Number(best) - anchorNum);
      if (dist !== bestDist) return dist < bestDist ? id : best;
      return Number(id) > Number(best) ? id : best;
    });
  }

  private resolveMentionAnchorMessageId(
    threadUI: ReturnType<GlobalStore['getThreadUI']>,
    listedIds: string[],
  ): string | undefined {
    const anchorItemId = threadUI?.scrollAnchorItemId;
    if (anchorItemId?.startsWith('msg-')) {
      return anchorItemId.slice(4);
    }
    if (listedIds.length > 0) {
      return listedIds[Math.floor(listedIds.length / 2)];
    }
    return undefined;
  }

  private enqueueContentsRead(peerId: string, messageIds: string[]): void {
    const pending = this.pendingMarkMentionIds.get(peerId) ?? new Set<string>();
    for (const id of messageIds) {
      pending.add(id);
    }
    this.pendingMarkMentionIds.set(peerId, pending);

    const timer = this.markMentionsReadTimers.get(peerId);
    if (timer) clearTimeout(timer);
    this.markMentionsReadTimers.set(
      peerId,
      setTimeout(() => {
        this.markMentionsReadTimers.delete(peerId);
        void this.flushMarkMentionsRead(peerId);
      }, MARK_MENTIONS_READ_DEBOUNCE_MS),
    );
  }

  private applyOptimisticMediaRead(peerId: string, messageIds: string[]): void {
    const messageStore = this.ensureMessageStore(peerId);
    const patches: MessageEntity[] = [];

    for (const id of messageIds) {
      const existing = messageStore.get(id) as Message | undefined;
      if (!existing?.mediaUnread) continue;
      patches.push({ ...(existing as unknown as MessageEntity), mediaUnread: false });
    }

    if (patches.length) {
      messageStore.update(patches);
    }
  }

  private applyOptimisticMentionsRead(peerId: string, messageIds: string[]): void {
    const messageStore = this.ensureMessageStore(peerId);
    const patches: MessageEntity[] = [];

    for (const id of messageIds) {
      const existing = messageStore.get(id) as Message | undefined;
      if (!existing || !existing.hasUnreadMention) continue;
      patches.push({ ...(existing as unknown as MessageEntity), mediaUnread: false });
    }

    if (patches.length) {
      messageStore.update(patches);
    }

    this.globalStore.getOrCreateDialogUI(peerId).removeUnreadMentionIds(messageIds);

    if (!this.sm.has('dialog')) return;
    const dialogStore = this.sm.get('dialog');
    const dialog = dialogStore.get(peerId) as Dialog | undefined;
    if (!dialog?.unreadMentionsCount) return;

    const nextCount = Math.max(0, dialog.unreadMentionsCount - messageIds.length);
    this.patchDialogMentionsCount(peerId, nextCount);
  }

  private patchDialogMentionsCount(peerId: string, unreadMentionsCount: number): void {
    if (!this.sm.has('dialog')) return;
    const dialogStore = this.sm.get('dialog');
    const existing = dialogStore.get(peerId) as Dialog | undefined;
    if (!existing) return;
    dialogStore.update([
      new Dialog({
        ...existing,
        unreadMentionsCount: unreadMentionsCount > 0 ? unreadMentionsCount : undefined,
      }),
    ]);
  }

  private clearUnreadMentionFlags(peerId: string): void {
    const messageStore = this.ensureMessageStore(peerId);
    const patches: MessageEntity[] = [];
    for (const message of messageStore.getAllData().values()) {
      if (!message.hasUnreadMention) continue;
      patches.push({ ...(message as unknown as MessageEntity), mediaUnread: false });
    }
    if (patches.length) {
      messageStore.update(patches);
    }
  }

  private applyOptimisticRead(peerId: string, maxId: number): void {
    if (!this.sm.has('dialog')) return;

    const dialogStore = this.sm.get('dialog');
    const existing = dialogStore.get(peerId) as Dialog | undefined;
    if (!existing) return;

    const prevRead = existing.readInboxMaxId ?? 0;
    if (maxId <= prevRead) return;

    const topId = Number(existing.topMessageId);
    const reachedTop = Number.isFinite(topId) && topId > 0 && maxId >= topId;
    let nextUnread = 0;
    if (!reachedTop) {
      const messageStore = this.ensureMessageStore(peerId);
      let readCount = 0;
      for (const msg of messageStore.getAllData().values()) {
        const id = Number(msg.id);
        if (!Number.isFinite(id)) continue;
        if (!msg.out && id > prevRead && id <= maxId) {
          readCount += 1;
        }
      }
      nextUnread = Math.max(0, existing.unreadCount - readCount);
    }

    const merged: DialogEntity = {
      ...existing,
      readInboxMaxId: maxId,
      unreadCount: nextUnread,
      ...(nextUnread <= 0 ? { unreadMark: false } : {}),
    };
    dialogStore.update([new Dialog(merged)]);
  }
}
