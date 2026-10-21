import type { TypeEncryptedChat } from '../../types/api-types';
import { STORE } from '../constants';
import type { LocalDbContext } from '../context';
import type { EncryptedChatKeyRow, EncryptedChatPeerRow } from '../types';
import { mergeEncryptedChat } from './merge-encrypted-chat';

export class EncryptedChatStore {
  constructor(private readonly ctx: LocalDbContext) {}

  async putEncryptedChat(chat: TypeEncryptedChat): Promise<void> {
    const entity = await this.writeEncryptedChat(chat);
    this.ctx.notify({ store: 'encryptedChats', kind: 'put', entities: [entity] });
  }

  async putEncryptedChats(chats: TypeEncryptedChat[]): Promise<void> {
    if (chats.length === 0) return;
    const entities: TypeEncryptedChat[] = [];
    for (const chat of chats) {
      entities.push(await this.writeEncryptedChat(chat));
    }
    this.ctx.notify({ store: 'encryptedChats', kind: 'put', entities });
  }

  async getEncryptedChat(id: string): Promise<TypeEncryptedChat | undefined> {
    const row = await this.ctx.idb.get<EncryptedChatPeerRow>(STORE.encryptedChats, id);
    return row?.entity;
  }

  async getEncryptedChatRow(id: string): Promise<EncryptedChatPeerRow | undefined> {
    return this.ctx.idb.get<EncryptedChatPeerRow>(STORE.encryptedChats, id);
  }

  async putEncryptedChatKey(
    id: string,
    key: Pick<EncryptedChatKeyRow, 'dhPrivate' | 'authKey' | 'keyFingerprint'>,
  ): Promise<void> {
    const existing = await this.ctx.idb.get<EncryptedChatKeyRow>(STORE.encryptedChatKeys, id);
    const row: EncryptedChatKeyRow = {
      id,
      dhPrivate: key.dhPrivate ?? existing?.dhPrivate,
      authKey: key.authKey ?? existing?.authKey,
      keyFingerprint: key.keyFingerprint ?? existing?.keyFingerprint,
      updatedAt: Date.now(),
    };
    void this.ctx.idb.putQueued(STORE.encryptedChatKeys, row);
  }

  async getEncryptedChatKey(id: string): Promise<EncryptedChatKeyRow | undefined> {
    return this.ctx.idb.get<EncryptedChatKeyRow>(STORE.encryptedChatKeys, id);
  }

  private async writeEncryptedChat(chat: TypeEncryptedChat): Promise<TypeEncryptedChat> {
    const id = String(chat.id);
    const local = await this.ctx.idb.get<EncryptedChatPeerRow>(STORE.encryptedChats, id);
    const row = mergeEncryptedChat(chat, local);
    void this.ctx.idb.putQueued(STORE.encryptedChats, row);
    return row.entity;
  }
}
