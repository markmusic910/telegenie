import { IdbManager } from '@telegenie/libs/foundation/idb';
import { reaction, toJS, type IReactionDisposer } from 'mobx';
import type EntityStore from '../entity/entity.store';
import type GlobalStore from '../global/global.store';
import type {
  CustomEmojiDocumentEntity,
  DialogEntity,
  DialogFilterEntity,
  EntityStoreChange,
  MessageEntity,
} from '../types';
import { stringifyJson } from '../utils/json';
import {
  GLOBAL_CACHE_ROW_ID,
  messageCacheKey,
  SDK_CACHE_DB_VERSION,
  SDK_CACHE_STORE,
  SDK_CACHE_STORES,
  sdkCacheDbName,
} from './constants';

export type CachedMessageRow = MessageEntity & {
  cacheKey: string;
};

export type CachedGlobalRow = {
  id: typeof GLOBAL_CACHE_ROW_ID;
  auth: Record<string, unknown>;
  app: Record<string, unknown>;
};

export type StoreCacheOptions = {
  accountSlot: string;
  factory?: IDBFactory;
  flushDelayMs?: number;
};

/**
 * Separate from foundation LocalDb. Persists dialog, dialogFilter, message,
 * custom-emoji documents, and global MobX stores. Peer/*Full data stays in
 * foundation LocalDb.
 * Writes are gated by {@link setPersistEnabled} (leader tab only).
 */
export class StoreCache {
  private readonly idb: IdbManager;
  private globalDispose: IReactionDisposer | undefined;
  private opened = false;
  private persistEnabled = false;
  private dialogStore: EntityStore<any, DialogEntity> | undefined;
  private dialogFilterStore: EntityStore<any, DialogFilterEntity> | undefined;
  private customEmojiStore: EntityStore<any, CustomEmojiDocumentEntity> | undefined;
  private readonly messageStores = new Map<string, EntityStore<any, MessageEntity>>();
  private globalStore: GlobalStore | undefined;

  constructor(options: StoreCacheOptions) {
    this.idb = new IdbManager({
      name: sdkCacheDbName(options.accountSlot),
      version: SDK_CACHE_DB_VERSION,
      stores: SDK_CACHE_STORES,
      factory: options.factory,
      flushDelayMs: options.flushDelayMs,
    });
  }

  async open(): Promise<void> {
    if (!IdbManager.isSupported()) {
      return;
    }
    await this.idb.open();
    this.opened = true;
  }

  get isOpen() {
    return this.opened;
  }

  get isPersistEnabled() {
    return this.persistEnabled;
  }

  setPersistEnabled(enabled: boolean): void {
    this.persistEnabled = enabled;
  }

  async flush(): Promise<void> {
    if (!this.opened) return;
    await this.idb.flush();
  }

  /**
   * Write current in-memory dialog / message / global snapshots.
   * No-op unless persist is enabled (leader).
   */
  async persistSnapshot(): Promise<void> {
    if (!this.canWrite()) return;
    if (this.dialogStore) {
      for (const entity of this.dialogStore.getAllData().values()) {
        const id = String(entity.id);
        if (!id) continue;
        void this.idb.putQueued(SDK_CACHE_STORE.dialog, toJS(entity) as DialogEntity);
      }
    }
    if (this.dialogFilterStore) {
      for (const entity of this.dialogFilterStore.getAllData().values()) {
        const id = String(entity.id);
        if (!id) continue;
        void this.idb.putQueued(SDK_CACHE_STORE.dialogFilter, toJS(entity) as DialogFilterEntity);
      }
    }
    if (this.customEmojiStore) {
      for (const entity of this.customEmojiStore.getAllData().values()) {
        const plain = toJS(entity) as CustomEmojiDocumentEntity;
        if (!plain.mimeType) continue;
        void this.idb.putQueued(SDK_CACHE_STORE.customEmoji, plain);
      }
    }
    for (const [peerId, store] of this.messageStores) {
      for (const entity of store.getAllData().values()) {
        if (!entity?.id) continue;
        const plain = toJS(entity) as MessageEntity;
        const row: CachedMessageRow = {
          ...plain,
          cacheKey: messageCacheKey(plain.peerId || peerId, String(plain.id)),
        };
        void this.idb.putQueued(SDK_CACHE_STORE.message, row);
      }
    }
    if (this.globalStore) {
      this.persistGlobal(this.globalStore.toJS());
    }
    await this.flush();
  }

  close(): void {
    this.globalDispose?.();
    this.globalDispose = undefined;
    this.dialogStore = undefined;
    this.dialogFilterStore = undefined;
    this.customEmojiStore = undefined;
    this.messageStores.clear();
    this.globalStore = undefined;
    this.persistEnabled = false;
    this.idb.close();
    this.opened = false;
  }

  attachDialogStore(store: EntityStore<any, DialogEntity>): void {
    this.dialogStore = store;
    store.setOnChange((change) => this.handleDialogChange(change));
  }

  attachDialogFilterStore(store: EntityStore<any, DialogFilterEntity>): void {
    this.dialogFilterStore = store;
    store.setOnChange((change) => this.handleDialogFilterChange(change));
  }

  attachCustomEmojiStore(store: EntityStore<any, CustomEmojiDocumentEntity>): void {
    this.customEmojiStore = store;
    store.setOnChange((change) => this.handleCustomEmojiChange(change));
  }

  attachMessageStore(peerId: string, store: EntityStore<any, MessageEntity>): void {
    this.messageStores.set(peerId, store);
    store.setOnChange((change) => this.handleMessageChange(peerId, change));
  }

  attachGlobalStore(globalStore: GlobalStore): void {
    this.globalStore = globalStore;
    this.globalDispose?.();
    this.globalDispose = reaction(
      () => globalStore.toJS(),
      (snapshot) => {
        void this.persistGlobal(snapshot);
      },
      { delay: 50 },
    );
  }

  async loadDialogs(): Promise<DialogEntity[]> {
    if (!this.opened) return [];
    return this.idb.getAll<DialogEntity>(SDK_CACHE_STORE.dialog);
  }

  async loadDialogFilters(): Promise<DialogFilterEntity[]> {
    if (!this.opened) return [];
    return this.idb.getAll<DialogFilterEntity>(SDK_CACHE_STORE.dialogFilter);
  }

  async loadMessages(): Promise<CachedMessageRow[]> {
    if (!this.opened) return [];
    return this.idb.getAll<CachedMessageRow>(SDK_CACHE_STORE.message);
  }

  /** Point reads for listed / reply ids after the in-memory store has evicted them. */
  async loadMessagesByIds(peerId: string, ids: string[]): Promise<MessageEntity[]> {
    if (!this.opened || ids.length === 0) return [];
    const keys = ids.map((id) => messageCacheKey(peerId, String(id)));
    const rows = await this.idb.getMany<CachedMessageRow>(SDK_CACHE_STORE.message, keys);
    const out: MessageEntity[] = [];
    for (const row of rows) {
      if (!row) continue;
      const { cacheKey: _cacheKey, ...entity } = row;
      if (entity.peerId && entity.peerId !== peerId) continue;
      out.push(entity);
    }
    return out;
  }

  async loadCustomEmojiByIds(ids: string[]): Promise<CustomEmojiDocumentEntity[]> {
    if (!this.opened || ids.length === 0) return [];
    const rows = await this.idb.getMany<CustomEmojiDocumentEntity>(SDK_CACHE_STORE.customEmoji, ids);
    return rows.filter((row): row is CustomEmojiDocumentEntity => Boolean(row?.mimeType));
  }

  async loadGlobal(): Promise<CachedGlobalRow | undefined> {
    if (!this.opened) return undefined;
    return this.idb.get<CachedGlobalRow>(SDK_CACHE_STORE.global, GLOBAL_CACHE_ROW_ID);
  }

  /**
   * Debug deletes ignore leader persist gating so a follower tab can still
   * drop a cached row (or a whole object store) from IDB.
   */
  async forceDelete(store: string, key: string): Promise<void> {
    if (!this.opened) return;
    await this.idb.delete(store, key);
  }

  async forceClear(store: string): Promise<void> {
    if (!this.opened) return;
    await this.idb.clear(store);
  }

  async forceClearAll(): Promise<void> {
    if (!this.opened) return;
    for (const store of SDK_CACHE_STORES) {
      await this.forceClear(store.name);
    }
  }

  async forceDeleteMessagesByPeer(peerId: string): Promise<void> {
    if (!this.opened) return;
    const prefix = `${peerId}:`;
    const rows = await this.idb.getAll<CachedMessageRow>(SDK_CACHE_STORE.message);
    const keys = rows
      .filter((row) => row.cacheKey.startsWith(prefix))
      .map((row) => row.cacheKey);
    await this.idb.deleteMany(SDK_CACHE_STORE.message, keys);
  }

  async forcePersistGlobal(snapshot: { auth: unknown; app: unknown }): Promise<void> {
    if (!this.opened) return;
    this.persistGlobal(snapshot, true);
    await this.flush();
  }

  private canWrite(): boolean {
    return this.opened && this.persistEnabled;
  }

  private handleDialogChange(change: EntityStoreChange<DialogEntity>): void {
    if (!this.canWrite()) return;
    if (change.type === 'put') {
      for (const entity of change.entities) {
        void this.idb.putQueued(SDK_CACHE_STORE.dialog, entity);
      }
      return;
    }
    for (const id of change.ids) {
      void this.idb.deleteQueued(SDK_CACHE_STORE.dialog, id);
    }
  }

  private handleDialogFilterChange(change: EntityStoreChange<DialogFilterEntity>): void {
    if (!this.canWrite()) return;
    if (change.type === 'put') {
      for (const entity of change.entities) {
        void this.idb.putQueued(SDK_CACHE_STORE.dialogFilter, entity);
      }
      return;
    }
    for (const id of change.ids) {
      void this.idb.deleteQueued(SDK_CACHE_STORE.dialogFilter, id);
    }
  }

  private handleCustomEmojiChange(change: EntityStoreChange<CustomEmojiDocumentEntity>): void {
    if (!this.canWrite()) return;
    if (change.type === 'put') {
      for (const entity of change.entities) {
        if (!entity.mimeType) continue;
        void this.idb.putQueued(SDK_CACHE_STORE.customEmoji, entity);
      }
      return;
    }
    for (const id of change.ids) {
      void this.idb.deleteQueued(SDK_CACHE_STORE.customEmoji, id);
    }
  }

  private handleMessageChange(peerId: string, change: EntityStoreChange<MessageEntity>): void {
    if (!this.canWrite()) return;
    if (change.type === 'put') {
      for (const entity of change.entities) {
        const row: CachedMessageRow = {
          ...entity,
          cacheKey: messageCacheKey(entity.peerId || peerId, String(entity.id)),
        };
        void this.idb.putQueued(SDK_CACHE_STORE.message, row);
      }
      return;
    }
    for (const id of change.ids) {
      void this.idb.deleteQueued(SDK_CACHE_STORE.message, messageCacheKey(peerId, id));
    }
  }

  private persistGlobal(snapshot: { auth: unknown; app: unknown }, force = false): void {
    if (!this.opened) return;
    if (!force && !this.persistEnabled) return;
    // Strip MobX actions / non-cloneable fields before IDB write.
    const plain = JSON.parse(stringifyJson(snapshot)) as {
      auth: Record<string, unknown>;
      app: Record<string, unknown>;
    };
    const row: CachedGlobalRow = {
      id: GLOBAL_CACHE_ROW_ID,
      auth: plain.auth,
      app: plain.app,
    };
    void this.idb.putQueued(SDK_CACHE_STORE.global, row);
  }
}
