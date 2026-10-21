'use client';

import { useGlobalStoreDialog, useGlobalStoreThread, useSDK, useStoreEntities } from '@/lib/contexts/sdk.context';
import type { MessageListScrollerStore } from '@/lib/hooks/message-list/message-list-scroller.store';
import type { JumpToBottomFn } from '@/lib/hooks/message-list/use-jump-to-bottom';
import { useMessageListScrollerEvent } from '@/lib/hooks/message-list/use-message-list-scroller';
import { useStableCallback } from '@/lib/hooks/use-stable-callback';
import { MAIN_THREAD_ID } from '@telegenie/sdk';
import { useLayoutEffect } from 'react';

const PIN_TO_BOTTOM_PX = 50;

type UsePinToBottomOptions = {
  scroller: MessageListScrollerStore;
  jumpToBottom: JumpToBottomFn;
  peerId: string;
};

/**
 * Follow the live tail when `threadUI.pinToBottom` is true.
 *
 * Does not attach DOM listeners. Subscribe through {@link MessageListScrollerStore}:
 * - **scroll**: `setPinToBottom` when `distanceFromBottom` is within 50px and the
 *   listed window still follows newest (`listedFollowsNewest`).
 * - **resize**: jump to bottom if still pinned (content grew, e.g. a new message).
 *
 * Also jumps once when the listed thread opens (`peerId` / `threadId`) and again
 * when `dialog.topMessageId` changes. Pin flips from scrolling do not re-run the
 * open jump.
 */
export function usePinToBottom({ scroller, jumpToBottom, peerId }: UsePinToBottomOptions) {
  const sdk = useSDK();
  const dialog = useStoreEntities('dialog', peerId);
  const dialogUI = useGlobalStoreDialog(peerId);
  const threadId = dialogUI?.activeThreadId ?? MAIN_THREAD_ID;
  const threadUI = useGlobalStoreThread(peerId, threadId);
  const topMessageId = dialog?.topMessageId;
  const pinToBottom = threadUI?.pinToBottom ?? true;
  const listedFollowsNewest = threadUI?.listedFollowsNewest ?? true;

  const jumpIfPinned = useStableCallback(() => {
    if (!pinToBottom) return;
    void jumpToBottom();
  });

  useLayoutEffect(() => {
    if (!pinToBottom) return;
    const abort = new AbortController();
    void jumpToBottom('auto', abort.signal);
    return () => abort.abort();
    // Only re-run when the listed thread changes, not when pin flips from scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToBottom, peerId, threadId]);

  useLayoutEffect(() => {
    jumpIfPinned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topMessageId]);

  useMessageListScrollerEvent(scroller, 'scroll', () => {
    sdk.messageLoad.setPinToBottom(
      peerId,
      listedFollowsNewest && scroller.getMetrics().distanceFromBottom <= PIN_TO_BOTTOM_PX,
      threadId,
    );
  });

  useMessageListScrollerEvent(scroller, 'resize', jumpIfPinned);
}
