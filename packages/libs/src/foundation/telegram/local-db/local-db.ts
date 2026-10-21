import { IdbManager } from '../../idb/idb-manager';
import {
  DB_NAME_PREFIX,
  FULL_INFO_TTL_MS,
  LOCAL_DB_VERSION,
} from './constants';
import type { LocalDbContext } from './context';
import { ChannelStore } from './channels/channel.store';
import { ChatStore } from './chats/chat.store';
import { EncryptedChatStore } from './encrypted-chats/encrypted-chat.store';
import { FileRefStore } from './files/file-ref.store';
import { MsgIdRangeStore } from './msg-id-ranges/msg-id-range.store';
import { PeerStore } from './peers/peer.store';
import { RandomIdStore } from './random-ids/random-id.store';
import type {
  LocalDbEntityChange,
  LocalDbEntityChangeNotifier,
  LocalDbOptions,
} from './types';
import { buildLocalDbStores } from './types';
import { UpdateStateStore } from './updates/update-state.store';
import { UserStore } from './users/user.store';

/**
 * Persistent Telegram protocol local database (peers, sync state, ranges, random ids).
 * One IndexedDB per accountSlot: `telegenie-foundation_${accountSlot}`.
 */
export class LocalDb {
  private readonly idb: IdbManager;
  private readonly accountSlot: string;
  private entityChangeNotifier?: LocalDbEntityChangeNotifier;

  private readonly users: UserStore;
  private readonly chats: ChatStore;
  private readonly channels: ChannelStore;
  private readonly encryptedChats: EncryptedChatStore;
  private readonly peers: PeerStore;
  private readonly updates: UpdateStateStore;
  private readonly msgIdRanges: MsgIdRangeStore;
  private readonly randomIds: RandomIdStore;
  private readonly fileRefs: FileRefStore;

  readonly putUser: UserStore['putUser'];
  readonly putUsers: UserStore['putUsers'];
  readonly getUser: UserStore['getUser'];
  readonly getUserRow: UserStore['getUserRow'];
  readonly putUserFull: UserStore['putUserFull'];
  readonly getUserFull: UserStore['getUserFull'];
  readonly invalidateUserFull: UserStore['invalidateUserFull'];

  readonly putChat: ChatStore['putChat'];
  readonly putChats: ChatStore['putChats'];
  readonly getChat: ChatStore['getChat'];
  readonly deleteChat: ChatStore['deleteChat'];
  readonly putChatFull: ChatStore['putChatFull'];
  readonly getChatFull: ChatStore['getChatFull'];
  readonly invalidateChatFull: ChatStore['invalidateChatFull'];

  readonly putChannel: ChannelStore['putChannel'];
  readonly putChannels: ChannelStore['putChannels'];
  readonly getChannel: ChannelStore['getChannel'];
  readonly getChannelRow: ChannelStore['getChannelRow'];
  readonly deleteChannel: ChannelStore['deleteChannel'];
  readonly putChannelFull: ChannelStore['putChannelFull'];
  readonly getChannelFull: ChannelStore['getChannelFull'];
  readonly invalidateChannelFull: ChannelStore['invalidateChannelFull'];

  readonly putEncryptedChat: EncryptedChatStore['putEncryptedChat'];
  readonly putEncryptedChats: EncryptedChatStore['putEncryptedChats'];
  readonly getEncryptedChat: EncryptedChatStore['getEncryptedChat'];
  readonly getEncryptedChatRow: EncryptedChatStore['getEncryptedChatRow'];
  readonly putEncryptedChatKey: EncryptedChatStore['putEncryptedChatKey'];
  readonly getEncryptedChatKey: EncryptedChatStore['getEncryptedChatKey'];

  readonly getPeer: PeerStore['getPeer'];
  readonly putMinContext: PeerStore['putMinContext'];
  readonly getMinContext: PeerStore['getMinContext'];
  readonly resolveInputPeer: PeerStore['resolveInputPeer'];

  readonly getCommonState: UpdateStateStore['getCommonState'];
  readonly setCommonState: UpdateStateStore['setCommonState'];
  readonly getMeta: UpdateStateStore['getMeta'];
  readonly setMeta: UpdateStateStore['setMeta'];
  readonly applyCommonPts: UpdateStateStore['applyCommonPts'];
  readonly applyQts: UpdateStateStore['applyQts'];
  readonly applySeq: UpdateStateStore['applySeq'];
  readonly getChannelPts: UpdateStateStore['getChannelPts'];
  readonly setChannelPts: UpdateStateStore['setChannelPts'];
  readonly seedChannelPts: UpdateStateStore['seedChannelPts'];
  readonly applyChannelPts: UpdateStateStore['applyChannelPts'];

  readonly getMsgIdRanges: MsgIdRangeStore['getMsgIdRanges'];
  readonly noteMessageId: MsgIdRangeStore['noteMessageId'];
  readonly markMsgIdGapUnfillable: MsgIdRangeStore['markMsgIdGapUnfillable'];
  readonly containsMsgId: MsgIdRangeStore['containsMsgId'];
  readonly findGapInDisplayedRange: MsgIdRangeStore['findGapInDisplayedRange'];
  readonly extendRangesFromFetchedIds: MsgIdRangeStore['extendRangesFromFetchedIds'];
  readonly extendRangesFromSpan: MsgIdRangeStore['extendRangesFromSpan'];

  readonly putPendingRandomId: RandomIdStore['putPendingRandomId'];
  readonly bindRandomId: RandomIdStore['bindRandomId'];
  readonly getRandomId: RandomIdStore['getRandomId'];
  readonly deleteRandomId: RandomIdStore['deleteRandomId'];

  readonly putFileRef: FileRefStore['putFileRef'];
  readonly getFileRef: FileRefStore['getFileRef'];
  readonly deleteFileRef: FileRefStore['deleteFileRef'];
  readonly putFileSource: FileRefStore['putFileSource'];
  readonly getFileSources: FileRefStore['getFileSources'];
  readonly deleteFileSources: FileRefStore['deleteFileSources'];

  constructor(options: LocalDbOptions) {
    this.accountSlot = options.accountSlot;
    this.entityChangeNotifier = options.onEntityChange;
    this.idb = new IdbManager({
      name: `${DB_NAME_PREFIX}${options.accountSlot}`,
      version: LOCAL_DB_VERSION,
      stores: buildLocalDbStores(),
      factory: options.factory,
      flushDelayMs: options.flushDelayMs,
      maxBatchSize: options.maxBatchSize,
    });

    const ctx: LocalDbContext = {
      idb: this.idb,
      fullInfoTtlMs: options.fullInfoTtlMs ?? FULL_INFO_TTL_MS,
      notify: (change) => this.notify(change),
    };

    this.users = new UserStore(ctx);
    this.chats = new ChatStore(ctx);
    this.channels = new ChannelStore(ctx);
    this.encryptedChats = new EncryptedChatStore(ctx);
    this.peers = new PeerStore(ctx, this.users, this.chats, this.channels);
    this.updates = new UpdateStateStore(ctx);
    this.msgIdRanges = new MsgIdRangeStore(ctx);
    this.randomIds = new RandomIdStore(ctx);
    this.fileRefs = new FileRefStore(ctx);

    this.putUser = this.users.putUser.bind(this.users);
    this.putUsers = this.users.putUsers.bind(this.users);
    this.getUser = this.users.getUser.bind(this.users);
    this.getUserRow = this.users.getUserRow.bind(this.users);
    this.putUserFull = this.users.putUserFull.bind(this.users);
    this.getUserFull = this.users.getUserFull.bind(this.users);
    this.invalidateUserFull = this.users.invalidateUserFull.bind(this.users);

    this.putChat = this.chats.putChat.bind(this.chats);
    this.putChats = this.chats.putChats.bind(this.chats);
    this.getChat = this.chats.getChat.bind(this.chats);
    this.deleteChat = this.chats.deleteChat.bind(this.chats);
    this.putChatFull = this.chats.putChatFull.bind(this.chats);
    this.getChatFull = this.chats.getChatFull.bind(this.chats);
    this.invalidateChatFull = this.chats.invalidateChatFull.bind(this.chats);

    this.putChannel = this.channels.putChannel.bind(this.channels);
    this.putChannels = this.channels.putChannels.bind(this.channels);
    this.getChannel = this.channels.getChannel.bind(this.channels);
    this.getChannelRow = this.channels.getChannelRow.bind(this.channels);
    this.deleteChannel = this.channels.deleteChannel.bind(this.channels);
    this.putChannelFull = this.channels.putChannelFull.bind(this.channels);
    this.getChannelFull = this.channels.getChannelFull.bind(this.channels);
    this.invalidateChannelFull = this.channels.invalidateChannelFull.bind(this.channels);

    this.putEncryptedChat = this.encryptedChats.putEncryptedChat.bind(this.encryptedChats);
    this.putEncryptedChats = this.encryptedChats.putEncryptedChats.bind(this.encryptedChats);
    this.getEncryptedChat = this.encryptedChats.getEncryptedChat.bind(this.encryptedChats);
    this.getEncryptedChatRow = this.encryptedChats.getEncryptedChatRow.bind(this.encryptedChats);
    this.putEncryptedChatKey = this.encryptedChats.putEncryptedChatKey.bind(this.encryptedChats);
    this.getEncryptedChatKey = this.encryptedChats.getEncryptedChatKey.bind(this.encryptedChats);

    this.getPeer = this.peers.getPeer.bind(this.peers);
    this.putMinContext = this.peers.putMinContext.bind(this.peers);
    this.getMinContext = this.peers.getMinContext.bind(this.peers);
    this.resolveInputPeer = this.peers.resolveInputPeer.bind(this.peers);

    this.getCommonState = this.updates.getCommonState.bind(this.updates);
    this.setCommonState = this.updates.setCommonState.bind(this.updates);
    this.getMeta = this.updates.getMeta.bind(this.updates);
    this.setMeta = this.updates.setMeta.bind(this.updates);
    this.applyCommonPts = this.updates.applyCommonPts.bind(this.updates);
    this.applyQts = this.updates.applyQts.bind(this.updates);
    this.applySeq = this.updates.applySeq.bind(this.updates);
    this.getChannelPts = this.updates.getChannelPts.bind(this.updates);
    this.setChannelPts = this.updates.setChannelPts.bind(this.updates);
    this.seedChannelPts = this.updates.seedChannelPts.bind(this.updates);
    this.applyChannelPts = this.updates.applyChannelPts.bind(this.updates);

    this.getMsgIdRanges = this.msgIdRanges.getMsgIdRanges.bind(this.msgIdRanges);
    this.noteMessageId = this.msgIdRanges.noteMessageId.bind(this.msgIdRanges);
    this.markMsgIdGapUnfillable = this.msgIdRanges.markMsgIdGapUnfillable.bind(this.msgIdRanges);
    this.containsMsgId = this.msgIdRanges.containsMsgId.bind(this.msgIdRanges);
    this.findGapInDisplayedRange = this.msgIdRanges.findGapInDisplayedRange.bind(this.msgIdRanges);
    this.extendRangesFromFetchedIds = this.msgIdRanges.extendRangesFromFetchedIds.bind(
      this.msgIdRanges,
    );
    this.extendRangesFromSpan = this.msgIdRanges.extendRangesFromSpan.bind(this.msgIdRanges);

    this.putPendingRandomId = this.randomIds.putPendingRandomId.bind(this.randomIds);
    this.bindRandomId = this.randomIds.bindRandomId.bind(this.randomIds);
    this.getRandomId = this.randomIds.getRandomId.bind(this.randomIds);
    this.deleteRandomId = this.randomIds.deleteRandomId.bind(this.randomIds);

    this.putFileRef = this.fileRefs.putFileRef.bind(this.fileRefs);
    this.getFileRef = this.fileRefs.getFileRef.bind(this.fileRefs);
    this.deleteFileRef = this.fileRefs.deleteFileRef.bind(this.fileRefs);
    this.putFileSource = this.fileRefs.putFileSource.bind(this.fileRefs);
    this.getFileSources = this.fileRefs.getFileSources.bind(this.fileRefs);
    this.deleteFileSources = this.fileRefs.deleteFileSources.bind(this.fileRefs);
  }

  get dbName(): string {
    return `${DB_NAME_PREFIX}${this.accountSlot}`;
  }

  /** Replace or clear the entity-change notifier (used by Telegram facade). */
  setEntityChangeNotifier(notifier?: LocalDbEntityChangeNotifier): void {
    this.entityChangeNotifier = notifier;
  }

  async open(): Promise<void> {
    await this.idb.open();
  }

  close(): void {
    this.entityChangeNotifier = undefined;
    this.idb.close();
  }

  destroy(): void {
    this.entityChangeNotifier = undefined;
    this.idb.destroy();
  }

  async deleteDatabase(): Promise<void> {
    this.entityChangeNotifier = undefined;
    await this.idb.deleteDatabase();
  }

  flush(): Promise<void> {
    return this.idb.flush();
  }

  /** Helper: box id for a peer (`common` for user/chat, peerId for channel). */
  static msgIdBoxForPeer(peerId: string): string {
    return MsgIdRangeStore.msgIdBoxForPeer(peerId);
  }

  private notify(change: LocalDbEntityChange): void {
    if (!this.entityChangeNotifier) return;
    try {
      this.entityChangeNotifier(change);
    } catch (err) {
      console.error('[LocalDb] onEntityChange error', err);
    }
  }
}
