import {
  BRIDGE_KIND_READY,
  BRIDGE_REQUEST_MESSAGE,
} from '@telegenie/libs/foundation/telegram/worker/sw-bridge-protocol';

import GlobalStore from '../../store/global/global.store';
import StoreManager from '../../store/store.manager';
import { SwController } from './sw.controller';

describe('SwController.watchBridgeRequest', () => {
  const originalNavigator = globalThis.navigator;
  let listeners: Map<string, Set<(event: MessageEvent) => void>>;

  beforeEach(() => {
    listeners = new Map();
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        serviceWorker: {
          addEventListener: jest.fn((type: string, fn: (event: MessageEvent) => void) => {
            const set = listeners.get(type) ?? new Set();
            set.add(fn);
            listeners.set(type, set);
          }),
          removeEventListener: jest.fn((type: string, fn: (event: MessageEvent) => void) => {
            listeners.get(type)?.delete(fn);
          }),
        },
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
  });

  function dispatchSwMessage(data: unknown) {
    const set = listeners.get('message');
    if (!set) return;
    for (const fn of set) {
      fn({ data } as MessageEvent);
    }
  }

  it('invokes reconnect only for the leader on BRIDGE_REQUEST_MESSAGE and cleans up on disconnect', () => {
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    globalStore.leader.setLeader('tab-a', Date.now());

    const sw = new SwController({
      globalStore,
      getTabId: () => 'tab-a',
    });

    const onReconnect = jest.fn();
    sw.watchBridgeRequest(onReconnect);

    dispatchSwMessage({ kind: BRIDGE_KIND_READY });
    expect(onReconnect).not.toHaveBeenCalled();

    dispatchSwMessage(BRIDGE_REQUEST_MESSAGE);
    expect(onReconnect).toHaveBeenCalledTimes(1);

    // Losing leadership prevents further reconnects.
    globalStore.leader.setLeader('tab-b', Date.now());
    dispatchSwMessage(BRIDGE_REQUEST_MESSAGE);
    expect(onReconnect).toHaveBeenCalledTimes(1);

    // Disconnect removes the listener.
    sw.disconnectLeaderBridges();
    globalStore.leader.setLeader('tab-a', Date.now());
    dispatchSwMessage(BRIDGE_REQUEST_MESSAGE);
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('does not register a listener when the tab is not the leader', () => {
    const sm = new StoreManager();
    const globalStore = new GlobalStore(sm);
    globalStore.leader.setLeader('tab-b', Date.now());

    const sw = new SwController({
      globalStore,
      getTabId: () => 'tab-a',
    });

    const onReconnect = jest.fn();
    sw.watchBridgeRequest(onReconnect);
    dispatchSwMessage(BRIDGE_REQUEST_MESSAGE);
    expect(onReconnect).not.toHaveBeenCalled();
  });
});
