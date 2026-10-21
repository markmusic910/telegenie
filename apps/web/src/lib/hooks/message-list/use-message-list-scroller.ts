'use client';

import {
  createMessageListScrollerStore,
  type MessageListScrollerStore,
  type ScrollerEvent,
  type ScrollerMetrics,
} from '@/lib/hooks/message-list/message-list-scroller.store';
import { useStableCallback } from '@/lib/hooks/use-stable-callback';
import { type RefObject, useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Host hook for the message-list scroller: attach DOM listeners once, fan out to many subscribers.
 *
 * Call exactly once per message list (e.g. in `MessageList`). It creates a stable
 * {@link MessageListScrollerStore} and, when `scrollerRef.current` is set, attaches:
 * - one passive `scroll` listener on the scroller root
 * - one `ResizeObserver` on the scroller's first child (message content wrapper)
 *
 * Feature hooks (`usePinToBottom`, `useMessageListHistory`, etc.) must **not**
 * add their own scroll/resize listeners. Pass the returned store and subscribe via
 * {@link useMessageListScrollerEvent} (side effects) or {@link useMessageListScrollerMetrics}
 * (reactive `scrollOffset` / `distanceFromBottom` via `useSyncExternalStore`).
 *
 * Ref timing: attach runs in `useEffect`, so the scroller element must exist by then.
 * If the ref is still null on first paint, a later MobX-driven re-render re-runs the
 * effect and attaches once the div has mounted (same behavior as the pre-store hook).
 */
export function useMessageListScrollerHost(
  scrollerRef: RefObject<HTMLElement | null>,
): MessageListScrollerStore {
  const storeRef = useRef<MessageListScrollerStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createMessageListScrollerStore();
  }

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return undefined;
    return storeRef.current!.attach(root);
  }, [scrollerRef]);

  return storeRef.current;
}

/** Subscribe to scroll or resize events from the shared message list scroller store. */
export function useMessageListScrollerEvent(
  store: MessageListScrollerStore,
  event: ScrollerEvent,
  handler: () => void,
) {
  const stableHandler = useStableCallback(handler);

  useEffect(() => store.subscribe(event, stableHandler), [event, stableHandler, store]);
}

/** Read live scroller metrics without attaching extra DOM listeners. */
export function useMessageListScrollerMetrics(store: MessageListScrollerStore): ScrollerMetrics {
  return useSyncExternalStore(store.subscribeMetrics, store.getMetrics, store.getMetrics);
}
