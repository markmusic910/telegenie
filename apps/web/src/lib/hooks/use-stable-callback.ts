'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';

/** Stable function identity that always calls the latest `handler`. */
export function useStableCallback<T extends (...args: never[]) => unknown>(handler: T): T {
  const handlerRef = useRef(handler);

  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  return useCallback(((...args: Parameters<T>) => handlerRef.current(...args)) as T, []);
}
