import { Controller, Method, RequestLog } from '@telegenie/decorators';
import { getEntityTypeById } from '@telegenie/libs/foundation/telegram/helpers';
import type { TypePeerNotifySettings } from '@telegenie/libs/foundation/telegram/types/api-types';
import type { TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';
import { toJS } from 'mobx';
import type { Channel } from '@telegenie/sdk/store/entity/models/channel.model';
import { Dialog } from '@telegenie/sdk/store/entity/models/dialog.model';
import { UserFull } from '@telegenie/sdk/store/entity/models/user-full.model';
import { User } from '@telegenie/sdk/store/entity/models/user.model';
import type GlobalStore from '@telegenie/sdk/store/global/global.store';
import type StoreManager from '@telegenie/sdk/store/store.manager';
import type { DialogEntity, UserEntity, UserFullEntity } from '@telegenie/sdk/store/types';
import { ConversionService } from '../common/services/convert.service';

export type AddUserContactInput = {
  userId: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  addPhonePrivacyException?: boolean;
};

type UsernamePeer = Pick<User | Channel, 'id' | 'username' | 'usernames'>;

type UserControllerOptions = {
  sm: StoreManager;
  globalStore?: GlobalStore;
  debug?: boolean;
  worker: TelegramWorkerClient;
};

@Controller
export class UserController {
  worker: TelegramWorkerClient;
  sm: StoreManager;
  globalStore: GlobalStore | undefined;
  converter: ConversionService;
  private topInlineBotIdsCache?: string[];
  private topInlineBotsInFlight?: Promise<string[]>;

  constructor({ sm, globalStore, debug, worker }: UserControllerOptions) {
    this.converter = new ConversionService({
      debug: debug ?? false,
    });
    this.worker = worker;
    this.sm = sm;
    this.globalStore = globalStore;
  }

  @RequestLog()
  @Method()
  async getUsers(
    options: {
      id: string;
      accessHash?: string;
    }[],
  ): Promise<User[]> {
    const usersRecord = await this.worker.call('user.getUsers', [options]);
    const userEntities = this.converter.convertUsers(Object.values(usersRecord));
    this.sm.get('user').update(userEntities);
    return userEntities.map((entity) => new User(entity));
  }

  @RequestLog()
  @Method()
  async getUsersByIds(ids: string[]): Promise<User[]> {
    const usersRecord = await this.worker.call('user.getUsersByIds', [ids]);
    const userEntities = this.converter.convertUsers(Object.values(usersRecord));
    this.sm.get('user').update(userEntities);
    return userEntities.map((entity) => new User(entity));
  }

  @RequestLog()
  @Method()
  async getFullUsers(
    options: {
      id: string;
      accessHash?: string;
    }[],
    fetchOptions?: { forceRefresh?: boolean },
  ): Promise<UserFull[]> {
    const { fullUsers, chats, channels, users } = await this.worker.call('user.getFullUsers', [
      options,
      fetchOptions,
    ]);

    if (Object.keys(users).length > 0) {
      this.sm.get('user').update(this.converter.convertUsers(Object.values(users)));
    }
    if (Object.keys(chats).length > 0) {
      this.sm
        .get('chat')
        .update(Object.values(chats).map((chat) => this.converter.convertChat(chat)));
    }
    if (Object.keys(channels).length > 0) {
      this.sm
        .get('channel')
        .update(Object.values(channels).map((channel) => this.converter.convertChannel(channel)));
    }

    const userFullEntities = Object.values(fullUsers).map((fu) => this.converter.convertUserFull(fu));
    this.sm.get('userFull').update(userFullEntities);
    return userFullEntities.map((entity) => new UserFull(entity));
  }

  @RequestLog()
  @Method()
  async getFullUsersByIds(
    ids: string[],
    fetchOptions?: { forceRefresh?: boolean },
  ): Promise<UserFull[]> {
    const { fullUsers, chats, channels, users } = await this.worker.call('user.getFullUsersByIds', [
      ids,
      fetchOptions,
    ]);

    if (Object.keys(users).length > 0) {
      this.sm.get('user').update(this.converter.convertUsers(Object.values(users)));
    }
    if (Object.keys(chats).length > 0) {
      this.sm
        .get('chat')
        .update(Object.values(chats).map((chat) => this.converter.convertChat(chat)));
    }
    if (Object.keys(channels).length > 0) {
      this.sm
        .get('channel')
        .update(Object.values(channels).map((channel) => this.converter.convertChannel(channel)));
    }

    const userFullEntities = Object.values(fullUsers).map((fu) => this.converter.convertUserFull(fu));
    this.sm.get('userFull').update(userFullEntities);
    return userFullEntities.map((entity) => new UserFull(entity));
  }

  @RequestLog()
  @Method()
  async getMe(): Promise<User> {
    const raw = await this.worker.call('user.getMe', []);
    const entity = this.converter.convertUsers([raw])[0];
    this.sm.get('user').update([entity]);
    return new User(entity);
  }

  @RequestLog()
  @Method()
  async getContacts(): Promise<User[]> {
    const usersRecord = await this.worker.call('user.getContacts', []);
    const userEntities = this.converter.convertUsers(Object.values(usersRecord));
    this.sm.get('user').update(userEntities);
    return userEntities.map((entity) => new User(entity));
  }

  @RequestLog()
  @Method()
  async resolveUsername(username: string): Promise<string | undefined> {
    const localPeerId = this.findPeerIdByUsername(username);
    if (localPeerId) {
      return localPeerId;
    }

    const result = await this.worker.call('user.resolveUsername', [username]);
    if (!result) {
      return undefined;
    }

    if (result.users.length > 0) {
      this.sm.get('user').update(this.converter.convertUsers(result.users));
    }
    if (result.chats.length > 0) {
      this.sm
        .get('chat')
        .update(result.chats.map((chat) => this.converter.convertChat(chat)));
    }
    if (result.channels.length > 0) {
      this.sm
        .get('channel')
        .update(result.channels.map((channel) => this.converter.convertChannel(channel)));
    }

    return result.peerId;
  }

  /**
   * Fetch top inline bots and hydrate returned users into the user store.
   * Cached for the session with in-flight deduplication.
   */
  @RequestLog()
  @Method()
  async getTopInlineBots(forceRefresh = false): Promise<string[]> {
    if (!forceRefresh && this.topInlineBotIdsCache) {
      return this.topInlineBotIdsCache;
    }
    if (!forceRefresh && this.topInlineBotsInFlight) {
      return this.topInlineBotsInFlight;
    }

    const run = (async (): Promise<string[]> => {
      const { userIds, users } = await this.worker.call('user.getTopInlineBots', [20]);
      if (Object.keys(users).length > 0 && this.sm.has('user')) {
        this.sm
          .get('user')
          .update(
            this.converter.convertUsers(Object.values(users)).map((entity) => new User(entity)),
          );
      }
      this.topInlineBotIdsCache = userIds;
      return userIds;
    })();

    this.topInlineBotsInFlight = run;
    try {
      return await run;
    } finally {
      this.topInlineBotsInFlight = undefined;
    }
  }

  /**
   * Search remote users/bots via `contacts.search` and hydrate returned users into the user store.
   */
  @RequestLog()
  @Method()
  async searchContacts(q: string, limit: number = 20): Promise<string[]> {
    const query = q.trim();
    if (!query) return [];
    const { userIds, users } = await this.worker.call('user.searchContacts', [query, limit]);
    if (Object.keys(users).length > 0 && this.sm.has('user')) {
      this.sm
        .get('user')
        .update(
          this.converter.convertUsers(Object.values(users)).map((entity) => new User(entity)),
        );
    }
    return userIds;
  }

  /**
   * Push a user peer onto the middle-column profile stack and trigger background `UserFull` sync.
   * Skips non-user IDs, Saved Messages (`self`), and known deleted accounts.
   */
  @RequestLog()
  @Method()
  openProfile(userId: string): boolean {
    const trimmed = userId.trim();
    if (!trimmed) return false;
    try {
      if (getEntityTypeById(trimmed) !== 'user') return false;
    } catch {
      return false;
    }

    const selfId = this.globalStore?.auth.currentUser?.id;
    if (selfId && String(selfId) === trimmed) {
      return false;
    }

    const existingUser = this.sm.has('user')
      ? (this.sm.get('user').getAllData().get(trimmed) as User | undefined)
      : undefined;
    if (existingUser?.self || existingUser?.deleted) {
      return false;
    }

    this.globalStore?.nav.pushProfilePeerId(trimmed);

    if (!existingUser) {
      void this.getUsersByIds([trimmed]).catch(() => undefined);
    }
    void this.getFullUsers([{ id: trimmed, accessHash: existingUser?.accessHash }], {
      forceRefresh: true,
    }).catch(() => undefined);

    return true;
  }

  /** Pop the top-most User Profile from the middle-column overlay stack. */
  @RequestLog()
  @Method()
  popProfile(): string | undefined {
    return this.globalStore?.nav.popMiddleOverlay()?.peerId;
  }

  /** Clear the entire User Profile stack (e.g. when opening a chat). */
  @RequestLog()
  @Method()
  closeProfile(): void {
    this.globalStore?.nav.clearProfilePeerIds();
  }

  @RequestLog()
  @Method()
  async addContact(input: AddUserContactInput): Promise<User | undefined> {
    const existing = this.sm.has('user')
      ? (this.sm.get('user').getAllData().get(input.userId) as User | undefined)
      : undefined;
    const usersRecord = await this.worker.call('user.addContact', [
      {
        id: input.userId,
        accessHash: existing?.accessHash,
        firstName: input.firstName,
        lastName: input.lastName ?? '',
        phone: input.phone ?? existing?.phone ?? '',
        addPhonePrivacyException: input.addPhonePrivacyException,
      },
    ]);
    const converted = this.converter.convertUsers(Object.values(usersRecord));
    if (converted.length > 0 && this.sm.has('user')) {
      this.sm.get('user').update(converted);
      const match = converted.find((entry) => entry.id === input.userId) ?? converted[0];
      return match ? new User(match) : undefined;
    }
    if (existing && this.sm.has('user')) {
      const patched: UserEntity = {
        ...(toJS(existing) as UserEntity),
        id: input.userId,
        contact: true,
        firstName: input.firstName,
        lastName: input.lastName ?? '',
      };
      this.sm.get('user').update([patched]);
      return new User(patched);
    }
    return undefined;
  }

  @RequestLog()
  @Method()
  async deleteContact(userId: string): Promise<void> {
    const existing = this.sm.has('user')
      ? (this.sm.get('user').getAllData().get(userId) as User | undefined)
      : undefined;
    const usersRecord = await this.worker.call('user.deleteContact', [
      {
        id: userId,
        accessHash: existing?.accessHash,
      },
    ]);
    const converted = this.converter.convertUsers(Object.values(usersRecord));
    if (converted.length > 0 && this.sm.has('user')) {
      this.sm.get('user').update(converted);
      return;
    }
    if (existing && this.sm.has('user')) {
      const patched: UserEntity = {
        ...(toJS(existing) as UserEntity),
        id: userId,
        contact: false,
        mutualContact: false,
      };
      this.sm.get('user').update([patched]);
    }
  }

  @RequestLog()
  @Method()
  async setBlocked(userId: string, blocked: boolean): Promise<void> {
    const existing = this.sm.has('user')
      ? (this.sm.get('user').getAllData().get(userId) as User | undefined)
      : undefined;
    await this.worker.call('user.setBlocked', [
      {
        id: userId,
        accessHash: existing?.accessHash,
        blocked,
      },
    ]);
    if (this.sm.has('userFull')) {
      const full = this.sm.get('userFull').getAllData().get(userId) as UserFull | undefined;
      if (full) {
        const merged: UserFullEntity = {
          ...(toJS(full) as UserFullEntity),
          id: userId,
          blocked,
        };
        this.sm.get('userFull').update([new UserFull(merged)]);
      }
    }
  }

  @RequestLog()
  @Method()
  async setMuted(peerId: string, muted: boolean): Promise<TypePeerNotifySettings> {
    const existingUser = this.sm.has('user')
      ? (this.sm.get('user').getAllData().get(peerId) as User | undefined)
      : undefined;
    const notifySettings = await this.worker.call('user.setPeerMuted', [
      {
        peerId,
        accessHash: existingUser?.accessHash,
        muted,
      },
    ]);
    if (this.sm.has('dialog')) {
      const existingDialog = this.sm.get('dialog').getAllData().get(peerId) as Dialog | undefined;
      if (existingDialog) {
        const mergedDialog: DialogEntity = {
          ...(toJS(existingDialog) as DialogEntity),
          id: peerId,
          peerId,
          notifySettings,
        };
        this.sm.get('dialog').update([new Dialog(mergedDialog)]);
      }
    }
    if (this.sm.has('userFull')) {
      const existingFull = this.sm.get('userFull').getAllData().get(peerId) as UserFull | undefined;
      if (existingFull) {
        const mergedFull: UserFullEntity = {
          ...(toJS(existingFull) as UserFullEntity),
          id: peerId,
          notifySettings,
        };
        this.sm.get('userFull').update([new UserFull(mergedFull)]);
      }
    }
    return notifySettings;
  }

  private findPeerIdByUsername(username: string): string | undefined {
    const normalized = this.normalizeUsername(username);
    if (!normalized) {
      return undefined;
    }

    for (const user of this.sm.get('user').getAllData().values()) {
      if (this.peerMatchesUsername(user, normalized)) {
        return user.id;
      }
    }

    for (const channel of this.sm.get('channel').getAllData().values()) {
      if (this.peerMatchesUsername(channel, normalized)) {
        return channel.id;
      }
    }

    return undefined;
  }

  private normalizeUsername(username: string): string {
    return username.replace(/^@+/, '').trim().toLowerCase();
  }

  private peerMatchesUsername(peer: UsernamePeer, normalized: string): boolean {
    if (peer.username?.toLowerCase() === normalized) {
      return true;
    }
    return (
      peer.usernames?.some((entry) => entry.username.toLowerCase() === normalized) ?? false
    );
  }
}
