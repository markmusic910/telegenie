import type { TeleGenieSDKView } from '../telegenie.sdk';
import type { DialogUIState } from './global/models/dialog.state';
import type { ThreadUIState } from './global/models/thread.state';
import type { GlobalStoreView, StoreMapView } from './store.view';

type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

describe('UI store views hide mutators', () => {
  it('does not expose GlobalStore writers', () => {
    const hasSetPinToBottom: HasKey<GlobalStoreView, 'setPinToBottom'> = false;
    const hasGetOrCreateThreadUI: HasKey<GlobalStoreView, 'getOrCreateThreadUI'> = false;
    const hasGetOrCreateDialogUI: HasKey<GlobalStoreView, 'getOrCreateDialogUI'> = false;
    const hasSetHistoryState: HasKey<GlobalStoreView, 'setHistoryState'> = false;
    const hasThreads: HasKey<GlobalStoreView, 'threads'> = false;
    const hasGetDialogUI: HasKey<GlobalStoreView, 'getDialogUI'> = true;
    const hasGetThreadUI: HasKey<GlobalStoreView, 'getThreadUI'> = true;
    const hasDialogs: HasKey<GlobalStoreView, 'dialogs'> = true;

    expect(hasSetPinToBottom).toBe(false);
    expect(hasGetOrCreateThreadUI).toBe(false);
    expect(hasGetOrCreateDialogUI).toBe(false);
    expect(hasSetHistoryState).toBe(false);
    expect(hasThreads).toBe(false);
    expect(hasGetDialogUI).toBe(true);
    expect(hasGetThreadUI).toBe(true);
    expect(hasDialogs).toBe(true);
  });

  it('exposes thread computeds without class actions', () => {
    const hasHasMoreOlder: HasKey<ThreadUIState, 'hasMoreOlder'> = true;
    const hasHasMoreNewer: HasKey<ThreadUIState, 'hasMoreNewer'> = true;
    const hasThreadFlatItems: HasKey<ThreadUIState, 'flatItems'> = true;
    const hasAppendLive: HasKey<ThreadUIState, 'appendLiveMessage'> = false;
    const hasSetPin: HasKey<ThreadUIState, 'setPinToBottom'> = false;
    const hasGetThread: HasKey<DialogUIState, 'getThread'> = true;
    const hasGetOrCreateThread: HasKey<DialogUIState, 'getOrCreateThread'> = false;

    expect(hasHasMoreOlder).toBe(true);
    expect(hasHasMoreNewer).toBe(true);
    expect(hasThreadFlatItems).toBe(true);
    expect(hasAppendLive).toBe(false);
    expect(hasSetPin).toBe(false);
    expect(hasGetThread).toBe(true);
    expect(hasGetOrCreateThread).toBe(false);
  });

  it('does not expose entity-store writers or SDK store-writer APIs', () => {
    const hasUpdate: HasKey<StoreMapView['dialog'], 'update'> = false;
    const hasHydrate: HasKey<StoreMapView['dialog'], 'hydrate'> = false;
    const hasDeleteByIds: HasKey<StoreMapView['dialog'], 'deleteByIds'> = false;
    const hasEnsureMessageStore: HasKey<TeleGenieSDKView, 'ensureMessageStore'> = false;
    const hasUpdates: HasKey<TeleGenieSDKView, 'updates'> = false;
    const hasDebugDeleteEntity: HasKey<TeleGenieSDKView, 'debugDeleteEntity'> = true;
    const hasDebugClearEntityStore: HasKey<TeleGenieSDKView, 'debugClearEntityStore'> = true;
    const hasDebugDeleteDialogUI: HasKey<TeleGenieSDKView, 'debugDeleteDialogUI'> = true;
    const hasDebugDeleteThreadUI: HasKey<TeleGenieSDKView, 'debugDeleteThreadUI'> = true;
    const hasDebugClearAllStores: HasKey<TeleGenieSDKView, 'debugClearAllStores'> = true;
    const hasDebugDeleteFoundationEntity: HasKey<
      TeleGenieSDKView,
      'debugDeleteFoundationEntity'
    > = true;
    const hasSetSelectedFolderId: HasKey<
      TeleGenieSDKView['globalStore']['nav'],
      'setSelectedFolderId'
    > = false;

    expect(hasUpdate).toBe(false);
    expect(hasHydrate).toBe(false);
    expect(hasDeleteByIds).toBe(false);
    expect(hasEnsureMessageStore).toBe(false);
    expect(hasUpdates).toBe(false);
    expect(hasDebugDeleteEntity).toBe(true);
    expect(hasDebugClearEntityStore).toBe(true);
    expect(hasDebugDeleteDialogUI).toBe(true);
    expect(hasDebugDeleteThreadUI).toBe(true);
    expect(hasDebugClearAllStores).toBe(true);
    expect(hasDebugDeleteFoundationEntity).toBe(true);
    expect(hasSetSelectedFolderId).toBe(false);
  });
});
