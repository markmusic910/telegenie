import { Controller, Method, RequestLog } from '@telegenie/decorators';
import type {
  FolderFilter,
  StoreSyncPayload,
  TelegramWorkerClient,
} from '@telegenie/libs/foundation/telegram/worker';
import { runInAction } from 'mobx';
import { DialogFilterModel } from '../../store/entity/models/dialog-filter.model';
import type GlobalStore from '../../store/global/global.store';
import type StoreManager from '../../store/store.manager';
import type { DialogFilterEntity } from '../../store/types';
import {
  ALL_CHATS_FOLDER_ID,
  DEFAULT_FOLDER_ENTITIES,
  DEFAULT_FOLDER_IDS,
} from './dialog-filter.constants';

type DialogFilterControllerOptions = {
  sm: StoreManager;
  globalStore: GlobalStore;
  worker: TelegramWorkerClient;
  debug?: boolean;
};

export type DialogFilterStoreSyncPayload = Extract<
  StoreSyncPayload,
  { type: `dialogFilter.${string}` }
>;

function toEntity(filter: FolderFilter): DialogFilterEntity {
  return {
    id: String(filter.id),
    folderId: filter.id,
    title: filter.title,
    emoticon: filter.emoticon,
    color: filter.color,
    isDefault: filter.id === 0,
    isLocal: false,
    isChatlist: filter.isChatlist,
    contacts: filter.contacts,
    nonContacts: filter.nonContacts,
    groups: filter.groups,
    broadcasts: filter.broadcasts,
    bots: filter.bots,
    excludeMuted: filter.excludeMuted,
    excludeRead: filter.excludeRead,
    excludeArchived: filter.excludeArchived,
    pinnedPeerIds: filter.pinnedPeerIds,
    includePeerIds: filter.includePeerIds,
    excludePeerIds: filter.excludePeerIds,
  };
}

/**
 * Chat folders (dialog filters).
 *
 * Owns the folder definitions and the rail order. Which dialogs a folder holds
 * is derived by the UI via `dialog-filter.matcher`, since Telegram has no RPC
 * that enumerates a folder's chats.
 */
@Controller
export class DialogFilterController {
  private readonly sm: StoreManager;
  private readonly globalStore: GlobalStore;
  private readonly worker: TelegramWorkerClient;
  private readonly debug: boolean;

  constructor({ sm, globalStore, worker, debug }: DialogFilterControllerOptions) {
    this.sm = sm;
    this.globalStore = globalStore;
    this.worker = worker;
    this.debug = debug ?? false;
  }

  private get store() {
    return this.sm.get('dialogFilter');
  }

  /**
   * Put All Chats into the store and make sure it holds the front of the rail
   * order. Runs before any network call so the rail always renders.
   */
  @RequestLog()
  @Method()
  seedDefaults(): void {
    const existing = this.store.getAllData();
    const missing = DEFAULT_FOLDER_ENTITIES.filter((folder) => !existing.has(folder.id));
    if (missing.length > 0) {
      this.store.update(missing.map((folder) => new DialogFilterModel(folder)));
    }
    if (this.globalStore.nav.sortedFolderIds.length === 0) {
      this.globalStore.nav.setSortedFolderIds([...DEFAULT_FOLDER_IDS]);
    }
  }

  /** Fetch folder definitions and reconcile the rail order with the server order. */
  @RequestLog()
  @Method()
  async getAll(): Promise<DialogFilterEntity[]> {
    const batch = await this.worker.call('dialogFilter.getAll', []);
    const entities = batch.filters.map(toEntity);

    if (entities.length > 0) {
      this.store.update(entities.map((entity) => new DialogFilterModel(entity)));
    }

    const keep = new Set([...entities.map((entity) => entity.id), ...DEFAULT_FOLDER_IDS]);
    const stale: string[] = [];
    for (const id of this.store.getAllData().keys()) {
      if (keep.has(id)) continue;
      stale.push(id);
    }
    if (stale.length > 0) {
      this.store.deleteByIds(stale);
    }

    this.reconcileOrder(batch.order.map(String));

    if (!this.store.getAllData().has(this.globalStore.nav.selectedFolderId)) {
      this.globalStore.nav.setSelectedFolderId(ALL_CHATS_FOLDER_ID);
    }
    if (this.debug) {
      console.info('[DialogFilterModule] folders', this.globalStore.nav.sortedFolderIds);
    }
    return entities;
  }

  /** Select the folder shown on the dialog rail. */
  @RequestLog()
  @Method()
  selectFolder(folderId: string): void {
    this.globalStore.nav.setSelectedFolderId(folderId);
  }

  /**
   * Persist a new rail order. Applies locally first, then pushes the server
   * folders to Telegram; reverts the local order if the RPC fails.
   */
  @RequestLog()
  @Method()
  async reorder(folderIds: string[]): Promise<void> {
    const previous = [...this.globalStore.nav.sortedFolderIds];
    this.globalStore.nav.setSortedFolderIds(folderIds);

    const serverOrder = folderIds.map(Number).filter((id) => Number.isFinite(id));

    if (serverOrder.length === 0) return;

    try {
      await this.worker.call('dialogFilter.reorder', [serverOrder]);
    } catch (err) {
      this.globalStore.nav.setSortedFolderIds(previous);
      throw err;
    }
  }

  /** Apply a `dialogFilter.*` store-sync payload from the SharedWorker. */
  @RequestLog()
  @Method()
  applyUpdate(payload: DialogFilterStoreSyncPayload): void {
    switch (payload.type) {
      case 'dialogFilter.put': {
        const entity = toEntity(payload.filter);
        this.store.update([new DialogFilterModel(entity)]);
        this.appendToOrder(entity.id);
        return;
      }
      case 'dialogFilter.delete': {
        this.removeFolder(String(payload.id));
        return;
      }
      case 'dialogFilter.order': {
        this.reconcileOrder(payload.order.map(String));
        return;
      }
      case 'dialogFilter.reload': {
        void this.getAll().catch((err) => {
          console.error('[DialogFilterModule] reload failed', err);
        });
        return;
      }
      default:
        return;
    }
  }

  /**
   * Apply server folder order. When `serverOrder` is non-empty it replaces the
   * rail order; an empty order only seeds All Chats before the first fetch.
   */
  @RequestLog()
  @Method()
  reconcileOrder(serverOrder: string[]): void {
    const known = new Set(this.store.getAllData().keys());
    for (const id of DEFAULT_FOLDER_IDS) known.add(id);

    const next: string[] = [];
    const seen = new Set<string>();
    const push = (id: string) => {
      if (seen.has(id) || !known.has(id)) return;
      seen.add(id);
      next.push(id);
    };

    if (serverOrder.length > 0) {
      for (const id of serverOrder) push(id);
      for (const id of known) push(id);
    } else {
      for (const id of DEFAULT_FOLDER_IDS) push(id);
      for (const id of known) {
        if (!DEFAULT_FOLDER_IDS.includes(id)) push(id);
      }
    }

    const current = this.globalStore.nav.sortedFolderIds;
    if (current.length === next.length && current.every((id, i) => id === next[i])) {
      return;
    }
    this.globalStore.nav.setSortedFolderIds(next);
  }

  private appendToOrder(id: string): void {
    if (this.globalStore.nav.sortedFolderIds.includes(id)) return;
    this.globalStore.nav.setSortedFolderIds([...this.globalStore.nav.sortedFolderIds, id]);
  }

  private removeFolder(id: string): void {
    if (DEFAULT_FOLDER_IDS.includes(id)) return;
    runInAction(() => {
      this.store.deleteByIds([id]);
      this.globalStore.nav.setSortedFolderIds(
        this.globalStore.nav.sortedFolderIds.filter((folderId) => folderId !== id),
      );
      if (this.globalStore.nav.selectedFolderId === id) {
        this.globalStore.nav.setSelectedFolderId(ALL_CHATS_FOLDER_ID);
      }
    });
  }
}
