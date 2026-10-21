import type { Chat, ChatFull } from '../../types/api-types';
import { openStoreHarness } from '../test-harness';
import { ChatStore } from './chat.store';

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

function sampleChatFull(overrides: Partial<ChatFull> = {}): ChatFull {
  return {
    id: '-10',
    about: 'about',
    participants: {} as ChatFull['participants'],
    notifySettings: {} as ChatFull['notifySettings'],
    ...overrides,
  } as ChatFull;
}

describe('ChatStore', () => {
  let harness: Awaited<ReturnType<typeof openStoreHarness>>;
  let store: ChatStore;

  afterEach(async () => {
    if (harness) await harness.cleanup();
  });

  async function setup(): Promise<void> {
    harness = await openStoreHarness();
    store = new ChatStore(harness.ctx);
  }

  it('puts and gets a chat', async () => {
    await setup();
    await store.putChat(sampleChat());
    await expect(store.getChat('-10')).resolves.toMatchObject({ title: 'Group' });
  });

  it('putChats batch', async () => {
    await setup();
    await store.putChats([sampleChat()]);
    await expect(store.getChat('-10')).resolves.toMatchObject({ title: 'Group' });
  });

  it('does not notify on empty putChats', async () => {
    await setup();
    await store.putChats([]);
    expect(harness.changes).toHaveLength(0);
  });

  it('stores and invalidates chatFull', async () => {
    await setup();
    await store.putChatFull(sampleChatFull());
    await expect(store.getChatFull('-10')).resolves.toMatchObject({ about: 'about' });
    await store.invalidateChatFull('-10');
    await expect(store.getChatFull('-10')).resolves.toBeUndefined();
  });

  it('deletes a chat and notifies', async () => {
    await setup();
    await store.putChat(sampleChat());
    harness.changes.length = 0;
    await store.deleteChat('-10');
    await expect(store.getChat('-10')).resolves.toBeUndefined();
    expect(harness.changes).toEqual([
      { store: 'chats', kind: 'delete', ids: ['-10'] },
    ]);
  });

  it('notifies on putChat', async () => {
    await setup();
    await store.putChat(sampleChat());
    expect(harness.changes).toHaveLength(1);
    expect(harness.changes[0]).toMatchObject({
      store: 'chats',
      kind: 'put',
      entities: [expect.objectContaining({ id: '-10' })],
    });
  });
});
