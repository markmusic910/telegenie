import { openStoreHarness } from '../test-harness';
import { FileRefStore } from './file-ref.store';

describe('FileRefStore', () => {
  let harness: Awaited<ReturnType<typeof openStoreHarness>>;
  let store: FileRefStore;

  afterEach(async () => {
    if (harness) await harness.cleanup();
  });

  async function setup(): Promise<void> {
    harness = await openStoreHarness();
    store = new FileRefStore(harness.ctx);
  }

  it('puts and gets a file reference', async () => {
    await setup();
    await store.putFileRef({
      fileId: 'd:99',
      kind: 'document',
      id: '99',
      fileReference: 'aGk=',
    });
    await expect(store.getFileRef('d:99')).resolves.toMatchObject({
      fileId: 'd:99',
      kind: 'document',
      fileReference: 'aGk=',
    });
    await store.deleteFileRef('d:99');
    await expect(store.getFileRef('d:99')).resolves.toBeUndefined();
  });

  it('upserts one source per kind and lists by fileId', async () => {
    await setup();
    await store.putFileSource({
      fileId: 'd:1',
      source: { kind: 'fileSourceMessage', peer: '5', id: 10 },
    });
    await store.putFileSource({
      fileId: 'd:1',
      source: { kind: 'fileSourceWebPage', url: 'https://t.me' },
    });
    await store.putFileSource({
      fileId: 'd:1',
      source: { kind: 'fileSourceMessage', peer: '5', id: 11 },
    });
    const rows = await store.getFileSources('d:1');
    expect(rows).toHaveLength(2);
    const message = rows.find((r) => r.sourceKind === 'fileSourceMessage');
    expect(message?.source).toMatchObject({ id: 11 });
    await store.deleteFileSources('d:1');
    await expect(store.getFileSources('d:1')).resolves.toEqual([]);
  });
});
