'use client';

import { useStableCallback } from '@/lib/hooks/use-stable-callback';
import { useEffect, useRef } from 'react';

type UseDebounceOptions = {
  /**
   * When true (default), each `run` restarts the delay.
   * When false, the first `run` wins and later calls are ignored until it fires or `cancel`.
   */
  restart?: boolean;
};

/**
 * Delay `callback` until `delayMs` after `run`. Cancels a pending call on unmount.
 */
export function useDebounce<T extends (...args: never[]) => void>(
  callback: T,
  delayMs: number,
  options?: UseDebounceOptions,
): { run: T; cancel: () => void } {
  const restart = options?.restart ?? true;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef(delayMs);
  delayRef.current = delayMs;

  const stableCallback = useStableCallback(callback);

  const cancel = useStableCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  });

  const run = useStableCallback(((...args: Parameters<T>) => {
    if (timerRef.current) {
      if (!restart) return;
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      stableCallback(...args);
    }, delayRef.current);
  }) as T);

  useEffect(() => cancel, [cancel]);

  return { run, cancel };
}
