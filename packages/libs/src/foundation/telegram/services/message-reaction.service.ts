import { Api } from '@telegenie/teleproto';
import bigint from 'big-integer';
import {
  buildInputPeer,
  isEmptyReaction,
  isPaidReaction,
  plainReactionToInput,
} from '../helpers';
import type { LocalDb } from '../local-db/local-db';
import type { Channel, Chat, TypeReaction } from '../types/api-types';
import type { MessageReactionsList } from '../types/message';
import type { UpdateManager } from '../update-manager/update-manager';
import { convertChannel, convertChat } from './converters/chat.converter';
import {
  convertAvailableReaction,
  convertMessageReactionsList,
  convertMessages,
  emoticonsFromApiReactions,
  type PlainAvailableReaction,
} from './converters/message.converter';
import type { LoadHistoryResult } from './message.service';
import { convertUser } from './converters/user.converter';
import { persistPeers } from './utils/persist-peers.helper';
import { resolveInputPeerForRead } from './utils/resolve-input-peer-for-read';
import type { TransportService } from './transport.service';

export const REACTION_UNREAD_SLICE = 100;

const EMPTY_UNREAD_REACTIONS: LoadHistoryResult & { messageIds: string[] } = {
  messages: [],
  messageServices: [],
  users: [],
  chats: [],
  channels: [],
  emptyMessages: [],
  messageIds: [],
};

type MessageReactionServiceOptions = {
  transportService: TransportService;
  localDb?: LocalDb;
  updateManager?: UpdateManager;
};

export class MessageReactionService {
  private defaultReactionEmoticon?: string;
  private availableReactionsCache?: PlainAvailableReaction[];
  private topReactionEmoticonsCache?: string[];
  private recentReactionEmoticonsCache?: string[];
  transportService: TransportService;
  localDb: LocalDb | undefined;
  updateManager: UpdateManager | undefined;

  constructor({ transportService, localDb, updateManager }: MessageReactionServiceOptions) {
    this.transportService = transportService;
    this.localDb = localDb;
    this.updateManager = updateManager;
  }

  get client() {
    return this.transportService?.client ?? null;
  }

  sendReaction = async (
    peerId: string,
    messageId: number,
    reactions: TypeReaction[],
    accessHash?: string,
    addToRecent?: boolean,
  ): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const peer = accessHash
      ? buildInputPeer(peerId, accessHash)
      : await resolveInputPeerForRead(peerId, this.transportService, this.localDb);
    const regular = reactions.filter(
      (reaction) => !isPaidReaction(reaction) && !isEmptyReaction(reaction),
    );
    const updates = await this.client.invoke(
      new Api.messages.SendReaction({
        peer,
        msgId: messageId,
        reaction: regular.map((reaction) => plainReactionToInput(reaction)),
        ...(addToRecent ? { addToRecent: true } : {}),
      }),
    );
    if (this.updateManager && updates) {
      await this.updateManager.process(updates, 'rpc');
    }
  };

  refreshReactions = async (peerId: string, messageIds: number[]): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    if (messageIds.length === 0) return;
    const peer = await resolveInputPeerForRead(peerId, this.transportService, this.localDb);
    const chunkSize = 100;
    for (let offset = 0; offset < messageIds.length; offset += chunkSize) {
      const id = messageIds.slice(offset, offset + chunkSize);
      const updates = await this.client.invoke(
        new Api.messages.GetMessagesReactions({ peer, id }),
      );
      if (this.updateManager && updates) {
        await this.updateManager.process(updates, 'rpc');
      }
    }
  };

  getMessageReactionsList = async (
    peerId: string,
    messageId: number,
    accessHash?: string,
    options?: { offset?: string; limit?: number; reaction?: TypeReaction },
  ): Promise<MessageReactionsList> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const peer = accessHash
      ? buildInputPeer(peerId, accessHash)
      : await resolveInputPeerForRead(peerId, this.transportService, this.localDb);
    const result = await this.client.invoke(
      new Api.messages.GetMessageReactionsList({
        peer,
        id: messageId,
        limit: options?.limit ?? 100,
        ...(options?.offset ? { offset: options.offset } : {}),
        ...(options?.reaction ? { reaction: plainReactionToInput(options.reaction) } : {}),
      }),
    );
    if (!(result instanceof Api.messages.MessageReactionsList)) {
      throw new Error('Unexpected getMessageReactionsList response');
    }
    const users = result.users?.map(convertUser) ?? [];
    const chats: Chat[] = [];
    const channels: Channel[] = [];
    for (const chat of result.chats ?? []) {
      if (chat instanceof Api.Chat) chats.push(convertChat(chat));
      else if (chat instanceof Api.Channel) channels.push(convertChannel(chat));
    }
    await persistPeers(this.localDb, { users, chats, channels });
    return convertMessageReactionsList(result);
  };

  getUnreadReactions = async (
    peerId: string,
    opts?: { offsetId?: number; limit?: number },
  ): Promise<LoadHistoryResult & { messageIds: string[] }> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const peer = await resolveInputPeerForRead(peerId, this.transportService, this.localDb);
    const resp = await this.client.invoke(
      new Api.messages.GetUnreadReactions({
        peer,
        offsetId: opts?.offsetId ?? 0,
        addOffset: 0,
        limit: opts?.limit ?? REACTION_UNREAD_SLICE,
        maxId: 0,
        minId: 0,
      }),
    );
    if (!resp || resp instanceof Api.messages.MessagesNotModified) {
      return { ...EMPTY_UNREAD_REACTIONS };
    }
    const converted = convertMessages(resp.messages);
    const users = resp.users?.map(convertUser) ?? [];
    const chats: Chat[] = [];
    const channels: Channel[] = [];
    for (const chat of resp.chats ?? []) {
      if (chat instanceof Api.Chat) chats.push(convertChat(chat));
      else if (chat instanceof Api.Channel) channels.push(convertChannel(chat));
    }
    await persistPeers(this.localDb, { users, chats, channels });
    const messageIds = converted.messages.map((message) => String(message.id));
    return {
      messages: converted.messages,
      messageServices: converted.messageServices,
      users,
      chats,
      channels,
      emptyMessages: converted.emptyMessages,
      messageIds,
    };
  };

  readAllReactions = async (peerId: string): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const peer = await resolveInputPeerForRead(peerId, this.transportService, this.localDb);
    for (;;) {
      const result = await this.client.invoke(
        new Api.messages.ReadReactions({
          peer,
        }),
      );
      if (!result || !(result instanceof Api.messages.AffectedHistory)) {
        break;
      }
      if (!result.offset) {
        break;
      }
    }
  };

  getDefaultReaction = async (): Promise<{ emoticon: string }> => {
    if (this.defaultReactionEmoticon) {
      return { emoticon: this.defaultReactionEmoticon };
    }
    let emoticon = '👍';
    if (this.client) {
      const cached = (this.client as { _config?: { reactionsDefault?: Api.TypeReaction } })._config;
      const config =
        cached ??
        (await this.client.invoke(new Api.help.GetConfig()).catch(() => undefined));
      const reaction =
        config && 'reactionsDefault' in config ? config.reactionsDefault : undefined;
      if (reaction instanceof Api.ReactionEmoji && reaction.emoticon) {
        emoticon = reaction.emoticon;
      }
    }
    this.defaultReactionEmoticon = emoticon;
    return { emoticon };
  };

  getAvailableReactions = async (): Promise<PlainAvailableReaction[]> => {
    if (this.availableReactionsCache) return this.availableReactionsCache;
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const result = await this.client.invoke(
      new Api.messages.GetAvailableReactions({ hash: bigint(0) as never }),
    );
    if (result instanceof Api.messages.AvailableReactionsNotModified) {
      this.availableReactionsCache = [];
      return [];
    }
    if (!(result instanceof Api.messages.AvailableReactions)) {
      throw new Error('Unexpected getAvailableReactions response');
    }
    const reactions = (result.reactions ?? [])
      .map(convertAvailableReaction)
      .filter((row): row is PlainAvailableReaction => row != null && !row.inactive);
    this.availableReactionsCache = reactions;
    return reactions;
  };

  getTopReactions = async (limit = 100): Promise<string[]> => {
    if (this.topReactionEmoticonsCache) return this.topReactionEmoticonsCache;
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const result = await this.client.invoke(
      new Api.messages.GetTopReactions({ limit, hash: bigint(0) as never }),
    );
    if (result instanceof Api.messages.ReactionsNotModified) {
      this.topReactionEmoticonsCache = [];
      return [];
    }
    if (!(result instanceof Api.messages.Reactions)) {
      throw new Error('Unexpected getTopReactions response');
    }
    const emoticons = emoticonsFromApiReactions(result.reactions ?? []);
    this.topReactionEmoticonsCache = emoticons;
    return emoticons;
  };

  getRecentReactions = async (limit = 50): Promise<string[]> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const result = await this.client.invoke(
      new Api.messages.GetRecentReactions({ limit, hash: bigint(0) as never }),
    );
    if (result instanceof Api.messages.ReactionsNotModified) {
      this.recentReactionEmoticonsCache = [];
      return [];
    }
    if (!(result instanceof Api.messages.Reactions)) {
      throw new Error('Unexpected getRecentReactions response');
    }
    const emoticons = emoticonsFromApiReactions(result.reactions ?? []);
    this.recentReactionEmoticonsCache = emoticons;
    return emoticons;
  };

  clearRecentReactions = async (): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    await this.client.invoke(new Api.messages.ClearRecentReactions());
    this.recentReactionEmoticonsCache = [];
  };

  setDefaultReaction = async (emoticon: string): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    await this.client.invoke(
      new Api.messages.SetDefaultReaction({
        reaction: new Api.ReactionEmoji({ emoticon }),
      }),
    );
    this.defaultReactionEmoticon = emoticon.replace(/\uFE0F/g, '');
  };
}
