import GlobalStore from '../../store/global/global.store';
import StoreManager from '../../store/store.manager';
import { DialogInfoController } from './dialog-info.controller';

describe('DialogInfoController', () => {
  it('opens channel and chat overlays on the middle stack', () => {
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    const worker = { call: jest.fn() } as never;

    const controller = new DialogInfoController({
      sm,
      globalStore,
      worker,
      ensureMessageStore: () => ({ update: jest.fn() }) as never,
      getChannelsByIds: jest.fn(() => Promise.resolve([])),
      getFullChannelByIds: jest.fn(() => Promise.resolve([])),
      getChatsByIds: jest.fn(() => Promise.resolve([])),
      getFullChatByIds: jest.fn(() => Promise.resolve([])),
    });

    expect(controller.open('-1000000000777')).toBe(true);
    expect(globalStore.nav.activeMiddleOverlay).toEqual({
      kind: 'dialog',
      peerId: '-1000000000777',
    });

    expect(controller.open('-10')).toBe(true);
    expect(globalStore.nav.middleOverlayStack).toHaveLength(2);
    expect(controller.pop()?.peerId).toBe('-10');
  });
});