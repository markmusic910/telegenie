import { observable, runInAction, type ObservableMap } from 'mobx';
import BaseStore from '../base.store';
import type { Channel } from '../entity/models/channel.model';
import type { Dialog } from '../entity/models/dialog.model';
import type StoreManager from '../store.manager';
import type { MessageStore } from '../types';
import { AuthSlice, type AuthStep } from './models/auth.slice';
import { DialogSlice } from './models/dialog.slice';
import type { DialogUISnapshot } from './models/dialog.state';
import { LeaderSlice } from './models/leader.slice';
import { NavSlice } from './models/nav.slice';
import { StickersSlice } from './models/stickers.slice';
import { ThreadSlice, type ThreadSliceContext } from './models/thread.slice';
import { MAIN_THREAD_ID, type ThreadUISnapshot } from './models/thread.state';

export type { AuthStep };

export class GlobalStore extends BaseStore {
  auth: AuthSlice;
  leader: LeaderSlice;
  nav: NavSlice;
  stickers: StickersSlice;
  dialogs: ObservableMap<string, DialogSlice> = observable.map();

  private sm?: StoreManager;

  constructor(sm?: StoreManager) {
    super();
    this.sm = sm;
    this.auth = new AuthSlice();
    this.leader = new LeaderSlice();
    this.nav = new NavSlice(this);
    this.stickers = new StickersSlice();
  }

  getData() {
    return this;
  }

  getDialogUI(peerId: string): DialogSlice | undefined {
    return this.dialogs.get(peerId);
  }

  getThreadUI(peerId: string, threadId: string = MAIN_THREAD_ID): ThreadSlice | undefined {
    return this.dialogs.get(peerId)?.threads.get(threadId);
  }

  getOrCreateDialogUI(peerId: string): DialogSlice {
    let dialogUI = this.dialogs.get(peerId);
    if (!dialogUI) {
      dialogUI = new DialogSlice((_threadId, snapshot) => this.createThread(peerId, snapshot));
      dialogUI.getOrCreateThread(MAIN_THREAD_ID);
      this.dialogs.set(peerId, dialogUI);
    }
    return dialogUI;
  }

  getOrCreateThreadUI(peerId: string, threadId: string = MAIN_THREAD_ID): ThreadSlice {
    return this.getOrCreateDialogUI(peerId).getOrCreateThread(threadId);
  }

  deleteDialog(peerId: string) {
    this.dialogs.delete(peerId);
  }

  deleteThread(peerId: string, threadId: string) {
    const dialog = this.dialogs.get(peerId);
    if (!dialog) return;
    dialog.deleteThread(threadId);
    if (dialog.threads.size === 0) {
      this.dialogs.delete(peerId);
    }
  }

  reconcileAllIndexesWithStore() {
    for (const [peerId, dialog] of this.dialogs.entries()) {
      for (const threadId of dialog.threads.keys()) {
        this.getOrCreateThreadUI(peerId, threadId).reconcileIndexWithStore();
      }
    }
  }

  hydrateDialogsFromSnapshot(snapshot: Record<string, unknown> | undefined) {
    if (!snapshot) return;
    const dialogsData = snapshot.dialogs ?? snapshot.dialogsUI;
    if (!dialogsData || typeof dialogsData !== 'object') return;
    runInAction(() => {
      this.dialogs.clear();
      for (const [peerId, plain] of Object.entries(dialogsData as Record<string, unknown>)) {
        this.dialogs.set(
          peerId,
          DialogSlice.fromSnapshot(
            (_threadId, threadSnap) => this.createThread(peerId, threadSnap),
            plain as DialogUISnapshot,
          ),
        );
      }
    });
  }

  hydrateAppSnapshot(snapshot: Record<string, unknown> | undefined) {
    this.leader.hydrateFromSnapshot(snapshot);
    this.nav.hydrateFromSnapshot(snapshot);
    this.stickers.hydrateFromSnapshot(snapshot);
    this.hydrateDialogsFromSnapshot(snapshot);
  }

  toJS() {
    return {
      auth: this.auth.toJS(),
      // Keep the legacy `app` IDB key so StoreCache does not need a version bump.
      app: {
        ...this.leader.toJS(),
        ...this.nav.toJS(),
        ...this.dialogsToJS(),
        ...this.stickers.toJS(),
      },
    };
  }

  private dialogsToJS() {
    const dialogs: Record<string, DialogUISnapshot> = {};
    for (const [peerId, dialog] of this.dialogs.entries()) {
      dialogs[peerId] = dialog.toSnapshot();
    }
    return { dialogs };
  }

  private createThread(peerId: string, snapshot?: ThreadUISnapshot) {
    return new ThreadSlice(this.threadCtx(peerId), snapshot);
  }

  private threadCtx(peerId: string): ThreadSliceContext {
    return {
      peerId,
      getTopMessageId: () => this.dialogEntity(peerId)?.topMessageId,
      getDialog: () => this.dialogEntity(peerId),
      getChannel: () =>
        this.sm?.has('channel')
          ? (this.sm.get('channel').get(peerId) as Channel | undefined)
          : undefined,
      getMessageStore: () => {
        const storeName = `${peerId}-message`;
        return this.sm?.has(storeName) ? (this.sm.get(storeName) as MessageStore) : undefined;
      },
    };
  }

  private dialogEntity(peerId: string): Dialog | undefined {
    return this.sm?.has('dialog')
      ? (this.sm.get('dialog').get(peerId) as Dialog | undefined)
      : undefined;
  }
}

export default GlobalStore;
