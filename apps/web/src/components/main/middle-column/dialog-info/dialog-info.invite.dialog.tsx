'use client';

import type { User as SDKUser } from '@telegenie/sdk';
import { fallbackPeerDisplay } from '@telegenie/sdk';
import { Search, UserPlus } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import PeerAvatar from '@/lib/components/peer.avatar';
import { Button } from '@/lib/components/ui/button';
import { Checkbox } from '@/lib/components/ui/checkbox';
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/lib/components/ui/input-group';
import { useSDK } from '@/lib/contexts/sdk.context';
import { formatUserStatus } from '@/lib/utils/date';

export interface DialogInfoInviteDialogProps {
  peerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogInfoInviteDialog = observer(function DialogInfoInviteDialog({
  peerId,
  open,
  onOpenChange,
}: DialogInfoInviteDialogProps) {
  const sdk = useSDK();
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<SDKUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;

    async function loadContacts() {
      setLoading(true);
      try {
        const list = await sdk.user.getContacts();
        if (active) setContacts(list);
      } catch (err) {
        console.error('[DialogInfoInviteDialog] failed to load contacts', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadContacts();
    return () => {
      active = false;
    };
  }, [open, sdk]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedIds(new Set());
    }
  }, [open]);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((contact) => {
      const display = contact.display ?? fallbackPeerDisplay(contact.id);
      return display.name.toLowerCase().includes(q) || contact.id.includes(q);
    });
  }, [contacts, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleInvite = async () => {
    if (selectedIds.size === 0 || inviting) return;
    setInviting(true);
    try {
      await sdk.channel.inviteMembers(peerId, [...selectedIds]);
      toast.success('Invited members');
      onOpenChange(false);
    } catch {
      toast.error('Failed to invite members');
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup
        showCloseButton={false}
        className="flex h-[min(520px,85vh)] max-w-md flex-col rounded-2xl border bg-background shadow-lg outline-none"
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <UserPlus className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <DialogTitle className="text-base font-semibold">Add members</DialogTitle>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={selectedIds.size === 0 || inviting}
            loading={inviting}
            onClick={() => void handleInvite()}
          >
            Add
          </Button>
        </DialogHeader>

        <DialogPanel className="flex min-h-0 flex-1 flex-col gap-3 p-4 pt-2" scrollFade={false}>
          <InputGroup className="w-full shrink-0">
            <InputGroupAddon align="inline-start">
              <Search className="size-4 text-muted-foreground" aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Who would you like to add?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </InputGroup>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading contacts…</p>
            ) : filteredContacts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No contacts found</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {filteredContacts.map((contact) => {
                  const isChecked = selectedIds.has(contact.id);
                  const display = contact.display ?? fallbackPeerDisplay(contact.id);
                  return (
                    <li key={contact.id}>
                      <button
                        type="button"
                        onClick={() => toggleSelect(contact.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent/40"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <PeerAvatar
                            peerId={contact.id}
                            display={display}
                            photo={contact.photo}
                            className="size-10"
                          />
                          <div className="min-w-0 text-left">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {display.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatUserStatus(contact.status)}
                            </p>
                          </div>
                        </div>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleSelect(contact.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
});

export default DialogInfoInviteDialog;