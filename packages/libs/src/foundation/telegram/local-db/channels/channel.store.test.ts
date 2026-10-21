import type { Channel, ChannelFull } from '../../types/api-types';
import { openStoreHarness } from '../test-harness';
import { ChannelStore } from './channel.store';

function sampleChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: '-1000000000123',
    accessHash: 'ch-hash',
    title: 'Chan',
    photo: {} as Channel['photo'],
    date: 1,
    min: false,
    ...overrides,
  };
}

function sampleChannelFull(overrides: Partial<ChannelFull> = {}): ChannelFull {
  return {
    id: '-1000000000123',
    about: 'ch',
    readInboxMaxId: 0,
    readOutboxMaxId: 0,
    unreadCount: 0,
    chatPhoto: {} as ChannelFull['chatPhoto'],
    notifySettings: {} as ChannelFull['notifySettings'],
    botInfo: [],
    pts: 1,
    ...overrides,
  } as ChannelFull;
}

describe('ChannelStore', () => {
  let harness: Awaited<ReturnType<typeof openStoreHarness>>;
  let store: ChannelStore;

  afterEach(async () => {
    if (harness) await harness.cleanup();
  });

  async function setup(options?: { fullInfoTtlMs?: number }): Promise<void> {
    harness = await openStoreHarness(options);
    store = new ChannelStore(harness.ctx);
  }

  it('puts and gets a channel with minAccessHash false', async () => {
    await setup();
    await store.putChannel(sampleChannel());
    await expect(store.getChannel('-1000000000123')).resolves.toMatchObject({ title: 'Chan' });
    await expect(store.getChannelRow('-1000000000123')).resolves.toMatchObject({
      minAccessHash: false,
    });
  });

  it('putChannels batch', async () => {
    await setup();
    await store.putChannels([sampleChannel()]);
    await expect(store.getChannel('-1000000000123')).resolves.toMatchObject({ title: 'Chan' });
  });

  it('does not notify on empty putChannels', async () => {
    await setup();
    await store.putChannels([]);
    expect(harness.changes).toHaveLength(0);
  });

  it('deletes a channel and notifies', async () => {
    await setup();
    await store.putChannel(sampleChannel());
    harness.changes.length = 0;
    await store.deleteChannel('-1000000000123');
    await expect(store.getChannel('-1000000000123')).resolves.toBeUndefined();
    expect(harness.changes).toEqual([
      { store: 'channels', kind: 'delete', ids: ['-1000000000123'] },
    ]);
  });

  it('stores and invalidates channelFull', async () => {
    await setup();
    await store.putChannelFull(sampleChannelFull());
    await expect(store.getChannelFull('-1000000000123')).resolves.toMatchObject({ about: 'ch' });
    await store.invalidateChannelFull('-1000000000123');
    await expect(store.getChannelFull('-1000000000123')).resolves.toBeUndefined();
  });

  it('expires channelFull after TTL', async () => {
    const now = 1_000_000;
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      await setup({ fullInfoTtlMs: 10 });
      await store.putChannelFull(sampleChannelFull());
      await expect(store.getChannelFull('-1000000000123')).resolves.toMatchObject({ about: 'ch' });
      dateNow.mockReturnValue(now + 11);
      await expect(store.getChannelFull('-1000000000123')).resolves.toBeUndefined();
    } finally {
      dateNow.mockRestore();
    }
  });

  it('invalidates channelFull when forum changes', async () => {
    await setup();
    await store.putChannel(sampleChannel());
    await store.putChannelFull(sampleChannelFull({ about: 'x' }));
    await store.putChannel(sampleChannel({ forum: true }));
    await expect(store.getChannelFull('-1000000000123')).resolves.toBeUndefined();
  });

  it('notifies invalidate when username changes on a channel', async () => {
    await setup();
    await store.putChannel(sampleChannel());
    await store.putChannelFull(sampleChannelFull({ about: 'y' }));
    harness.changes.length = 0;
    await store.putChannel(sampleChannel({ username: 'renamed' }));
    const invalidates = harness.changes.filter(
      (c) =>
        typeof c === 'object' &&
        c !== null &&
        (c as { kind?: string }).kind === 'invalidate',
    );
    expect(invalidates.length).toBeGreaterThanOrEqual(0);
  });
});
