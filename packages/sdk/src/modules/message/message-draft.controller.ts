import { Controller, Method, RequestLog } from '@telegenie/decorators';
import type { TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';
import { readPeerAccessHash } from '@telegenie/libs/foundation/telegram/utils';
import { toJS } from 'mobx';
import { Dialog } from '../../store/entity/models/dialog.model';
import type { Message } from '../../store/entity/models/message.model';
import type GlobalStore from '../../store/global/global.store';
import { MAIN_THREAD_ID, type MessageDraft, type StagedForward } from '../../store/global/models/thread.state';
import type StoreManager from '../../store/store.manager';
import type { DialogEntity } from '../../store/types';
import {
  dialogDraftFromMessage,
  customEmojiEntities,
  draftThreadKey,
  normalizeDraft,
  sameDraft,
  serverMessageDraft,
} from './message-draft.utils';

/** Server copy of the thread draft. The thread draft is written immediately; this only syncs it. */
export const SAVE_DRAFT_DEBOUNCE_MS = 1_000;

export type SaveDraftFlight = {
  settled: boolean;
  done: Promise<void>;
};

type MessageDraftControllerOptions = {
  worker: TelegramWorkerClient;
  sm: StoreManager;
  globalStore: GlobalStore;
};

/** Thread-draft buffer and the debounced `message.saveDraft` sync. */
@Controller
export class MessageDraftController {
  private readonly saveDraftTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly saveDraftGeneration = new Map<string, number>();
  private readonly saveDraftFlight = new Map<string, SaveDraftFlight>();

  constructor(private readonly options: MessageDraftControllerOptions) {}

  @RequestLog()
  @Method()
  setReplyingTo(peerId: string, messageId?: string, threadId: string = MAIN_THREAD_ID): void {
    const thread = this.options.globalStore.getOrCreateThreadUI(peerId, threadId);
    thread.setReplyingToId(messageId);
    const draft = thread.draft;
    if (!draft || draft.replyToMsgId === messageId) return;
    const next: MessageDraft = { text: draft.text };
    if (draft.entities?.length) next.entities = draft.entities;
    if (messageId) next.replyToMsgId = messageId;
    thread.setDraft(next);
    this.mirrorDialogDraft(peerId, next);
    this.scheduleSaveDraft(peerId, threadId);
  }

  /**
   * Open the composer on a text message. The normal draft and reply stay put
   * so cancel can restore them. Edit text is not written to `message.saveDraft`.
   */
  @RequestLog()
  @Method()
  startEditing(peerId: string, messageId: string, threadId: string = MAIN_THREAD_ID): void {
    const thread = this.options.globalStore.getOrCreateThreadUI(peerId, threadId);
    thread.setEditingId(messageId);
    const text = this.readMessageText(peerId, messageId);
    thread.setEditingText(text.length > 0 ? text : undefined);
  }

  /** In-progress edit buffer. Empty string is kept so a cleared field stays cleared. */
  @RequestLog()
  @Method()
  setEditingText(peerId: string, text: string, threadId: string = MAIN_THREAD_ID): void {
    const thread = this.options.globalStore.getOrCreateThreadUI(peerId, threadId);
    thread.setEditingText(text);
  }

  /**
   * Show a forward in the destination composer. Not written to the thread snapshot.
   * Clears an in-progress edit so the forward bar is the one on screen.
   */
  @RequestLog()
  @Method()
  stageForward(
    toPeerId: string,
    fromPeerId: string,
    messageId: string,
    threadId: string = MAIN_THREAD_ID,
  ): void {
    const thread = this.options.globalStore.getOrCreateThreadUI(toPeerId, threadId);
    thread.setEditingId(undefined);
    thread.setEditingText(undefined);
    const next: StagedForward = { fromPeerId, messageId, dropAuthor: false };
    thread.setForwarding(next);
  }

  @RequestLog()
  @Method()
  setForwardDropAuthor(
    peerId: string,
    dropAuthor: boolean,
    threadId: string = MAIN_THREAD_ID,
  ): void {
    const thread = this.options.globalStore.getThreadUI(peerId, threadId);
    if (!thread?.forwarding) return;
    thread.setForwarding({ ...thread.forwarding, dropAuthor });
  }

  @RequestLog()
  @Method()
  clearForward(peerId: string, threadId: string = MAIN_THREAD_ID): void {
    this.options.globalStore.getThreadUI(peerId, threadId)?.setForwarding(undefined);
  }

  @RequestLog()
  @Method()
  cancelEditing(peerId: string, threadId: string = MAIN_THREAD_ID): void {
    const thread = this.options.globalStore.getThreadUI(peerId, threadId);
    thread?.setEditingId(undefined);
    thread?.setEditingText(undefined);
  }

  private readMessageText(peerId: string, messageId: string): string {
    const storeName = `${peerId}-message`;
    if (!this.options.sm.has(storeName)) return '';
    const store = this.options.sm.get(storeName);
    if (!('getAllData' in store)) return '';
    const message = store.getAllData().get(messageId) as Message | undefined;
    return message?.message ?? '';
  }

  /**
   * Thread draft is the only composer buffer. This writes it immediately and
   * debounces `message.saveDraft` so the UI never syncs a second copy.
   * `undefined` or empty text clears it. A clear drops `replyingToId` only when
   * that reply was stored on the draft.
   */
  @RequestLog()
  @Method()
  setDraft(peerId: string, draft?: MessageDraft, threadId: string = MAIN_THREAD_ID): void {
    const thread = this.options.globalStore.getOrCreateThreadUI(peerId, threadId);
    const previous = thread.draft;
    const next = normalizeDraft(draft, thread.replyingToId);
    if (!sameDraft(previous, next)) {
      thread.setDraft(next);
      if (next?.replyToMsgId) {
        thread.setReplyingToId(next.replyToMsgId);
      } else if (previous?.replyToMsgId && thread.replyingToId === previous.replyToMsgId) {
        thread.setReplyingToId(undefined);
      }
      this.scheduleSaveDraft(peerId, threadId);
    }
    this.mirrorDialogDraft(peerId, next);
  }

  /**
   * Copy Telegram's draft into the thread when this tab has none.
   * A local draft, or a save still waiting to sync, wins over the server copy.
   */
  @RequestLog()
  @Method()
  adoptDialogDraft(peerId: string, threadId: string = MAIN_THREAD_ID): void {
    if (this.options.globalStore.getThreadUI(peerId, threadId)?.draft) return;
    if (this.hasPendingSaveDraft(peerId, threadId)) return;
    const server = serverMessageDraft(this.readDialog(peerId)?.draft);
    if (!server) return;
    this.setDraft(peerId, server, threadId);
  }

  /** In-flight save captured before `sendText` awaits, so a late RPC can be cleared. */
  @Method()
  overlappingSave(peerId: string, threadId: string = MAIN_THREAD_ID): SaveDraftFlight | undefined {
    const flight = this.saveDraftFlight.get(draftThreadKey(peerId, threadId));
    if (!flight || flight.settled) return undefined;
    return flight;
  }

  @Method()
  async clearAfterSend(
    peerId: string,
    threadId: string,
    overlappingSave: SaveDraftFlight | undefined,
  ): Promise<void> {
    const key = draftThreadKey(peerId, threadId);
    this.dropPendingSaveDraft(peerId, threadId);
    const thread = this.options.globalStore.getThreadUI(peerId, threadId);
    thread?.setDraft(undefined);
    thread?.setReplyingToId(undefined);
    this.mirrorDialogDraft(peerId, undefined);
    if (!overlappingSave) return;
    await overlappingSave.done;
    if (this.options.globalStore.getThreadUI(peerId, threadId)?.draft) return;
    if (this.saveDraftTimers.has(key)) return;
    const generation = this.saveDraftGeneration.get(key) ?? 0;
    this.enqueueSaveDraft(peerId, threadId, generation);
    await this.saveDraftFlight.get(key)?.done;
  }

  private hasPendingSaveDraft(peerId: string, threadId: string): boolean {
    const key = draftThreadKey(peerId, threadId);
    if (this.saveDraftTimers.has(key)) return true;
    const flight = this.saveDraftFlight.get(key);
    return Boolean(flight && !flight.settled);
  }

  /**
   * The chat list reads `dialog.draft`, which otherwise changes only when
   * `UpdateDraftMessage` echoes. Write the thread draft there immediately so a
   * chat with no previous draft still shows what was just typed.
   */
  private mirrorDialogDraft(peerId: string, draft: MessageDraft | undefined): void {
    if (!this.options.sm.has('dialog')) return;
    const store = this.options.sm.get('dialog');
    const existing = store.getAllData().get(peerId) as Dialog | undefined;
    if (!existing) return;
    if (sameDraft(serverMessageDraft(existing.draft), draft)) return;
    const plain = toJS(existing) as DialogEntity;
    store.update([
      new Dialog({
        ...plain,
        id: peerId,
        peerId,
        draft: dialogDraftFromMessage(draft),
      }),
    ]);
  }

  private readDialog(peerId: string): Dialog | undefined {
    if (!this.options.sm.has('dialog')) return undefined;
    return this.options.sm.get('dialog').get(peerId) as Dialog | undefined;
  }

  private bumpSaveDraftGeneration(peerId: string, threadId: string): number {
    const key = draftThreadKey(peerId, threadId);
    const next = (this.saveDraftGeneration.get(key) ?? 0) + 1;
    this.saveDraftGeneration.set(key, next);
    return next;
  }

  private scheduleSaveDraft(peerId: string, threadId: string): void {
    const key = draftThreadKey(peerId, threadId);
    const existing = this.saveDraftTimers.get(key);
    if (existing) clearTimeout(existing);
    const generation = this.bumpSaveDraftGeneration(peerId, threadId);
    this.saveDraftTimers.set(
      key,
      setTimeout(() => {
        this.saveDraftTimers.delete(key);
        this.enqueueSaveDraft(peerId, threadId, generation);
      }, SAVE_DRAFT_DEBOUNCE_MS),
    );
  }

  private dropPendingSaveDraft(peerId: string, threadId: string): void {
    const key = draftThreadKey(peerId, threadId);
    const existing = this.saveDraftTimers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.saveDraftTimers.delete(key);
    }
    this.bumpSaveDraftGeneration(peerId, threadId);
  }

  /**
   * Serialize saves per thread so an older RPC cannot land after a newer one.
   * Arrow field: the debounce timer fires outside a `@Method` call.
   */
  private readonly enqueueSaveDraft = (
    peerId: string,
    threadId: string,
    generation: number,
  ): void => {
    const key = draftThreadKey(peerId, threadId);
    const previous = this.saveDraftFlight.get(key);
    let settle = (): void => {};
    const done = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const flight: SaveDraftFlight = { settled: false, done };
    this.saveDraftFlight.set(key, flight);
    void (async () => {
      try {
        if (previous) await previous.done;
        if (this.saveDraftGeneration.get(key) !== generation) return;
        const draft = this.options.globalStore.getThreadUI(peerId, threadId)?.draft;
        const message = draft?.text ?? '';
        const replyNum =
          message && draft?.replyToMsgId != null ? Number(draft.replyToMsgId) : Number.NaN;
        const replyToMsgId = Number.isInteger(replyNum) && replyNum > 0 ? replyNum : undefined;
        const entities = customEmojiEntities(draft?.entities);
        const accessHash = readPeerAccessHash(this.options.sm, peerId);
        try {
          await this.options.worker.call(
            'message.saveDraft',
            entities
              ? [peerId, message, accessHash, replyToMsgId, entities]
              : [peerId, message, accessHash, replyToMsgId],
          );
        } catch {
          // The thread draft stays the source of truth if the RPC fails.
        }
      } finally {
        flight.settled = true;
        settle();
      }
    })();
  };
}
