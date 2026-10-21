'use client';

import { useGlobalStoreDialog, useSDK } from '@/lib/contexts/sdk.context';
import type { MessageListScrollerStore } from '@/lib/hooks/message-list/message-list-scroller.store';
import { useMessageListScrollerEvent } from '@/lib/hooks/message-list/use-message-list-scroller';
import { MAIN_THREAD_ID } from '@telegenie/sdk';

type UseRecordScrollOffsetOptions = {
  scroller: MessageListScrollerStore;
  peerId: string;
};

/** Persist the scroller's `scrollTop` on the active thread UI as the user scrolls. */
export function useRecordScrollOffset({ scroller, peerId }: UseRecordScrollOffsetOptions) {
  const sdk = useSDK();
  const dialogUI = useGlobalStoreDialog(peerId);
  const threadId = dialogUI?.activeThreadId ?? MAIN_THREAD_ID;

  useMessageListScrollerEvent(scroller, 'scroll', () => {
    sdk.messageLoad.recordScrollOffset(peerId, scroller.getMetrics().scrollOffset, threadId);
  });
}
