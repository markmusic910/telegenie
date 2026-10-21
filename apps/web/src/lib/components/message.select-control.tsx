'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface MessageSelectControlProps {
  selected: boolean;
  className?: string;
}

/** Round check mark at the left edge of a message row while selecting. */
export default function MessageSelectControl({ selected, className }: MessageSelectControlProps) {
  return (
    <span
      aria-hidden
      data-selected={selected ? 'true' : 'false'}
      className={cn(
        'pointer-events-none flex size-5.5 items-center justify-center rounded-full border-2 transition-colors',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-muted-foreground/50 bg-background/80 text-transparent',
        className,
      )}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  );
}
