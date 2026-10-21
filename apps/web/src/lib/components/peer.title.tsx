'use client';

import type { PeerDisplay } from '@telegenie/sdk';
import { BadgeCheck, BellOff } from 'lucide-react';

import { cn } from '@/lib/utils';

type PeerTitleProps = {
  display: PeerDisplay;
  muted?: boolean;
  unread?: boolean;
  className?: string;
};

export default function PeerTitle({ display, muted = false, unread = false, className }: PeerTitleProps) {
  return (
    <span className={cn('flex min-w-0 items-center gap-1', className)}>
      <span
        className={cn(
          'truncate text-sm leading-snug text-foreground',
          unread ? 'font-semibold' : 'font-medium',
        )}
      >
        {display.name}
      </span>
      {display.isVerified && (
        <BadgeCheck
          className="size-3.5 shrink-0 text-primary"
          aria-label="Verified"
        />
      )}
      {muted && (
        <BellOff
          className="size-3 shrink-0 text-muted-foreground"
          aria-label="Muted"
        />
      )}
    </span>
  );
}
