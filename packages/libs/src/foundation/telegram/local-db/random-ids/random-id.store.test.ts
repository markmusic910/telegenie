import { openStoreHarness } from '../test-harness';
import { RandomIdStore } from './random-id.store';

describe('RandomIdStore', () => {
  let harness: Awaited<ReturnType<typeof openStoreHarness>>;
  let store: RandomIdStore;

  afterEach(async () => {
    if (harness) await harness.cleanup();
  });

  async function setup(): Promise<void> {
    harness = await openStoreHarness();
    store = new RandomIdStore(harness.ctx);
  }

  it('randomId pending then bind and delete', async () => {
    await setup();
    await store.putPendingRandomId('99', '1');
    await store.bindRandomId('99', 7);
    await expect(store.getRandomId('99')).resolves.toMatchObject({
      randomId: '99',
      peerId: '1',
      messageId: 7,
    });
    await store.bindRandomId('orphan', 3);
    await expect(store.getRandomId('orphan')).resolves.toMatchObject({
      messageId: 3,
      peerId: '',
    });
    await store.deleteRandomId('99');
    await expect(store.getRandomId('99')).resolves.toBeUndefined();
  });
});
