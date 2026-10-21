import { Api } from '@telegenie/teleproto';
import to from 'await-to-js';
import { chunk } from 'lodash-es';
import { buildInputEntity, buildInputPeer } from '../helpers';
import { sleep } from '../../../utils/scheduler/sleep';
import type { LocalDb } from '../local-db/local-db';
import type { UpdateManager } from '../update-manager/update-manager';
import type { TransportService } from './transport.service';
import { convertChannel, convertChannelFull, convertChat } from './converters/chat.converter';
import { convertUser } from './converters/user.converter';
import { persistPeers } from './utils/persist-peers.helper';
import { resolveInputUsers, type PeerIdAccessHash } from './utils/input-user.helper';
import type { Channel, ChannelFull, Chat } from '../types/api-types';
import type { User } from '../types/users';

type ChannelServiceOptions = {
  debug?: boolean;
  transportService: TransportService;
  localDb?: LocalDb;
  updateManager?: UpdateManager;
};

/**
 * ChannelService — cache-first gets; mutating RPCs feed UpdateManager.
 */
export class ChannelService {
  private debug: boolean;
  private log: (...args: any) => void;
  transportService: TransportService;
  localDb: LocalDb | undefined;
  updateManager: UpdateManager | undefined;

  constructor({ debug, transportService, localDb, updateManager }: ChannelServiceOptions) {
    this.transportService = transportService;
    this.localDb = localDb;
    this.updateManager = updateManager;
    this.debug = debug ?? false;
    this.log = (...args: any) => {
      if (this.debug) {
        console.info('[ChannelService]', ...args);
      }
    };
  }

  get client() {
    return this.transportService?.client ?? null;
  }

  /**
   * get Channels by id list (LocalDb first; GramJS for misses).
   * @param ids - Bot API ids, e.g. "-1000000000123"
   */
  getChannelsByIds = async (ids: string[]): Promise<Record<string, Channel>> => {
    const result: Record<string, Channel> = {};
    const misses: string[] = [];

    for (const id of ids) {
      const local = await this.localDb?.getChannel(id);
      if (local) {
        result[local.id] = local;
      } else {
        misses.push(id);
      }
    }

    if (misses.length === 0) {
      return result;
    }

    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const inputIds = await Promise.all(
      misses.map(async (id) => {
        const row = await this.localDb?.getChannelRow(id);
        return buildInputPeer(id, row?.entity.accessHash);
      }),
    );

    const fetched = await this.client.invoke(
      new Api.channels.GetChannels({
        id: inputIds,
      }),
    );

    if (!fetched) {
      return result;
    }

    const channels: Channel[] = [];
    for (const channel of fetched.chats) {
      if (channel instanceof Api.Channel) {
        const converted = convertChannel(channel);
        result[converted.id] = converted;
        channels.push(converted);
      }
    }
    await persistPeers(this.localDb, { channels });
    return result;
  };

  /**
   * get Full Channel by id list (LocalDb TTL; GramJS for misses).
   */
  getFullChannelByIds = async (
    options: {
      id: string;
      accessHash: string;
    }[],
  ): Promise<{
    fullChannels: Record<string, ChannelFull>;
    chats: Record<string, Chat>;
    channels: Record<string, Channel>;
    users: Record<string, User>;
  }> => {
    const fullChannels: Record<string, ChannelFull> = {};
    const chats: Record<string, Chat> = {};
    const channels: Record<string, Channel> = {};
    const users: Record<string, User> = {};
    const misses: { id: string; accessHash: string }[] = [];

    for (const opt of options) {
      const local = await this.localDb?.getChannelFull(opt.id);
      if (local) {
        fullChannels[local.id] = local;
      } else {
        misses.push(opt);
      }
    }

    if (misses.length === 0) {
      return { fullChannels, chats, channels, users };
    }

    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const resolvedMisses = await Promise.all(
      misses.map(async ({ id, accessHash }) => {
        if (accessHash) return { id, accessHash };
        const row = await this.localDb?.getChannelRow(id);
        return { id, accessHash: row?.entity.accessHash ?? accessHash };
      }),
    );

    const chunks = chunk(resolvedMisses, 5);
    const fetchedFulls: ChannelFull[] = [];
    const fetchedChats: Chat[] = [];
    const fetchedChannels: Channel[] = [];
    const fetchedUsers: User[] = [];

    for (const opts of chunks) {
      await Promise.allSettled(
        opts.map(async ({ id, accessHash }) => {
          if (!accessHash) {
            console.error(`getFullChannelByIds param error for id: ${id}, no accessHash`);
            return;
          }
          const [err, result] = await to(
            this.client!.invoke(
              new Api.channels.GetFullChannel({ channel: buildInputPeer(id, accessHash) }),
            ),
          );
          if (err) {
            console.error('getFullChannelByIds error', err);
            return;
          }
          if (!result || !(result instanceof Api.messages.ChatFull)) {
            console.error('getFullChannelByIds error', result);
            return;
          }
          if (!(result.fullChat instanceof Api.ChannelFull)) {
            return;
          }
          const converted = convertChannelFull(result.fullChat);
          fullChannels[converted.id] = converted;
          fetchedFulls.push(converted);
          result.chats.forEach((chat) => {
            if (chat instanceof Api.Chat) {
              const convertedChat = convertChat(chat);
              chats[convertedChat.id] = convertedChat;
              fetchedChats.push(convertedChat);
            } else if (chat instanceof Api.Channel) {
              const convertedChannel = convertChannel(chat);
              channels[convertedChannel.id] = convertedChannel;
              fetchedChannels.push(convertedChannel);
            }
          });
          result.users.forEach((user) => {
            const convertedUser = convertUser(user);
            users[convertedUser.id] = convertedUser;
            fetchedUsers.push(convertedUser);
          });
        }),
      );
      await sleep(300);
    }

    await persistPeers(this.localDb, {
      chats: fetchedChats,
      channels: fetchedChannels,
      users: fetchedUsers,
      channelFulls: fetchedFulls,
    });

    return { fullChannels, chats, channels, users };
  };

  createGroup = async (
    title: string,
    about?: string,
    users?: PeerIdAccessHash[],
  ): Promise<Channel> => {
    return this.createChannelKind({ title, about, megagroup: true, users });
  };

  createChannel = async (
    title: string,
    about?: string,
    options?: {
      isPublic?: boolean;
      username?: string;
      restrictSavingContent?: boolean;
    },
    users?: PeerIdAccessHash[],
  ): Promise<Channel> => {
    const channel = await this.createChannelKind({ title, about, broadcast: true, users });

    if (options?.isPublic && options.username) {
      await this.client.invoke(
        new Api.channels.UpdateUsername({
          channel: buildInputEntity(channel.id, channel.accessHash) as Api.InputChannel,
          username: options.username,
        }),
      );
      channel.username = options.username;
      await persistPeers(this.localDb, { channels: [channel] });
    }

    if (options?.restrictSavingContent) {
      await this.client.invoke(
        new Api.messages.ToggleNoForwards({
          peer: buildInputPeer(channel.id, channel.accessHash),
          enabled: true,
        }),
      );
    }

    return channel;
  };

  private createChannelKind = async (params: {
    title: string;
    about?: string;
    megagroup?: boolean;
    broadcast?: boolean;
    users?: PeerIdAccessHash[];
  }): Promise<Channel> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const updates = await this.client.invoke(
      new Api.channels.CreateChannel({
        title: params.title,
        about: params.about ?? '',
        megagroup: params.megagroup,
        broadcast: params.broadcast,
      }),
    );

    if (!updates || !(updates instanceof Api.Updates)) {
      throw new Error('Failed to create channel');
    }

    if (this.updateManager) {
      await this.updateManager.process(updates, 'rpc');
    } else {
      const chat = updates.chats?.[0] instanceof Api.Channel ? updates.chats[0] : null;
      if (chat) {
        await persistPeers(this.localDb, { channels: [convertChannel(chat)] });
      }
    }

    const created = updates.chats?.[0] instanceof Api.Channel ? updates.chats[0] : null;
    if (!created) {
      throw new Error('Failed to create channel');
    }

    const channel = convertChannel(created);

    if (params.users?.length) {
      const inputUsers = await resolveInputUsers(this.localDb, params.users);
      const invited = await this.client.invoke(
        new Api.channels.InviteToChannel({
          channel: buildInputEntity(channel.id, channel.accessHash) as Api.InputChannel,
          users: inputUsers,
        }),
      );
      if (this.updateManager) {
        await this.updateManager.process(invited.updates, 'rpc');
      }
    }

    return channel;
  };

  exportInviteLink = async (channelId: string, accessHash?: string): Promise<string> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const result = await this.client.invoke(
      new Api.messages.ExportChatInvite({
        peer: buildInputPeer(channelId, accessHash),
      }),
    );
    if (result instanceof Api.ChatInviteExported) {
      return result.link;
    }
    throw new Error('Failed to export chat invite link');
  };

  /** Read a channel from LocalDb only (no network). */
  getLocalChannel = async (id: string): Promise<Channel | undefined> => {
    return this.localDb?.getChannel(id);
  };
}
