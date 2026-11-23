'use client';

import { Skeleton } from '@/lib/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { InputCompletionOption } from '@telegenie/agent/worker';
import { Sparkles, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface ComposerCompleteSuggestProps {
  loading: boolean;
  options: InputCompletionOption[];
  selectedIndex: number;
  error?: string | null;
  onSelect: (option: InputCompletionOption) => void;
  onHover: (index: number) => void;
  onDismiss: () => void;
}

export default function ComposerCompleteSuggest({
  loading,
  options,
  selectedIndex,
  error,
  onSelect,
  onHover,
  onDismiss,
}: ComposerCompleteSuggestProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [onDismiss]);

  if (!loading && !error && options.length === 0) return null;

  return (
    <div
      ref={rootRef}
      role="listbox"
      aria-label="AI message completion suggestions"
      className="absolute bottom-full start-0 z-30 mb-2 w-full rounded-xl border border-border bg-popover p-2 shadow-md"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" aria-hidden />
          <span>{loading ? 'Genie is drafting suggestions...' : 'AI Suggestions'}</span>
          {!loading && options.length > 0 ? (
            <span className="hidden text-[10px] text-muted-foreground/70 sm:inline">
              · ↑↓ navigate · Enter / Tab accept · Esc dismiss
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss suggestions"
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-1.5 px-1 py-0.5">
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-8 w-11/12 rounded-lg" />
          <Skeleton className="h-8 w-4/5 rounded-lg" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {options.map((option, index) => {
            const isSelected = index === selectedIndex;
            return (
              <li key={`${index}-${option.text.slice(0, 24)}`} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onMouseEnter={() => onHover(index)}
                  onMouseDown={(event) => {
                    // Prevent textarea blur before applying the selection
                    event.preventDefault();
                  }}
                  onClick={() => onSelect(option)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-start text-xs leading-relaxed transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent/60',
                  )}
                >
                  {option.label ? (
                    <span className="mt-0.5 shrink-0 rounded-full border border-border bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {option.label}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {option.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
