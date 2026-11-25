import bigint from 'big-integer';
import { sleep } from '@telegenie/libs/utils/scheduler/sleep';
import { Api } from '@telegenie/teleproto';
import to from 'await-to-js';
import { chunk } from 'lodash-es';
import { buildInputPeer, buildMarkedPeerIdByType, getEntityTypeById } from '../helpers';
import type { LocalDb } from '../local-db/local-db';
import type {
  Channel,
  Chat,
  PeerChannel,
  PeerChat,
  PeerUser,
  TypePeerNotifySettings,
} from '../types/api-types';
import type { User, UserFull } from '../types/users';
import type { UpdateManager } from '../update-manager';
import type { StoreSyncPayload } from '../worker/store-sync';
import {
  convertTypePeer,
  convertTypePeerNotifySettings,
} from './converters/common.converter';
import { convertChannel, convertChat } from './converters/chat.converter';
import { convertUser, convertUserFull } from './converters/user.converter';
import { persistPeers } from './utils/persist-peers.helper';
import { resolveInputPeerForRead } from './resolve-input-peer-for-read';
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

export type AddContactInput = {
  id: string;
  accessHash?: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  addPhonePrivacyException?: boolean;
};

function extractUsersFromUpdatesResult(result: unknown): User[] {
  if (result instanceof Api.Updates || result instanceof Api.UpdatesCombined) {
    return (result.users ?? [])
      .filter((entry): entry is Api.User => entry instanceof Api.User)
      .map(convertUser);
  }
  return [];
}

type UserServiceOptions = {
  debug?: boolean;
  transportService: TransportService;
  localDb?: LocalDb;
  updateManager?: UpdateManager;
  onStoreUpdate?: (payload: StoreSyncPayload) => void;
};

/**
 * UserService — cache-first reads via LocalDb; GramJS on miss / full TTL expiry.
 */
export class UserService {
  private debug: boolean;
  private log: (...args: any) => void;
  transportService: TransportService;
  localDb: LocalDb | undefined;
  updateManager: UpdateManager | undefined;
  onStoreUpdate: ((payload: StoreSyncPayload) => void) | undefined;

  constructor({
    debug,
    transportService,
    localDb,
    updateManager,
    onStoreUpdate,
  }: UserServiceOptions) {
    this.transportService = transportService;
    this.localDb = localDb;
    this.updateManager = updateManager;
    this.onStoreUpdate = onStoreUpdate;
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
    fetchOptions?: { forceRefresh?: boolean },
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
      if (!fetchOptions?.forceRefresh) {
        const local = await this.localDb?.getUserFull(opt.id);
        if (local) {
          fullUsers[local.id] = local;
          continue;
        }
      }
      misses.push(opt);
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
    fetchOptions?: { forceRefresh?: boolean },
  ): Promise<{
    fullUsers: Record<string, UserFull>;
    chats: Record<string, Chat>;
    channels: Record<string, Channel>;
    users: Record<string, User>;
  }> => {
    return this.getFullUsers(
      ids.map((id) => ({ id })),
      fetchOptions,
    );
  };

  /**
   * Add or update a Telegram contact (`contacts.addContact`), persist returned user entities,
   * and invalidate cached `userFull` so contact settings refresh.
   */
  addContact = async (input: AddContactInput): Promise<Record<string, User>> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const peer = input.accessHash
      ? buildInputPeer(input.id, input.accessHash)
      : await resolveInputPeerForRead(input.id, this.transportService, this.localDb);
    const updates = await this.client.invoke(
      new Api.contacts.AddContact({
        id: peer,
        firstName: input.firstName,
        lastName: input.lastName ?? '',
        phone: input.phone ?? '',
        addPhonePrivacyException: Boolean(input.addPhonePrivacyException),
      }),
    );
    if (this.updateManager && updates) {
      await this.updateManager.process(updates, 'rpc');
    }
    const users = extractUsersFromUpdatesResult(updates);
    const record: Record<string, User> = {};
    for (const user of users) {
      record[user.id] = user;
    }
    if (users.length > 0) {
      await persistPeers(this.localDb, { users });
    }
    await this.localDb?.invalidateUserFull(input.id);
    return record;
  };

  /**
   * Remove a user from contacts (`contacts.deleteContacts`), persist returned user entities,
   * and invalidate cached `userFull`.
   */
  deleteContact = async (input: {
    id: string;
    accessHash?: string;
  }): Promise<Record<string, User>> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const peer = input.accessHash
      ? buildInputPeer(input.id, input.accessHash)
      : await resolveInputPeerForRead(input.id, this.transportService, this.localDb);
    const updates = await this.client.invoke(
      new Api.contacts.DeleteContacts({
        id: [peer],
      }),
    );
    if (this.updateManager && updates) {
      await this.updateManager.process(updates, 'rpc');
    }
    const users = extractUsersFromUpdatesResult(updates);
    const record: Record<string, User> = {};
    for (const user of users) {
      record[user.id] = user;
    }
    if (users.length > 0) {
      await persistPeers(this.localDb, { users });
    }
    await this.localDb?.invalidateUserFull(input.id);
    return record;
  };

  /**
   * Block or unblock a peer (`contacts.block` / `contacts.unblock`) and sync `LocalDb` + tabs.
   */
  setBlocked = async (input: {
    id: string;
    accessHash?: string;
    blocked: boolean;
  }): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const peer = input.accessHash
      ? buildInputPeer(input.id, input.accessHash)
      : await resolveInputPeerForRead(input.id, this.transportService, this.localDb);
    if (input.blocked) {
      await this.client.invoke(new Api.contacts.Block({ id: peer }));
    } else {
      await this.client.invoke(new Api.contacts.Unblock({ id: peer }));
    }
    const cached = await this.localDb?.getUserFull(input.id);
    if (cached && this.localDb) {
      await this.localDb.putUserFull({ ...cached, blocked: input.blocked });
    } else {
      await this.localDb?.invalidateUserFull(input.id);
    }
    this.onStoreUpdate?.({
      type: 'peerBlocked',
      peerId: input.id,
      blocked: input.blocked,
    });
  };

  /**
   * Mute (`muteUntil = 2147483647`) or unmute (`muteUntil = 0`) notifications for a peer.
   */
  setPeerMuted = async (input: {
    peerId: string;
    accessHash?: string;
    muted: boolean;
  }): Promise<TypePeerNotifySettings> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const peer = input.accessHash
      ? buildInputPeer(input.peerId, input.accessHash)
      : await resolveInputPeerForRead(input.peerId, this.transportService, this.localDb);
    const muteUntil = input.muted ? 2_147_483_647 : 0;
    await this.client.invoke(
      new Api.account.UpdateNotifySettings({
        peer: new Api.InputNotifyPeer({ peer }),
        settings: new Api.InputPeerNotifySettings({ muteUntil }),
      }),
    );
    const notifySettings = convertTypePeerNotifySettings(
      new Api.PeerNotifySettings({ muteUntil }),
    );
    if (getEntityTypeById(input.peerId) === 'user' && this.localDb) {
      const cachedFull = await this.localDb.getUserFull(input.peerId);
      if (cachedFull) {
        await this.localDb.putUserFull({ ...cachedFull, notifySettings });
      }
    }
    this.onStoreUpdate?.({
      type: 'notifySettings',
      peerId: input.peerId,
      notifySettings,
    });
    return notifySettings;
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

  /**
   * Fetch top inline bots via `contacts.getTopPeers` (`botsInline: true`).
   */
  getTopInlineBots = async (
    limit: number = 20,
  ): Promise<{ userIds: string[]; users: Record<string, User> }> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const result = await this.client.invoke(
      new Api.contacts.GetTopPeers({
        botsInline: true,
        offset: 0,
        limit,
        hash: bigint(0),
      }),
    );

    if (!(result instanceof Api.contacts.TopPeers)) {
      return { userIds: [], users: {} };
    }

    const users: Record<string, User> = {};
    const convertedUsers: User[] = [];
    for (const entry of result.users ?? []) {
      if (entry instanceof Api.User) {
        const converted = convertUser(entry);
        users[converted.id] = converted;
        convertedUsers.push(converted);
      }
    }

    await persistPeers(this.localDb, { users: convertedUsers });

    const userIds: string[] = [];
    const seen = new Set<string>();
    for (const category of result.categories ?? []) {
      if (!(category.category instanceof Api.TopPeerCategoryBotsInline)) continue;
      for (const topPeer of category.peers ?? []) {
        if (topPeer.peer instanceof Api.PeerUser) {
          const id = buildMarkedPeerIdByType(topPeer.peer.userId.toString(), 'user');
          if (id && !seen.has(id)) {
            seen.add(id);
            userIds.push(id);
          }
        }
      }
    }

    return { userIds, users };
  };

  /**
   * Search remote users/bots via `contacts.search` and persist returned users to LocalDb.
   */
  searchContacts = async (
    q: string,
    limit: number = 20,
  ): Promise<{ userIds: string[]; users: Record<string, User> }> => {
    const query = q.trim();
    if (!query) {
      return { userIds: [], users: {} };
    }
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const result = await this.client.invoke(
      new Api.contacts.Search({
        q: query,
        limit,
      }),
    );

    if (!(result instanceof Api.contacts.Found)) {
      return { userIds: [], users: {} };
    }

    const users: Record<string, User> = {};
    const convertedUsers: User[] = [];
    for (const entry of result.users ?? []) {
      if (entry instanceof Api.User) {
        const converted = convertUser(entry);
        users[converted.id] = converted;
        convertedUsers.push(converted);
      }
    }

    await persistPeers(this.localDb, { users: convertedUsers });

    const userIds: string[] = [];
    const seen = new Set<string>();
    for (const peer of [...(result.myResults ?? []), ...(result.results ?? [])]) {
      if (peer instanceof Api.PeerUser) {
        const id = buildMarkedPeerIdByType(peer.userId.toString(), 'user');
        if (id && !seen.has(id)) {
          seen.add(id);
          userIds.push(id);
        }
      }
    }

    return { userIds, users };
  };
}
