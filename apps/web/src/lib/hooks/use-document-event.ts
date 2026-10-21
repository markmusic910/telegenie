'use client';

import { useEffect, useRef } from 'react';

type DocumentListener = (event: Event) => void;

type EventBucket = {
  listeners: Set<DocumentListener>;
  handler: (event: Event) => void;
};

const buckets = new Map<string, EventBucket>();

function subscribeDocumentEvent(type: string, listener: DocumentListener): () => void {
  let bucket = buckets.get(type);
  if (!bucket) {
    const listeners = new Set<DocumentListener>();
    const handler = (event: Event) => {
      for (const item of [...listeners]) item(event);
    };
    document.addEventListener(type, handler);
    bucket = { listeners, handler };
    buckets.set(type, bucket);
  }
  bucket.listeners.add(listener);
  return () => {
    const current = buckets.get(type);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size > 0) return;
    document.removeEventListener(type, current.handler);
    buckets.delete(type);
  };
}

/** Share one `document` listener per event name across every subscriber. */
export function useDocumentEvent<K extends keyof DocumentEventMap>(
  type: K,
  listener: (event: DocumentEventMap[K]) => void,
): void {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    return subscribeDocumentEvent(type, (event) => {
      listenerRef.current(event as DocumentEventMap[K]);
    });
  }, [type]);
}
