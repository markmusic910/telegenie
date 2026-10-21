import { EntityDataProvider } from '../../store/entity/entity.data-provider';
import EntityStore from '../../store/entity/entity.store';
import { CustomEmojiDocument } from '../../store/entity/models/custom-emoji.model';
import { GlobalStore } from '../../store/global/global.store';
import { FEATURED_SETS_TTL_MS } from '../../store/global/models/stickers.state';
import StoreManager from '../../store/store.manager';
import { MODEL_TYPE, type CustomEmojiDocumentEntity } from '../../store/types';
import { StickerController } from './sticker.controller';

function document(id: string): CustomEmojiDocumentEntity {
  return {
    id,
    accessHash: '1',
    fileReference: '',
    date: 1,
    mimeType: 'application/x-tgsticker',
    size: '1',
    dcId: 2,
    attributes: [],
  };
}

function createHarness(options?: {
  loadCachedDocuments?: (ids: string[]) => Promise<CustomEmojiDocumentEntity[]>;
  call?: jest.Mock;
}) {
  const sm = new StoreManager();
  const globalStore = new GlobalStore(sm);
  const call =
    options?.call ??
    jest.fn(async (_method: string, args: [string[]]) => args[0].map((id) => document(id)));
  const controller = new StickerController({
    sm,
    globalStore,
    worker: { call } as never,
    loadCachedDocuments: options?.loadCachedDocuments ?? (async () => []),
  });
  const store = new EntityStore<CustomEmojiDocument, CustomEmojiDocumentEntity>({
    model: CustomEmojiDocument,
    type: MODEL_TYPE.ENTITY_MODEL,
    dataProvider: new EntityDataProvider({
      debounceTime: 200,
      fetcher: async (ids) => {
        await controller.ensureCustomEmojiDocuments(ids);
        return [];
      },
    }),
  });
  sm.set('customEmoji', store);
  return { sm, store, globalStore, call, controller };
}

describe('StickerController custom emoji documents', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a remembered document in memory and does not call Telegram', async () => {
    const { store, call, controller } = createHarness();
    controller.rememberCustomEmoji([document('9')]);
    store.get('9');
    await jest.advanceTimersByTimeAsync(200);
    expect(call).not.toHaveBeenCalled();
    expect(store.getAllData().get('9')?.mimeType).toBe('application/x-tgsticker');
  });

  it('hydrates IndexedDB hits and skips Telegram', async () => {
    const loadCachedDocuments = jest.fn(async (ids: string[]) => ids.map((id) => document(id)));
    const { store, call } = createHarness({ loadCachedDocuments });
    store.get('4');
    await jest.advanceTimersByTimeAsync(200);
    expect(loadCachedDocuments).toHaveBeenCalledWith(['4']);
    expect(call).not.toHaveBeenCalled();
    expect(store.getAllData().get('4')?.accessHash).toBe('1');
  });

  it('requests at most 100 missing ids, then the rest 200ms later', async () => {
    const { store, call } = createHarness();
    for (let index = 1; index <= 101; index += 1) {
      store.get(String(index));
    }
    await jest.advanceTimersByTimeAsync(200);
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0]?.[0]).toBe('sticker.getCustomEmojiDocuments');
    expect(call.mock.calls[0]?.[1]?.[0]).toHaveLength(100);

    await jest.advanceTimersByTimeAsync(200);
    expect(call).toHaveBeenCalledTimes(2);
    expect(call.mock.calls[1]?.[1]?.[0]).toEqual(['101']);
  });
});

describe('StickerController featured sets', () => {
  const duck = { id: '9', accessHash: '1', title: 'Duck' };

  it('returns a fresh cache and does not call Telegram', async () => {
    const { controller, globalStore, call } = createHarness();
    const fetchedAt = Date.now();
    globalStore.stickers.rememberFeatured('emoji', [duck], fetchedAt);

    await expect(controller.getFeaturedSets('emoji')).resolves.toEqual([duck]);
    expect(call).not.toHaveBeenCalled();
    expect(globalStore.toJS().app).toMatchObject({
      stickers: { emoji: { sets: [duck], fetchedAt } },
    });
  });

  it('loads Telegram when the cache is missing and stores it for 7 days', async () => {
    const call = jest.fn(async () => [duck]);
    const { controller, globalStore } = createHarness({ call });

    await expect(controller.getFeaturedSets('emoji')).resolves.toEqual([duck]);
    expect(call).toHaveBeenCalledWith('sticker.getFeaturedSets', ['emoji']);

    const restored = new GlobalStore();
    restored.hydrateAppSnapshot(globalStore.toJS().app as Record<string, unknown>);
    expect(restored.stickers.freshFeatured('emoji')).toEqual([duck]);
    expect(
      restored.stickers.freshFeatured('emoji', Date.now() + FEATURED_SETS_TTL_MS),
    ).toBeUndefined();
  });

  it('reloads Telegram after the 7 day cache expires', async () => {
    const call = jest.fn(async () => [{ ...duck, title: 'Duck 2' }]);
    const { controller, globalStore } = createHarness({ call });
    globalStore.stickers.rememberFeatured('emoji', [duck], Date.now() - FEATURED_SETS_TTL_MS);

    await expect(controller.getFeaturedSets('emoji')).resolves.toEqual([
      { ...duck, title: 'Duck 2' },
    ]);
    expect(call).toHaveBeenCalledTimes(1);
    expect(globalStore.stickers.freshFeatured('emoji')).toEqual([{ ...duck, title: 'Duck 2' }]);
  });
});
