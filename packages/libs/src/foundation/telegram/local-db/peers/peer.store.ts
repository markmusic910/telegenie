import { getEntityTypeById } from '../../helpers/peer-id.helper';
import type { Channel, Chat } from '../../types/api-types';
import type { User } from '../../types/users';
import { STORE } from '../constants';
import type { LocalDbContext } from '../context';
import type { ChannelStore } from '../channels/channel.store';
import type { ChatStore } from '../chats/chat.store';
import type { MinContextRow, ResolvedInputPeer } from '../types';
import type { UserStore } from '../users/user.store';

export class PeerStore {
  constructor(
    private readonly ctx: LocalDbContext,
    private readonly users: UserStore,
    private readonly chats: ChatStore,
    private readonly channels: ChannelStore,
  ) {}

  async putMinContext(input: {
    peerId: string;
    seenInPeerId: string;
    msgId: number;
  }): Promise<void> {
    const row: MinContextRow = {
      ...input,
      updatedAt: Date.now(),
    };
    void this.ctx.idb.putQueued(STORE.minContexts, row);
  }

  async getMinContext(peerId: string): Promise<MinContextRow | undefined> {
    return this.ctx.idb.get<MinContextRow>(STORE.minContexts, peerId);
  }

  async getPeer(id: string): Promise<User | Chat | Channel | undefined> {
    const type = getEntityTypeById(id);
    if (type === 'user') return this.users.getUser(id);
    if (type === 'chat') return this.chats.getChat(id);
    return this.channels.getChannel(id);
  }

  async resolveInputPeer(peerId: string): Promise<ResolvedInputPeer> {
    const type = getEntityTypeById(peerId);

    if (type === 'chat') {
      return { type: 'chat', chatId: peerId };
    }

    if (type === 'user') {
      const row = await this.users.getUserRow(peerId);
      if (row?.entity.accessHash && !row.minAccessHash) {
        return { type: 'user', userId: peerId, accessHash: row.entity.accessHash };
      }
      const minCtx = await this.getMinContext(peerId);
      if (minCtx) {
        return {
          type: 'userFromMessage',
          userId: peerId,
          seenInPeerId: minCtx.seenInPeerId,
          msgId: minCtx.msgId,
        };
      }
      return { type: 'unavailable', peerId };
    }

    const row = await this.channels.getChannelRow(peerId);
    if (row?.entity.accessHash && !row.minAccessHash) {
      return { type: 'channel', channelId: peerId, accessHash: row.entity.accessHash };
    }
    const minCtx = await this.getMinContext(peerId);
    if (minCtx) {
      return {
        type: 'channelFromMessage',
        channelId: peerId,
        seenInPeerId: minCtx.seenInPeerId,
        msgId: minCtx.msgId,
      };
    }
    return { type: 'unavailable', peerId };
  }
}
