'use client';

import type { ComponentProps } from 'react';
import { fallbackPeerDisplay, type PeerDisplay } from '@telegenie/sdk';

import PeerAvatar from '@/lib/components/peer.avatar';
import { cn } from '@/lib/utils';

type DialogItemSenderProps = {
  peerId: string;
  display?: PeerDisplay;
  photo?: ComponentProps<typeof PeerAvatar>['photo'];
  label: string;
  className?: string;
};

export default function DialogItemSender({
  peerId,
  display,
  photo,
  label,
  className,
}: DialogItemSenderProps) {
  const resolvedBase = display ?? fallbackPeerDisplay(peerId);
  const resolved = { ...resolvedBase, isSavedMessages: false, name: label };

  return (
    <div className={cn('flex min-w-0 items-center gap-1', className)}>
      <PeerAvatar
        peerId={peerId}
        display={resolved}
        photo={photo}
        className="size-3.5 text-[8px]"
      />
      <span className="truncate text-xs leading-snug text-foreground/80">{label}</span>
    </div>
  );
}
