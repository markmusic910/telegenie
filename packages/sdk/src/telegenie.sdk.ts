import { getTabId, logRequest } from '@telegenie/decorators';
import {
  createBroadcastBus,
  DEFAULT_BROADCAST_CHANNEL_NAME,
  type BroadcastBus,
} from '@telegenie/libs/foundation/broadcast-channel';
import type { LocalDbEntityChange } from '@telegenie/libs/foundation/telegram/local-db';
import type { TelegramCredentials } from '@telegenie/libs/foundation/telegram/utils';
import {
  createLazyTelegramWorkerClient,
  type TelegramWorkerClient,
} from '@telegenie/libs/foundation/telegram/worker';
import type { FoundationDebugStore } from '@telegenie/libs/foundation/telegram/worker/telegram.api';
import { createDefaultTelegramWorker } from '@telegenie/libs/foundation/telegram/worker/create-default-telegram-worker';
import { reaction, runInAction, type IReactionDisposer } from 'mobx';
import { AgentController } from './modules/agent/agent.controller';
import { AuthController } from './modules/auth/auth.controller';
import { ChannelController } from './modules/channel/channel.controller';
import { ChatController } from './modules/chat/chat.controller';
import { ConversionService } from './modules/common/services/convert.service';
import { DialogFilterController } from './modules/dialog-filter/dialog-filter.controller';
import { DialogController } from './modules/dialog/dialog.controller';
import { EncryptedChatController } from './modules/encrypted-chat/encrypted-chat.controller';
import { MessageDraftController } from './modules/message/message-draft.controller';
import { MessageSelectController } from './modules/message/message-select.controller';
import { MessageLoadController } from './modules/message/message-load.controller';
import { MessageReactionController } from './modules/message/message-reaction.controller';
import { MessageReadController } from './modules/message/message-read.controller';
import { MessageSendController } from './modules/message/message-send.controller';
import { StickerController } from './modules/sticker/sticker.controller';
import { SwController } from './modules/sw/sw.controller';
import { TabLeaderElection } from './modules/tab-leader/tab-leader-election';
import { UpdatesController } from './modules/updates/updates.controller';
import { UserController } from './modules/user/user.controller';
import { GlobalStore, StoreManager } from './store';
import type {
  EntityStoreView,
  GlobalStoreView,
  StoreManagerView,
} from './store/store.view';
import { EntityDataProvider } from './store/entity/entity.data-provider';
import EntityStore from './store/entity/entity.store';
import { ChannelFull } from './store/entity/models/channel-full.model';
import { Channel } from './store/entity/models/channel.model';
import { ChatFull } from './store/entity/models/chat-full.model';
import { Chat } from './store/entity/models/chat.model';
import { CustomEmojiDocument } from './store/entity/models/custom-emoji.model';
import { DialogFilterModel } from './store/entity/models/dialog-filter.model';
import { Dialog } from './store/entity/models/dialog.model';
import { EncryptedChat } from './store/entity/models/encrypted-chat.model';
import { Message } from './store/entity/models/message.model';
import { UserFull } from './store/entity/models/user-full.model';
import { User } from './store/entity/models/user.model';
import { SDK_CACHE_STORE, messageCacheKey } from './store/persist/constants';
import { StoreCache } from './store/persist/store.cache';
import {
  MODEL_TYPE,
  type ChannelEntity,
  type ChannelFullEntity,
  type ChatEntity,
  type ChatFullEntity,
  type DialogEntity,
  type CustomEmojiDocumentEntity,
  type DialogFilterEntity,
  type EncryptedChatEntity,
  type Entity,
  type EntityWithId,
  type MessageEntity,
  type MessageStore,
  type UserEntity,
  type UserFullEntity,
} from './store/types';

export type TeleGenieSDKOptions = {
  debug?: boolean;
  /** Optional Worker client factory override (tests). */
  createWorkerClient?: () => TelegramWorkerClient;
};

export type TeleGenieSDKInitOptions = TelegramCredentials & {
  /** Attempt to restore a persisted session. Defaults to `true`. */
  restoreSession?: boolean;
  /** Account slot for LocalDb + SDK StoreCache. Defaults to `default`. */
  accountSlot?: string;
};

const MESSAGE_STORE_SUFFIX = '-message';

export function messageStoreName(peerId: string): string {
  return `${peerId}${MESSAGE_STORE_SUFFIX}`;
}

export function peerIdFromMessageStoreName(name: string): string | undefined {
  if (!name.endsWith(MESSAGE_STORE_SUFFIX)) return undefined;
  const peerId = name.slice(0, -MESSAGE_STORE_SUFFIX.length);
  return peerId || undefined;
}

export class TeleGenieSDK {
  readonly store: StoreManager;
  readonly globalStore: GlobalStore;

  readonly auth: AuthController;
  readonly chat: ChatController;
  readonly channel: ChannelController;
  readonly dialog: DialogController;
  readonly dialogFilter: DialogFilterController;
  readonly messageLoad: MessageLoadController;
  readonly messageRead: MessageReadController;
  readonly messageSend: MessageSendController;
  readonly messageDraft: MessageDraftController;
  readonly messageSelect: MessageSelectController;
  readonly messageReaction: MessageReactionController;
  readonly sticker: StickerController;
  readonly user: UserController;
  readonly encryptedChat: EncryptedChatController;
  readonly updates: UpdatesController;
  readonly sw: SwController;
  readonly agent: AgentController;
  readonly broadcast: BroadcastBus;

  private _initialized = false;
  private readonly debug: boolean;
  private readonly worker: TelegramWorkerClient;
  private storeCache: StoreCache | undefined;
  private unsubscribeEntityChanges: (() => void) | undefined;
  private unsubscribeStoreUpdates: (() => void) | undefined;
  private unsubscribeDialogOrder: (() => void) | undefined;
  private persistLeadershipDispose: IReactionDisposer | undefined;
  private readonly converter: ConversionService;
  private tabLeader: TabLeaderElection;

  constructor(options: TeleGenieSDKOptions = {}) {
    this.debug = options.debug ?? false;
    this.store = new StoreManager();
    this.globalStore = new GlobalStore(this.store);
    this.converter = new ConversionService({ debug: this.debug });
    const rawWorker =
      options.createWorkerClient?.() ??
      createLazyTelegramWorkerClient(() => createDefaultTelegramWorker());
    this.worker = wrapWorkerWithLogging(rawWorker);

    this.broadcast = createBroadcastBus({ name: DEFAULT_BROADCAST_CHANNEL_NAME });
    this.tabLeader = new TabLeaderElection({
      globalStore: this.globalStore,
      broadcast: this.broadcast,
    });

    const ensureMessageStore = (peerId: string) => this.ensureMessageStore(peerId);

    this.auth = new AuthController({
      debug: this.debug,
      globalStore: this.globalStore,
      worker: this.worker,
      onAuthSuccess: () => this.onAuthSuccess(),
    });
    this.chat = new ChatController({ sm: this.store, debug: this.debug, worker: this.worker });
    this.channel = new ChannelController({ sm: this.store, debug: this.debug, worker: this.worker });
    this.dialog = new DialogController({
      sm: this.store,
      debug: this.debug,
      worker: this.worker,
      ensureMessageStore,
    });
    this.dialogFilter = new DialogFilterController({
      sm: this.store,
      debug: this.debug,
      worker: this.worker,
      globalStore: this.globalStore,
    });
    this.user = new UserController({ sm: this.store, debug: this.debug, worker: this.worker });
    this.messageDraft = new MessageDraftController({
      worker: this.worker,
      sm: this.store,
      globalStore: this.globalStore,
    });
    this.messageSelect = new MessageSelectController({
      globalStore: this.globalStore,
      ensureMessageStore,
    });
    const messageRead = new MessageReadController({
      sm: this.store,
      globalStore: this.globalStore,
      worker: this.worker,
      ensureMessageStore,
      focusMessage: (peerId, opts) => this.messageLoad.focusMessage(peerId, opts),
      ingestUnreadMentionHistory: (peerId, result) =>
        this.messageLoad.ingestUnreadMentionHistory(peerId, result),
    });
    this.messageRead = messageRead;
    this.messageLoad = new MessageLoadController({
      sm: this.store,
      globalStore: this.globalStore,
      debug: this.debug,
      worker: this.worker,
      ensureMessageStore,
      resolveUsername: (username) => this.user.resolveUsername(username),
      loadCachedMessages: async (peerId, ids) => {
        if (!this.storeCache?.isOpen) return [];
        return this.storeCache.loadMessagesByIds(peerId, ids);
      },
      loadUnreadReactionsOnOpen: (peerId) => this.messageReaction.ensureUnreadReactions(peerId),
      flushPendingInboxRead: (peerId) => messageRead.flushPendingInboxRead(peerId),
      adoptDialogDraft: (peerId, threadId) => this.messageDraft.adoptDialogDraft(peerId, threadId),
    });
    this.messageSend = new MessageSendController({
      worker: this.worker,
      sm: this.store,
      globalStore: this.globalStore,
      drafts: this.messageDraft,
      jumpToBottom: (peerId, threadId) => this.messageLoad.jumpToBottom(peerId, threadId),
      applyLocalDelete: (peerId, ids) => this.updates.applyLocalMessageDelete(peerId, ids),
      ensureMessageStore: (peerId) => this.ensureMessageStore(peerId),
      ensureListedIdsCached: (peerId, threadId) =>
        this.messageLoad.ensureListedIdsCached(peerId, threadId),
    });
    this.messageReaction = new MessageReactionController({
      sm: this.store,
      globalStore: this.globalStore,
      debug: this.debug,
      worker: this.worker,
      ensureMessageStore,
      loadMessagesByIds: (peerId, ids) => this.messageLoad.getMessagesByIds(peerId, ids),
      focusMessage: (peerId, opts) => this.messageLoad.focusMessage(peerId, opts),
    });
    this.sticker = new StickerController({
      worker: this.worker,
      sm: this.store,
      globalStore: this.globalStore,
      loadCachedDocuments: async (ids) => {
        if (!this.storeCache?.isOpen) return [];
        return this.storeCache.loadCustomEmojiByIds(ids);
      },
    });
    this.encryptedChat = new EncryptedChatController({
      sm: this.store,
      debug: this.debug,
      worker: this.worker,
    });
    this.updates = new UpdatesController({
      sm: this.store,
      debug: this.debug,
      ensureMessageStore,
      dialogFilter: this.dialogFilter,
      globalStore: this.globalStore,
      markMessageListRead: (peerId, maxId) => this.messageRead.markMessageListRead(peerId, maxId),
      emitMessageNotification: (payload) => {
        void this.worker.call('message.emitNotification', [payload]);
      },
    });
    this.sw = new SwController({
      globalStore: this.globalStore,
      getTabId: () => this.tabLeader.tabId,
      onFocusMessage: (payload) => {
        if (payload.chatId && payload.messageId != null) {
          void this.messageLoad.focusMessage(payload.chatId, {
            messageId: String(payload.messageId),
          });
        }
      },
    });
    this.agent = new AgentController({
      getTabId: () => this.tabLeader.tabId,
      telegramIsAuthorized: () => this.worker.call('auth.isAuthorized', []),
      updateUiState: (payload) => {
        if (typeof payload.isLoading === 'boolean') {
          this.globalStore.leader.setLoading(payload.isLoading);
        }
        // TODO: surface payload.statusMessage in UI when a status field exists.
      },
    });

    this.registerStores();
  }

  get isInitialized() {
    return this._initialized;
  }

  ensureMessageStore(peerId: string): MessageStore {
    const name = messageStoreName(peerId);
    if (this.store.has(name)) {
      return this.store.get(name) as MessageStore;
    }

    const messageStore = new EntityStore<Message, MessageEntity>({
      model: Message,
      type: MODEL_TYPE.ENTITY_MODEL,
      shouldSkipUpdate: (key, value) =>
        (key === 'views' || key === 'forwards') && value === undefined,
      dataProvider: new EntityDataProvider<MessageEntity>({
        fetcher: async (ids: string[]) => {
          await this.messageLoad.getMessagesByIds(peerId, ids);
          return [];
        },
      }),
    });

    this.store.set(name, messageStore);
    this.storeCache?.attachMessageStore(peerId, messageStore);
    return messageStore;
  }

  getMessageStore(peerId: string): MessageStore {
    return this.ensureMessageStore(peerId);
  }

  /**
   * Debug: drop one entity from memory and, for dialog / dialogFilter /
   * per-peer message stores, from SDK cache IDB as well.
   */
  async debugDeleteEntity(storeName: string, id: string): Promise<void> {
    const store = this.getMutableEntityStore(storeName);
    store?.deleteByIds([id]);
    await this.forceDeleteCachedEntity(storeName, id);
  }

  /**
   * Debug: empty an entity store in memory and clear the matching SDK cache
   * object store (or that peer's message rows).
   */
  async debugClearEntityStore(storeName: string): Promise<void> {
    this.getMutableEntityStore(storeName)?.clear();
    await this.forceClearCachedStore(storeName);
  }

  /**
   * Debug: drop one foundation LocalDb row (chat, chatFull, channel, channelFull).
   * The worker fans out an entity change so the matching memory store updates too.
   */
  async debugDeleteFoundationEntity(store: FoundationDebugStore, id: string): Promise<void> {
    await this.worker.call('debug.deleteLocalEntity', [store, id]);
  }

  /** Debug: drop one dialog UI from the global store (and persist global). */
  async debugDeleteDialogUI(peerId: string): Promise<void> {
    this.globalStore.deleteDialog(peerId);
    await this.storeCache?.forcePersistGlobal(this.globalStore.toJS());
  }

  /** Debug: drop one thread UI from the global store (and persist global). */
  async debugDeleteThreadUI(peerId: string, threadId: string): Promise<void> {
    this.globalStore.deleteThread(peerId, threadId);
    await this.storeCache?.forcePersistGlobal(this.globalStore.toJS());
  }

  /**
   * Debug: wipe MobX entity stores / thread UI, SDK cache IDB, or both.
   * Memory-only leaves IDB intact (persist is paused so leader write-through
   * does not delete cached rows). IDB-only leaves RAM intact.
   */
  async debugClearAllStores(target: 'memory' | 'idb' | 'both'): Promise<void> {
    const clearMemory = target === 'memory' || target === 'both';
    const clearIdb = target === 'idb' || target === 'both';
    const cache = this.storeCache;
    const wasPersistEnabled = Boolean(cache?.isPersistEnabled);

    if (clearMemory) {
      cache?.setPersistEnabled(false);
      this.clearAllMemoryStores();
    }
    try {
      if (clearIdb) {
        await cache?.forceClearAll();
      }
    } finally {
      if (clearMemory) {
        // Global persist is a 50ms reaction — wait it out while persist is off.
        await new Promise((resolve) => setTimeout(resolve, 80));
        cache?.setPersistEnabled(wasPersistEnabled);
      }
    }
  }

  private clearAllMemoryStores(): void {
    for (const name of this.store.names()) {
      if (name === 'global') continue;
      this.getMutableEntityStore(name)?.clear();
    }
    this.globalStore.hydrateDialogsFromSnapshot({ dialogs: {} });
  }

  /**
   * Open SDK cache + LocalDb (in worker), recover persisted dialog/message/global,
   * subscribe to LocalDb peer changes, then optionally restore the auth session.
   */
  async init(options: TeleGenieSDKInitOptions): Promise<this> {
    const { restoreSession = true, accountSlot = 'default', ...credentials } = options;

    this.sw.init();

    await this.openStoreCache(accountSlot);
    await this.recoverFromCache();
    // Before any network call, so the folder rail always has something to render.
    this.dialogFilter.seedDefaults();

    // Connect SharedWorker (first RPC / explicit connect happens below).
    await this.worker.call('account.open', [{ accountSlot }]);
    this.unsubscribeEntityChanges?.();
    this.unsubscribeEntityChanges = this.worker.on('entityChange', (change) => {
      this.handleLocalDbEntityChange(change);
    });
    this.unsubscribeStoreUpdates?.();
    this.unsubscribeStoreUpdates = this.worker.on('storeUpdate', (payload) => {
      this.updates.apply(payload);
    });
    this.unsubscribeDialogOrder?.();
    this.unsubscribeDialogOrder = this.worker.on('dialogOrder', (payload) => {
      this.globalStore.nav.setSortedDialogIds(payload.ids, payload.allIds);
    });

    this.tabLeader.dispose();
    this.sw.disconnectLeaderBridges();
    this.tabLeader = new TabLeaderElection({
      globalStore: this.globalStore,
      broadcast: this.broadcast,
    });
    const isLeader = await this.tabLeader.start();
    this.watchPersistLeadership();
    if (isLeader) {
      await this.sw.connectLeaderBridges(this.worker);
      this.sw.watchControllerChange(() => {
        void this.sw.connectLeaderBridges(this.worker);
      });
    }

    // Per-tab agent ↔ page bridge (TabPageApi host on this tab).
    await this.agent.connectPageBridge();

    await this.auth.configure(credentials);

    if (restoreSession) {
      await this.auth.tryRestoreSession();
    }

    this._initialized = true;
    return this;
  }

  private async onAuthSuccess(): Promise<void> {
    try {
      await this.worker.call('updates.start', []);
    } catch (err) {
      if (this.debug) {
        console.warn('[TeleGenieSDK] startUpdates failed', err);
      }
    }
    try {
      const meModel = await this.user.getMe();
      runInAction(() => {
        this.globalStore.auth.currentUser = JSON.parse(meModel.toJSON());
      });
    } catch (err) {
      if (this.debug) {
        console.warn('[TeleGenieSDK] getMe failed', err);
      }
    }
    // Full reload from the server after auth; order and definitions are not
    // taken from the SDK cache.
    try {
      await this.dialogFilter.getAll();
    } catch (err) {
      if (this.debug) {
        console.warn('[TeleGenieSDK] getDialogFilters failed', err);
      }
    }
  }

  private async openStoreCache(accountSlot: string): Promise<void> {
    this.persistLeadershipDispose?.();
    this.persistLeadershipDispose = undefined;
    this.storeCache?.close();
    this.storeCache = new StoreCache({ accountSlot });
    await this.storeCache.open();
    this.storeCache.attachDialogStore(this.store.get('dialog'));
    this.storeCache.attachDialogFilterStore(this.store.get('dialogFilter'));
    this.storeCache.attachCustomEmojiStore(this.store.get('customEmoji'));
    this.storeCache.attachGlobalStore(this.globalStore);
    for (const name of this.store.names()) {
      const peerId = peerIdFromMessageStoreName(name);
      if (!peerId) continue;
      this.storeCache.attachMessageStore(peerId, this.store.get(name) as MessageStore);
    }
  }

  private watchPersistLeadership(): void {
    this.persistLeadershipDispose?.();
    this.persistLeadershipDispose = reaction(
      () => this.tabLeader.isLeader,
      (isLeader) => {
        this.storeCache?.setPersistEnabled(isLeader);
        if (isLeader) {
          void this.storeCache?.persistSnapshot();
          void this.sw.connectLeaderBridges(this.worker);
          this.sw.watchControllerChange(() => {
            void this.sw.connectLeaderBridges(this.worker);
          });
        } else {
          this.sw.disconnectLeaderBridges();
        }
      },
      { fireImmediately: true },
    );
  }

  private async recoverFromCache(): Promise<void> {
    if (!this.storeCache?.isOpen) return;

    const dialogs = await this.storeCache.loadDialogs();
    if (dialogs.length > 0) {
      this.store.get('dialog').hydrate(dialogs);
    }

    const messages = await this.storeCache.loadMessages();
    if (messages.length > 0) {
      const byPeer = new Map<string, MessageEntity[]>();
      for (const row of messages) {
        const { cacheKey: _cacheKey, ...entity } = row;
        const peerId = entity.peerId;
        if (!peerId) continue;
        const list = byPeer.get(peerId);
        if (list) list.push(entity);
        else byPeer.set(peerId, [entity]);
      }
      for (const [peerId, list] of byPeer) {
        this.ensureMessageStore(peerId).hydrate(list);
      }
    }

    const globalRow = await this.storeCache.loadGlobal();
    if (globalRow) {
      this.applyGlobalSnapshot(globalRow.auth, globalRow.app);
    }
    // Folder definitions and rail order come from the server on every load.
    this.globalStore.nav.setSortedFolderIds([]);
  }

  private applyGlobalSnapshot(
    auth: Record<string, unknown>,
    app: Record<string, unknown>,
  ): void {
    runInAction(() => {
      const a = this.globalStore.auth;
      if (auth.currentUser != null) {
        a.currentUser = auth.currentUser as typeof a.currentUser;
      }
      if (typeof auth.authSessionString === 'string' || auth.authSessionString === null) {
        a.authSessionString = auth.authSessionString as string | null;
      }
      if (typeof auth.authPhoneNumber === 'string') {
        a.authPhoneNumber = auth.authPhoneNumber;
      }

      this.globalStore.hydrateAppSnapshot(app);
    });
    this.globalStore.reconcileAllIndexesWithStore();
  }

  private handleLocalDbEntityChange(change: LocalDbEntityChange): void {
    switch (change.store) {
      case 'users':
        if (change.kind === 'put') {
          const models = this.converter
            .convertLocalDbUsers(change.entities)
            .map((entity) => new User(entity));
          this.store.get('user').update(models);
        } else if (change.kind === 'delete') {
          this.store.get('user').deleteByIds(change.ids);
        }
        break;
      case 'chats':
        if (change.kind === 'put') {
          const models = this.converter
            .convertLocalDbChats(change.entities)
            .map((entity) => new Chat(entity));
          this.store.get('chat').update(models);
        } else if (change.kind === 'delete') {
          this.store.get('chat').deleteByIds(change.ids);
        }
        break;
      case 'channels':
        if (change.kind === 'put') {
          const models = this.converter
            .convertLocalDbChannels(change.entities)
            .map((entity) => new Channel(entity));
          this.store.get('channel').update(models);
        } else if (change.kind === 'delete') {
          this.store.get('channel').deleteByIds(change.ids);
        }
        break;
      case 'userFull':
        if (change.kind === 'put') {
          const models = change.entities.map(
            (e) => new UserFull(this.converter.convertUserFull(e)),
          );
          this.store.get('userFull').update(models);
        } else if (change.kind === 'invalidate') {
          this.store.get('userFull').deleteByIds(change.ids);
        }
        break;
      case 'chatFull':
        if (change.kind === 'put') {
          const models = change.entities.map(
            (e) => new ChatFull(this.converter.convertChatFull(e)),
          );
          this.store.get('chatFull').update(models);
        } else if (change.kind === 'invalidate') {
          this.store.get('chatFull').deleteByIds(change.ids);
        }
        break;
      case 'channelFull':
        if (change.kind === 'put') {
          const models = change.entities.map(
            (e) => new ChannelFull(this.converter.convertChannelFull(e)),
          );
          this.store.get('channelFull').update(models);
        } else if (change.kind === 'invalidate') {
          this.store.get('channelFull').deleteByIds(change.ids);
        }
        break;
      case 'encryptedChats':
        if (change.kind === 'put') {
          const models = this.converter
            .convertLocalDbEncryptedChats(change.entities)
            .map((entity) => new EncryptedChat(entity));
          this.store.get('encryptedChat').update(models);
        } else if (change.kind === 'delete') {
          this.store.get('encryptedChat').deleteByIds(change.ids);
        }
        break;
      default:
        break;
    }
  }

  private getMutableEntityStore(name: string): EntityStore<EntityWithId, Entity> | undefined {
    if (name === 'global' || !this.store.has(name)) return undefined;
    const store = this.store.get(name);
    if (store === this.globalStore) return undefined;
    return store as EntityStore<EntityWithId, Entity>;
  }

  private async forceDeleteCachedEntity(storeName: string, id: string): Promise<void> {
    const cache = this.storeCache;
    if (!cache?.isOpen) return;
    if (storeName === 'dialog') {
      await cache.forceDelete(SDK_CACHE_STORE.dialog, id);
      return;
    }
    if (storeName === 'dialogFilter') {
      await cache.forceDelete(SDK_CACHE_STORE.dialogFilter, id);
      return;
    }
    if (storeName === 'customEmoji') {
      await cache.forceDelete(SDK_CACHE_STORE.customEmoji, id);
      return;
    }
    const peerId = peerIdFromMessageStoreName(storeName);
    if (peerId) {
      await cache.forceDelete(SDK_CACHE_STORE.message, messageCacheKey(peerId, id));
    }
  }

  private async forceClearCachedStore(storeName: string): Promise<void> {
    const cache = this.storeCache;
    if (!cache?.isOpen) return;
    if (storeName === 'dialog') {
      await cache.forceClear(SDK_CACHE_STORE.dialog);
      return;
    }
    if (storeName === 'dialogFilter') {
      await cache.forceClear(SDK_CACHE_STORE.dialogFilter);
      return;
    }
    if (storeName === 'customEmoji') {
      await cache.forceClear(SDK_CACHE_STORE.customEmoji);
      return;
    }
    const peerId = peerIdFromMessageStoreName(storeName);
    if (peerId) {
      await cache.forceDeleteMessagesByPeer(peerId);
    }
  }

  private registerStores() {
    this.store.set(
      'channel',
      new EntityStore<Channel, ChannelEntity>({
        model: Channel,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider<ChannelEntity>({
          fetcher: async (ids: string[]) => {
            await this.channel.getChannelsByIds(ids);
            return [];
          },
        }),
      }),
    );

    this.store.set(
      'chat',
      new EntityStore<Chat, ChatEntity>({
        model: Chat,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider<ChatEntity>({
          fetcher: async (ids: string[]) => {
            await this.chat.getChatsByIds(ids);
            return [];
          },
        }),
      }),
    );

    this.store.set(
      'user',
      new EntityStore<User, UserEntity>({
        model: User,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider<UserEntity>({
          fetcher: async (ids: string[]) => {
            await this.user.getUsersByIds(ids);
            return [];
          },
        }),
      }),
    );

    this.store.set(
      'userFull',
      new EntityStore<UserFull, UserFullEntity>({
        model: UserFull,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider<UserFullEntity>({
          fetcher: async (ids: string[]) => {
            await this.user.getFullUsersByIds(ids);
            return [];
          },
        }),
      }),
    );

    this.store.set(
      'chatFull',
      new EntityStore<ChatFull, ChatFullEntity>({
        model: ChatFull,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider<ChatFullEntity>({
          fetcher: async () => [],
        }),
      }),
    );

    this.store.set(
      'channelFull',
      new EntityStore<ChannelFull, ChannelFullEntity>({
        model: ChannelFull,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider<ChannelFullEntity>({
          fetcher: async () => [],
        }),
      }),
    );

    this.store.set('global', this.globalStore);

    this.store.set(
      'dialog',
      new EntityStore<Dialog, DialogEntity>({
        model: Dialog,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider<DialogEntity>({
          fetcher: async (_ids: string[]) => {
            return [];
          },
        }),
      }),
    );

    this.store.set(
      'dialogFilter',
      new EntityStore<DialogFilterModel, DialogFilterEntity>({
        model: DialogFilterModel,
        type: MODEL_TYPE.ENTITY_MODEL,
        // Folders arrive whole from `dialogFilter.getAll`; never fetched by id.
        dataProvider: new EntityDataProvider<DialogFilterEntity>({
          fetcher: async () => [],
        }),
      }),
    );

    this.store.set(
      'encryptedChat',
      new EntityStore<EncryptedChat, EncryptedChatEntity>({
        model: EncryptedChat,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider<EncryptedChatEntity>({
          fetcher: async () => [],
        }),
      }),
    );

    this.store.set(
      'customEmoji',
      new EntityStore<CustomEmojiDocument, CustomEmojiDocumentEntity>({
        model: CustomEmojiDocument,
        type: MODEL_TYPE.ENTITY_MODEL,
        dataProvider: new EntityDataProvider<CustomEmojiDocumentEntity>({
          debounceTime: 200,
          fetcher: async (ids: string[]) => {
            await this.sticker.ensureCustomEmojiDocuments(ids);
            return [];
          },
        }),
      }),
    );
  }
}

function wrapWorkerWithLogging(worker: TelegramWorkerClient): TelegramWorkerClient {
  // @ts-expect-error ~~~
  if (process.env.NODE_ENV === 'production') {
    return worker;
  }
  const originalCall = worker.call;
  worker.call = function (this: any, method: string, args: any[], options?: any) {
    const start = Date.now();
    const timestamp = new Date().toISOString();
    const tabId = getTabId();
    try {
      const result = originalCall.call(this, method, args, options);
      if (
        typeof result === 'object' &&
        result !== null &&
        typeof (result as any).then === 'function'
      ) {
        return Promise.resolve(result).then(
          (value) => {
            logRequest({
              methodName: `worker.call:${method}`,
              args,
              start,
              timestamp,
              tabId,
              outgoing: true,
              success: true,
              result: value,
            });
            return value;
          },
          (error) => {
            logRequest({
              methodName: `worker.call:${method}`,
              args,
              start,
              timestamp,
              tabId,
              outgoing: true,
              success: false,
              error,
            });
            throw error;
          }
        );
      }
      logRequest({
        methodName: `worker.call:${method}`,
        args,
        start,
        timestamp,
        tabId,
        outgoing: true,
        success: true,
        result,
      });
      return result;
    } catch (error) {
      logRequest({
        methodName: `worker.call:${method}`,
        args,
        start,
        timestamp,
        tabId,
        outgoing: true,
        success: false,
        error,
      });
      throw error;
    }
  };
  return worker;
}

/**
 * UI-facing SDK surface: controllers for writes, read-only store views.
 * Omit `ensureMessageStore` and `updates` — they exist only to mutate stores.
 */
export type { FoundationDebugStore } from '@telegenie/libs/foundation/telegram/worker/telegram.api';

export type TeleGenieSDKView = Omit<
  TeleGenieSDK,
  'store' | 'globalStore' | 'ensureMessageStore' | 'updates' | 'getMessageStore'
> & {
  readonly store: StoreManagerView;
  readonly globalStore: GlobalStoreView;
  getMessageStore(peerId: string): EntityStoreView<Message>;
};
