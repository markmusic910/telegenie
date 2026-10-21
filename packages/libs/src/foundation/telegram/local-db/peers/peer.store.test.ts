import type { Channel, Chat } from '../../types/api-types';
import type { User } from '../../types/users';
import { ChannelStore } from '../channels/channel.store';
import { ChatStore } from '../chats/chat.store';
import { openStoreHarness } from '../test-harness';
import { UserStore } from '../users/user.store';
import { PeerStore } from './peer.store';

function sampleUser(overrides: Partial<User> = {}): User {
  return {
    id: '1',
    accessHash: 'hash-full',
    firstName: 'Ada',
    min: false,
    contact: true,
    ...overrides,
  } as User;
}

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

function sampleChat(overrides: Partial<Chat> = {}): Chat {
  return {
    id: '-10',
    title: 'Group',
    participantsCount: 2,
    date: 1,
    version: 1,
    ...overrides,
  };
}

describe('PeerStore', () => {
  let harness: Awaited<ReturnType<typeof openStoreHarness>>;
  let users: UserStore;
  let chats: ChatStore;
  let channels: ChannelStore;
  let store: PeerStore;

  afterEach(async () => {
    if (harness) await harness.cleanup();
  });

  async function setup(): Promise<void> {
    harness = await openStoreHarness();
    users = new UserStore(harness.ctx);
    chats = new ChatStore(harness.ctx);
    channels = new ChannelStore(harness.ctx);
    store = new PeerStore(harness.ctx, users, chats, channels);
  }

  it('resolves userFromMessage when only min context exists', async () => {
    await setup();
    await users.putUser(sampleUser({ min: true, accessHash: 'm', phone: '1' }));
    await store.putMinContext({ peerId: '1', seenInPeerId: '-10', msgId: 42 });
    await expect(store.resolveInputPeer('1')).resolves.toEqual({
      type: 'userFromMessage',
      userId: '1',
      seenInPeerId: '-10',
      msgId: 42,
    });
  });

  it('resolves unavailable user when min hash only', async () => {
    await setup();
    await users.putUser(sampleUser({ min: true, accessHash: 'm', phone: '1' }));
    await expect(store.resolveInputPeer('1')).resolves.toEqual({
      type: 'unavailable',
      peerId: '1',
    });
  });

  it('resolves full user access hash', async () => {
    await setup();
    await users.putUser(sampleUser());
    await expect(store.resolveInputPeer('1')).resolves.toEqual({
      type: 'user',
      userId: '1',
      accessHash: 'hash-full',
    });
  });

  it('resolves chat peer', async () => {
    await setup();
    await expect(store.resolveInputPeer('-10')).resolves.toEqual({ type: 'chat', chatId: '-10' });
  });

  it('resolves full channel access hash', async () => {
    await setup();
    await channels.putChannel(sampleChannel());
    await expect(store.resolveInputPeer('-1000000000123')).resolves.toEqual({
      type: 'channel',
      channelId: '-1000000000123',
      accessHash: 'ch-hash',
    });
  });

  it('resolves channelFromMessage when only min context exists', async () => {
    await setup();
    await channels.putChannel(sampleChannel({ min: true, accessHash: 'mh' }));
    await store.putMinContext({
      peerId: '-1000000000123',
      seenInPeerId: '-10',
      msgId: 5,
    });
    await expect(store.resolveInputPeer('-1000000000123')).resolves.toEqual({
      type: 'channelFromMessage',
      channelId: '-1000000000123',
      seenInPeerId: '-10',
      msgId: 5,
    });
  });

  it('resolves unavailable channel when min hash only', async () => {
    await setup();
    await channels.putChannel(sampleChannel({ min: true, accessHash: 'mh' }));
    await expect(store.resolveInputPeer('-1000000000123')).resolves.toEqual({
      type: 'unavailable',
      peerId: '-1000000000123',
    });
  });

  it('getPeer routes by entity type', async () => {
    await setup();
    await users.putUser(sampleUser());
    await chats.putChat(sampleChat());
    await channels.putChannel(sampleChannel());
    await expect(store.getPeer('1')).resolves.toMatchObject({ firstName: 'Ada' });
    await expect(store.getPeer('-10')).resolves.toMatchObject({ title: 'Group' });
    await expect(store.getPeer('-1000000000123')).resolves.toMatchObject({ title: 'Chan' });
  });

  it('stores and reads min context', async () => {
    await setup();
    await store.putMinContext({ peerId: '1', seenInPeerId: '-10', msgId: 42 });
    await expect(store.getMinContext('1')).resolves.toMatchObject({
      peerId: '1',
      seenInPeerId: '-10',
      msgId: 42,
    });
  });
});
