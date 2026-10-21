import { Controller, Method, RequestLog } from '@telegenie/decorators';
import {
  canSendReaction,
  getEntityTypeById,
  isChatReactionsNone,
  isEmojiReaction,
  isEmptyReaction,
  isPaidReaction,
  reactionKey,
  reactionsEqual,
  type ReactionPeerKind,
} from '@telegenie/libs/foundation/telegram/helpers';
import type {
  TypeChatReactions,
  TypeMessagePeerReaction,
  TypeReaction,
  TypeReactionCount,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import type { PlainAvailableReaction } from '@telegenie/libs/foundation/telegram/services/converters/message.converter';
import type { MessageReactionsList } from '@telegenie/libs/foundation/telegram/types/message';
import type { TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';
import type {
  FullChannelBundle,
  FullChatBundle,
} from '@telegenie/libs/foundation/telegram/worker/telegram.api';
import { toJS } from 'mobx';
import { ChannelFull } from '../../store/entity/models/channel-full.model';
import { Channel } from '../../store/entity/models/channel.model';
import { ChatFull } from '../../store/entity/models/chat-full.model';
import { Chat } from '../../store/entity/models/chat.model';
import { Message } from '../../store/entity/models/message.model';
import { User } from '../../store/entity/models/user.model';
import { Dialog } from '../../store/entity/models/dialog.model';
import type GlobalStore from '../../store/global/global.store';
import { MAIN_THREAD_ID } from '../../store/global/models/thread.state';
import { formatDialogPreviewText } from '../../store/entity/models/message.model';
import { dialogPeerKindFromId } from '../../store/utils/peer-display';
import type StoreManager from '../../store/store.manager';
import type { DialogEntity, MessageEntity, MessageStore } from '../../store/types';
import { ConversionService } from '../common/services/convert.service';
import type { FocusMessageOptions } from './message-load.controller';

export type MessageReactionListResult = {
  count: number;
  reactions: TypeMessagePeerReaction[];
  nextOffset?: string;
};

/** A reaction on a loaded message, with the chat it belongs to. */
export type RecentReactionMessage = {
  key: string;
  emoticon: string;
  peerId: string;
  messageId: string;
  messageText: string;
  dialogTitle: string;
  date: number;
};

type MessageReactionControllerOptions = {
  sm: StoreManager;
  globalStore: GlobalStore;
  debug?: boolean;
  worker: TelegramWorkerClient;
  ensureMessageStore: (peerId: string) => MessageStore;
  loadMessagesByIds: (peerId: string, ids: string[]) => Promise<Message[]>;
  focusMessage: (peerId: string, opts: FocusMessageOptions) => Promise<void>;
};

@Controller
export class MessageReactionController {
  worker: TelegramWorkerClient;
  sm: StoreManager;
  converter: ConversionService;
  private readonly globalStore: GlobalStore;
  private readonly ensureMessageStore: (peerId: string) => MessageStore;
  private readonly loadMessagesByIds: (peerId: string, ids: string[]) => Promise<Message[]>;
  private readonly focusMessage: (peerId: string, opts: FocusMessageOptions) => Promise<void>;
  private cachedDefaultReaction?: string;
  private recentEmoticons: string[] = [];
  private topEmoticons: string[] = [];
  /** Session cache of active catalog reactions (`messages.GetAvailableReactions`). */
  availableReactions: PlainAvailableReaction[] = [];

  constructor(options: MessageReactionControllerOptions) {
    this.sm = options.sm;
    this.globalStore = options.globalStore;
    this.worker = options.worker;
    this.converter = new ConversionService({ debug: options.debug ?? false });
    this.ensureMessageStore = options.ensureMessageStore;
    this.loadMessagesByIds = options.loadMessagesByIds;
    this.focusMessage = options.focusMessage;
  }

  @RequestLog()
  @Method()
  async toggleReaction(input: {
    peerId: string;
    messageId: string | number;
    reaction: TypeReaction;
    addToRecent?: boolean;
  }): Promise<void> {
    const messageId =
      typeof input.messageId === 'number' ? input.messageId : Number(input.messageId);
    if (!Number.isInteger(messageId) || messageId <= 0) return;

    const id = String(messageId);
    await this.ensureReactionPolicy(input.peerId);

    let existing = this.ensureMessageStore(input.peerId).get(id);
    if (!existing) {
      await this.loadMessagesByIds(input.peerId, [id]);
      existing = this.ensureMessageStore(input.peerId).get(id);
    }
    if (!existing) return;

    const base = toJS(existing) as MessageEntity;
    if (!this.allowsReaction(input.peerId, input.reaction, base.reactions?.results)) return;

    const { results } = nextReactionResults(
      base.reactions?.results ?? [],
      input.reaction,
      this.regularReactionLimit(),
    );
    const sent = results
      .filter((row) => row.chosenOrder != null && !isPaidReaction(row.reaction))
      .sort((a, b) => (a.chosenOrder ?? 0) - (b.chosenOrder ?? 0))
      .map((row) => row.reaction);

    await this.worker.call('message.sendReaction', [
      input.peerId,
      messageId,
      sent,
      this.channelAccessHash(input.peerId),
      input.addToRecent,
    ]);
  }

  @RequestLog()
  @Method()
  async getReactionMenuEmojis(peerId: string, messageId?: string): Promise<string[]> {
    await this.ensureReactionPolicy(peerId);
    const peerKind = this.reactionPeerKind(peerId);
    const available = this.availableChatReactions(peerId);
    if (messageId) {
      const message = this.ensureMessageStore(peerId).get(messageId);
      const results = message?.reactions?.results ?? [];
      if (results.length >= this.reactionsUniqMax(peerId)) {
        return uniqueMenuEmojis(
          results.flatMap((row) =>
            'emoticon' in row.reaction && row.reaction.emoticon ? [row.reaction.emoticon] : [],
          ),
        );
      }
    }
    const allow = reactionMenuEmojis(peerKind, available);
    const allowAll = available != null && 'allowCustom' in available;
    if (!allowAll) {
      return uniqueMenuEmojis(allow);
    }
    await this.loadAvailableReactionsCatalog();
    const defaultEmoji = await this.getDefaultReaction();
    if (!this.recentEmoticons.length) {
      try {
        this.recentEmoticons = await this.worker.call('message.getRecentReactions', [50]);
      } catch {
        this.recentEmoticons = [];
      }
    }
    if (!this.topEmoticons.length) {
      try {
        this.topEmoticons = await this.worker.call('message.getTopReactions', [100]);
      } catch {
        this.topEmoticons = [];
      }
    }
    const catalog = this.availableReactions
      .filter((row) => !row.inactive && !row.premium)
      .map((row) => row.emoticon);
    const priority = uniqueMenuEmojis([
      defaultEmoji,
      ...this.recentEmoticons,
      ...this.topEmoticons,
    ]);
    const ordered = [
      ...priority.filter((emoji) => catalog.includes(canonicalMenuEmoticon(emoji))),
      ...catalog.filter(
        (emoji) => !priority.some((item) => canonicalMenuEmoticon(item) === canonicalMenuEmoticon(emoji)),
      ),
    ];
    return uniqueMenuEmojis(ordered.length ? ordered : allow);
  }

  @RequestLog()
  @Method()
  async loadAvailableReactionsCatalog(): Promise<PlainAvailableReaction[]> {
    if (this.availableReactions.length) return this.availableReactions;
    const reactions = await this.worker.call('message.getAvailableReactions', []);
    this.availableReactions = reactions;
    return reactions;
  }

  @RequestLog()
  @Method()
  async setDefaultReaction(input: { emoticon: string }): Promise<void> {
    const emoticon = canonicalMenuEmoticon(input.emoticon);
    if (!emoticon) return;
    await this.worker.call('message.setDefaultReaction', [emoticon]);
    this.cachedDefaultReaction = emoticon;
  }

  @RequestLog()
  @Method()
  async clearRecentReactions(): Promise<void> {
    await this.worker.call('message.clearRecentReactions', []);
    this.recentEmoticons = [];
  }

  @RequestLog()
  @Method()
  async refreshRecentReactions(): Promise<string[]> {
    this.recentEmoticons = await this.worker.call('message.getRecentReactions', [50]);
    return this.recentEmoticons;
  }

  /**
   * Reactions already loaded on messages, newest first.
   * Chats with an unread-reaction count are fetched first so those messages are included.
   */
  @RequestLog()
  @Method()
  async listRecentReactionMessages(): Promise<RecentReactionMessage[]> {
    if (this.sm.has('dialog')) {
      const dialogs = [...this.sm.get('dialog').getAllData().values()];
      const pending = dialogs.filter((dialog) => (dialog.unreadReactionsCount ?? 0) > 0).slice(0, 12);
      await Promise.all(
        pending.map((dialog) => this.fetchUnreadReactions(dialog.peerId).catch(() => [])),
      );
    }

    const rows: RecentReactionMessage[] = [];
    for (const name of this.sm.names()) {
      if (!name.endsWith('-message')) continue;
      const peerId = name.slice(0, -'-message'.length);
      if (!peerId) continue;
      const store = this.sm.get(name) as MessageStore;
      if (typeof store.getAllData !== 'function') continue;
      let dialogTitle = peerId;
      try {
        dialogTitle = this.dialogTitle(peerId);
      } catch {
        dialogTitle = peerId;
      }
      for (const message of store.getAllData().values()) {
        try {
          rows.push(...this.reactionRowsFromMessage(message, dialogTitle));
        } catch {
          // One malformed cached message should not blank the whole list.
        }
      }
    }
    await this.fillMissingReactionDates(rows);
    rows.sort((a, b) => b.date - a.date || Number(b.messageId) - Number(a.messageId));
    return rows.slice(0, 50);
  }

  @RequestLog()
  @Method()
  async getReactionList(input: {
    peerId: string;
    messageId: string | number;
    offset?: string;
    limit?: number;
    reaction?: TypeReaction;
  }): Promise<MessageReactionListResult> {
    return this.getMessageReactionsList(input);
  }

  @RequestLog()
  @Method()
  async getMessageReactionsList(input: {
    peerId: string;
    messageId: string | number;
    offset?: string;
    limit?: number;
    reaction?: TypeReaction;
  }): Promise<MessageReactionListResult> {
    const messageId =
      typeof input.messageId === 'number' ? input.messageId : Number(input.messageId);
    if (!Number.isInteger(messageId) || messageId <= 0) {
      return { count: 0, reactions: [] };
    }
    const list = await this.worker.call('message.getMessageReactionsList', [
      input.peerId,
      messageId,
      this.channelAccessHash(input.peerId),
      {
        offset: input.offset,
        limit: input.limit,
        reaction: input.reaction,
      },
    ]);
    this.ingestReactionListPeers(list);
    return {
      count: list.count,
      reactions: list.reactions,
      nextOffset: list.nextOffset,
    };
  }

  @RequestLog()
  @Method()
  async getDefaultReaction(): Promise<string> {
    if (this.cachedDefaultReaction) return this.cachedDefaultReaction;
    try {
      const result = await this.worker.call('message.getDefaultReaction', []);
      this.cachedDefaultReaction = result.emoticon || '👍';
    } catch {
      this.cachedDefaultReaction = '👍';
    }
    return this.cachedDefaultReaction;
  }

  @RequestLog()
  @Method()
  async refreshVisibleReactions(peerId: string, messageIds: string[]): Promise<void> {
    if (getEntityTypeById(peerId) === 'user') return;
    const store = this.ensureMessageStore(peerId);
    const ids = messageIds
      .map((messageId) => Number(messageId))
      .filter((messageId) => {
        if (!Number.isInteger(messageId) || messageId <= 0) return false;
        const message = store.get(String(messageId));
        return message?.kind === 'message' && message.reactions != null;
      });
    if (!ids.length) return;
    await this.worker.call('message.refreshReactions', [peerId, ids]);
  }

  @RequestLog()
  @Method()
  async fetchUnreadReactions(peerId: string): Promise<string[]> {
    const result = await this.worker.call('message.getUnreadReactions', [peerId]);
    const dialogUI = this.globalStore.getOrCreateDialogUI(peerId);
    const unseen = (ids: readonly string[]) =>
      ids.map(String).filter((id) => id && !dialogUI.hasSeenReaction(id));
    if (result.messageIds.length) {
      await this.loadMessagesByIds(peerId, result.messageIds);
    }
    const serverIds = unseen(result.messageIds);
    const localIds = unseen(dialogUI.unreadReactionIds);
    // A live reaction can land before messages.getUnreadReactions lists it.
    // Keep that local id, and drop reactions the user has already opened.
    const merged = [...new Set([...serverIds, ...localIds])].sort(
      (a, b) => Number(b) - Number(a),
    );
    if (merged.length > 0) {
      dialogUI.setUnreadReactionIds(merged);
      this.patchDialogReactionsCount(peerId, merged.length);
      return merged;
    }
    dialogUI.setUnreadReactionIds([]);
    const dialog = this.sm.has('dialog')
      ? (this.sm.get('dialog').get(peerId) as Dialog | undefined)
      : undefined;
    if ((dialog?.unreadReactionsCount ?? 0) > 0) {
      this.patchDialogReactionsCount(peerId, 0);
    }
    return [];
  }

  @RequestLog()
  @Method()
  async focusClosestUnreadReaction(
    peerId: string,
    threadId: string = MAIN_THREAD_ID,
    anchorMessageId?: string,
  ): Promise<void> {
    await this.ensureUnreadReactionsFresh(peerId);
    const targetId = this.pickClosestUnreadReactionId(peerId, threadId, anchorMessageId);
    if (!targetId) return;
    await this.focusMessage(peerId, { messageId: targetId, threadId });
    this.applyLocalReactionRead(peerId, [targetId]);
  }

  /**
   * Mark unread reactions read for messages that are on screen.
   * `messages.readReactions` clears the whole dialog, so it is sent only after
   * every known unread reaction message has been seen.
   */
  @RequestLog()
  @Method()
  markReactionsRead(peerId: string, messageIds: string[]): void {
    if (!messageIds.length) return;
    const unread = new Set(this.globalStore.getOrCreateDialogUI(peerId).unreadReactionIds);
    const visible = messageIds.filter((id) => unread.has(id));
    if (!visible.length) return;
    this.applyLocalReactionRead(peerId, visible);
  }

  @RequestLog()
  @Method()
  async ensureUnreadReactions(peerId: string): Promise<void> {
    const dialog = this.sm.has('dialog')
      ? (this.sm.get('dialog').get(peerId) as Dialog | undefined)
      : undefined;
    const count = dialog?.unreadReactionsCount ?? 0;
    const cached = this.globalStore.getDialogUI(peerId)?.unreadReactionIds.length ?? 0;
    if (count <= 0 && cached === 0) return;
    if (cached > 0 && cached >= count) return;
    await this.fetchUnreadReactions(peerId);
  }

  private applyLocalReactionRead(peerId: string, messageIds: string[]): void {
    if (!messageIds.length) return;
    const dialogUI = this.globalStore.getOrCreateDialogUI(peerId);
    dialogUI.markReactionsSeen(messageIds);
    dialogUI.removeUnreadReactionIds(messageIds);
    const remaining = dialogUI.unreadReactionIds.length;
    this.patchDialogReactionsCount(peerId, remaining);
    if (remaining > 0) return;
    // messages.readReactions marks the dialog's current unreads read on the server.
    // Later reactions stay unread. Don't clear ids that arrive while this is in flight.
    void this.worker.call('message.readAllReactions', [peerId]);
  }

  @RequestLog()
  @Method()
  async readAllReactions(peerId: string): Promise<void> {
    await this.worker.call('message.readAllReactions', [peerId]);
    this.globalStore.getOrCreateDialogUI(peerId).clearUnreadReactionIds();
    this.patchDialogReactionsCount(peerId, 0);
  }

  private async ensureUnreadReactionsFresh(peerId: string): Promise<void> {
    const dialogUI = this.globalStore.getDialogUI(peerId);
    const dialog = this.sm.has('dialog')
      ? (this.sm.get('dialog').get(peerId) as Dialog | undefined)
      : undefined;
    const count = dialog?.unreadReactionsCount ?? 0;
    const cached = dialogUI?.unreadReactionIds ?? [];
    if (count > 0 && cached.length === 0) {
      await this.fetchUnreadReactions(peerId);
    }
  }

  private pickClosestUnreadReactionId(
    peerId: string,
    threadId: string,
    anchorMessageId?: string,
  ): string | undefined {
    const dialogUI = this.globalStore.getDialogUI(peerId);
    const candidates = (dialogUI?.unreadReactionIds ?? []).filter((id) =>
      this.ensureMessageStore(peerId).get(id),
    );
    if (!candidates.length) return undefined;

    const threadUI = this.globalStore.getThreadUI(peerId, threadId);
    const listedIds = threadUI?.listedIds ?? [];
    const anchor = anchorMessageId ?? listedIds[listedIds.length - 1];
    const anchorIndex = anchor ? listedIds.indexOf(anchor) : -1;

    if (anchorIndex >= 0) {
      let bestId = candidates[0];
      let bestDistance = Infinity;
      for (const id of candidates) {
        const index = listedIds.indexOf(id);
        if (index < 0) continue;
        const distance = Math.abs(index - anchorIndex);
        if (distance < bestDistance) {
          bestId = id;
          bestDistance = distance;
        }
      }
      if (bestDistance < Infinity) return bestId;
    }

    return candidates[0];
  }

  private dialogTitle(peerId: string): string {
    const kind = dialogPeerKindFromId(peerId);
    const storeName = kind === 'user' ? 'user' : kind === 'channel' ? 'channel' : 'chat';
    if (!this.sm.has(storeName)) return peerId;
    const peer = this.sm.get(storeName).getAllData().get(peerId) as
      | { display?: { name?: string } }
      | undefined;
    const name = peer?.display?.name?.trim();
    if (name && name !== peerId) return name;
    return peerId;
  }

  private reactionRowsFromMessage(message: Message, dialogTitle: string): RecentReactionMessage[] {
    if (message.kind !== 'message' || !message.reactions) return [];
    const recent = Array.isArray(message.reactions.recentReactions)
      ? message.reactions.recentReactions
      : [];
    const fromRecent = this.rowsForReactions(
      message,
      dialogTitle,
      recent.flatMap((entry) => {
        const emoticon = emoticonFromReaction(entry?.reaction);
        const date = Number(entry?.date);
        return emoticon && Number.isFinite(date) && date > 0 ? [{ emoticon, date }] : [];
      }),
    );
    if (fromRecent.length) return fromRecent;
    const results = Array.isArray(message.reactions.results) ? message.reactions.results : [];
    // Count-only reactions have no timestamp. Leave date at 0 so the message
    // send time is not shown as the reaction time.
    return this.rowsForReactions(
      message,
      dialogTitle,
      results.flatMap((result) => {
        const emoticon = emoticonFromReaction(result?.reaction);
        return emoticon && result.count > 0 ? [{ emoticon, date: 0 }] : [];
      }),
    );
  }

  /** Load per-emoji reaction times when the message only has aggregate counts. */
  private async fillMissingReactionDates(rows: RecentReactionMessage[]): Promise<void> {
    const pending = new Map<string, RecentReactionMessage[]>();
    for (const row of rows) {
      if (row.date > 0) continue;
      const key = `${row.peerId}:${row.messageId}`;
      const group = pending.get(key);
      if (group) group.push(row);
      else pending.set(key, [row]);
    }
    const keys = [...pending.keys()];
    let next = 0;
    const workers = Array.from({ length: Math.min(4, keys.length) }, async () => {
      while (next < keys.length) {
        const key = keys[next];
        next += 1;
        const splitAt = key.lastIndexOf(':');
        const peerId = key.slice(0, splitAt);
        const messageId = key.slice(splitAt + 1);
        const dates = await this.reactionDatesByEmoticon(peerId, messageId);
        for (const row of pending.get(key) ?? []) {
          const date = dates.get(row.emoticon);
          if (date) row.date = date;
        }
      }
    });
    await Promise.all(workers);
  }

  private async reactionDatesByEmoticon(
    peerId: string,
    messageId: string,
  ): Promise<Map<string, number>> {
    const dates = new Map<string, number>();
    try {
      const list = await this.worker.call('message.getMessageReactionsList', [
        peerId,
        Number(messageId),
        this.channelAccessHash(peerId),
        { limit: 100 },
      ]);
      const reactions = Array.isArray(list?.reactions) ? list.reactions : [];
      for (const entry of reactions) {
        const emoticon = canonicalMenuEmoticon(emoticonFromReaction(entry?.reaction) ?? '');
        const date = Number(entry?.date);
        if (!emoticon || !Number.isFinite(date) || date <= 0) continue;
        dates.set(emoticon, Math.max(dates.get(emoticon) ?? 0, date));
      }
    } catch {
      // The row stays in the list without a fabricated timestamp.
    }
    return dates;
  }

  private rowsForReactions(
    message: Message,
    dialogTitle: string,
    sources: Array<{ emoticon: string; date: number }>,
  ): RecentReactionMessage[] {
    const rows: RecentReactionMessage[] = [];
    const seen = new Set<string>();
    for (const source of sources) {
      const emoticon = canonicalMenuEmoticon(source.emoticon);
      if (!emoticon || seen.has(emoticon)) continue;
      seen.add(emoticon);
      rows.push({
        key: `${message.peerId}:${message.id}:${emoticon}`,
        emoticon,
        peerId: message.peerId,
        messageId: String(message.id),
        messageText: formatDialogPreviewText(message) || message.summaryText || 'Message',
        dialogTitle,
        date: source.date,
      });
    }
    return rows;
  }

  private patchDialogReactionsCount(peerId: string, unreadReactionsCount: number): void {
    if (!this.sm.has('dialog')) return;
    const existing = this.sm.get('dialog').get(peerId) as DialogEntity | undefined;
    if (!existing) return;
    this.sm.get('dialog').update([
      new Dialog({
        ...(existing as DialogEntity),
        unreadReactionsCount: unreadReactionsCount > 0 ? unreadReactionsCount : undefined,
      }),
    ]);
  }

  private allowsReaction(
    peerId: string,
    reaction: TypeReaction,
    existing?: TypeReactionCount[],
  ): boolean {
    if (isPaidReaction(reaction) || isEmptyReaction(reaction)) return false;
    const alreadyOnMessage = (existing ?? []).some((row) => reactionsEqual(row.reaction, reaction));
    const chosen = (existing ?? []).some(
      (row) => row.chosenOrder != null && reactionsEqual(row.reaction, reaction),
    );
    if (chosen) return true;
    const peerKind = this.reactionPeerKind(peerId);
    if (peerKind === 'user') return isEmojiReaction(reaction);
    const available = this.availableChatReactions(peerId);
    if (available === undefined) return alreadyOnMessage;
    if (isChatReactionsNone(available)) return alreadyOnMessage;
    return canSendReaction(reaction, available, peerKind) || alreadyOnMessage;
  }

  private hasReactionPolicy(peerId: string): boolean {
    const kind = getEntityTypeById(peerId);
    if (kind === 'user') return true;
    const storeName = kind === 'channel' ? 'channelFull' : 'chatFull';
    if (!this.sm.has(storeName)) return false;
    const full = this.sm.get(storeName).getAllData().get(peerId) as
      | { notifySettings?: unknown; availableReactions?: TypeChatReactions }
      | undefined;
    if (!full?.notifySettings) return false;
    return full.availableReactions !== undefined;
  }

  private hydrateFullChatBundle(bundle: FullChatBundle): void {
    const chatFullEntities = Object.values(bundle.fullChats).map((full) =>
      this.converter.convertChatFull(full),
    );
    if (chatFullEntities.length && this.sm.has('chatFull')) {
      this.sm.get('chatFull').update(chatFullEntities.map((entity) => new ChatFull(entity)));
    }
    const chatEntities = Object.values(bundle.chats).map((chat) =>
      this.converter.convertChat(chat),
    );
    if (chatEntities.length && this.sm.has('chat')) {
      this.sm.get('chat').update(chatEntities.map((entity) => new Chat(entity)));
    }
    const channelEntities = Object.values(bundle.channels).map((channel) =>
      this.converter.convertChannel(channel),
    );
    if (channelEntities.length && this.sm.has('channel')) {
      this.sm.get('channel').update(channelEntities.map((entity) => new Channel(entity)));
    }
    const userEntities = this.converter.convertUsers(Object.values(bundle.users));
    if (userEntities.length && this.sm.has('user')) {
      this.sm.get('user').update(userEntities.map((entity) => new User(entity)));
    }
  }

  private hydrateFullChannelBundle(bundle: FullChannelBundle): void {
    const channelFullEntities = Object.values(bundle.fullChannels).map((full) =>
      this.converter.convertChannelFull(full),
    );
    if (channelFullEntities.length && this.sm.has('channelFull')) {
      this.sm
        .get('channelFull')
        .update(channelFullEntities.map((entity) => new ChannelFull(entity)));
    }
    const channelEntities = Object.values(bundle.channels).map((channel) =>
      this.converter.convertChannel(channel),
    );
    if (channelEntities.length && this.sm.has('channel')) {
      this.sm.get('channel').update(channelEntities.map((entity) => new Channel(entity)));
    }
    const chatEntities = Object.values(bundle.chats).map((chat) =>
      this.converter.convertChat(chat),
    );
    if (chatEntities.length && this.sm.has('chat')) {
      this.sm.get('chat').update(chatEntities.map((entity) => new Chat(entity)));
    }
    const userEntities = this.converter.convertUsers(Object.values(bundle.users));
    if (userEntities.length && this.sm.has('user')) {
      this.sm.get('user').update(userEntities.map((entity) => new User(entity)));
    }
  }

  private async ensureReactionPolicy(peerId: string): Promise<void> {
    if (this.hasReactionPolicy(peerId)) return;
    const kind = getEntityTypeById(peerId);
    if (kind === 'chat') {
      const bundle = await this.worker.call('chat.getFullChatByIds', [[peerId]]);
      this.hydrateFullChatBundle(bundle);
      return;
    }
    if (kind === 'channel') {
      const accessHash = await this.ensureChannelAccessHash(peerId);
      if (!accessHash) return;
      const bundle = await this.worker.call('channel.getFullChannelByIds', [
        [{ id: peerId, accessHash }],
      ]);
      this.hydrateFullChannelBundle(bundle);
    }
  }

  private ingestReactionListPeers(list: MessageReactionsList): void {
    if (list.users.length && this.sm.has('user')) {
      this.sm
        .get('user')
        .update(this.converter.convertUsers(list.users).map((entity) => new User(entity)));
    }
    const [chatEntities, channelEntities] = this.converter.convertTypeChats(list.chats);
    if (channelEntities.length && this.sm.has('channel')) {
      this.sm.get('channel').update(channelEntities.map((entity) => new Channel(entity)));
    }
    if (chatEntities.length && this.sm.has('chat')) {
      this.sm.get('chat').update(chatEntities.map((entity) => new Chat(entity)));
    }
  }

  private async ensureChannelAccessHash(peerId: string): Promise<string | undefined> {
    const existing = this.channelAccessHash(peerId);
    if (existing) return existing;
    const channels = await this.worker.call('channel.getChannelsByIds', [[peerId]]);
    const raw = channels[peerId];
    if (!raw) return undefined;
    const entity = this.converter.convertChannel(raw);
    if (this.sm.has('channel')) {
      this.sm.get('channel').update([new Channel(entity)]);
    }
    return entity.accessHash;
  }

  private reactionPeerKind(peerId: string): ReactionPeerKind {
    const kind = getEntityTypeById(peerId);
    if (kind === 'channel') return 'channel';
    if (kind === 'chat') return 'group';
    return 'user';
  }

  private availableChatReactions(peerId: string): TypeChatReactions | undefined {
    const kind = getEntityTypeById(peerId);
    const storeName = kind === 'channel' ? 'channelFull' : kind === 'chat' ? 'chatFull' : undefined;
    if (!storeName || !this.sm.has(storeName)) return undefined;
    const full = this.sm.get(storeName).getAllData().get(peerId) as
      | { availableReactions?: TypeChatReactions }
      | undefined;
    if (!full) return undefined;
    return full.availableReactions;
  }

  private channelAccessHash(peerId: string): string | undefined {
    if (getEntityTypeById(peerId) !== 'channel' || !this.sm.has('channel')) return undefined;
    return (this.sm.get('channel').getAllData().get(peerId) as { accessHash?: string } | undefined)
      ?.accessHash;
  }

  private selfUser(): { id: string; premium?: boolean } | undefined {
    if (!this.sm.has('user')) return undefined;
    for (const user of this.sm.get('user').getAllData().values()) {
      if (user.self && user.id) return { id: String(user.id), premium: user.premium };
    }
    return undefined;
  }

  private regularReactionLimit(): number {
    const self = this.selfUser();
    if (!self) return 1;
    return self.premium ? 3 : 1;
  }

  private reactionsUniqMax(peerId: string): number {
    const kind = getEntityTypeById(peerId);
    const storeName = kind === 'channel' ? 'channelFull' : kind === 'chat' ? 'chatFull' : undefined;
    if (storeName && this.sm.has(storeName)) {
      const full = this.sm.get(storeName).getAllData().get(peerId) as
        | { reactionsLimit?: number }
        | undefined;
      if (full?.reactionsLimit != null && full.reactionsLimit > 0) {
        return full.reactionsLimit;
      }
    }
    return REACTIONS_UNIQ_MAX;
  }
}

const REACTIONS_UNIQ_MAX = 11;
const SUGGESTED_REACTION_EMOJIS = ['👍', '❤', '🔥', '🎉', '😢', '😮'];

function emoticonFromReaction(reaction: TypeReaction | undefined): string | undefined {
  if (!reaction || typeof reaction !== 'object') return undefined;
  if ('emoticon' in reaction && typeof reaction.emoticon === 'string') return reaction.emoticon;
  return undefined;
}

function canonicalMenuEmoticon(value: string): string {
  return value.replace(/\uFE0F/g, '');
}

function uniqueMenuEmojis(emojis: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const emoji of emojis) {
    const key = canonicalMenuEmoticon(emoji);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

function reactionMenuEmojis(
  peerKind: ReactionPeerKind,
  available: TypeChatReactions | undefined,
): string[] {
  if (peerKind === 'user') return uniqueMenuEmojis(SUGGESTED_REACTION_EMOJIS);
  if (available === undefined) return [];
  if (isChatReactionsNone(available)) return [];
  const builtin = uniqueMenuEmojis(SUGGESTED_REACTION_EMOJIS);
  if ('reactions' in available && Array.isArray(available.reactions)) {
    return uniqueMenuEmojis(
      available.reactions.flatMap((reaction) =>
        'emoticon' in reaction && reaction.emoticon ? [reaction.emoticon] : [],
      ),
    );
  }
  if ('allowCustom' in available) return builtin;
  return [];
}

function nextReactionResults(
  results: TypeReactionCount[],
  reaction: TypeReaction,
  limit: number,
): { results: TypeReactionCount[]; added: boolean } {
  const key = reactionKey(reaction);
  const chosen = results
    .filter((row) => row.chosenOrder != null && !isPaidReaction(row.reaction))
    .sort((a, b) => (a.chosenOrder ?? 0) - (b.chosenOrder ?? 0));
  const removing = chosen.some((row) => reactionKey(row.reaction) === key);
  let nextChosen = removing
    ? chosen.filter((row) => reactionKey(row.reaction) !== key)
    : [...chosen, { reaction, count: 0, chosenOrder: chosen.length }];
  if (!removing && nextChosen.length > limit) {
    nextChosen = nextChosen.slice(nextChosen.length - limit);
  }
  const kept = new Set(nextChosen.map((row) => reactionKey(row.reaction)));

  const counts = new Map<string, { reaction: TypeReaction; count: number; paid: boolean }>();
  for (const row of results) {
    const rowKey = reactionKey(row.reaction);
    const current = counts.get(rowKey);
    if (current) current.count += row.count;
    else {
      counts.set(rowKey, {
        reaction: row.reaction,
        count: row.count,
        paid: isPaidReaction(row.reaction),
      });
    }
  }
  for (const row of chosen) {
    if (kept.has(reactionKey(row.reaction))) continue;
    const entry = counts.get(reactionKey(row.reaction));
    if (!entry || entry.paid) continue;
    entry.count -= 1;
  }
  if (!removing && !chosen.some((row) => reactionKey(row.reaction) === key)) {
    const entry = counts.get(key);
    if (entry && !entry.paid) entry.count += 1;
    else if (!entry) counts.set(key, { reaction, count: 1, paid: false });
  }

  const chosenOrder = new Map(nextChosen.map((row, index) => [reactionKey(row.reaction), index]));
  const orderedKeys: string[] = [];
  for (const row of results) {
    const key = reactionKey(row.reaction);
    const entry = counts.get(key);
    if (entry && entry.count > 0 && !orderedKeys.includes(key)) {
      orderedKeys.push(key);
    }
  }
  for (const [key, entry] of counts) {
    if (entry.count > 0 && !orderedKeys.includes(key)) {
      orderedKeys.push(key);
    }
  }
  const next = orderedKeys.map((key) => {
    const entry = counts.get(key)!;
    const order = entry.paid ? undefined : chosenOrder.get(key);
    return {
      reaction: entry.reaction,
      count: entry.count,
      ...(order != null ? { chosenOrder: order } : {}),
    };
  });
  return { results: next, added: !removing };
}
