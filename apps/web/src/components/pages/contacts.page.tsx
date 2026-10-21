'use client';

import AppNavBar from '@/components/main/app-nav.bar';
import PeerAvatar from '@/lib/components/peer.avatar';
import { ScrollArea } from '@/lib/components/ui/scroll-area';
import { useSDK } from '@/lib/contexts/sdk.context';
import { fallbackPeerDisplay, peerProfileDisplay, type User } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

/** Contacts list in the left column, with the same bottom bar as chats and settings. */
const ContactsPage = observer(function ContactsPage() {
  const sdk = useSDK();
  const [contacts, setContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void sdk.user
      .getContacts()
      .then((list) => {
        if (!cancelled) setContacts(list);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sdk.user]);

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-full max-w-sm flex-col border-r border-border bg-card md:w-80">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <span className="text-sm font-semibold">Contacts</span>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {loading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : contacts.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No contacts yet.</p>
          ) : (
            <ul>
              {contacts.map((contact) => {
                const display = peerProfileDisplay(contact);
                return (
                  <li key={contact.id}>
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <PeerAvatar
                        peerId={contact.id}
                        display={display.name ? display : fallbackPeerDisplay(contact.id)}
                        photo={contact.photo}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{display.name || contact.id}</p>
                        {contact.phone ? (
                          <p className="truncate text-xs text-muted-foreground">{contact.phone}</p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <AppNavBar />
      </aside>
    </div>
  );
});

export default ContactsPage;
