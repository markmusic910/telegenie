import { openStoreHarness } from '../test-harness';
import { MsgIdRangeStore } from './msg-id-range.store';

describe('MsgIdRangeStore', () => {
  let harness: Awaited<ReturnType<typeof openStoreHarness>>;
  let store: MsgIdRangeStore;

  afterEach(async () => {
    if (harness) await harness.cleanup();
  });

  async function setup(): Promise<void> {
    harness = await openStoreHarness();
    store = new MsgIdRangeStore(harness.ctx);
  }

  it('noteMessageId builds ranges; pending after unfillable gap', async () => {
    await setup();
    await store.noteMessageId('common', 1);
    await store.noteMessageId('common', 2);
    await expect(store.containsMsgId('common', 2)).resolves.toBe(true);
    await expect(store.containsMsgId('missing', 1)).resolves.toBe(false);
    await store.markMsgIdGapUnfillable('common');
    await store.markMsgIdGapUnfillable('new-box');
    await store.noteMessageId('common', 100);
    const box = await store.getMsgIdRanges('common');
    expect(box?.pending).toBe(false);
    expect(box?.ranges.some((r) => r.start === 100)).toBe(true);
  });

  it('findGapInDisplayedRange and extendRangesFromFetchedIds', async () => {
    await setup();
    await expect(store.findGapInDisplayedRange('common', 1, 5)).resolves.toEqual([1, 5]);
    await store.extendRangesFromFetchedIds('common', [1, 2, 3]);
    await expect(store.findGapInDisplayedRange('common', 1, 5)).resolves.toEqual([4, 5]);
    await expect(store.containsMsgId('common', 2)).resolves.toBe(true);
  });

  it('extendRangesFromSpan', async () => {
    await setup();
    await store.extendRangesFromSpan('chan', 25, 75);
    await expect(store.findGapInDisplayedRange('chan', 25, 75)).resolves.toBeNull();
  });

  it('msgIdBoxForPeer uses common for user/chat and peer id for channel', () => {
    expect(MsgIdRangeStore.msgIdBoxForPeer('1')).toBe('common');
    expect(MsgIdRangeStore.msgIdBoxForPeer('-10')).toBe('common');
    expect(MsgIdRangeStore.msgIdBoxForPeer('-1000000000123')).toBe('-1000000000123');
  });
});
