import type { Dialog, DialogFolder } from '../types/api-types';
import type { Message, MessageService } from '../types/message';
import { peerIdFromTypePeer, type StoreSyncPayload } from '../worker/store-sync';

export type DialogOrderRank = {
  peerId: string;
  activityAt: number;
  topMessageId: number;
  topMessageDate: number;
  draftDate: number;
  pinnedOrder: number | undefined;
  folderId: number | undefined;
  isFolder: boolean;
};

export type DialogOrderPage = {
  dialogs: Dialog[];
  dialogFolders: DialogFolder[];
  messages: Message[];
  messageServices: MessageService[];
};

export type DialogOrderIngestOptions = {
  /** Clear prior ranks (start of a full main-list refetch). */
  reset?: boolean;
  /** Telegram folder the page was queried from; stamped when the row omits it. */
  folderId?: number;
};

/** Archived chats live in Telegram folder 1. */
export const ARCHIVE_FOLDER_ID = 1;

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function draftDateOf(draft: Dialog['draft']): number {
  if (!draft || !('date' in draft)) return 0;
  return typeof draft.date === 'number' && draft.date > 0 ? draft.date : 0;
}

function defaultRank(peerId: string): DialogOrderRank {
  return {
    peerId,
    activityAt: 0,
    topMessageId: 0,
    topMessageDate: 0,
    draftDate: 0,
    pinnedOrder: undefined,
    folderId: undefined,
    isFolder: false,
  };
}

function firstPutMessage(payload: Extract<StoreSyncPayload, { type: 'message.put' }>): {
  peerId: string;
  id: number;
  date: number;
} | undefined {
  const msg = payload.messages[0] ?? payload.messageServices[0];
  if (!msg) return undefined;
  const peerId = peerIdFromTypePeer(msg.peer_id);
  if (!peerId) return undefined;
  return { peerId, id: msg.id, date: msg.date ?? 0 };
}

/**
 * In-memory dialog ranking for the Telegram SharedWorker.
 * Emits a new id list only after `getAllDialogs` has seeded and the order changed.
 */
export class DialogOrderTracker {
  private readonly ranks = new Map<string, DialogOrderRank>();
  private sortedDialogIds: string[] = [];
  private sortedAllDialogIds: string[] = [];
  private seeded = false;
  private dirty = false;
  private nextPinnedOrder = 0;

  get ids(): readonly string[] {
    return this.sortedDialogIds;
  }

  /** Sorted ids including the archive (Telegram folders 0 and 1). */
  get allIds(): readonly string[] {
    return this.sortedAllDialogIds;
  }

  get isSeeded(): boolean {
    return this.seeded;
  }

  /** Pinned peer ids for a folder, in current pin order (excludes folder rows). */
  pinnedPeerIds(folderId = 0): string[] {
    const entries: DialogOrderRank[] = [];
    for (const rank of this.ranks.values()) {
      if (rank.isFolder) continue;
      if ((rank.folderId ?? 0) !== folderId) continue;
      if (rank.pinnedOrder === undefined) continue;
      entries.push(rank);
    }
    entries.sort((a, b) => (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0));
    return entries.map((rank) => rank.peerId);
  }

  reset(): void {
    this.ranks.clear();
    this.sortedDialogIds = [];
    this.sortedAllDialogIds = [];
    this.seeded = false;
    this.dirty = false;
    this.nextPinnedOrder = 0;
  }

  /** Ingest one `messages.getDialogs` page. */
  ingestPage(page: DialogOrderPage, options: DialogOrderIngestOptions = {}): void {
    if (options.reset) {
      this.ranks.clear();
      this.nextPinnedOrder = 0;
      this.sortedDialogIds = [];
      this.sortedAllDialogIds = [];
    }

    const byPeerAndId = new Map<string, { id: number; date: number }>();
    for (const msg of [...page.messages, ...page.messageServices]) {
      const peerId = peerIdFromTypePeer(msg.peer_id);
      if (!peerId) continue;
      byPeerAndId.set(`${peerId}:${msg.id}`, { id: msg.id, date: msg.date ?? 0 });
    }

    for (const dialog of page.dialogs) {
      const peerId = peerIdFromTypePeer(dialog.peer);
      if (!peerId) continue;
      const topId = dialog.topMessage ?? 0;
      const top = byPeerAndId.get(`${peerId}:${topId}`);
      const topDate = top?.date ?? 0;
      const draftDate = draftDateOf(dialog.draft);
      let pinnedOrder: number | undefined;
      if (dialog.pinned) {
        pinnedOrder = this.nextPinnedOrder;
        this.nextPinnedOrder += 1;
      }
      this.ranks.set(peerId, {
        peerId,
        activityAt: Math.max(topDate, draftDate),
        topMessageId: topId,
        topMessageDate: topDate,
        draftDate,
        pinnedOrder,
        folderId: dialog.folderId ?? options.folderId,
        isFolder: false,
      });
    }

    for (const folder of page.dialogFolders) {
      const peerId = peerIdFromTypePeer(folder.peer);
      if (!peerId) continue;
      this.ranks.set(peerId, {
        ...defaultRank(peerId),
        isFolder: true,
        pinnedOrder: folder.pinned ? this.nextPinnedOrder++ : undefined,
      });
    }

    this.seeded = true;
    this.dirty = true;
  }

  /** Patch ranking from a live store-sync payload. Does not emit until {@link flush}. */
  apply(payload: StoreSyncPayload): void {
    switch (payload.type) {
      case 'message.put': {
        if (payload.op === 'edit') return;
        const msg = firstPutMessage(payload);
        if (!msg) return;
        const existing = this.ranks.get(msg.peerId) ?? defaultRank(msg.peerId);
        const isNew = !this.ranks.has(msg.peerId);
        if (msg.id >= existing.topMessageId) {
          existing.topMessageId = msg.id;
          existing.topMessageDate = msg.date;
          existing.activityAt = Math.max(msg.date, existing.draftDate);
          this.dirty = true;
        } else if (isNew) {
          this.dirty = true;
        }
        this.ranks.set(msg.peerId, existing);
        return;
      }
      case 'message.delete': {
        if (payload.peerId) {
          this.applyDelete(payload.peerId, payload.ids);
          return;
        }
        for (const peerId of this.ranks.keys()) {
          this.applyDelete(peerId, payload.ids);
        }
        return;
      }
      case 'draft': {
        const existing = this.ranks.get(payload.peerId) ?? defaultRank(payload.peerId);
        const nextDraft =
          payload.draft && 'date' in payload.draft && typeof payload.draft.date === 'number'
            ? payload.draft.date
            : 0;
        if (nextDraft === existing.draftDate && this.ranks.has(payload.peerId)) return;
        existing.draftDate = nextDraft;
        existing.activityAt = Math.max(existing.topMessageDate, nextDraft);
        this.ranks.set(payload.peerId, existing);
        this.dirty = true;
        return;
      }
      case 'dialogPinned': {
        const existing = this.ranks.get(payload.peerId) ?? defaultRank(payload.peerId);
        if (payload.folderId != null) existing.folderId = payload.folderId;
        if (payload.pinned) {
          if (existing.pinnedOrder === undefined) {
            existing.pinnedOrder = this.maxPinnedOrder() + 1;
          }
        } else {
          existing.pinnedOrder = undefined;
        }
        this.ranks.set(payload.peerId, existing);
        this.dirty = true;
        return;
      }
      case 'pinnedDialogs': {
        const folderId = payload.folderId ?? 0;
        const listed = new Set(payload.peerIds);
        for (const rank of this.ranks.values()) {
          const rankFolder = rank.folderId ?? 0;
          if (rankFolder !== folderId) continue;
          if (!listed.has(rank.peerId)) {
            rank.pinnedOrder = undefined;
          }
        }
        payload.peerIds.forEach((peerId, index) => {
          const existing = this.ranks.get(peerId) ?? defaultRank(peerId);
          existing.pinnedOrder = index;
          existing.folderId = payload.folderId;
          this.ranks.set(peerId, existing);
        });
        this.dirty = true;
        return;
      }
      case 'folderPeer': {
        const existing = this.ranks.get(payload.peerId) ?? defaultRank(payload.peerId);
        if (existing.folderId === payload.folderId && this.ranks.has(payload.peerId)) return;
        existing.folderId = payload.folderId;
        this.ranks.set(payload.peerId, existing);
        this.dirty = true;
        return;
      }
      default:
        return;
    }
  }

  /**
   * Recompute both sorted scopes. Returns them when seeded and either changed;
   * otherwise `undefined` (callers must not emit).
   */
  flush(): { ids: string[]; allIds: string[] } | undefined {
    if (!this.seeded || !this.dirty) return undefined;
    this.dirty = false;
    const ids = this.compute(0);
    const allIds = this.compute(ARCHIVE_FOLDER_ID);
    const idsChanged = !sameIds(ids, this.sortedDialogIds);
    const allChanged = !sameIds(allIds, this.sortedAllDialogIds);
    if (!idsChanged && !allChanged) return undefined;
    this.sortedDialogIds = ids;
    this.sortedAllDialogIds = allIds;
    return { ids, allIds };
  }

  private applyDelete(peerId: string, ids: number[]): void {
    const existing = this.ranks.get(peerId);
    if (!existing) return;
    if (!ids.includes(existing.topMessageId)) return;
    existing.topMessageId = 0;
    existing.topMessageDate = 0;
    existing.activityAt = existing.draftDate;
    this.dirty = true;
  }

  private maxPinnedOrder(): number {
    let max = -1;
    for (const rank of this.ranks.values()) {
      if (typeof rank.pinnedOrder === 'number' && rank.pinnedOrder > max) {
        max = rank.pinnedOrder;
      }
    }
    return max;
  }

  /** Rank non-folder dialogs whose Telegram folder is `<= maxFolderId`. */
  private compute(maxFolderId: number): string[] {
    const entries = [...this.ranks.values()].filter(
      (rank) => !rank.isFolder && (rank.folderId ?? 0) <= maxFolderId,
    );
    entries.sort((a, b) => {
      const aPinned = a.pinnedOrder !== undefined;
      const bPinned = b.pinnedOrder !== undefined;
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      if (aPinned && bPinned) {
        return (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0);
      }
      return b.activityAt - a.activityAt;
    });
    return entries.map((rank) => rank.peerId);
  }
}
