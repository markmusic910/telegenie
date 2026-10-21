
export enum EVENT_TYPES {
  UPDATE_STORE = 'update:store',
  DELETE_STORE = 'delete:store',
  UPDATE_STORE_CHANNEL = 'update:store:channel',
  DELETE_STORE_CHANNEL = 'delete:store:channel',
  UPDATE_STORE_CHANNEL_FULL = 'update:store:channel-full',
  DELETE_STORE_CHANNEL_FULL = 'delete:store:channel-full',
  UPDATE_STORE_CHAT = 'update:store:chat',
  DELETE_STORE_CHAT = 'delete:store:chat',
  UPDATE_STORE_CHAT_FULL = 'update:store:chat-full',
  DELETE_STORE_CHAT_FULL = 'delete:store:chat-full',
  UPDATE_STORE_MESSAGE = 'update:store:message',
  DELETE_STORE_MESSAGE = 'delete:store:message',
  UPDATE_STORE_USER = 'update:store:user',
  DELETE_STORE_USER = 'delete:store:user',
  UPDATE_STORE_USER_FULL = 'update:store:user-full',
  DELETE_STORE_USER_FULL = 'delete:store:user-full',
  UPDATE_STORE_DIALOG = 'update:store:dialog',
  DELETE_STORE_DIALOG = 'delete:store:dialog',
  UPDATE_GLOBAL_STORE = 'update:store:global',
  DELETE_GLOBAL_STORE = 'delete:store:global',
  UPDATE_STORE_TG_CHANNEL = 'update:store:tg-channel',
  DELETE_STORE_TG_CHANNEL = 'delete:store:tg-channel',
  UPDATE_STORE_TG_CHAT = 'update:store:tg-chat',
  DELETE_STORE_TG_CHAT = 'delete:store:tg-chat',
  UPDATE_STORE_TG_MESSAGE = 'update:store:tg-message',
  DELETE_STORE_TG_MESSAGE = 'delete:store:tg-message',
  UPDATE_STORE_TG_USER = 'update:store:tg-user',
  DELETE_STORE_TG_USER = 'delete:store:tg-user',
  UPDATE_STORE_TG_DIALOG = 'update:store:tg-dialog',
  DELETE_STORE_TG_DIALOG = 'delete:store:tg-dialog',
}

export type IdType = string;

export type NotificationEntityIds = {
  ids: IdType[];
};

export type NotificationEntities<T> = {
  entities: T;
};

export type NotificationUpdateStore<T> = {
  type:
    | EVENT_TYPES.UPDATE_STORE
    | EVENT_TYPES.UPDATE_STORE_CHANNEL
    | EVENT_TYPES.UPDATE_STORE_CHAT
    | EVENT_TYPES.UPDATE_STORE_MESSAGE
    | EVENT_TYPES.UPDATE_STORE_USER
    | EVENT_TYPES.UPDATE_STORE_DIALOG
    | EVENT_TYPES.UPDATE_STORE_CHANNEL_FULL
    | EVENT_TYPES.UPDATE_STORE_CHAT_FULL
    | EVENT_TYPES.UPDATE_STORE_USER_FULL
    | EVENT_TYPES.UPDATE_STORE_TG_CHANNEL
    | EVENT_TYPES.UPDATE_STORE_TG_CHAT
    | EVENT_TYPES.UPDATE_STORE_TG_MESSAGE
    | EVENT_TYPES.UPDATE_STORE_TG_USER
    | EVENT_TYPES.UPDATE_STORE_TG_DIALOG;
  body: NotificationEntities<T>;
};

export type NotificationDeleteStore = {
  type:
    | EVENT_TYPES.DELETE_STORE
    | EVENT_TYPES.DELETE_STORE_CHANNEL
    | EVENT_TYPES.DELETE_STORE_CHAT
    | EVENT_TYPES.DELETE_STORE_MESSAGE
    | EVENT_TYPES.DELETE_STORE_USER
    | EVENT_TYPES.DELETE_STORE_DIALOG
    | EVENT_TYPES.DELETE_STORE_CHANNEL_FULL
    | EVENT_TYPES.DELETE_STORE_CHAT_FULL
    | EVENT_TYPES.DELETE_STORE_USER_FULL
    | EVENT_TYPES.DELETE_STORE_TG_CHANNEL
    | EVENT_TYPES.DELETE_STORE_TG_CHAT
    | EVENT_TYPES.DELETE_STORE_TG_MESSAGE
    | EVENT_TYPES.DELETE_STORE_TG_USER
    | EVENT_TYPES.DELETE_STORE_TG_DIALOG;
  body: NotificationEntityIds;
};

export type Entity = {
  id: string | number;
  [key: string]: any;
};

export type GlobalStoreModel = Record<string, any>;

export type NotificationUpdateGlobalStore<T extends Partial<GlobalStoreModel> = Partial<GlobalStoreModel>> = {
  type: EVENT_TYPES.UPDATE_GLOBAL_STORE;
  body: T;
};

export type NotificationDeleteGlobalStore<T extends keyof GlobalStoreModel = keyof GlobalStoreModel> = {
  type: EVENT_TYPES.DELETE_GLOBAL_STORE;
  body: T;
};

export type EntityStorePayload<Entities = Entity> =
  | NotificationDeleteStore
  | NotificationUpdateStore<Entities>;

export type GlobalStorePayload<
  GlobalStore extends Partial<GlobalStoreModel> = Partial<GlobalStoreModel>,
> =
  | NotificationUpdateGlobalStore<GlobalStore>
  | NotificationDeleteGlobalStore<
      keyof GlobalStore extends keyof GlobalStoreModel ? keyof GlobalStore : never
    >;
