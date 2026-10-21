'use client';

import {
  Dialog,
  MAIN_THREAD_ID,
  TeleGenieSDK,
  type Channel,
  type Chat,
  type DialogUIState,
  type Message,
  type StoreMapView,
  type StoreName,
  type StoreManagerView,
  type TeleGenieSDKOptions,
  type TeleGenieSDKView,
  type ThreadUIState,
  type User,
} from '@telegenie/sdk';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type DialogPeer = User | Channel | Chat;

type SDKContextValue = {
  sdk: TeleGenieSDK;
};

/** Stores that hold entities keyed by id (excludes the global store). */
export type EntityStoreName = Exclude<StoreName, 'global'>;

type StoreModel<N extends EntityStoreName> = ReturnType<StoreMapView[N]['get']>;

const SDKContext = createContext<SDKContextValue | null>(null);

export type SDKProviderProps = {
  children: ReactNode;
  /** Optional pre-built SDK instance (e.g. for tests). */
  sdk?: TeleGenieSDK;
  /** Options used when the provider constructs the default SDK instance. */
  options?: TeleGenieSDKOptions;
};

export function SDKProvider({ children, sdk: sdkProp, options }: SDKProviderProps) {
  const value = useMemo<SDKContextValue>(() => {
    const sdk = sdkProp ?? new TeleGenieSDK(options);
    return { sdk };
  }, [sdkProp, options]);

  return <SDKContext.Provider value={value}>{children}</SDKContext.Provider>;
}

function useSDKContext(): SDKContextValue {
  const ctx = useContext(SDKContext);
  if (!ctx) {
    throw new Error(
      'useSDK / useStore / useStoreManager / useStoreEntities / useMessage / useGlobalStoreDialog / useGlobalStoreThread must be used within an SDKProvider',
    );
  }
  return ctx;
}

/** Access the TeleGenie SDK instance from context. */
export function useSDK(): TeleGenieSDKView {
  return useSDKContext().sdk as unknown as TeleGenieSDKView;
}

/** Access the store manager from context. */
export function useStoreManager(): StoreManagerView {
  return useSDK().store;
}

/** Access a named store from the store manager (typed by store name). */
export function useStore<N extends StoreName>(name: N): StoreMapView[N] {
  return useStoreManager().get(name);
}

/** Read per-dialog UI (active thread, pins, mentions). Does not allocate. */
export function useGlobalStoreDialog(
  peerId: string | null | undefined,
): DialogUIState | undefined {
  const globalStore = useStore('global');
  if (!peerId) return undefined;
  return globalStore.getDialogUI(peerId);
}

/** Read per-thread UI (listed window, scroll, focus). Does not allocate. */
export function useGlobalStoreThread(
  peerId: string | null | undefined,
  threadId: string = MAIN_THREAD_ID,
): ThreadUIState | undefined {
  const globalStore = useStore('global');
  if (!peerId) return undefined;
  return globalStore.getThreadUI(peerId, threadId);
}

/** Get a single entity by store name + id. Pass `null`/`undefined` to skip the lookup. */
export function useStoreEntities<N extends EntityStoreName>(
  name: N,
  id: string | null | undefined,
): StoreModel<N> | null;
/** Get multiple entities by store name + ids. */
export function useStoreEntities<N extends EntityStoreName>(
  name: N,
  ids: string[],
): StoreModel<N>[];
export function useStoreEntities<N extends EntityStoreName>(
  name: N,
  idOrIds: string | string[] | null | undefined,
): StoreModel<N> | StoreModel<N>[] | null {
  const store = useStore(name);
  if (idOrIds == null) {
    return null;
  }
  if (Array.isArray(idOrIds)) {
    return idOrIds.map((id) => store.get(id)) as StoreModel<N>[];
  }
  return store.get(idOrIds) as StoreModel<N>;
}

/**
 * Look up a message in the per-peer `${peerId}-message` store.
 * Placeholders (empty / undated) are treated as not loaded yet.
 */
export function useMessage(
  peerId: string | null | undefined,
  messageId: string | null | undefined,
): Message | null {
  const sdk = useSDK();
  if (!peerId || !messageId) return null;
  const message = sdk.getMessageStore(peerId).get(messageId);
  if (!message || message.isEmpty || !message.date) return null;
  return message;
}

/** Resolve User / Channel / Chat for a Bot API dialog id without touching the wrong stores. */
export function useDialogPeer(peerId: string | null | undefined): DialogPeer | null {
  const type = peerId ? Dialog.peerKindFromId(peerId) : null;

  const user = useStoreEntities('user', type === 'user' ? peerId : null);
  const channel = useStoreEntities('channel', type === 'channel' ? peerId : null);
  const chat = useStoreEntities('chat', type === 'chat' ? peerId : null);

  if (type === 'user') return isPresentPeer(user) ? user : null;
  if (type === 'channel') return isPresentPeer(channel) ? channel : null;
  if (type === 'chat') return isPresentPeer(chat) ? chat : null;
  return null;
}

function isPresentPeer(peer: User | Channel | Chat | null): peer is User | Channel | Chat {
  if (!peer) return false;
  if ('firstName' in peer) {
    return Boolean(peer.firstName || peer.lastName || peer.username || peer.self || peer.deleted);
  }
  if ('title' in peer) {
    return Boolean(peer.title);
  }
  return false;
}
