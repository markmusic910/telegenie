'use client';

import { useIntersectionObserver, type ObserveFn } from '@/lib/hooks/use-intersection-observer';
import type { RefObject } from 'react';

const MEDIA_LOAD_THROTTLE_MS = 350;
const MEDIA_LOAD_MARGIN = '400px 0px';

type UseMessageListMediaOptions = {
  scrollRootRef: RefObject<HTMLElement | null>;
  scrollRoot?: HTMLElement | null;
};

export function useMessageListMedia({
  scrollRootRef,
  scrollRoot,
}: UseMessageListMediaOptions): ObserveFn {
  const { observe } = useIntersectionObserver({
    rootRef: scrollRootRef,
    root: scrollRoot,
    rootMargin: MEDIA_LOAD_MARGIN,
    throttleMs: MEDIA_LOAD_THROTTLE_MS,
  });
  return observe;
}
