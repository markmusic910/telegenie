'use client';
 
import { useStore } from '@/lib/contexts/sdk.context';
import { MAIN_THREAD_ID } from '@telegenie/sdk';
import { reaction } from 'mobx';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export type ObserveFn = (
  element: Element,
  onIntersecting?: (isIntersecting: boolean) => void,
) => () => void;

type IntersectionEntryLike = {
  isIntersecting: boolean;
  target: Element;
};

type UseIntersectionObserverOptions = {
  rootRef: RefObject<HTMLElement | null>;
  /** When set, the observer is (re)created for this element instead of only `rootRef.current`. */
  root?: HTMLElement | null;
  rootMargin?: string;
  throttleMs?: number;
  isDisabled?: boolean;
  /** Scope freeze observation to a specific dialog, otherwise defaults to active nav dialog. */
  peerId?: string;
  /** Scope freeze observation to a specific thread, otherwise defaults to active thread. */
  threadId?: string;
  onIntersect?: (entries: IntersectionEntryLike[]) => void;
};

export function useIntersectionObserver({
  rootRef,
  root,
  rootMargin = '0px',
  throttleMs = 0,
  isDisabled = false,
  peerId,
  threadId,
  onIntersect,
}: UseIntersectionObserverOptions) {
  const globalStore = useStore('global');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementsRef = useRef(new Set<Element>());
  const callbacksRef = useRef(new Map<Element, (isIntersecting: boolean) => void>());
  const onIntersectRef = useRef(onIntersect);
  const freezeCountRef = useRef(0);
  const pendingEntriesRef = useRef(new Map<Element, IntersectionEntryLike>());
  const pendingFlushRef = useRef(false);
  const lastRunRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  onIntersectRef.current = onIntersect;

  const mergeEntries = useCallback((entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      pendingEntriesRef.current.set(entry.target, {
        isIntersecting: entry.isIntersecting,
        target: entry.target,
      });
    }
  }, []);

  const flush = useCallback(() => {
    if (freezeCountRef.current > 0) {
      pendingFlushRef.current = true;
      return;
    }

    const entries = Array.from(pendingEntriesRef.current.values());
    pendingEntriesRef.current.clear();
    pendingFlushRef.current = false;
    if (entries.length === 0) return;

    for (const entry of entries) {
      callbacksRef.current.get(entry.target)?.(entry.isIntersecting);
    }
    onIntersectRef.current?.(entries);
  }, []);

  const schedule = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      mergeEntries(entries);
      if (freezeCountRef.current > 0) {
        pendingFlushRef.current = true;
        return;
      }
      if (throttleMs <= 0) {
        flush();
        return;
      }
      if (timerRef.current) return;
      const elapsed = Date.now() - lastRunRef.current;
      const delay = Math.max(0, throttleMs - elapsed);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        lastRunRef.current = Date.now();
        flush();
      }, delay);
    },
    [flush, mergeEntries, throttleMs],
  );

  useEffect(() => {
    if (isDisabled) return undefined;

    const observerRoot = root ?? rootRef.current;
    if (!observerRoot) return undefined;

    observerRef.current?.disconnect();
    const observer = new IntersectionObserver((entries) => schedule(entries), {
      root: observerRoot,
      rootMargin,
    });
    observerRef.current = observer;
    for (const element of elementsRef.current) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isDisabled, root, rootMargin, rootRef, schedule]);

  const unobserve = useCallback((element: Element | null | undefined) => {
    if (!element) return;
    elementsRef.current.delete(element);
    callbacksRef.current.delete(element);
    pendingEntriesRef.current.delete(element);
    observerRef.current?.unobserve(element);
  }, []);

  const observe = useCallback(
    (element: Element | null | undefined, onIntersecting?: (isIntersecting: boolean) => void) => {
      if (!element) return () => undefined;
      elementsRef.current.add(element);
      if (onIntersecting) {
        callbacksRef.current.set(element, onIntersecting);
      }
      observerRef.current?.observe(element);
      return () => unobserve(element);
    },
    [unobserve],
  );

  const freeze = useCallback(() => {
    freezeCountRef.current += 1;
  }, []);

  const unfreeze = useCallback(() => {
    if (freezeCountRef.current === 0) return;
    freezeCountRef.current -= 1;
    if (freezeCountRef.current > 0) return;

    const extra = observerRef.current?.takeRecords() ?? [];
    if (extra.length > 0) mergeEntries(extra);
    if (pendingFlushRef.current || pendingEntriesRef.current.size > 0) {
      flush();
    }
  }, [flush, mergeEntries]);

  useEffect(() => {
    let wasFrozen = false;
    return reaction(
      () => {
        const targetPeerId = peerId ?? globalStore.nav.selectedDialogId;
        if (!targetPeerId) return false;
        const targetThreadId =
          threadId ?? globalStore.getDialogUI(targetPeerId)?.activeThreadId ?? MAIN_THREAD_ID;
        return globalStore.getThreadUI(targetPeerId, targetThreadId)?.isScrollFrozen ?? false;
      },
      (isFrozen) => {
        if (isFrozen === wasFrozen) return;
        wasFrozen = isFrozen;
        if (isFrozen) {
          freeze();
        } else {
          unfreeze();
        }
      },
      { fireImmediately: true },
    );
  }, [freeze, globalStore, peerId, threadId, unfreeze]);

  return { observe: observe as ObserveFn, unobserve, freeze, unfreeze };
}

export function useOnIntersect(
  targetRef: RefObject<Element | null>,
  observe: ObserveFn | undefined,
) {
  useEffect(() => {
    const element = targetRef.current;
    if (!element || !observe) return undefined;
    return observe(element);
  }, [observe, targetRef]);
}

/** Load full media once the element is near the scroller viewport; stay loaded after that. */
export function useCanLoadMedia(observe?: ObserveFn) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [canLoad, setCanLoad] = useState(!observe);

  useEffect(() => {
    if (!observe) {
      setCanLoad(true);
      return undefined;
    }
    if (!element) return undefined;
    return observe(element, (isIntersecting) => {
      if (isIntersecting) setCanLoad(true);
    });
  }, [element, observe]);

  return { ref: setElement, canLoad };
}
