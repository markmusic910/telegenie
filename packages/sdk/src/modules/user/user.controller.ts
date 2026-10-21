import { Controller, Method, RequestLog } from '@telegenie/decorators';
import type { TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';
import type { Channel } from '@telegenie/sdk/store/entity/models/channel.model';
import { UserFull } from '@telegenie/sdk/store/entity/models/user-full.model';
import { User } from '@telegenie/sdk/store/entity/models/user.model';
import type StoreManager from '@telegenie/sdk/store/store.manager';
import { ConversionService } from '../common/services/convert.service';

type UsernamePeer = Pick<User | Channel, 'id' | 'username' | 'usernames'>;

type UserControllerOptions = {
  sm: StoreManager;
  debug?: boolean;
  worker: TelegramWorkerClient;
};

@Controller
export class UserController {
  worker: TelegramWorkerClient;
  sm: StoreManager;
  converter: ConversionService;

  constructor({ sm, debug, worker }: UserControllerOptions) {
    this.converter = new ConversionService({
      debug: debug ?? false,
    });
    this.worker = worker;
    this.sm = sm;
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
  ): Promise<UserFull[]> {
    const { fullUsers, chats, channels, users } = await this.worker.call('user.getFullUsers', [
      options,
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
  async getFullUsersByIds(ids: string[]): Promise<UserFull[]> {
    const { fullUsers, chats, channels, users } = await this.worker.call('user.getFullUsersByIds', [
      ids,
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
