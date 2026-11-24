'use client';

import { useSDK } from '@/lib/contexts/sdk.context';
import { dialogHref } from '@/lib/utils/dialog-url';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Select a dialog in the SDK and update the Next.js URL to `/chat/<dialogId>`.
 */
export function useSelectDialog() {
  const sdk = useSDK();
  const router = useRouter();

  return useCallback(
    async (peerId: string, threadId?: string) => {
      const pending =
        threadId !== undefined
          ? sdk.messageLoad.selectDialog(peerId, threadId)
          : sdk.messageLoad.selectDialog(peerId);
      router.push(dialogHref(peerId));
      await pending;
    },
    [router, sdk.messageLoad],
  );
}
