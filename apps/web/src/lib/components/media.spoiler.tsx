'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MediaSpoilerProps {
  isVisible: boolean;
  onReveal?: () => void;
  className?: string;
  label?: string;
  thumbUri?: string;
}

const ANIMATION_DURATION_MS = 500;

export default function MediaSpoiler({
  isVisible,
  onReveal,
  className,
  label = 'Spoiler',
  thumbUri,
}: MediaSpoilerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isRendered, setIsRendered] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      setIsRendered(true);
      setIsClosing(false);
    }
  }, [isVisible]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (isClosing) return;

      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const shiftX = x - rect.width / 2;
        const shiftY = y - rect.height / 2;
        container.style.setProperty('--click-shift-x', `${shiftX}px`);
        container.style.setProperty('--click-shift-y', `${shiftY}px`);
      }

      setIsClosing(true);
      setTimeout(() => {
        setIsRendered(false);
        onReveal?.();
      }, ANIMATION_DURATION_MS);
    },
    [isClosing, onReveal],
  );

  if (!isRendered) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'media-spoiler-root',
        isClosing && 'media-spoiler-closing',
        className,
      )}
      onClick={handleClick}
    >
      {thumbUri && (
        <img
          src={thumbUri}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover filter blur-md scale-110 opacity-60 pointer-events-none"
        />
      )}
      <div className="media-spoiler-dots" />
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-white pointer-events-none transition-opacity duration-300">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md shadow-md border border-white/10">
          <EyeOff className="size-4 opacity-90" />
          <span className="text-xs font-semibold tracking-wide drop-shadow-sm">{label}</span>
        </div>
        <span className="text-[11px] text-white/80 mt-1 font-medium drop-shadow-sm">
          Click to reveal
        </span>
      </div>
    </div>
  );
}
