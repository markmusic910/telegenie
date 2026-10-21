'use client';

import { useDocumentEvent } from '@/lib/hooks/use-document-event';
import { retainCustomEmoji, type RetainedCustomEmoji } from '@/lib/rlottie/rlottie-pool';
import { cn } from '@/lib/utils';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type CustomEmojiView = {
  documentId: string;
  src: string;
  size: number;
  element: HTMLElement;
  /** First decoded frame is on the shared canvas. */
  onReady?: () => void;
};

type CustomEmojiSurfaceApi = {
  register: (view: CustomEmojiView) => () => void;
};

const CustomEmojiSurfaceContext = createContext<CustomEmojiSurfaceApi | null>(null);

export function useCustomEmojiSurface(): CustomEmojiSurfaceApi | null {
  return useContext(CustomEmojiSurfaceContext);
}

type LiveView = CustomEmojiView & { retained: RetainedCustomEmoji };

/**
 * One canvas for every animated custom emoji inside `children`.
 * Each cell stays a placeholder for layout and clicks; this blits the shared
 * RLottie frame into that placeholder's rectangle. Used by the featured strip,
 * an open emoji set, search results, and each message bubble.
 */
export default function CustomEmojiSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewsRef = useRef(new Map<number, LiveView>());
  const seqRef = useRef(0);
  const rafRef = useRef(0);
  const drawingRef = useRef(false);
  const scheduleRef = useRef<() => void>(() => undefined);

  const [api] = useState<CustomEmojiSurfaceApi>(() => ({
    register(view) {
      const id = ++seqRef.current;
      const retained = retainCustomEmoji({
        documentId: view.documentId,
        src: view.src,
        size: view.size,
      });
      viewsRef.current.set(id, { ...view, retained });
      let ready = false;
      const notifyReady = () => {
        if (ready || !retained.getBitmap()) return;
        ready = true;
        view.onReady?.();
      };
      const unsubscribe = retained.subscribe(() => {
        notifyReady();
        scheduleRef.current();
      });
      notifyReady();
      scheduleRef.current();
      return () => {
        unsubscribe();
        retained.release();
        viewsRef.current.delete(id);
        scheduleRef.current();
      };
    },
  }));

  scheduleRef.current = () => {
    if (drawingRef.current || viewsRef.current.size === 0 || document.hidden) return;
    drawingRef.current = true;
    const loop = () => {
      const root = rootRef.current;
      const canvas = canvasRef.current;
      if (root && canvas) {
        const bounds = root.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(bounds.width * dpr));
        const height = Math.max(1, Math.round(bounds.height * dpr));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        const context = canvas.getContext('2d');
        if (context) {
          context.clearRect(0, 0, width, height);
          const canvasBounds = canvas.getBoundingClientRect();
          for (const view of viewsRef.current.values()) {
            if (!view.element.isConnected) continue;
            const bitmap = view.retained.getBitmap();
            if (!bitmap) continue;
            const rect = view.element.getBoundingClientRect();
            context.drawImage(
              bitmap,
              (rect.left - canvasBounds.left) * dpr,
              (rect.top - canvasBounds.top) * dpr,
              view.size * dpr,
              view.size * dpr,
            );
          }
        }
      }
      if (viewsRef.current.size === 0 || document.hidden) {
        drawingRef.current = false;
        rafRef.current = 0;
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  useDocumentEvent('visibilitychange', () => {
    if (!document.hidden) scheduleRef.current();
  });

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      drawingRef.current = false;
    };
  }, []);

  return (
    <CustomEmojiSurfaceContext.Provider value={api}>
      <div ref={rootRef} className={cn('relative', className)}>
        {children}
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 size-full"
        />
      </div>
    </CustomEmojiSurfaceContext.Provider>
  );
}
