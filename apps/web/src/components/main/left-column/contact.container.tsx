'use client';

import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import AppNavBar from '@/components/main/app-nav.bar';
import { ScrollArea } from '@/lib/components/ui/scroll-area';
import { Skeleton } from '@/lib/components/ui/skeleton';
import { useSDK } from '@/lib/contexts/sdk.context';
import ContactItem from './contact.item';

function ContactListSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-px px-3 py-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

const ContactContainer = observer(() => {
  const sdk = useSDK();
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void sdk.user
      .getContacts()
      .then((list) => {
        if (!cancelled) {
          setContactIds(list.map((contact) => contact.id));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load contacts');
          setContactIds([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sdk.user]);

  return (
    <div className="flex h-full min-w-0 w-full flex-1 flex-col overflow-x-hidden">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-foreground">Contacts</h2>
          <span className="text-xs text-muted-foreground">
            {!loading && contactIds.length > 0 ? `${contactIds.length}` : ''}
          </span>
        </div>
      </div>

      {loading && contactIds.length === 0 ? (
        <ContactListSkeleton />
      ) : error && contactIds.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
          <span className="text-sm text-destructive">{error}</span>
          <span className="text-xs text-muted-foreground">Please try reloading.</span>
        </div>
      ) : contactIds.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
          <span className="text-sm text-muted-foreground">No contacts yet.</span>
        </div>
      ) : (
        <ScrollArea
          className="flex-1 overflow-x-hidden px-2 py-2"
          viewportClassName="overflow-x-hidden [overflow-anchor:none]"
        >
          <ul className="flex flex-col gap-px p-2" role="list" aria-label="Contact list">
            {contactIds.map((contactId) => (
              <ContactItem key={contactId} contactId={contactId} />
            ))}
          </ul>
        </ScrollArea>
      )}

      <AppNavBar />
    </div>
  );
});

export default ContactContainer;
