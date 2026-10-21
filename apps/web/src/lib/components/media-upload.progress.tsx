'use client';

import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MediaUploadProgressProps {
  progress?: number;
  onAbort?: () => void;
  onCancel?: () => void;
  className?: string;
}

/**
 * Centered media upload indicator:
 * Displays a percentage, horizontal progress bar, and an abort button directly below it.
 */
export default function MediaUploadProgress({
  progress = 0,
  onAbort,
  onCancel,
  className,
}: MediaUploadProgressProps) {
  const handleAbort = onAbort ?? onCancel;
  // If progress is > 1.5, it was provided as a percentage (e.g. 25 = 25%).
  // Otherwise it's a 0..1 ratio (e.g. 0.65 = 65%, 1.2 = 100% clamped).
  const normalized = progress > 1.5 ? progress : progress * 100;
  const targetPercent = Math.min(100, Math.max(0, Math.round(normalized)));

  const [displayPercent, setDisplayPercent] = React.useState(targetPercent);

  React.useEffect(() => {
    if (displayPercent === targetPercent) return;

    const diff = Math.abs(targetPercent - displayPercent);
    // Smooth step interval: if diff is large, step faster; if small, step steadily
    const stepInterval = Math.max(6, Math.min(25, Math.floor(300 / diff)));

    const timer = setTimeout(() => {
      setDisplayPercent((prev) => {
        if (prev < targetPercent) return prev + 1;
        if (prev > targetPercent) return prev - 1;
        return prev;
      });
    }, stepInterval);

    return () => clearTimeout(timer);
  }, [displayPercent, targetPercent]);

  return (
    <div
      className={cn(
        'absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity select-none',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col items-center rounded-2xl bg-black/70 px-4 py-3 shadow-xl backdrop-blur-md border border-white/15 min-w-[110px]">
        {/* Progress % */}
        <span className="text-xs font-semibold text-white/95 tabular-nums mb-1.5">
          {displayPercent}%
        </span>

        {/* Progress Bar Track */}
        <div className="w-20 h-1.5 bg-white/25 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-75 ease-out"
            style={{ width: `${displayPercent}%` }}
          />
        </div>

        {/* Abort / Delete Button Below */}
        {handleAbort && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAbort();
            }}
            aria-label="Cancel upload"
            title="Cancel upload"
            className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/25 hover:bg-white/40 active:scale-95 text-white p-0 border-0 outline-none transition-all cursor-pointer"
          >
            <X size={14} className="text-white shrink-0" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
