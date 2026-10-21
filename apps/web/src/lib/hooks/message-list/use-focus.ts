'use client';

import { useGlobalStoreDialog, useGlobalStoreThread, useSDK } from '@/lib/contexts/sdk.context';
import { findFlatMessageIndex, MAIN_THREAD_ID, type MessageAlbum } from '@telegenie/sdk';
import { type RefObject, useCallback, useEffect, useRef } from 'react';

const FOCUS_HIGHLIGHT_MS = 1500;

type UseMessageListFocusOptions = {
  scrollerRef: RefObject<HTMLElement | null>;
  peerId: string;
};

function listItemSelector(id: string): string {
  return `[data-list-item-id="${CSS.escape(id)}"]`;
}

/**
 * Scroll the listed scroller to `threadUI.focusedMessageId` and optionally
 * highlight it. Reads focus + `flatItems` from the active thread store.
 */
export function useMessageListFocus({ scrollerRef, peerId }: UseMessageListFocusOptions) {
  const sdk = useSDK();
  const dialogUI = useGlobalStoreDialog(peerId);
  const threadId = dialogUI?.activeThreadId ?? MAIN_THREAD_ID;
  const threadUI = useGlobalStoreThread(peerId, threadId);
  const flatItems = threadUI?.flatItems;
  const focusedMessageId = threadUI?.focusedMessageId;
  const focusGeneration = threadUI?.focusGeneration ?? 0;
  const focusNoHighlight = threadUI?.focusNoHighlight;

  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrolledGenerationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!focusedMessageId) {
      scrolledGenerationRef.current = null;
      return;
    }

    const items = flatItems ?? [];
    const index = findFlatMessageIndex(items, focusedMessageId);
    const root = scrollerRef.current;
    if (index == null || !root) {
      return;
    }

    if (scrolledGenerationRef.current === focusGeneration) {
      return;
    }
    scrolledGenerationRef.current = focusGeneration;

    const item = items[index];
    const element = item ? root.querySelector<HTMLElement>(listItemSelector(item.id)) : null;

    if (element) {
      sdk.messageLoad.setScrollFrozen(peerId, true, threadId);
      const unfreeze = () => {
        sdk.messageLoad.setScrollFrozen(peerId, false, threadId);
      };
      let timer: ReturnType<typeof setTimeout> | null = null;
      const onScrollEnd = () => {
        if (timer) clearTimeout(timer);
        root.removeEventListener('scrollend', onScrollEnd);
        unfreeze();
      };
      root.addEventListener('scrollend', onScrollEnd, { once: true });
      timer = setTimeout(onScrollEnd, 600);

      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
    }
    clearTimerRef.current = setTimeout(() => {
      sdk.messageLoad.clearFocus(peerId, threadId);
      clearTimerRef.current = null;
    }, FOCUS_HIGHLIGHT_MS);
  }, [flatItems, focusGeneration, focusedMessageId, peerId, scrollerRef, sdk.messageLoad, threadId]);

  useEffect(
    () => () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    },
    [],
  );

  const isMessageFocused = useCallback(
    (messageId: string, album?: MessageAlbum) => {
      if (focusNoHighlight || !focusedMessageId) return false;
      if (focusedMessageId === messageId) return true;
      return album?.messages.some((message) => message.id === focusedMessageId) ?? false;
    },
    [focusNoHighlight, focusedMessageId],
  );

  return { isMessageFocused };
}
