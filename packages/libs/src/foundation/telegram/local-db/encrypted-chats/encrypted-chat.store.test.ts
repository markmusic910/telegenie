import type { EncryptedChatWaiting } from '../../types/api-types';
import { openStoreHarness } from '../test-harness';
import { EncryptedChatStore } from './encrypted-chat.store';

function sampleWaiting(id = 7): EncryptedChatWaiting {
  return {
    id,
    accessHash: 'h',
    date: 1,
    adminId: '1',
    participantId: '2',
  };
}

describe('EncryptedChatStore', () => {
  let harness: Awaited<ReturnType<typeof openStoreHarness>>;
  let store: EncryptedChatStore;

  afterEach(async () => {
    if (harness) await harness.cleanup();
  });

  async function setup(): Promise<void> {
    harness = await openStoreHarness();
    store = new EncryptedChatStore(harness.ctx);
  }

  it('puts and gets an encrypted chat', async () => {
    await setup();
    await store.putEncryptedChat(sampleWaiting());
    await expect(store.getEncryptedChat('7')).resolves.toMatchObject({
      id: 7,
      accessHash: 'h',
    });
    await expect(store.getEncryptedChatRow('7')).resolves.toMatchObject({
      id: '7',
    });
  });

  it('putEncryptedChats batch', async () => {
    await setup();
    await store.putEncryptedChats([sampleWaiting(8), sampleWaiting(9)]);
    await expect(store.getEncryptedChat('8')).resolves.toMatchObject({ id: 8 });
    await expect(store.getEncryptedChat('9')).resolves.toMatchObject({ id: 9 });
  });

  it('does not notify on empty putEncryptedChats', async () => {
    await setup();
    await store.putEncryptedChats([]);
    expect(harness.changes).toHaveLength(0);
  });

  it('merges encrypted chat key fields', async () => {
    await setup();
    await store.putEncryptedChatKey('7', { dhPrivate: new Uint8Array([1]) });
    await store.putEncryptedChatKey('7', { authKey: new Uint8Array([2]), keyFingerprint: 'fp' });
    const row = await store.getEncryptedChatKey('7');
    expect(row?.dhPrivate).toEqual(new Uint8Array([1]));
    expect(row?.authKey).toEqual(new Uint8Array([2]));
    expect(row?.keyFingerprint).toBe('fp');
  });

  it('notifies on putEncryptedChat', async () => {
    await setup();
    await store.putEncryptedChat(sampleWaiting());
    expect(harness.changes).toHaveLength(1);
    expect(harness.changes[0]).toMatchObject({
      store: 'encryptedChats',
      kind: 'put',
      entities: [expect.objectContaining({ id: 7 })],
    });
  });
});
