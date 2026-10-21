import type EntityStore from '../entity/entity.store';
import type GlobalStore from '../global/global.store';
import type { ChannelEntity, ChannelFullEntity } from './channel';
import type { ChatEntity, ChatFullEntity } from './chat';
import type { Entity, EntityStoreSchema, EntityWithId, GlobalStoreSchema } from './common';
import type { DialogEntity } from './dialog';
import type { CustomEmojiDocumentEntity } from './custom-emoji';
import type { DialogFilterEntity } from './dialog-filter';
import type { MessageEntity } from './message';
import type { UserEntity, UserFullEntity } from './user';

export type AllStoreSchema = EntityStoreSchema<EntityWithId, Entity> | GlobalStoreSchema;

export type ChannelStore = EntityStore<
  import('../entity/models/channel.model').Channel,
  ChannelEntity
>;
export type ChatStore = EntityStore<import('../entity/models/chat.model').Chat, ChatEntity>;
export type MessageStore = EntityStore<
  import('../entity/models/message.model').Message,
  MessageEntity
>;
export type UserStore = EntityStore<import('../entity/models/user.model').User, UserEntity>;
export type UserFullStore = EntityStore<
  import('../entity/models/user-full.model').UserFull,
  UserFullEntity
>;
export type ChatFullStore = EntityStore<
  import('../entity/models/chat-full.model').ChatFull,
  ChatFullEntity
>;
export type ChannelFullStore = EntityStore<
  import('../entity/models/channel-full.model').ChannelFull,
  ChannelFullEntity
>;
export type DialogStore = EntityStore<
  import('../entity/models/dialog.model').Dialog,
  DialogEntity
>;
export type DialogFilterStore = EntityStore<
  import('../entity/models/dialog-filter.model').DialogFilterModel,
  DialogFilterEntity
>;
export type EncryptedChatStore = EntityStore<
  import('../entity/models/encrypted-chat.model').EncryptedChat,
  import('./encrypted-chat').EncryptedChatEntity
>;
export type CustomEmojiStore = EntityStore<
  import('../entity/models/custom-emoji.model').CustomEmojiDocument,
  CustomEmojiDocumentEntity
>;

/**
 * Named stores registered by TeleGenieSDK.
 * Per-peer message caches use dynamic names `${peerId}-message` (not in StoreMap).
 */
export type StoreMap = {
  channel: ChannelStore;
  chat: ChatStore;
  user: UserStore;
  userFull: UserFullStore;
  chatFull: ChatFullStore;
  channelFull: ChannelFullStore;
  dialog: DialogStore;
  dialogFilter: DialogFilterStore;
  encryptedChat: EncryptedChatStore;
  customEmoji: CustomEmojiStore;
  global: GlobalStore;
};

export type StoreName = keyof StoreMap;

export type AllStore =
  | ChannelStore
  | ChatStore
  | MessageStore
  | UserStore
  | UserFullStore
  | ChatFullStore
  | ChannelFullStore
  | DialogStore
  | DialogFilterStore
  | EncryptedChatStore
  | CustomEmojiStore
  | GlobalStore;
