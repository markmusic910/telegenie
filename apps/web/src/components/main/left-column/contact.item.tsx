'use client';

import { fallbackPeerDisplay } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';
import { useRouter } from 'next/navigation';
import { forwardRef, type CSSProperties, type HTMLAttributes } from 'react';

import PeerAvatar from '@/lib/components/peer.avatar';
import PeerTitle from '@/lib/components/peer.title';
import { useSDK, useStore, useStoreEntities } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import { formatUserStatus } from '@/lib/utils/date';
import { contactsHref } from '@/lib/utils/dialog-url';

interface ContactItemProps extends HTMLAttributes<HTMLLIElement> {
  contactId: string;
  style?: CSSProperties;
}

const ContactItem = observer(
  forwardRef<HTMLLIElement, ContactItemProps>(function ContactItem(
    { contactId, style, className, ...liProps },
    ref,
  ) {
    const sdk = useSDK();
    const router = useRouter();
    const globalStore = useStore('global');
    const user = useStoreEntities('user', contactId);

    if (!user) {
      return (
        <li
          ref={ref}
          style={style}
          className={cn('h-[3.75rem]', className)}
          aria-hidden
          {...liProps}
        />
      );
    }

    const selected = contactId === globalStore.nav.selectedDialogId;
    const display = user.display.name ? user.display : fallbackPeerDisplay(contactId);
    const statusLabel = formatUserStatus(user.status);
    const isOnline = statusLabel === 'online';

    return (
      <li ref={ref} style={style} className={className} {...liProps}>
        <button
          id={`contact-item-${contactId}`}
          type="button"
          onClick={() => {
            const pending = sdk.messageLoad.selectDialog(contactId);
            router.push(contactsHref(contactId));
            void pending;
          }}
          className={cn(
            'group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left',
            'transition-[background-color,border-color] duration-100 outline-none',
            'hover:border-ring hover:bg-accent focus-visible:border-ring focus-visible:bg-accent',
            selected && 'border-ring bg-accent',
          )}
        >
          <PeerAvatar peerId={contactId} display={display} photo={user.photo} />

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-baseline justify-between gap-1">
              <PeerTitle display={display} />
            </div>
            <span
              className={cn(
                'truncate text-xs leading-snug',
                isOnline ? 'font-medium text-primary' : 'text-muted-foreground',
              )}
            >
              {statusLabel}
            </span>
          </div>
        </button>
      </li>
    );
  }),
);

ContactItem.displayName = 'ContactItem';

export default ContactItem;
