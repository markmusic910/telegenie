import type { Channel, ChannelForbidden, ChannelFull } from '../../types/api-types';
import { STORE } from '../constants';
import type { LocalDbContext } from '../context';
import { getFullWithTtl } from '../context';
import type { ChannelFullRow, ChannelPeerRow } from '../types';
import { mergeChannel } from './merge-channel';

export class ChannelStore {
  constructor(private readonly ctx: LocalDbContext) {}

  async putChannel(channel: Channel | ChannelForbidden): Promise<void> {
    const entity = await this.writeChannel(channel);
    this.ctx.notify({ store: 'channels', kind: 'put', entities: [entity] });
  }

  async putChannels(channels: Array<Channel | ChannelForbidden>): Promise<void> {
    if (channels.length === 0) return;
    const entities: Array<Channel | ChannelForbidden> = [];
    for (const channel of channels) {
      entities.push(await this.writeChannel(channel));
    }
    this.ctx.notify({ store: 'channels', kind: 'put', entities });
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    const row = await this.ctx.idb.get<ChannelPeerRow>(STORE.channels, id);
    return row?.entity;
  }

  async getChannelRow(id: string): Promise<ChannelPeerRow | undefined> {
    return this.ctx.idb.get<ChannelPeerRow>(STORE.channels, id);
  }

  async putChannelFull(full: ChannelFull): Promise<void> {
    const row: ChannelFullRow = { id: full.id, entity: full, storedAt: Date.now() };
    void this.ctx.idb.putQueued(STORE.channelFull, row);
    this.ctx.notify({ store: 'channelFull', kind: 'put', entities: [full] });
  }

  async getChannelFull(id: string): Promise<ChannelFull | undefined> {
    return getFullWithTtl(this.ctx, STORE.channelFull, id);
  }

  async invalidateChannelFull(id: string): Promise<void> {
    void this.ctx.idb.deleteQueued(STORE.channelFull, id);
    this.ctx.notify({ store: 'channelFull', kind: 'invalidate', ids: [id] });
  }

  async deleteChannel(id: string): Promise<void> {
    await this.ctx.idb.delete(STORE.channels, id);
    this.ctx.notify({ store: 'channels', kind: 'delete', ids: [id] });
  }

  private async writeChannel(
    channel: Channel | ChannelForbidden,
  ): Promise<Channel | ChannelForbidden> {
    const local = await this.ctx.idb.get<ChannelPeerRow>(STORE.channels, channel.id);
    const { row, invalidateFull } = mergeChannel(channel, local);
    void this.ctx.idb.putQueued(STORE.channels, row);
    if (invalidateFull) {
      await this.invalidateChannelFull(channel.id);
    }
    return row.entity;
  }
}
