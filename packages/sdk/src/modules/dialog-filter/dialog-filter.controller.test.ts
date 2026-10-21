import type { FolderFilter } from '@telegenie/libs/foundation/telegram/services/converters/dialog-filter.converter';
import type { TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';
import { GlobalStore } from '../../store';
import { EntityDataProvider } from '../../store/entity/entity.data-provider';
import EntityStore from '../../store/entity/entity.store';
import { DialogFilterModel } from '../../store/entity/models/dialog-filter.model';
import StoreManager from '../../store/store.manager';
import { MODEL_TYPE, type DialogFilterEntity } from '../../store/types';
import { ALL_CHATS_FOLDER_ID } from './dialog-filter.constants';
import { DialogFilterController } from './dialog-filter.controller';

function serverFilter(id: number, overrides: Partial<FolderFilter> = {}): FolderFilter {
  return {
    id,
    title: `Folder ${id}`,
    isChatlist: false,
    pinnedPeerIds: [],
    includePeerIds: [],
    excludePeerIds: [],
    ...overrides,
  };
}

function createModule(
  getAll: FolderFilter[] = [],
  order: number[] = getAll.map((f) => f.id),
) {
  const sm = new StoreManager();
  sm.set(
    'dialogFilter',
    new EntityStore<DialogFilterModel, DialogFilterEntity>({
      model: DialogFilterModel,
      type: MODEL_TYPE.ENTITY_MODEL,
      dataProvider: new EntityDataProvider({ fetcher: async () => [] }),
    }),
  );
  const globalStore = new GlobalStore();
  const call = jest.fn().mockImplementation(async (method: string) => {
    if (method === 'dialogFilter.getAll') return { filters: getAll, order };
    return undefined;
  });
  const worker = { call } as unknown as TelegramWorkerClient;
  return {
    module: new DialogFilterController({ sm, globalStore, worker }),
    sm,
    globalStore,
    call,
  };
}

describe('DialogFilterController.seedDefaults', () => {
  it('stores All Chats and leads the rail with it', () => {
    const { module, sm, globalStore } = createModule();
    module.seedDefaults();

    expect([...sm.get('dialogFilter').getAllData().keys()]).toEqual([ALL_CHATS_FOLDER_ID]);
    expect(globalStore.nav.sortedFolderIds).toEqual([ALL_CHATS_FOLDER_ID]);
  });

  it('is idempotent', () => {
    const { module, sm } = createModule();
    module.seedDefaults();
    module.seedDefaults();
    expect(sm.get('dialogFilter').getSize()).toBe(1);
  });
});

describe('DialogFilterController.getAll', () => {
  it('converts server folders and appends them after All Chats', async () => {
    const { module, globalStore, sm } = createModule(
      [serverFilter(0), serverFilter(3, { groups: true }), serverFilter(2)],
      [0, 3, 2],
    );
    module.seedDefaults();
    await module.getAll();

    expect(globalStore.nav.sortedFolderIds).toEqual([ALL_CHATS_FOLDER_ID, '3', '2']);
    expect(sm.get('dialogFilter').getAllData().get('3')?.groups).toBe(true);
    expect(sm.get('dialogFilter').getAllData().get(ALL_CHATS_FOLDER_ID)?.isDefault).toBe(true);
  });

  it('drops server folders that disappeared', async () => {
    const { module, sm, globalStore } = createModule([serverFilter(0)], [0]);
    module.seedDefaults();
    sm.get('dialogFilter').update([
      new DialogFilterModel({
        id: '9',
        folderId: 9,
        title: 'Gone',
        isDefault: false,
        isLocal: false,
        isChatlist: false,
        pinnedPeerIds: [],
        includePeerIds: [],
        excludePeerIds: [],
      }),
    ]);

    await module.getAll();

    expect(sm.get('dialogFilter').getAllData().has('9')).toBe(false);
    expect(globalStore.nav.sortedFolderIds).not.toContain('9');
  });

  it('applies server order on refetch', async () => {
    const { module, globalStore } = createModule(
      [serverFilter(0), serverFilter(2), serverFilter(3)],
      [0, 2, 3],
    );
    module.seedDefaults();
    await module.getAll();
    globalStore.nav.setSortedFolderIds([ALL_CHATS_FOLDER_ID, '3', '2']);

    await module.getAll();

    expect(globalStore.nav.sortedFolderIds).toEqual([ALL_CHATS_FOLDER_ID, '2', '3']);
  });
});

describe('DialogFilterController.reorder', () => {
  it('sends server folder ids in order', async () => {
    const { module, globalStore, call } = createModule([serverFilter(0), serverFilter(2)], [0, 2]);
    module.seedDefaults();
    await module.getAll();

    const next = [ALL_CHATS_FOLDER_ID, '2'];
    await module.reorder(next);

    expect(globalStore.nav.sortedFolderIds).toEqual(next);
    expect(call).toHaveBeenLastCalledWith('dialogFilter.reorder', [[0, 2]]);
  });

  it('restores the previous order when the RPC fails', async () => {
    const { module, globalStore, call } = createModule([serverFilter(0)], [0]);
    module.seedDefaults();
    const previous = [...globalStore.nav.sortedFolderIds];
    call.mockRejectedValueOnce(new Error('NETWORK'));

    const result = await module.reorder([ALL_CHATS_FOLDER_ID]);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONTROLLER_ERROR', message: 'NETWORK' },
    });
    expect(globalStore.nav.sortedFolderIds).toEqual(previous);
  });
});

describe('DialogFilterController.applyUpdate', () => {
  it('adds a new folder to the store and the rail', () => {
    const { module, sm, globalStore } = createModule();
    module.seedDefaults();

    module.applyUpdate({ type: 'dialogFilter.put', id: 4, filter: serverFilter(4) });

    expect(sm.get('dialogFilter').getAllData().get('4')?.title).toBe('Folder 4');
    expect(globalStore.nav.sortedFolderIds).toContain('4');
  });

  it('removes a deleted folder and falls back to All Chats when it was selected', () => {
    const { module, sm, globalStore } = createModule();
    module.seedDefaults();
    module.applyUpdate({ type: 'dialogFilter.put', id: 4, filter: serverFilter(4) });
    globalStore.nav.setSelectedFolderId('4');

    module.applyUpdate({ type: 'dialogFilter.delete', id: 4 });

    expect(sm.get('dialogFilter').getAllData().has('4')).toBe(false);
    expect(globalStore.nav.sortedFolderIds).not.toContain('4');
    expect(globalStore.nav.selectedFolderId).toBe(ALL_CHATS_FOLDER_ID);
  });

  it('reorders on a server order update', () => {
    const { module, globalStore } = createModule();
    module.seedDefaults();
    module.applyUpdate({ type: 'dialogFilter.put', id: 4, filter: serverFilter(4) });
    module.applyUpdate({ type: 'dialogFilter.put', id: 5, filter: serverFilter(5) });
    globalStore.nav.setSortedFolderIds([ALL_CHATS_FOLDER_ID]);

    module.applyUpdate({ type: 'dialogFilter.order', order: [0, 5, 4] });

    expect(globalStore.nav.sortedFolderIds).toEqual([ALL_CHATS_FOLDER_ID, '5', '4']);
  });

  it('refetches on a wholesale reload', async () => {
    const { module, call } = createModule([serverFilter(0)], [0]);
    module.seedDefaults();

    module.applyUpdate({ type: 'dialogFilter.reload' });
    await Promise.resolve();

    expect(call).toHaveBeenCalledWith('dialogFilter.getAll', []);
  });
});

describe('DialogFilterController.selectFolder', () => {
  it('updates nav.selectedFolderId', () => {
    const { module, globalStore } = createModule();
    module.seedDefaults();
    module.applyUpdate({ type: 'dialogFilter.put', id: 4, filter: serverFilter(4) });

    module.selectFolder('4');

    expect(globalStore.nav.selectedFolderId).toBe('4');
  });
});
