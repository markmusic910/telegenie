'use client';

import { useSDK, useStore } from '@/lib/contexts/sdk.context';
import { dialogHref } from '@/lib/utils/dialog-url';
import { MAIN_THREAD_ID } from '@telegenie/sdk';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export type FocusMessageParams = {
  peerId: string;
  messageId: string;
  threadId?: string;
  replyFromMessageId?: string;
  noHighlight?: boolean;
};

export function useFocusMessage() {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const router = useRouter();

  return useCallback(
    (params: FocusMessageParams) => {
      if (globalStore.nav.selectedDialogId !== params.peerId) {
        router.push(dialogHref(params.peerId));
      }
      void sdk.messageLoad.focusMessage(params.peerId, {
        messageId: params.messageId,
        threadId: params.threadId ?? MAIN_THREAD_ID,
        replyFromMessageId: params.replyFromMessageId,
        noHighlight: params.noHighlight,
      });
    },
    [globalStore, router, sdk.messageLoad],
  );
}
