'use client';

import { useGlobalStoreDialog, useGlobalStoreThread, useSDK } from '@/lib/contexts/sdk.context';
import { MAIN_THREAD_ID } from '@telegenie/sdk';
import { useEffect, useState } from 'react';

/**
 * Hydrate listed message bodies into the in-memory store (IDB, then network).
 *
 * Persist restores `listedIds` / `msgIndexes` with the selected dialog, but the
 * peer message store may still be empty. Call this when the list mounts so
 * `flatItems` can render.
 */
export function useEnsureListedMessages(peerId: string): boolean {
  const sdk = useSDK();
  const dialogUI = useGlobalStoreDialog(peerId);
  const threadId = dialogUI?.activeThreadId ?? MAIN_THREAD_ID;
  const threadUI = useGlobalStoreThread(peerId, threadId);
  const listedIds = threadUI?.listedIds ?? [];
  const listedCount = listedIds.length;
  const listedKey = `${peerId}:${threadId}:${listedIds[0] ?? ''}:${listedIds[listedCount - 1] ?? ''}:${listedCount}`;
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  useEffect(() => {
    if (listedCount === 0) return;

    let cancelled = false;
    void sdk.messageLoad.ensureListedIdsCached(peerId, threadId).finally(() => {
      if (!cancelled) setHydratedKey(listedKey);
    });
    return () => {
      cancelled = true;
    };
  }, [listedCount, listedKey, peerId, sdk.messageLoad, threadId]);

  return listedCount === 0 || hydratedKey === listedKey;
}
