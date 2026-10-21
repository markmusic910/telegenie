import { openStoreHarness } from '../test-harness';
import { UpdateStateStore } from './update-state.store';

describe('UpdateStateStore', () => {
  let harness: Awaited<ReturnType<typeof openStoreHarness>>;
  let store: UpdateStateStore;

  afterEach(async () => {
    if (harness) await harness.cleanup();
  });

  async function setup(): Promise<void> {
    harness = await openStoreHarness();
    store = new UpdateStateStore(harness.ctx);
  }

  it('applyCommonPts apply/skip/gap and empty initial state', async () => {
    await setup();
    await expect(store.applyCommonPts(1, 1)).resolves.toBe('apply');
    await expect(store.getCommonState()).resolves.toMatchObject({ pts: 1 });
    await store.setCommonState({ pts: 10, qts: 0, seq: 0, date: 0 });
    await expect(store.applyCommonPts(11, 1)).resolves.toBe('apply');
    await expect(store.applyCommonPts(11, 1)).resolves.toBe('skip');
    await expect(store.applyCommonPts(20, 1)).resolves.toBe('gap');
  });

  it('applyQts and applySeq branches', async () => {
    await setup();
    await expect(store.applyQts(1)).resolves.toBe('apply');
    await expect(store.getCommonState()).resolves.toMatchObject({ qts: 1 });
    await expect(store.applyQts(1)).resolves.toBe('skip');
    await expect(store.applyQts(5)).resolves.toBe('gap');

    await store.setCommonState({ pts: 0, qts: 1, seq: 3, date: 0 });
    await expect(store.applySeq(0, 0, 9)).resolves.toBe('apply');
    await expect(store.getCommonState()).resolves.toMatchObject({ seq: 3, date: 9 });
    await expect(store.applySeq(0, 8, 10)).resolves.toBe('apply');
    await expect(store.getCommonState()).resolves.toMatchObject({ seq: 8, date: 10 });

    await store.setCommonState({ pts: 0, qts: 1, seq: 5, date: 0 });
    await expect(store.applySeq(6, 6, 1)).resolves.toBe('apply');
    await expect(store.applySeq(5, 5, 1)).resolves.toBe('skip');
    await expect(store.applySeq(10, 10, 1)).resolves.toBe('gap');
  });

  it('applyChannelPts and set/get', async () => {
    await setup();
    await expect(store.applyChannelPts('-1000000000123', 1, 1)).resolves.toBe('apply');
    await store.setChannelPts('-1000000000123', 5);
    await expect(store.applyChannelPts('-1000000000123', 6, 1)).resolves.toBe('apply');
    await expect(store.getChannelPts('-1000000000123')).resolves.toBe(6);
  });

  it('seedChannelPts writes only when missing or zero', async () => {
    await setup();
    await store.seedChannelPts('-1000000000123', 0);
    await expect(store.getChannelPts('-1000000000123')).resolves.toBeUndefined();
    await store.seedChannelPts('-1000000000123', 9);
    await expect(store.getChannelPts('-1000000000123')).resolves.toBe(9);
    await store.seedChannelPts('-1000000000123', 3);
    await expect(store.getChannelPts('-1000000000123')).resolves.toBe(9);
  });

  it('getMeta and setMeta', async () => {
    await setup();
    await store.setMeta('dhConfig', { p: 1 });
    await expect(store.getMeta('dhConfig')).resolves.toEqual({ p: 1 });
    await expect(store.getMeta('missing')).resolves.toBeUndefined();
  });
});
