import type { IdType } from '@telegenie/libs/foundation/notification';
import type { ChannelFull } from './entity/models/channel-full.model';
import type { Channel } from './entity/models/channel.model';
import type { ChatFull } from './entity/models/chat-full.model';
import type { Chat } from './entity/models/chat.model';
import type { CustomEmojiDocument } from './entity/models/custom-emoji.model';
import type { DialogFilterModel } from './entity/models/dialog-filter.model';
import type { Dialog } from './entity/models/dialog.model';
import type { EncryptedChat } from './entity/models/encrypted-chat.model';
import type { UserFull } from './entity/models/user-full.model';
import type { User } from './entity/models/user.model';
import type { AuthStep } from './global/global.store';
import type { DialogUIState } from './global/models/dialog.state';
import type { LeaderState } from './global/models/leader.state';
import type { NavState } from './global/models/nav.state';
import type { StickersState } from './global/models/stickers.state';
import type { ThreadUIState } from './global/models/thread.state';
import type { UserEntity } from './types';
import type { StoreName } from './types/store';

/** UI-facing entity store: lookups only. Controllers own `update` / `hydrate` / `deleteByIds`. */
export interface EntityStoreView<M> {
  get(id: IdType): M;
  getAllData(): {
    get(id: string): M | undefined;
    has(id: string): boolean;
    values(): IterableIterator<M>;
    keys(): IterableIterator<string>;
    readonly size: number;
  };
  getSize(): number;
  toJS(): unknown;
}

export interface AuthSliceView {
  readonly currentUser: UserEntity | null;
  readonly authStep: AuthStep;
  readonly authIsLoading: boolean;
  readonly authError: string | null;
  readonly authPasswordHint: string | undefined;
  readonly authSessionString: string | null;
  readonly authIsCodeViaApp: boolean;
  readonly authPhoneNumber: string;
  readonly authPhoneCodeHash: string;
}

export type LeaderSliceView = LeaderState;

export type NavSliceView = NavState;

export type StickersSliceView = StickersState;

export interface GlobalStoreView {
  readonly auth: AuthSliceView;
  readonly leader: LeaderSliceView;
  readonly nav: NavSliceView;
  readonly stickers: StickersSliceView;
  readonly dialogs: {
    get(peerId: string): DialogUIState | undefined;
    has(peerId: string): boolean;
    keys(): IterableIterator<string>;
  };
  getDialogUI(peerId: string): DialogUIState | undefined;
  getThreadUI(peerId: string, threadId?: string): ThreadUIState | undefined;
  toJS(): { auth: unknown; app: unknown };
}

export type StoreMapView = {
  channel: EntityStoreView<Channel>;
  chat: EntityStoreView<Chat>;
  user: EntityStoreView<User>;
  userFull: EntityStoreView<UserFull>;
  chatFull: EntityStoreView<ChatFull>;
  channelFull: EntityStoreView<ChannelFull>;
  dialog: EntityStoreView<Dialog>;
  dialogFilter: EntityStoreView<DialogFilterModel>;
  encryptedChat: EntityStoreView<EncryptedChat>;
  customEmoji: EntityStoreView<CustomEmojiDocument>;
  global: GlobalStoreView;
};

export interface StoreManagerView {
  get<N extends StoreName>(name: N): StoreMapView[N];
  get(name: string): EntityStoreView<unknown> | GlobalStoreView;
  has(name: string): boolean;
  names(): string[];
  toJS(): unknown;
}
