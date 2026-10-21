'use client';

import {
  useGlobalStoreDialog,
  useGlobalStoreThread,
  useSDK,
  useStore,
} from '@/lib/contexts/sdk.context';
import type { MessageListScrollerStore } from '@/lib/hooks/message-list/message-list-scroller.store';
import { useIntersectionObserver } from '@/lib/hooks/use-intersection-observer';
import { useMessageListScrollerEvent } from '@/lib/hooks/message-list/use-message-list-scroller';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useStableCallback } from '@/lib/hooks/use-stable-callback';
import {
  MAIN_THREAD_ID,
  anchorScrollTop,
  findVisibleItemIndex,
  itemOffsetInScroller,
  pickMessageScrollAnchor,
  type FlatListItem,
  type MessageScrollAnchor,
} from '@telegenie/sdk';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Prefetch margin around the message list triggers (2x 750px = 1500px). */
const HISTORY_TRIGGER_ROOT_MARGIN = '1500px';
/** Quiet window after the last content resize before the slide lock is released. */
const RESTORE_QUIET_MS = 150;
/** Failsafe so a missing anchor row cannot pin inFlight forever. */
const RESTORE_MAX_MS = 2000;

type UseMessageListHistoryOptions = {
  scroller: MessageListScrollerStore;
  scrollerRef: RefObject<HTMLElement | null>;
  root?: HTMLElement | null;
  peerId: string;
};

function listItemSelector(id: string): string {
  return `[data-list-item-id="${CSS.escape(id)}"]`;
}

function captureAnchor(
  root: HTMLElement,
  items: FlatListItem[],
): MessageScrollAnchor | undefined {
  const getItem = (id: string) => root.querySelector<HTMLElement>(listItemSelector(id));
  const startIndex = findVisibleItemIndex(items, root, getItem);
  return pickMessageScrollAnchor(
    items,
    startIndex,
    root.scrollTop,
    (index) => {
      const el = getItem(items[index]?.id ?? '');
      return el ? itemOffsetInScroller(root, el) : 0;
    },
    (index) => getItem(items[index]?.id ?? '')?.offsetHeight ?? 0,
  );
}

function applyAnchor(root: HTMLElement, anchor: MessageScrollAnchor): boolean {
  const el = root.querySelector<HTMLElement>(listItemSelector(anchor.itemId));
  if (!el) return false;
  // Instant jump — animated scroll would fire follow-up slides before the window settles.
  root.scrollTop = anchorScrollTop(itemOffsetInScroller(root, el), anchor.offsetInItem);
  return true;
}

export function useMessageListHistory({
  scroller,
  scrollerRef,
  root,
  peerId,
}: UseMessageListHistoryOptions) {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const dialogUI = useGlobalStoreDialog(peerId);
  const threadId = dialogUI?.activeThreadId ?? MAIN_THREAD_ID;
  const threadUI = useGlobalStoreThread(peerId, threadId);
  const listedIds = threadUI?.listedIds ?? [];
  const listedFirstId = listedIds[0];
  const listedLastId = listedIds[listedIds.length - 1];
  const listedCount = listedIds.length;

  /** True while slideListedWindow is actively running (e.g. fetching network history). */
  const slidingRef = useRef(false);
  /** True from slide start until restore has settled (or the slide has no anchor work). */
  const inFlightRef = useRef(false);
  /** Bumped on peer/thread change so in-flight work from the previous thread is ignored. */
  const generationRef = useRef(0);
  /** Bumped per slide (and on thread change) so a late quiet/max timer cannot unlock a newer slide. */
  const slideSeqRef = useRef(0);
  /** Visible row + offset captured before a slide; used to jump `scrollTop` after the window changes. */
  const anchorRef = useRef<MessageScrollAnchor | null>(null);
  /** Set once the anchor jump has succeeded at least once for this slide. */
  const restoreOkRef = useRef(false);

  const restoreAnchor = useStableCallback((): boolean => {
    const anchor = anchorRef.current;
    const root = scrollerRef.current;
    if (!anchor || !root) return false;
    const applied = applyAnchor(root, anchor);
    if (applied) restoreOkRef.current = true;
    return applied;
  });

  /** Restarts on each content resize; fires when the new window has been quiet long enough to unlock. */
  const { run: armQuietRelease, cancel: cancelQuietRelease } = useDebounce(
    (generation: number, slideSeq: number) => {
      if (generation !== generationRef.current || slideSeq !== slideSeqRef.current) return;
      if (slidingRef.current) return;
      if (!restoreOkRef.current) return;
      finishRestore(generation, slideSeq);
    },
    RESTORE_QUIET_MS,
  );

  /** Failsafe: release the restore lock if the anchor row never appears. */
  const { run: armMaxRelease, cancel: cancelMaxRelease } = useDebounce(
    (generation: number, slideSeq: number) => {
      restoreAnchor();
      finishRestore(generation, slideSeq);
    },
    RESTORE_MAX_MS,
    { restart: false },
  );

  const cancelRestoreTimers = useStableCallback(() => {
    cancelQuietRelease();
    cancelMaxRelease();
  });

  const finishRestore = useStableCallback((generation: number, slideSeq: number) => {
    if (generation !== generationRef.current || slideSeq !== slideSeqRef.current) return;
    cancelRestoreTimers();
    anchorRef.current = null;
    restoreOkRef.current = false;
    inFlightRef.current = false;
    if (hasPendingScrollSlideRef.current) {
      hasPendingScrollSlideRef.current = false;
      checkPendingSlide();
    }
  });

  const continueRestore = useStableCallback((generation: number, slideSeq: number) => {
    if (generation !== generationRef.current || slideSeq !== slideSeqRef.current) return;
    if (!anchorRef.current) return;
    restoreAnchor();
    if (restoreOkRef.current && !slidingRef.current) armQuietRelease(generation, slideSeq);
  });

  const runSlide = useStableCallback(async (direction: 'older' | 'newer') => {
    if (inFlightRef.current) return;
    const generation = generationRef.current;
    const slideSeq = ++slideSeqRef.current;
    const slidePeerId = peerId;
    const slideThreadId = threadId;
    slidingRef.current = true;
    inFlightRef.current = true;
    restoreOkRef.current = false;
    try {
      if (!anchorRef.current) {
        const root = scrollerRef.current;
        const items = globalStore.getThreadUI(slidePeerId, slideThreadId)?.flatItems ?? [];
        if (root) {
          anchorRef.current = captureAnchor(root, items) ?? null;
        }
      }
      await sdk.messageLoad.slideListedWindow(slidePeerId, direction, slideThreadId, {
        preload: true,
      });
    } catch {
      if (generation === generationRef.current) finishRestore(generation, slideSeq);
      return;
    } finally {
      slidingRef.current = false;
    }

    if (generation !== generationRef.current || slideSeq !== slideSeqRef.current) return;

    if (anchorRef.current) {
      restoreAnchor();
      armMaxRelease(generation, slideSeq);
      if (restoreOkRef.current) armQuietRelease(generation, slideSeq);
      return;
    }

    finishRestore(generation, slideSeq);
  });

  const [topEl, setTopEl] = useState<HTMLDivElement | null>(null);
  const [bottomEl, setBottomEl] = useState<HTMLDivElement | null>(null);

  const backwardsTriggerRef = useCallback((node: HTMLDivElement | null) => {
    setTopEl(node);
  }, []);

  const forwardsTriggerRef = useCallback((node: HTMLDivElement | null) => {
    setBottomEl(node);
  }, []);

  const isBackwardsIntersectingRef = useRef(false);
  const isForwardsIntersectingRef = useRef(false);
  const hasPendingScrollSlideRef = useRef(false);

  const checkPendingSlide = useStableCallback(() => {
    if (inFlightRef.current) return;
    const current = globalStore.getThreadUI(peerId, threadId);
    if (!current || current.isLoadingHistory || current.isScrollFrozen) return;

    if (isBackwardsIntersectingRef.current && current.hasMoreOlder) {
      void runSlide('older');
    } else if (
      isForwardsIntersectingRef.current &&
      !current.listedFollowsNewest &&
      current.hasMoreNewer
    ) {
      void runSlide('newer');
    }
  });

  // switch to another thread or dialog
  useLayoutEffect(() => {
    generationRef.current += 1;
    slideSeqRef.current += 1;
    slidingRef.current = false;
    anchorRef.current = null;
    restoreOkRef.current = false;
    inFlightRef.current = false;
    isBackwardsIntersectingRef.current = false;
    isForwardsIntersectingRef.current = false;
    hasPendingScrollSlideRef.current = false;
    cancelRestoreTimers();
  }, [cancelRestoreTimers, peerId, threadId]);

  useLayoutEffect(() => {
    if (!inFlightRef.current) return;
    continueRestore(generationRef.current, slideSeqRef.current);
  }, [continueRestore, listedCount, listedFirstId, listedLastId, peerId, threadId]);

  useMessageListScrollerEvent(scroller, 'resize', () => {
    if (!inFlightRef.current || !anchorRef.current) return;
    continueRestore(generationRef.current, slideSeqRef.current);
  });

  useMessageListScrollerEvent(scroller, 'scroll', () => {
    if (inFlightRef.current) {
      hasPendingScrollSlideRef.current = true;
      return;
    }
    anchorRef.current = null;
    checkPendingSlide();
  });

  const { observe: observeTrigger } = useIntersectionObserver({
    rootRef: scrollerRef,
    root,
    rootMargin: HISTORY_TRIGGER_ROOT_MARGIN,
    peerId,
    threadId,
    onIntersect: (entries) => {
      for (const entry of entries) {
        const isBackwards =
          entry.target === topEl || entry.target?.classList?.contains('backwards-trigger');
        const isForwards =
          entry.target === bottomEl || entry.target?.classList?.contains('forwards-trigger');

        if (isBackwards) {
          isBackwardsIntersectingRef.current = entry.isIntersecting;
        } else if (isForwards) {
          isForwardsIntersectingRef.current = entry.isIntersecting;
        }
      }
      checkPendingSlide();
    },
  });

  useEffect(() => {
    if (!topEl || listedCount === 0) {
      isBackwardsIntersectingRef.current = false;
      return undefined;
    }
    const unobserve = observeTrigger(topEl);
    return () => {
      isBackwardsIntersectingRef.current = false;
      unobserve();
    };
  }, [listedCount, observeTrigger, topEl]);

  useEffect(() => {
    if (!bottomEl || listedCount === 0) {
      isForwardsIntersectingRef.current = false;
      return undefined;
    }
    const unobserve = observeTrigger(bottomEl);
    return () => {
      isForwardsIntersectingRef.current = false;
      unobserve();
    };
  }, [listedCount, observeTrigger, bottomEl]);

  return {
    backwardsTriggerRef,
    forwardsTriggerRef,
    hasHistoryTriggers: listedCount > 0,
  };
}
