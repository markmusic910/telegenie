'use client';

import { useGlobalStoreDialog, useGlobalStoreThread } from '@/lib/contexts/sdk.context';
import { MAIN_THREAD_ID } from '@telegenie/sdk';
import { type RefObject, useLayoutEffect, useRef } from 'react';

type UseRestoreScrollPositionWhenOpenOptions = {
  scrollerRef: RefObject<HTMLElement | null>;
  peerId: string;
};

/**
 * Apply the first listed-scroller position when a dialog opens.
 *
 * Skips when `focusedMessageId` is set — `useMessageListFocus` scrolls to that
 * row (including unread-open, which focuses without a highlight). Skips when
 * `pinToBottom` is true — `usePinToBottom` already jumps to the newest edge.
 * Waits until `listedIds` exist so the scroller node is in the DOM (loading /
 * empty states unmount it). Does not re-apply if the user later unpins or the
 * listed window slides.
 */
export function useRestoreScrollPositionWhenOpen({
  scrollerRef,
  peerId,
}: UseRestoreScrollPositionWhenOpenOptions) {
  const dialogUI = useGlobalStoreDialog(peerId);
  const threadId = dialogUI?.activeThreadId ?? MAIN_THREAD_ID;
  const threadUI = useGlobalStoreThread(peerId, threadId);
  const pinToBottom = threadUI?.pinToBottom ?? true;
  const focusedMessageId = threadUI?.focusedMessageId;
  const scrollOffset = threadUI?.scrollOffset ?? 0;
  const listedCount = threadUI?.listedIds.length ?? 0;

  const restoredKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const key = `${peerId}:${threadId}`;
    if (restoredKeyRef.current === key) return;

    if (focusedMessageId || pinToBottom) {
      restoredKeyRef.current = key;
      return;
    }

    if (listedCount === 0) return;

    const root = scrollerRef.current;
    if (!root) return;

    root.scrollTo({ top: scrollOffset, behavior: 'auto' });
    restoredKeyRef.current = key;
  }, [focusedMessageId, listedCount, peerId, pinToBottom, scrollerRef, scrollOffset, threadId]);
}
