import { sleep } from '@telegenie/libs/utils/scheduler/sleep';
import { Api } from '@telegenie/teleproto';
import to from 'await-to-js';
import bigint from 'big-integer';
import { chunk } from 'lodash-es';
import { buildInputChatReactions, buildInputPeer, buildMtpPeerId, getEntityTypeById } from '../helpers';
import type { ApiChatReactions } from '../types';
import type { LocalDb } from '../local-db/local-db';
import type { UpdateManager } from '../update-manager/update-manager';
import type { Channel, Chat, ChatFull, MissingInvitee } from '../types/api-types';
import type { User } from '../types/users';
import { convertChannel, convertChannelFull, convertChat, convertChatFull } from './converters/chat.converter';
import { convertUser } from './converters/user.converter';
import { persistPeers } from './utils/persist-peers.helper';
import { resolveInputPeerForRead } from './utils/resolve-input-peer-for-read';
import { TransportService } from './transport.service';
import { resolveInputUsers, type PeerIdAccessHash } from './utils/input-user.helper';

function firstChatFromUpdates(updates: Api.TypeUpdates): Api.Chat | null {
  if (!(updates instanceof Api.Updates || updates instanceof Api.UpdatesCombined)) {
    return null;
  }
  const chat = updates.chats?.[0];
  return chat instanceof Api.Chat ? chat : null;
}

type ChatServiceOptions = {
  debug?: boolean;
  transportService: TransportService;
  localDb?: LocalDb;
  updateManager?: UpdateManager;
};

/**
 * ChatService — cache-first reads via LocalDb; GramJS on miss / full miss.
 */
export class ChatService {
  private debug: boolean;
  private log: (...args: any) => void;
  transportService: TransportService;
  localDb: LocalDb | undefined;
  updateManager: UpdateManager | undefined;

  constructor({ debug, transportService, localDb, updateManager }: ChatServiceOptions) {
    this.transportService = transportService;
    this.localDb = localDb;
    this.updateManager = updateManager;
    this.debug = debug ?? false;
    this.log = (...args: any) => {
      if (this.debug) {
        console.info('[ChatService]', ...args);
      }
    };
  }

  get client() {
    return this.transportService?.client ?? null;
  }

  /**
   * get all Basic Groups by id list (LocalDb first; GramJS for misses).
   * @param ids - **marked** peerId, e.g. "-1234567890"
   */
  getChatsByIds = async (ids: string[]): Promise<Record<string, Chat>> => {
    const result: Record<string, Chat> = {};
    const misses: string[] = [];

    for (const id of ids) {
      const local = await this.localDb?.getChat(id);
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

    const fetched = await this.client.invoke(
      new Api.messages.GetChats({
        id: misses.map((id) => bigint(id)),
      }),
    );

    if (!fetched) {
      return result;
    }

    const chats: Chat[] = [];
    for (const chat of fetched.chats) {
      if (chat instanceof Api.Chat) {
        const converted = convertChat(chat);
        result[converted.id] = converted;
        chats.push(converted);
      }
    }
    await persistPeers(this.localDb, { chats });
    return result;
  };

  /**
   * get Full Chat by id list (LocalDb first; GramJS for misses).
   */
  getFullChatByIds = async (
    ids: string[],
  ): Promise<{
    fullChats: Record<string, ChatFull>;
    chats: Record<string, Chat>;
    channels: Record<string, Channel>;
    users: Record<string, User>;
  }> => {
    const fullChats: Record<string, ChatFull> = {};
    const chats: Record<string, Chat> = {};
    const channels: Record<string, Channel> = {};
    const users: Record<string, User> = {};
    const misses: string[] = [];

    for (const id of ids) {
      const local = await this.localDb?.getChatFull(id);
      if (local) {
        fullChats[local.id] = local;
      } else {
        misses.push(id);
      }
    }

    if (misses.length === 0) {
      return { fullChats, chats, channels, users };
    }

    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const chunks = chunk(misses, 5);
    const fetchedFulls: ChatFull[] = [];
    const fetchedChats: Chat[] = [];
    const fetchedChannels: Channel[] = [];
    const fetchedUsers: User[] = [];

    for (const batch of chunks) {
      await Promise.allSettled(
        batch.map(async (id) => {
          const [err, result] = await to(
            this.client!.invoke(
              new Api.messages.GetFullChat({ chatId: buildMtpPeerId(id, 'chat') }),
            ),
          );
          if (err) {
            console.error('getFullChatByIds error', err);
            return;
          }
          if (!result || !(result instanceof Api.messages.ChatFull)) {
            console.error('getFullChatByIds error', result);
            return;
          }
          if (!(result.fullChat instanceof Api.ChatFull)) {
            return;
          }
          const converted = convertChatFull(result.fullChat);
          fullChats[converted.id] = converted;
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
      chatFulls: fetchedFulls,
    });

    return { fullChats, chats, channels, users };
  };

  createBasicGroup = async (
    title: string,
    users: PeerIdAccessHash[],
  ): Promise<{ chat: Chat; missingInvitees: MissingInvitee[] }> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const inputUsers = await resolveInputUsers(this.localDb, users);
    const result = await this.client.invoke(
      new Api.messages.CreateChat({
        title,
        users: inputUsers,
      }),
    );

    if (this.updateManager) {
      await this.updateManager.process(result.updates, 'rpc');
    } else {
      const apiChat = firstChatFromUpdates(result.updates);
      if (apiChat) {
        await persistPeers(this.localDb, { chats: [convertChat(apiChat)] });
      }
    }

    const apiChat = firstChatFromUpdates(result.updates);
    if (!apiChat) {
      throw new Error('Failed to create basic group');
    }

    const missingInvitees: MissingInvitee[] = result.missingInvitees.map((invitee) => ({
      userId: invitee.userId.toString(),
      premiumWouldAllowInvite: invitee.premiumWouldAllowInvite,
      premiumRequiredForPm: invitee.premiumRequiredForPm,
    }));

    return { chat: convertChat(apiChat), missingInvitees };
  };

  /** Read a chat from LocalDb only (no network). */
  getLocalChat = async (id: string): Promise<Chat | undefined> => {
    return this.localDb?.getChat(id);
  };

  setAvailableReactions = async (
    peerId: string,
    availableReactions: ApiChatReactions | 'none',
    reactionsLimit?: number,
    accessHash?: string,
  ): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const peer = accessHash
      ? buildInputPeer(peerId, accessHash)
      : await resolveInputPeerForRead(peerId, this.transportService, this.localDb);
    const inputReactions =
      availableReactions === 'none'
        ? buildInputChatReactions(undefined)
        : buildInputChatReactions(availableReactions);
    const updates = await this.client.invoke(
      new Api.messages.SetChatAvailableReactions({
        peer,
        availableReactions: inputReactions,
        ...(reactionsLimit != null ? { reactionsLimit } : {}),
      }),
    );
    if (this.updateManager && updates) {
      await this.updateManager.process(updates, 'rpc');
    }
    await this.reloadPeerFull(peerId, accessHash);
  };

  /**
   * `messages.setChatAvailableReactions` returns updates that do not include
   * `chatFull.available_reactions`. Reload full info so the cached row matches
   * the server.
   */
  private reloadPeerFull = async (peerId: string, accessHash?: string): Promise<void> => {
    if (!this.client) return;
    const kind = getEntityTypeById(peerId);
    if (kind === 'chat') {
      const result = await this.client.invoke(
        new Api.messages.GetFullChat({ chatId: buildMtpPeerId(peerId, 'chat') }),
      );
      if (!(result instanceof Api.messages.ChatFull) || !(result.fullChat instanceof Api.ChatFull)) {
        return;
      }
      await persistPeers(this.localDb, {
        ...peersFromChatFull(result),
        chatFulls: [convertChatFull(result.fullChat)],
      });
      return;
    }
    if (kind !== 'channel') return;
    const hash = accessHash ?? (await this.localDb?.getChannel(peerId))?.accessHash;
    if (!hash) return;
    const result = await this.client.invoke(
      new Api.channels.GetFullChannel({ channel: buildInputPeer(peerId, hash) }),
    );
    if (!(result instanceof Api.messages.ChatFull) || !(result.fullChat instanceof Api.ChannelFull)) {
      return;
    }
    await persistPeers(this.localDb, {
      ...peersFromChatFull(result),
      channelFulls: [convertChannelFull(result.fullChat)],
    });
  };
}

function peersFromChatFull(result: Api.messages.ChatFull): {
  chats: Chat[];
  channels: Channel[];
  users: User[];
} {
  const chats: Chat[] = [];
  const channels: Channel[] = [];
  const users: User[] = [];
  result.chats.forEach((chat) => {
    if (chat instanceof Api.Chat) chats.push(convertChat(chat));
    else if (chat instanceof Api.Channel) channels.push(convertChannel(chat));
  });
  result.users.forEach((user) => {
    users.push(convertUser(user));
  });
  return { chats, channels, users };
}
