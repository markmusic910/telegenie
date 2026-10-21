import { Api } from '@telegenie/teleproto';

import { peerIdFromMessage } from './helpers/peer-id.helper';
import { FileRefEngine } from './file-ref/engine';
import { LocalDb } from './local-db/local-db';
import type {
  LocalDbEntityChange,
  LocalDbEntityChangeNotifier,
  LocalDbOptions,
  ResolvedInputPeer,
} from './local-db/types';
import { AuthService } from './services/auth.service';
import { ChannelService } from './services/channel.service';
import { ChatService } from './services/chat.service';
import { DialogFilterService } from './services/dialog-filter.service';
import {
  DialogOrderTracker,
  type DialogOrderIngestOptions,
  type DialogOrderPage,
} from './services/dialog.order-tracker';
import { DialogService } from './services/dialog.service';
import { EncryptedChatService } from './services/encrypted-chat.service';
import { FileService } from './services/file.service';
import { MessageReactionService } from './services/message-reaction.service';
import { MessageService } from './services/message.service';
import { StickerService } from './services/sticker.service';
import { TransportService } from './services/transport.service';
import { UserService } from './services/user.service';
import { UpdateManager } from './update-manager/update-manager';
import type { UpdateManagerOptions } from './update-manager/types';
import { toStoreSyncPayloads } from './worker/store-sync';
import type {
  DialogOrderPayload,
  FoundationDebugStore,
  MessageNotificationPayload,
  StoreSyncPayload,
} from './worker/telegram.api';

export type TelegramOpenAccountOptions = Omit<LocalDbOptions, 'onEntityChange'> & {
  /** Forwarded to UpdateManager when created. */
  updateManager?: Omit<UpdateManagerOptions, 'transportService' | 'localDb' | 'debug'>;
};

type EntityChangeListener = LocalDbEntityChangeNotifier;
type MessageNotificationListener = (payload: MessageNotificationPayload) => void;
type StoreUpdateListener = (payload: StoreSyncPayload) => void;
type DialogOrderListener = (payload: DialogOrderPayload) => void;

/**
 * Facade over transport, LocalDb, UpdateManager, and entity services.
 */
export class Telegram {
  debug: boolean;
  transportService: TransportService;
  localDb: LocalDb | undefined;
  updateManager: UpdateManager | undefined;
  fileRefEngine: FileRefEngine | undefined;
  authService: AuthService | undefined;
  chatService: ChatService | undefined;
  channelService: ChannelService | undefined;
  dialogService: DialogService | undefined;
  dialogFilterService: DialogFilterService | undefined;
  fileService: FileService | undefined;
  messageService: MessageService | undefined;
  messageReactionService: MessageReactionService | undefined;
  stickerService: StickerService | undefined;
  userService: UserService | undefined;
  encryptedChatService: EncryptedChatService | undefined;

  private readonly entityChangeListeners = new Set<EntityChangeListener>();
  private readonly messageNotificationListeners = new Set<MessageNotificationListener>();
  private readonly storeUpdateListeners = new Set<StoreUpdateListener>();
  private readonly dialogOrderListeners = new Set<DialogOrderListener>();
  private messageNotificationUnsubs: Array<() => void> = [];
  private storeSyncUnsubs: Array<() => void> = [];
  private readonly dialogOrderTracker = new DialogOrderTracker();
  private openAccountSlot: string | undefined;

  constructor({ debug }: { debug?: boolean } = {}) {
    this.debug = debug ?? false;
    this.transportService = new TransportService({
      debug: debug ?? false,
    });
  }

  /**
   * Open LocalDb for an account slot and create UpdateManager (not started).
   * Assigns localDb / updateManager onto already-created services.
   * Idempotent when the same `accountSlot` is already open (SharedWorker multi-tab).
   */
  async openAccount(options: TelegramOpenAccountOptions): Promise<void> {
    if (this.localDb && this.openAccountSlot === options.accountSlot) {
      return;
    }

    if (this.localDb) {
      await this.closeAccount();
    }

    const { updateManager: umOpts, ...localDbOpts } = options;
    this.localDb = new LocalDb({
      ...localDbOpts,
      onEntityChange: (change) => this.fanOutEntityChange(change),
    });
    await this.localDb.open();

    this.fileRefEngine = new FileRefEngine({
      localDb: this.localDb,
      getClient: () => this.transportService.client,
    });
    this.transportService.setFileRefEngine(this.fileRefEngine);

    this.updateManager = new UpdateManager({
      ...umOpts,
      transportService: this.transportService,
      localDb: this.localDb,
      fileRefEngine: this.fileRefEngine,
      debug: this.debug,
    });

    this.attachMessageNotificationHooks();
    this.attachStoreSyncHooks();
    this.assignServiceDeps();
    this.openAccountSlot = options.accountSlot;
  }

  /** Start UpdateManager (requires openAccount + connected TelegramClient). Idempotent if already running. */
  async startUpdates(): Promise<void> {
    if (!this.updateManager) {
      throw new Error('Telegram: openAccount before startUpdates');
    }
    await this.updateManager.start();
  }

  stopUpdates(): void {
    this.updateManager?.stop();
  }

  /** Stop updates, clear entity listeners, close LocalDb. */
  async closeAccount(): Promise<void> {
    this.stopUpdates();
    this.detachMessageNotificationHooks();
    this.detachStoreSyncHooks();
    this.dialogOrderTracker.reset();
    this.fileRefEngine?.uninstall();
    this.fileRefEngine = undefined;
    this.transportService.setFileRefEngine(undefined);
    if (this.fileService) {
      this.fileService.fileRefEngine = undefined;
    }
    this.updateManager = undefined;
    this.entityChangeListeners.clear();
    this.messageNotificationListeners.clear();
    this.storeUpdateListeners.clear();
    this.dialogOrderListeners.clear();
    if (this.localDb) {
      this.localDb.setEntityChangeNotifier(undefined);
      this.localDb.close();
      this.localDb = undefined;
    }
    this.openAccountSlot = undefined;
    this.assignServiceDeps();
  }

  subscribeEntityChanges(handler: EntityChangeListener): () => void {
    this.entityChangeListeners.add(handler);
    return () => {
      this.entityChangeListeners.delete(handler);
    };
  }

  subscribeMessageNotifications(handler: MessageNotificationListener): () => void {
    this.messageNotificationListeners.add(handler);
    return () => {
      this.messageNotificationListeners.delete(handler);
    };
  }

  subscribeStoreUpdates(handler: StoreUpdateListener): () => void {
    this.storeUpdateListeners.add(handler);
    return () => {
      this.storeUpdateListeners.delete(handler);
    };
  }

  subscribeDialogOrder(handler: DialogOrderListener): () => void {
    this.dialogOrderListeners.add(handler);
    return () => {
      this.dialogOrderListeners.delete(handler);
    };
  }

  /**
   * Seed / refresh in-memory dialog ranking from a getDialogs page.
   * Emits `dialogOrder` when the sorted id list changes.
   */
  ingestDialogPage(page: DialogOrderPage, options: DialogOrderIngestOptions = {}): void {
    this.dialogOrderTracker.ingestPage(page, options);
    this.flushDialogOrder();
  }

  onUsers(handler: EntityChangeListener): () => void {
    return this.subscribeFiltered(handler, (c) => c.store === 'users');
  }

  onChats(handler: EntityChangeListener): () => void {
    return this.subscribeFiltered(handler, (c) => c.store === 'chats');
  }

  onChannels(handler: EntityChangeListener): () => void {
    return this.subscribeFiltered(handler, (c) => c.store === 'channels');
  }

  onUserFull(handler: EntityChangeListener): () => void {
    return this.subscribeFiltered(handler, (c) => c.store === 'userFull');
  }

  onChatFull(handler: EntityChangeListener): () => void {
    return this.subscribeFiltered(handler, (c) => c.store === 'chatFull');
  }

  onChannelFull(handler: EntityChangeListener): () => void {
    return this.subscribeFiltered(handler, (c) => c.store === 'channelFull');
  }

  async resolveInputPeer(peerId: string): Promise<ResolvedInputPeer> {
    if (!this.localDb) {
      return { type: 'unavailable', peerId };
    }
    return this.localDb.resolveInputPeer(peerId);
  }

  /**
   * Debug: delete one foundation peer or full-info row and notify listeners.
   * Flushes the write queue so a following IndexedDB read sees the delete.
   */
  async debugDeleteLocalEntity(store: FoundationDebugStore, id: string): Promise<void> {
    if (!this.localDb) {
      throw new Error('Telegram: openAccount before debugDeleteLocalEntity');
    }
    switch (store) {
      case 'chats':
        await this.localDb.deleteChat(id);
        break;
      case 'channels':
        await this.localDb.deleteChannel(id);
        break;
      case 'chatFull':
        await this.localDb.invalidateChatFull(id);
        break;
      case 'channelFull':
        await this.localDb.invalidateChannelFull(id);
        break;
      default: {
        const unexpected: never = store;
        throw new Error(`Telegram: unknown debug store ${String(unexpected)}`);
      }
    }
    await this.localDb.flush();
  }

  getAuthService() {
    if (!this.authService) {
      this.authService = new AuthService({
        debug: this.debug,
        transportService: this.transportService,
      });
    }
    return this.authService;
  }

  getChatService() {
    if (!this.chatService) {
      this.chatService = new ChatService({
        debug: this.debug,
        transportService: this.transportService,
        localDb: this.localDb,
        updateManager: this.updateManager,
      });
    }
    return this.chatService;
  }

  getChannelService() {
    if (!this.channelService) {
      this.channelService = new ChannelService({
        debug: this.debug,
        transportService: this.transportService,
        localDb: this.localDb,
        updateManager: this.updateManager,
      });
    }
    return this.channelService;
  }

  getDialogService() {
    if (!this.dialogService) {
      this.dialogService = new DialogService({
        debug: this.debug,
        transportService: this.transportService,
        localDb: this.localDb,
        dialogOrderTracker: this.dialogOrderTracker,
        flushDialogOrder: () => this.flushDialogOrder(),
      });
    }
    return this.dialogService;
  }

  getDialogFilterService() {
    if (!this.dialogFilterService) {
      this.dialogFilterService = new DialogFilterService({
        debug: this.debug,
        transportService: this.transportService,
        getSelfId: () => this.resolveSelfId(),
      });
    }
    return this.dialogFilterService;
  }

  getFileService() {
    if (!this.fileService) {
      this.fileService = new FileService({
        debug: this.debug,
        transportService: this.transportService,
        localDb: this.localDb,
        fileRefEngine: this.fileRefEngine,
      });
    }
    return this.fileService;
  }

  getMessageService() {
    if (!this.messageService) {
      this.messageService = new MessageService({
        debug: this.debug,
        transportService: this.transportService,
        fileService: this.getFileService(),
        localDb: this.localDb,
        updateManager: this.updateManager,
        onMessageViews: (peerId, patches) => {
          this.fanOutStoreUpdate({ type: 'message.patch', peerId, patches });
        },
      });
    }
    return this.messageService;
  }

  getMessageReactionService() {
    if (!this.messageReactionService) {
      this.messageReactionService = new MessageReactionService({
        transportService: this.transportService,
        localDb: this.localDb,
        updateManager: this.updateManager,
      });
    }
    return this.messageReactionService;
  }

  getStickerService() {
    if (!this.stickerService) {
      this.stickerService = new StickerService({
        transportService: this.transportService,
      });
    }
    return this.stickerService;
  }

  getUserService() {
    if (!this.userService) {
      this.userService = new UserService({
        debug: this.debug,
        transportService: this.transportService,
        localDb: this.localDb,
      });
    }
    return this.userService;
  }

  getEncryptedChatService() {
    if (!this.encryptedChatService) {
      this.encryptedChatService = new EncryptedChatService({
        debug: this.debug,
        transportService: this.transportService,
        localDb: this.localDb,
        updateManager: this.updateManager,
      });
    }
    return this.encryptedChatService;
  }

  private assignServiceDeps(): void {
    if (this.chatService) {
      this.chatService.localDb = this.localDb;
      this.chatService.updateManager = this.updateManager;
    }
    if (this.channelService) {
      this.channelService.localDb = this.localDb;
      this.channelService.updateManager = this.updateManager;
    }
    if (this.dialogService) {
      this.dialogService.localDb = this.localDb;
      this.dialogService.dialogOrderTracker = this.dialogOrderTracker;
      this.dialogService.flushDialogOrder = () => this.flushDialogOrder();
    }
    if (this.messageService) {
      this.messageService.localDb = this.localDb;
      this.messageService.updateManager = this.updateManager;
    }
    if (this.messageReactionService) {
      this.messageReactionService.localDb = this.localDb;
      this.messageReactionService.updateManager = this.updateManager;
    }
    if (this.userService) {
      this.userService.localDb = this.localDb;
    }
    if (this.encryptedChatService) {
      this.encryptedChatService.localDb = this.localDb;
      this.encryptedChatService.updateManager = this.updateManager;
    }
    if (this.fileService) {
      this.fileService.localDb = this.localDb;
      this.fileService.fileRefEngine = this.fileRefEngine;
    }
  }

  /** Own dialog id, used to resolve `InputPeerSelf` in folder peer lists. */
  private async resolveSelfId(): Promise<string | undefined> {
    return this.fileRefEngine?.getSelfId();
  }

  private subscribeFiltered(
    handler: EntityChangeListener,
    predicate: (change: LocalDbEntityChange) => boolean,
  ): () => void {
    return this.subscribeEntityChanges((change) => {
      if (predicate(change)) handler(change);
    });
  }

  private fanOutEntityChange(change: LocalDbEntityChange): void {
    for (const listener of this.entityChangeListeners) {
      try {
        listener(change);
      } catch (err) {
        console.error('[Telegram] entity change listener error', err);
      }
    }
  }

  private attachMessageNotificationHooks(): void {
    this.detachMessageNotificationHooks();
    if (!this.updateManager) return;

    const onNewMessage = async (update: {
      message?: Api.TypeMessage;
    }) => {
      const payload = this.toMessageNotification(update.message);
      if (payload) {
        this.fanOutMessageNotification(payload);
      }
    };

    this.messageNotificationUnsubs = [
      this.updateManager.on('UpdateNewMessage', onNewMessage),
      this.updateManager.on('UpdateNewChannelMessage', onNewMessage),
    ];
  }

  private detachMessageNotificationHooks(): void {
    for (const unsub of this.messageNotificationUnsubs) {
      unsub();
    }
    this.messageNotificationUnsubs = [];
  }

  private attachStoreSyncHooks(): void {
    this.detachStoreSyncHooks();
    if (!this.updateManager) return;

    this.storeSyncUnsubs = [
      this.updateManager.onAny((_event, update) => {
        const payloads = toStoreSyncPayloads(update);
        for (const payload of payloads) {
          this.dialogOrderTracker.apply(payload);
          this.fanOutStoreUpdate(payload);
        }
      }),
      this.updateManager.onControl('batchEnd', () => {
        this.flushDialogOrder();
      }),
    ];
  }

  private detachStoreSyncHooks(): void {
    for (const unsub of this.storeSyncUnsubs) {
      unsub();
    }
    this.storeSyncUnsubs = [];
  }

  private flushDialogOrder(): void {
    const order = this.dialogOrderTracker.flush();
    if (!order) return;
    this.fanOutDialogOrder(order);
  }

  private fanOutStoreUpdate(payload: StoreSyncPayload): void {
    for (const listener of this.storeUpdateListeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error('[Telegram] store update listener error', err);
      }
    }
  }

  private fanOutDialogOrder(payload: DialogOrderPayload): void {
    for (const listener of this.dialogOrderListeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error('[Telegram] dialog order listener error', err);
      }
    }
  }

  private toMessageNotification(
    message: Api.TypeMessage | undefined,
  ): MessageNotificationPayload | undefined {
    if (!message || message instanceof Api.MessageEmpty) {
      return undefined;
    }
    if ('out' in message && message.out) {
      return undefined;
    }

    const chatId = peerIdFromMessage(message);
    if (!chatId) {
      return undefined;
    }

    const text =
      'message' in message && typeof message.message === 'string' ? message.message.trim() : '';
    const hasMedia = 'media' in message && message.media != null;
    const body = text || (hasMedia ? 'Media' : '');
    if (!body) {
      return undefined;
    }

    return {
      chatId,
      messageId: message.id,
      title: chatId,
      body,
      isSilent: 'silent' in message ? Boolean(message.silent) : undefined,
    };
  }

  private fanOutMessageNotification(payload: MessageNotificationPayload): void {
    for (const listener of this.messageNotificationListeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error('[Telegram] message notification listener error', err);
      }
    }
  }

  /** Push a notification payload to SW listeners (e.g. unread reaction from a tab). */
  emitMessageNotification(payload: MessageNotificationPayload): void {
    this.fanOutMessageNotification(payload);
  }
}

let tg: Telegram | undefined;

export const getTelegram = ({ debug }: { debug?: boolean } = {}): Telegram => {
  if (!tg) {
    tg = new Telegram({ debug });
  }
  return tg;
};
