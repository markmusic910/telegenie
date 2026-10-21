import bigint from 'big-integer';
import { sleep } from '@telegenie/libs/utils/scheduler/sleep';
import { Api } from '@telegenie/teleproto';
import to from 'await-to-js';
import { chunk } from 'lodash-es';
import { buildInputPeer, buildMarkedPeerIdByType, getEntityTypeById } from '../helpers';
import type { LocalDb } from '../local-db/local-db';
import type { Channel, Chat, PeerChannel, PeerChat, PeerUser } from '../types/api-types';
import type { User, UserFull } from '../types/users';
import { convertTypePeer } from './converters/common.converter';
import { convertChannel, convertChat } from './converters/chat.converter';
import { convertUser, convertUserFull } from './converters/user.converter';
import { persistPeers } from './utils/persist-peers.helper';
import type { TransportService } from './transport.service';

export type ResolveUsernameResult = {
  peerId: string;
  users: User[];
  chats: Chat[];
  channels: Channel[];
};

function normalizeUsername(username: string): string {
  return username.replace(/^@+/, '').trim().toLowerCase();
}

function peerIdFromConvertedPeer(peer: PeerUser | PeerChat | PeerChannel): string {
  if ('userId' in peer && peer.userId) return peer.userId;
  if ('chatId' in peer && peer.chatId) return peer.chatId;
  if ('channelId' in peer && peer.channelId) return peer.channelId;
  return '';
}

function extractPeersFromChatsAndUsers(
  usersInput: Api.TypeUser[],
  chatsInput: Api.TypeChat[],
): { users: User[]; chats: Chat[]; channels: Channel[] } {
  const users = usersInput
    .filter((entry): entry is Api.User => entry instanceof Api.User)
    .map(convertUser);
  const chats: Chat[] = [];
  const channels: Channel[] = [];
  for (const entry of chatsInput) {
    if (entry instanceof Api.Chat) {
      chats.push(convertChat(entry));
    } else if (entry instanceof Api.Channel) {
      channels.push(convertChannel(entry));
    }
  }
  return { users, chats, channels };
}

type UserServiceOptions = {
  debug?: boolean;
  transportService: TransportService;
  localDb?: LocalDb;
};

/**
 * UserService — cache-first reads via LocalDb; GramJS on miss / full TTL expiry.
 */
export class UserService {
  private debug: boolean;
  private log: (...args: any) => void;
  transportService: TransportService;
  localDb: LocalDb | undefined;

  constructor({ debug, transportService, localDb }: UserServiceOptions) {
    this.transportService = transportService;
    this.localDb = localDb;
    this.debug = debug ?? false;
    this.log = (...args: any) => {
      if (this.debug) {
        console.info('[UserService]', ...args);
      }
    };
  }

  get client() {
    return this.transportService?.client ?? null;
  }

  /**
   * get Users by id list (LocalDb first; GramJS for misses).
   * @param options - array of { id: string, accessHash?: string } where id is **marked** peerId
   */
  getUsers = async (
    options: {
      id: string;
      accessHash?: string;
    }[],
  ): Promise<Record<string, User>> => {
    const result: Record<string, User> = {};
    const misses: { id: string; accessHash?: string }[] = [];

    for (const opt of options) {
      const local = await this.localDb?.getUser(opt.id);
      if (local) {
        result[local.id] = local;
      } else {
        misses.push(opt);
      }
    }

    if (misses.length === 0) {
      return result;
    }

    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const resolvedMisses = await Promise.all(
      misses.map(async ({ id, accessHash }) => {
        if (accessHash) return { id, accessHash };
        const row = await this.localDb?.getUserRow(id);
        return { id, accessHash: row?.entity.accessHash ?? accessHash };
      }),
    );

    const fetched = await this.client.invoke(
      new Api.users.GetUsers({
        id: resolvedMisses.map(({ id, accessHash }) => buildInputPeer(id, accessHash)),
      }),
    );

    if (!fetched) {
      return result;
    }

    const users: User[] = [];
    for (const user of fetched) {
      if (user instanceof Api.User) {
        const converted = convertUser(user);
        result[converted.id] = converted;
        users.push(converted);
      }
    }
    await persistPeers(this.localDb, { users });
    return result;
  };

  /**
   * get Users by string ids list
   */
  getUsersByIds = async (ids: string[]): Promise<Record<string, User>> => {
    return this.getUsers(ids.map((id) => ({ id })));
  };

  /**
   * get Full Users in batch (LocalDb TTL via getUserFull; GramJS for misses).
   */
  getFullUsers = async (
    options: {
      id: string;
      accessHash?: string;
    }[],
  ): Promise<{
    fullUsers: Record<string, UserFull>;
    chats: Record<string, Chat>;
    channels: Record<string, Channel>;
    users: Record<string, User>;
  }> => {
    const fullUsers: Record<string, UserFull> = {};
    const chats: Record<string, Chat> = {};
    const channels: Record<string, Channel> = {};
    const users: Record<string, User> = {};
    const misses: { id: string; accessHash?: string }[] = [];

    for (const opt of options) {
      // users.getFullUser only accepts InputUser. Chat and channel ids are a different full-info RPC.
      if (getEntityTypeById(opt.id) !== 'user') continue;
      const local = await this.localDb?.getUserFull(opt.id);
      if (local) {
        fullUsers[local.id] = local;
      } else {
        misses.push(opt);
      }
    }

    if (misses.length === 0) {
      return { fullUsers, chats, channels, users };
    }

    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const resolvedMisses = await Promise.all(
      misses.map(async ({ id, accessHash }) => {
        if (accessHash) return { id, accessHash };
        const row = await this.localDb?.getUserRow(id);
        return { id, accessHash: row?.entity.accessHash ?? accessHash };
      }),
    );

    const chunks = chunk(resolvedMisses, 5);
    const fetchedFulls: UserFull[] = [];
    const fetchedUsers: User[] = [];
    const fetchedChats: Chat[] = [];
    const fetchedChannels: Channel[] = [];

    for (const opts of chunks) {
      await Promise.allSettled(
        opts.map(async ({ id, accessHash }) => {
          const [err, result] = await to(
            this.client!.invoke(
              new Api.users.GetFullUser({ id: buildInputPeer(id, accessHash) }),
            ),
          );
          if (err) {
            console.error('getFullUsers error', err);
            return;
          }
          if (!result || !(result instanceof Api.users.UserFull)) {
            console.error('getFullUsers error', result);
            return;
          }
          const convertedFull = convertUserFull(result.fullUser);
          const fullId = buildMarkedPeerIdByType(result.fullUser.id.toString(), 'user');
          fullUsers[fullId] = convertedFull;
          fetchedFulls.push(convertedFull);
          result.chats.forEach((chat) => {
            if (chat instanceof Api.Chat) {
              const converted = convertChat(chat);
              chats[converted.id] = converted;
              fetchedChats.push(converted);
            } else if (chat instanceof Api.Channel) {
              const converted = convertChannel(chat);
              channels[converted.id] = converted;
              fetchedChannels.push(converted);
            }
          });
          result.users.forEach((user) => {
            const converted = convertUser(user);
            users[converted.id] = converted;
            fetchedUsers.push(converted);
          });
        }),
      );
      await sleep(300);
    }

    await persistPeers(this.localDb, {
      users: fetchedUsers,
      chats: fetchedChats,
      channels: fetchedChannels,
      userFulls: fetchedFulls,
    });

    return { fullUsers, chats, channels, users };
  };

  /**
   * get Full Users in batch by string ids list
   */
  getFullUsersByIds = async (
    ids: string[],
  ): Promise<{
    fullUsers: Record<string, UserFull>;
    chats: Record<string, Chat>;
    channels: Record<string, Channel>;
    users: Record<string, User>;
  }> => {
    return this.getFullUsers(ids.map((id) => ({ id })));
  };

  /** Read a user from LocalDb only (no network). */
  getLocalUser = async (id: string): Promise<User | undefined> => {
    return this.localDb?.getUser(id);
  };

  getMe = async (): Promise<User> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const me = await this.client.getMe();
    const converted = convertUser(me);
    await persistPeers(this.localDb, { users: [converted] });
    return converted;
  };

  getContacts = async (): Promise<Record<string, User>> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const result = await this.client.invoke(
      new Api.contacts.GetContacts({
        hash: bigint(0),
      }),
    );
    const users: User[] = [];
    const record: Record<string, User> = {};
    if (result instanceof Api.contacts.Contacts) {
      for (const user of result.users) {
        if (user instanceof Api.User) {
          const converted = convertUser(user);
          record[converted.id] = converted;
          users.push(converted);
        }
      }
      await persistPeers(this.localDb, { users });
    }
    return record;
  };

  resolveUsername = async (username: string): Promise<ResolveUsernameResult | undefined> => {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      return undefined;
    }

    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const result = await this.client.invoke(
      new Api.contacts.ResolveUsername({
        username: normalized,
      }),
    );
    if (!result || !(result instanceof Api.contacts.ResolvedPeer)) {
      return undefined;
    }

    const { users, chats, channels } = extractPeersFromChatsAndUsers(
      result.users ?? [],
      result.chats ?? [],
    );
    await persistPeers(this.localDb, { users, chats, channels });

    const peerId = peerIdFromConvertedPeer(convertTypePeer(result.peer));
    if (!peerId) {
      return undefined;
    }

    return { peerId, users, chats, channels };
  };
}
