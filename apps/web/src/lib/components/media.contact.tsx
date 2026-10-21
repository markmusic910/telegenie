'use client';

import PeerAvatar from '@/lib/components/peer.avatar';
import { useDialogPeer } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import type { MessageMediaContact } from '@telegenie/libs/foundation/telegram/types/api-types';
import { initialsFromName } from '@telegenie/sdk';

export interface MediaContactProps {
  contact: MessageMediaContact;
  isOutgoing?: boolean;
  className?: string;
}

function contactDisplayName(contact: MessageMediaContact): string {
  const first = contact.firstName?.trim() ?? '';
  const last = contact.lastName?.trim() ?? '';
  return [first, last].filter(Boolean).join(' ') || 'Contact';
}

export default function MediaContact({
  contact,
  isOutgoing = false,
  className,
}: MediaContactProps) {
  const name = contactDisplayName(contact);
  const peer = useDialogPeer(contact.userId || null);
  const display = peer?.display ?? {
    name,
    initials: initialsFromName(name),
    isVerified: false,
    isSavedMessages: false,
  };
  const accentClass = isOutgoing ? 'text-primary-foreground' : 'text-rose-500 dark:text-rose-400';
  const barClass = isOutgoing ? 'bg-primary-foreground' : 'bg-rose-500 dark:bg-rose-400';
  const dividerClass = isOutgoing ? 'border-primary-foreground/20' : 'border-border/50';
  const mutedClass = isOutgoing ? 'text-primary-foreground/80' : 'text-muted-foreground';

  return (
    <div
      className={cn(
        'relative flex min-w-[220px] max-w-[340px] flex-col overflow-hidden rounded-xl mb-1 select-none',
        isOutgoing
          ? 'bg-black/15 text-primary-foreground'
          : 'bg-muted/80 text-foreground border border-border/40',
        className,
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className={cn('w-0.5 shrink-0 self-stretch rounded-full', barClass)} aria-hidden />
        {contact.userId ? (
          <PeerAvatar
            peerId={contact.userId}
            display={display}
            photo={peer?.photo}
            className="size-11 text-sm"
          />
        ) : (
          <div
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
              isOutgoing
                ? 'bg-primary-foreground/20'
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
            )}
          >
            {display.initials}
          </div>
        )}
        <div className="min-w-0 flex flex-1 flex-col gap-0.5">
          <span className={cn('truncate text-sm font-semibold leading-tight', accentClass)}>
            {name}
          </span>
          {contact.phoneNumber ? (
            <span className={cn('truncate text-xs leading-tight', mutedClass)}>
              {contact.phoneNumber}
            </span>
          ) : null}
        </div>
      </div>
      <div className={cn('border-t', dividerClass)} />
      <button
        type="button"
        className={cn(
          'w-full !border-0 !border-transparent bg-transparent px-3 py-2 text-center text-xs font-semibold transition-none hover:!border-transparent hover:!bg-transparent focus-visible:outline-none',
          accentClass,
        )}
      >
        Send Message
      </button>
    </div>
  );
}
