import { Controller, Method, RequestLog } from '@telegenie/decorators';
import type { TypeMessageReactions } from '@telegenie/libs/foundation/telegram/types/api-types';
import type {
  MessageNotificationPayload,
  StoreSyncPayload,
} from '@telegenie/libs/foundation/telegram/worker';
import { toJS } from 'mobx';
import { Dialog } from '../../store/entity/models/dialog.model';
import type GlobalStore from '../../store/global/global.store';
import { MAIN_THREAD_ID } from '../../store/global/models/thread.state';
import type StoreManager from '../../store/store.manager';
import type { DialogEntity, MessageEntity, MessageStore } from '../../store/types';
import { ConversionService } from '../common/services/convert.service';
import { writeStampedMessages } from '../common/stamp-reply-verification';
import type { DialogFilterController } from '../dialog-filter/dialog-filter.controller';
import {
  addedIncomingReaction,
  asMessageId,
  incomingReactionRemains,
  reactionNotificationBody,
  sameReactions,
} from './updates.helpers';

const MESSAGE_STORE_SUFFIX = '-message';

type MarkMessageListRead = (peerId: string, maxId: number) => void;
type EmitMessageNotification = (payload: MessageNotificationPayload) => void;

type UpdatesControllerOptions = {
  sm: StoreManager;
  debug?: boolean;
  ensureMessageStore: (peerId: string) => MessageStore;
  dialogFilter?: DialogFilterController;
  globalStore?: GlobalStore;
  markMessageListRead?: MarkMessageListRead;
  emitMessageNotification?: EmitMessageNotification;
};

/**
 * Applies SharedWorker `storeUpdate` payloads to in-memory dialog + message stores.
 */
@Controller
export class UpdatesController {
  private readonly sm: StoreManager;
  private readonly converter: ConversionService;
  private readonly ensureMessageStore: (peerId: string) => MessageStore;
  private readonly dialogFilter: DialogFilterController | undefined;
  private readonly globalStore: GlobalStore | undefined;
  private readonly markMessageListRead: MarkMessageListRead | undefined;
  private readonly emitMessageNotification: EmitMessageNotification | undefined;

  constructor({
    sm,
    debug,
    ensureMessageStore,
    dialogFilter,
    globalStore,
    markMessageListRead,
    emitMessageNotification,
  }: UpdatesControllerOptions) {
    this.sm = sm;
    this.converter = new ConversionService({ debug: debug ?? false });
    this.ensureMessageStore = ensureMessageStore;
    this.dialogFilter = dialogFilter;
    this.globalStore = globalStore;
    this.markMessageListRead = markMessageListRead;
    this.emitMessageNotification = emitMessageNotification;
  }

  // @RequestLog()
  @Method()
  apply(payload: StoreSyncPayload): void {
    switch (payload.type) {
      case 'message.put':
        this.applyMessagePut(payload);
        return;
      case 'message.patch':
        this.applyMessagePatch(payload);
        return;
      case 'message.delete':
        this.applyMessageDelete(payload.ids, payload.peerId);
        return;
      case 'read.inbox':
        this.applyInboxRead(payload.peerId, payload.maxId, payload.stillUnreadCount);
        return;
      case 'read.outbox':
        this.patchDialog(payload.peerId, { readOutboxMaxId: payload.maxId });
        return;
      case 'read.contents':
        this.applyContentsRead(payload.peerId, payload.ids);
        return;
      case 'draft':
        this.patchDialog(payload.peerId, { draft: payload.draft });
        return;
      case 'unreadMark':
        this.patchDialog(payload.peerId, { unreadMark: payload.unread });
        return;
      case 'dialogPinned':
        this.patchDialog(payload.peerId, {
          pinned: payload.pinned,
          ...(payload.folderId != null ? { folderId: payload.folderId } : {}),
        });
        return;
      case 'pinnedDialogs':
        this.applyPinnedDialogs(payload.peerIds, payload.folderId);
        return;
      case 'notifySettings':
        this.patchDialog(payload.peerId, { notifySettings: payload.notifySettings });
        return;
      case 'folderPeer':
        this.patchDialog(payload.peerId, { folderId: payload.folderId });
        return;
      case 'dialogFilter.put':
      case 'dialogFilter.delete':
      case 'dialogFilter.order':
      case 'dialogFilter.reload':
        this.dialogFilter?.applyUpdate(payload);
        return;
      default:
        return;
    }
  }

  private applyMessagePut(payload: Extract<StoreSyncPayload, { type: 'message.put' }>): void {
    const entities: MessageEntity[] = [
      ...this.converter.convertMessages(payload.messages),
      ...this.converter.convertServiceMessages(payload.messageServices),
      ...this.converter.convertEmptyMessages(payload.emptyMessages),
    ];
    if (entities.length === 0) return;
    const priorReactions = new Map<string, TypeMessageReactions | undefined>();
    if (payload.op === 'edit' && this.globalStore) {
      for (const entity of entities) {
        if (entity.isEmpty || !entity.peerId) continue;
        const existing = this.ensureMessageStore(entity.peerId).getAllData().get(String(entity.id));
        priorReactions.set(`${entity.peerId}:${entity.id}`, existing?.reactions);
      }
    }
    writeStampedMessages(this.ensureMessageStore, entities);

    const primary = entities.find((e) => !e.isEmpty) ?? entities[0];
    if (!primary?.peerId) return;

    const incomingId = asMessageId(primary.id);
    const existing = this.dialogOf(primary.peerId);
    const currentTop = existing ? asMessageId(existing.topMessageId) : 0;
    const patch: Partial<DialogEntity> = {};
    if (incomingId >= currentTop) {
      patch.topMessageId = String(incomingId);
    }
    if (payload.op === 'new' && !primary.out) {
      patch.unreadCount = (existing?.unreadCount ?? 0) + 1;
      if (primary.mentioned && primary.mediaUnread) {
        patch.unreadMentionsCount = (existing?.unreadMentionsCount ?? 0) + 1;
      }
    }
    if (!existing || Object.keys(patch).length > 0) {
      this.patchDialog(primary.peerId, patch);
    }

    if (this.globalStore && payload.op === 'new') {
      for (const entity of entities) {
        if (entity.isEmpty || !entity.peerId) continue;
        this.globalStore
          .getOrCreateThreadUI(entity.peerId, MAIN_THREAD_ID)
          .ingestLiveMessage(String(entity.id));
        if (!entity.out && entity.mentioned && entity.mediaUnread) {
          const dialogUI = this.globalStore.getOrCreateDialogUI(entity.peerId);
          const nextIds = [...dialogUI.unreadMentionIds, String(entity.id)];
          this.globalStore.getOrCreateDialogUI(entity.peerId).setUnreadMentionIds(nextIds);
        }
      }
    }

    if (
      payload.op === 'new' &&
      primary.out &&
      incomingId > 0 &&
      this.globalStore?.nav.selectedDialogId === primary.peerId
    ) {
      this.markMessageListRead?.(primary.peerId, incomingId);
    }
    if (this.globalStore) {
      const emptyIds = entities.filter((e) => e.isEmpty).map((e) => e.id);
      if (emptyIds.length > 0 && primary.peerId) {
        this.globalStore
          .getOrCreateThreadUI(primary.peerId, MAIN_THREAD_ID)
          .markCachedDeleted(emptyIds);
      }
    }

    if (payload.op === 'edit' && this.globalStore) {
      const selfUserId = this.selfUserId();
      for (const entity of entities) {
        if (entity.isEmpty || !entity.peerId || entity.out === false || !entity.reactions) continue;
        const before = priorReactions.get(`${entity.peerId}:${entity.id}`);
        if (sameReactions(before, entity.reactions)) continue;
        this.applyUnreadReactionTransition(
          entity.peerId,
          String(entity.id),
          before,
          entity.reactions,
          selfUserId,
          entity.out === true,
        );
      }
    }
  }

  private applyMessagePatch(payload: Extract<StoreSyncPayload, { type: 'message.patch' }>): void {
    const store = this.ensureMessageStore(payload.peerId);
    const entities: MessageEntity[] = [];

    const selfUserId = this.selfUserId();
    for (const patch of payload.patches) {
      const existing = store.getAllData().get(String(patch.id));
      const base = existing ? (toJS(existing) as MessageEntity) : undefined;
      const reactionsChanged =
        patch.reactions !== undefined && !sameReactions(base?.reactions, patch.reactions);
      const statsChanged = patch.views != null || patch.forwards != null || patch.pinned != null;
      // `out === false` is someone else's message. A missing message can still
      // carry the server unread flag, which is only set for reactions on ours.
      if (reactionsChanged && this.globalStore && base?.out !== false) {
        this.applyUnreadReactionTransition(
          payload.peerId,
          String(patch.id),
          base?.reactions,
          patch.reactions,
          selfUserId,
          base?.out === true,
        );
      }
      if (!existing || !base) continue;
      if (!reactionsChanged && !statsChanged) continue;

      entities.push({
        ...base,
        ...(patch.views != null ? { views: patch.views } : {}),
        ...(patch.forwards != null ? { forwards: patch.forwards } : {}),
        ...(patch.pinned != null ? { pinned: patch.pinned } : {}),
        ...(reactionsChanged ? { reactions: patch.reactions } : {}),
      });
    }

    if (entities.length > 0) {
      store.update(entities);
    }

    const pinnedPatches = payload.patches.filter((p) => p.pinned != null);
    if (pinnedPatches.length > 0) {
      const dialogUI = this.globalStore?.dialogs.get(payload.peerId);
      if (dialogUI) {
        let currentIds = [...dialogUI.pinnedMessageIds];
        for (const p of pinnedPatches) {
          if (p.pinned) {
            if (!currentIds.includes(p.id)) {
              currentIds.unshift(p.id);
            }
          } else {
            currentIds = currentIds.filter((id) => id !== p.id);
          }
        }
        this.globalStore?.getOrCreateDialogUI(payload.peerId).setPinnedMessages(currentIds);
      }
    }
  }

  /** Same removal as an inbound `message.delete`, for a delete RPC that returns no message updates. */
  @RequestLog()
  @Method()
  applyLocalMessageDelete(peerId: string, ids: number[]): void {
    this.applyMessageDelete(ids, peerId);
  }

  private applyMessageDelete(ids: number[], peerId?: string): void {
    const idStrings = ids.map(String);
    const targets = peerId
      ? [{ peerId, store: this.ensureMessageStore(peerId) }]
      : this.messageStores();

    for (const { peerId: pid, store } of targets) {
      store.deleteByIds(idStrings);
      this.globalStore?.getOrCreateThreadUI(pid, MAIN_THREAD_ID).markCachedDeleted(idStrings);
      // Any thread of the peer may have the deleted message selected.
      const dialogUI = this.globalStore?.getDialogUI(pid);
      if (dialogUI) {
        for (const thread of dialogUI.threads.values()) thread.pruneSelected(idStrings);
      }
      const dialog = this.dialogOf(pid);
      if (!dialog) continue;
      if (!ids.includes(asMessageId(dialog.topMessageId))) continue;
      this.patchDialog(pid, { topMessageId: this.highestMessageId(store) });
    }
  }

  private applyPinnedDialogs(peerIds: string[], folderId?: number): void {
    const folder = folderId ?? 0;
    const listed = new Set(peerIds);
    const dialogStore = this.sm.get('dialog');
    for (const dialog of dialogStore.getAllData().values()) {
      if ((dialog.folderId ?? 0) !== folder) continue;
      const pinned = listed.has(dialog.id);
      if (Boolean(dialog.pinned) !== pinned) {
        this.patchDialog(dialog.peerId || dialog.id, { pinned });
      }
    }
    for (const id of peerIds) {
      this.patchDialog(id, { pinned: true, ...(folderId != null ? { folderId } : {}) });
    }
  }

  /** Inbox read id only increases; ignore older `still_unread_count` (core.telegram.org/api/views). */
  private applyInboxRead(peerId: string, maxId: number, stillUnreadCount: number): void {
    const currentMax = this.dialogOf(peerId)?.readInboxMaxId ?? 0;
    if (maxId < currentMax) return;
    this.patchDialog(peerId, {
      readInboxMaxId: maxId,
      unreadCount: stillUnreadCount,
    });
  }

  private applyContentsRead(peerId: string | undefined, ids: number[]): void {
    const idStrings = ids.map(String);
    const targets = peerId
      ? [{ peerId, store: this.ensureMessageStore(peerId) }]
      : this.messageStores();

    for (const { peerId: pid, store } of targets) {
      const patches: MessageEntity[] = [];
      const mentionIds: string[] = [];

      for (const id of idStrings) {
        const existing = store.getAllData().get(id);
        if (!existing?.mediaUnread) continue;
        if (existing.hasUnreadMention) mentionIds.push(id);
        const base = toJS(existing) as MessageEntity;
        patches.push({ ...base, mediaUnread: false });
      }

      if (patches.length) {
        store.update(patches);
      }
      if (!mentionIds.length) continue;

      this.globalStore?.getOrCreateDialogUI(pid).removeUnreadMentionIds(mentionIds);
      const dialog = this.dialogOf(pid);
      if (!dialog?.unreadMentionsCount) continue;
      const nextCount = Math.max(0, dialog.unreadMentionsCount - mentionIds.length);
      this.patchDialog(pid, {
        unreadMentionsCount: nextCount > 0 ? nextCount : undefined,
      });
    }
  }

  private selfUserId(): string | undefined {
    if (!this.sm.has('user')) return undefined;
    for (const user of this.sm.get('user').getAllData().values()) {
      if (user.self && user.id) return String(user.id);
    }
    return undefined;
  }

  private applyUnreadReactionTransition(
    peerId: string,
    messageId: string,
    before: TypeMessageReactions | undefined,
    after: TypeMessageReactions | undefined,
    selfUserId: string | undefined,
    trustCountDelta: boolean,
  ): void {
    if (!this.globalStore) return;
    const added = addedIncomingReaction(before, after, selfUserId, trustCountDelta);
    const dialogUI = this.globalStore.getOrCreateDialogUI(peerId);
    const ids = [...dialogUI.unreadReactionIds];
    const listed = ids.includes(messageId);

    if (added && !listed && !dialogUI.hasSeenReaction(messageId)) {
      const nextIds = [...ids, messageId].sort((a, b) => Number(b) - Number(a));
      dialogUI.setUnreadReactionIds(nextIds);
      this.patchDialog(peerId, {
        unreadReactionsCount: nextIds.length > 0 ? nextIds.length : undefined,
      });
      if (this.globalStore.nav.selectedDialogId !== peerId) {
        const body = reactionNotificationBody(after);
        this.emitMessageNotification?.({
          chatId: peerId,
          messageId: Number(messageId),
          title: peerId,
          body,
          reaction: body,
        });
      }
      return;
    }

    if (listed && !incomingReactionRemains(after, selfUserId)) {
      dialogUI.removeUnreadReactionIds([messageId]);
      const remaining = dialogUI.unreadReactionIds.length;
      this.patchDialog(peerId, {
        unreadReactionsCount: remaining > 0 ? remaining : undefined,
      });
    }
  }

  private patchDialog(peerId: string, patch: Partial<DialogEntity>): void {
    if (!peerId) return;
    const existing = this.dialogOf(peerId);
    const merged: DialogEntity = {
      topMessageId: '',
      unreadCount: 0,
      isFolder: false,
      ...(existing ? (toJS(existing) as DialogEntity) : {}),
      ...patch,
      id: peerId,
      peerId,
    };
    this.sm.get('dialog').update([new Dialog(merged)]);
  }

  private dialogOf(peerId: string): Dialog | undefined {
    return this.sm.get('dialog').getAllData().get(peerId) as Dialog | undefined;
  }

  private messageStores(): Array<{ peerId: string; store: MessageStore }> {
    const result: Array<{ peerId: string; store: MessageStore }> = [];
    for (const name of this.sm.names()) {
      if (!name.endsWith(MESSAGE_STORE_SUFFIX)) continue;
      result.push({
        peerId: name.slice(0, -MESSAGE_STORE_SUFFIX.length),
        store: this.sm.get(name) as MessageStore,
      });
    }
    return result;
  }

  private highestMessageId(store: MessageStore): string {
    let best = 0;
    for (const message of store.getAllData().values()) {
      if (message.isEmpty) continue;
      const id = asMessageId(message.id);
      if (id > best) best = id;
    }
    return best > 0 ? String(best) : '';
  }
}
