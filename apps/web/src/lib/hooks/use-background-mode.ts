'use client';

import { useEffect, useRef } from 'react';

export type BackgroundModeListener = (isBackground: boolean) => void;

const listeners = new Set<BackgroundModeListener>();

function computeIsBackground(): boolean {
  if (typeof document === 'undefined') return false;
  return document.hidden || !document.hasFocus();
}

let isBackground = computeIsBackground();

function setBackground(next: boolean) {
  if (isBackground === next) return;
  isBackground = next;
  for (const listener of listeners) listener(isBackground);
}

function handleVisibility() {
  setBackground(computeIsBackground());
}

function handleBlur() {
  setBackground(true);
}

function handleFocus() {
  setBackground(computeIsBackground());
}

if (typeof window !== 'undefined') {
  window.addEventListener('blur', handleBlur);
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibility);
}

export function isBackgroundModeActive(): boolean {
  return isBackground;
}

/** Register listeners. Window events are attached once at module load. */
export function subscribeBackgroundMode(
  ...nextListeners: BackgroundModeListener[]
): () => void {
  for (const listener of nextListeners) {
    listeners.add(listener);
    if (isBackground) listener(true);
  }
  return () => {
    for (const listener of nextListeners) listeners.delete(listener);
  };
}

export function useBackgroundMode(
  onChange?: BackgroundModeListener | readonly (BackgroundModeListener | undefined)[],
  isDisabled = false,
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (isDisabled) return undefined;

    const listener: BackgroundModeListener = (background) => {
      const current = onChangeRef.current;
      if (!current) return;
      if (typeof current === 'function') {
        current(background);
        return;
      }
      for (const callback of current) callback?.(background);
    };

    return subscribeBackgroundMode(listener);
  }, [isDisabled]);
}
