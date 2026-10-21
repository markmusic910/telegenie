'use client';

import { useGlobalStoreDialog, useSDK } from '@/lib/contexts/sdk.context';
import { MAIN_THREAD_ID } from '@telegenie/sdk';
import { type RefObject, useCallback, useEffect, useRef } from 'react';

export type JumpToBottomBehavior = 'auto' | 'smooth';

export type JumpToBottomFn = (
  behavior?: JumpToBottomBehavior,
  signal?: AbortSignal,
) => void | Promise<void>;

const JUMP_DEBOUNCE_MS = 50;

/** Rebuild the newest listed window if needed, then scroll the scroller to its bottom. */
export function useJumpToBottom(scrollerRef: RefObject<HTMLElement | null>, peerId: string) {
  const sdk = useSDK();
  const dialogUI = useGlobalStoreDialog(peerId);
  const threadId = dialogUI?.activeThreadId ?? MAIN_THREAD_ID;

  const peerIdRef = useRef(peerId);
  const threadIdRef = useRef(threadId);
  peerIdRef.current = peerId;
  threadIdRef.current = threadId;

  const generationRef = useRef(0);
  const debounceRef = useRef<{
    timer: ReturnType<typeof setTimeout>;
    resolve: (proceed: boolean) => void;
  } | null>(null);

  const cancelDebounce = useCallback((proceed: boolean) => {
    const pending = debounceRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    debounceRef.current = null;
    pending.resolve(proceed);
  }, []);

  useEffect(
    () => () => {
      generationRef.current += 1;
      cancelDebounce(false);
    },
    [cancelDebounce],
  );

  return useCallback(
    async (behavior: JumpToBottomBehavior = 'auto', signal?: AbortSignal) => {
      const generation = ++generationRef.current;
      cancelDebounce(false);

      const isStale = () =>
        generation !== generationRef.current ||
        peerIdRef.current !== peerId ||
        threadIdRef.current !== threadId ||
        Boolean(signal?.aborted);

      if (isStale()) return;

      const proceeded = await new Promise<boolean>((resolve) => {
        const onAbort = () => {
          cancelDebounce(false);
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        debounceRef.current = {
          timer: setTimeout(() => {
            debounceRef.current = null;
            signal?.removeEventListener('abort', onAbort);
            resolve(!isStale());
          }, JUMP_DEBOUNCE_MS),
          resolve: (proceed) => {
            signal?.removeEventListener('abort', onAbort);
            resolve(proceed && !isStale());
          },
        };
      });

      if (!proceeded || isStale()) return;

      await sdk.messageLoad.jumpToBottom(peerId, threadId);
      if (isStale()) return;

      const root = scrollerRef.current;
      if (!root) return;

      sdk.messageLoad.setScrollFrozen(peerId, true, threadId);
      const unfreeze = () => {
        sdk.messageLoad.setScrollFrozen(peerId, false, threadId);
      };

      if (behavior === 'smooth') {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const onScrollEnd = () => {
          if (timer) clearTimeout(timer);
          root.removeEventListener('scrollend', onScrollEnd);
          unfreeze();
        };
        root.addEventListener('scrollend', onScrollEnd, { once: true });
        timer = setTimeout(onScrollEnd, 600);
      } else {
        requestAnimationFrame(() => {
          unfreeze();
        });
      }

      root.scrollTo({ top: root.scrollHeight, behavior });
    },
    [cancelDebounce, peerId, scrollerRef, sdk.messageLoad, threadId],
  );
}
