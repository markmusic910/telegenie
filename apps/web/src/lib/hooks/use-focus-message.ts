'use client';

import { useSDK } from '@/lib/contexts/sdk.context';
import { MAIN_THREAD_ID } from '@telegenie/sdk';
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

  return useCallback(
    (params: FocusMessageParams) => {
      void sdk.messageLoad.focusMessage(params.peerId, {
        messageId: params.messageId,
        threadId: params.threadId ?? MAIN_THREAD_ID,
        replyFromMessageId: params.replyFromMessageId,
        noHighlight: params.noHighlight,
      });
    },
    [sdk.messageLoad],
  );
}
