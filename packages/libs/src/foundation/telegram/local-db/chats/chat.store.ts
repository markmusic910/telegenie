import type { Chat, ChatEmpty, ChatForbidden, ChatFull } from '../../types/api-types';
import { STORE } from '../constants';
import type { LocalDbContext } from '../context';
import type { ChatFullRow, ChatPeerRow } from '../types';
import { mergeChat } from './merge-chat';

export class ChatStore {
  constructor(private readonly ctx: LocalDbContext) {}

  async putChat(chat: Chat | ChatEmpty | ChatForbidden): Promise<void> {
    const entity = await this.writeChat(chat);
    this.ctx.notify({ store: 'chats', kind: 'put', entities: [entity] });
  }

  async putChats(chats: Array<Chat | ChatEmpty | ChatForbidden>): Promise<void> {
    if (chats.length === 0) return;
    const entities: Array<Chat | ChatEmpty | ChatForbidden> = [];
    for (const chat of chats) {
      entities.push(await this.writeChat(chat));
    }
    this.ctx.notify({ store: 'chats', kind: 'put', entities });
  }

  async getChat(id: string): Promise<Chat | undefined> {
    const row = await this.ctx.idb.get<ChatPeerRow>(STORE.chats, id);
    return row?.entity;
  }

  async putChatFull(full: ChatFull): Promise<void> {
    const row: ChatFullRow = { id: full.id, entity: full, storedAt: Date.now() };
    void this.ctx.idb.putQueued(STORE.chatFull, row);
    this.ctx.notify({ store: 'chatFull', kind: 'put', entities: [full] });
  }

  async getChatFull(id: string): Promise<ChatFull | undefined> {
    const row = await this.ctx.idb.get<ChatFullRow>(STORE.chatFull, id);
    return row?.entity;
  }

  async invalidateChatFull(id: string): Promise<void> {
    void this.ctx.idb.deleteQueued(STORE.chatFull, id);
    this.ctx.notify({ store: 'chatFull', kind: 'invalidate', ids: [id] });
  }

  async deleteChat(id: string): Promise<void> {
    await this.ctx.idb.delete(STORE.chats, id);
    this.ctx.notify({ store: 'chats', kind: 'delete', ids: [id] });
  }

  private async writeChat(
    chat: Chat | ChatEmpty | ChatForbidden,
  ): Promise<Chat | ChatEmpty | ChatForbidden> {
    const local = await this.ctx.idb.get<ChatPeerRow>(STORE.chats, chat.id);
    const row = mergeChat(chat, local);
    void this.ctx.idb.putQueued(STORE.chats, row);
    return row.entity;
  }
}
