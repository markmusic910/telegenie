import { Controller, Method, RequestLog } from '@telegenie/decorators';
import type { TelegramWorkerClient, PeerIdAccessHash } from '@telegenie/libs/foundation/telegram/worker';
import { Channel } from '../../store/entity/models/channel.model';
import { ChannelFull } from '../../store/entity/models/channel-full.model';
import { Chat } from '../../store/entity/models/chat.model';
import { User } from '../../store/entity/models/user.model';
import type StoreManager from '../../store/store.manager';
import { ConversionService } from '../common/services/convert.service';

type ChannelControllerOptions = {
  sm: StoreManager;
  debug?: boolean;
  worker: TelegramWorkerClient;
};

@Controller
export class ChannelController {
  worker: TelegramWorkerClient;
  sm: StoreManager;
  converter: ConversionService;
  private readonly recentParticipantsCache = new Map<
    string,
    { userIds: string[]; count: number }
  >();
  private readonly recentParticipantsInFlight = new Map<
    string,
    Promise<{ userIds: string[]; count: number }>
  >();

  constructor({ sm, debug, worker }: ChannelControllerOptions) {
    this.converter = new ConversionService({
      debug: debug ?? false,
    });
    this.worker = worker;
    this.sm = sm;
  }

  @RequestLog()
  @Method()
  async getChannelsByIds(ids: string[]): Promise<Channel[]> {
    const channelsRecord = await this.worker.call('channel.getChannelsByIds', [ids]);
    const channelEntities = Object.values(channelsRecord).map((channel) =>
      this.converter.convertChannel(channel),
    );
    this.sm.get('channel').update(channelEntities);
    return channelEntities.map((entity) => new Channel(entity));
  }

  @RequestLog()
  @Method()
  async getFullChannelByIds(
    options: {
      id: string;
      accessHash: string;
    }[],
  ): Promise<Channel[]> {
    const { fullChannels, chats, channels, users } = await this.worker.call(
      'channel.getFullChannelByIds',
      [options],
    );
    const channelFullEntities = Object.values(fullChannels).map((full) =>
      this.converter.convertChannelFull(full),
    );
    const channelEntities = Object.values(channels).map((channel) =>
      this.converter.convertChannel(channel),
    );
    const chatEntities = Object.values(chats).map((chat) => this.converter.convertChat(chat));
    if (channelFullEntities.length > 0 && this.sm.has('channelFull')) {
      this.sm
        .get('channelFull')
        .update(channelFullEntities.map((entity) => new ChannelFull(entity)));
    }
    if (channelEntities.length > 0) {
      this.sm.get('channel').update(channelEntities.map((entity) => new Channel(entity)));
    }
    if (chatEntities.length > 0 && this.sm.has('chat')) {
      this.sm.get('chat').update(chatEntities.map((entity) => new Chat(entity)));
    }
    if (Object.keys(users).length > 0 && this.sm.has('user')) {
      this.sm
        .get('user')
        .update(this.converter.convertUsers(Object.values(users)).map((entity) => new User(entity)));
    }
    return channelEntities.map((entity) => new Channel(entity));
  }

  @RequestLog()
  @Method()
  async createGroup(
    title: string,
    about?: string,
    users?: PeerIdAccessHash[],
  ): Promise<Channel> {
    const channel = await this.worker.call('channel.createGroup', [title, about, users]);
    const entity = this.converter.convertChannel(channel);
    this.sm.get('channel').update([entity]);
    return new Channel(entity);
  }

  @RequestLog()
  @Method()
  async createChannel(
    title: string,
    about?: string,
    options?: {
      isPublic?: boolean;
      username?: string;
      restrictSavingContent?: boolean;
    },
    users?: PeerIdAccessHash[],
  ): Promise<Channel> {
    const channel = await this.worker.call('channel.createChannel', [
      title,
      about,
      options,
      users,
    ]);
    const entity = this.converter.convertChannel(channel);
    this.sm.get('channel').update([entity]);
    return new Channel(entity);
  }

  @RequestLog()
  @Method()
  async exportInviteLink(channelId: string, accessHash?: string): Promise<string> {
    return this.worker.call('channel.exportInviteLink', [channelId, accessHash]);
  }

  /**
   * Fetch supergroup/channel participants and hydrate returned users into the user store.
   * Initial recent fetches (`!q && !offset`) are cached per channel for the session.
   */
  @RequestLog()
  @Method()
  async getParticipants(
    channelId: string,
    options?: {
      q?: string;
      offset?: number;
      limit?: number;
      forceRefresh?: boolean;
    },
  ): Promise<{ userIds: string[]; count: number }> {
    const query = options?.q?.trim() ?? '';
    const offset = options?.offset ?? 0;
    const isInitialRecent = !query && offset === 0;

    if (isInitialRecent && !options?.forceRefresh) {
      const cached = this.recentParticipantsCache.get(channelId);
      if (cached) return cached;
      const inflight = this.recentParticipantsInFlight.get(channelId);
      if (inflight) return inflight;
    }

    const channel = this.sm.has('channel')
      ? (this.sm.get('channel').getAllData().get(channelId) as Channel | undefined)
      : undefined;

    const run = (async (): Promise<{ userIds: string[]; count: number }> => {
      const { participantIds, users, count } = await this.worker.call('channel.getParticipants', [
        channelId,
        {
          q: query || undefined,
          offset,
          limit: options?.limit ?? 200,
          accessHash: channel?.accessHash,
        },
      ]);

      if (Object.keys(users).length > 0 && this.sm.has('user')) {
        this.sm
          .get('user')
          .update(
            this.converter.convertUsers(Object.values(users)).map((entity) => new User(entity)),
          );
      }

      const result = { userIds: participantIds, count };
      if (isInitialRecent) {
        this.recentParticipantsCache.set(channelId, result);
      }
      return result;
    })();

    if (isInitialRecent) {
      this.recentParticipantsInFlight.set(channelId, run);
      try {
        return await run;
      } finally {
        this.recentParticipantsInFlight.delete(channelId);
      }
    }

    return run;
  }

  @RequestLog()
  @Method()
  async join(peerId: string): Promise<void> {
    const channel = this.sm.has('channel')
      ? (this.sm.get('channel').get(peerId) as Channel | undefined)
      : undefined;
    await this.worker.call('channel.joinChannel', [peerId, channel?.accessHash]);
    await this.getChannelsByIds([peerId]);
  }

  @RequestLog()
  @Method()
  async leave(peerId: string): Promise<void> {
    const channel = this.sm.has('channel')
      ? (this.sm.get('channel').get(peerId) as Channel | undefined)
      : undefined;
    await this.worker.call('channel.leaveChannel', [peerId, channel?.accessHash]);
    await this.getChannelsByIds([peerId]);
  }

  @RequestLog()
  @Method()
  async inviteMembers(peerId: string, userIds: string[]): Promise<void> {
    const channel = this.sm.has('channel')
      ? (this.sm.get('channel').get(peerId) as Channel | undefined)
      : undefined;
    await this.worker.call('channel.inviteMembers', [peerId, userIds, channel?.accessHash]);
  }
}
