'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Camera, Search, UserPlus } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useSDK } from '@/lib/contexts/sdk.context';
import type { User as SDKUser } from '@telegenie/sdk';

import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogPanel,
} from '@/lib/components/ui/dialog';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/lib/components/ui/input-group';
import { Checkbox } from '@/lib/components/ui/checkbox';
import PeerAvatar from '@/lib/components/peer.avatar';
import { formatUserStatus } from '@/lib/utils/date';
import { fallbackPeerDisplay } from '@telegenie/sdk';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateGroupDialog = observer(({ open, onOpenChange }: CreateGroupDialogProps) => {
  const sdk = useSDK();

  const [name, setName] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<SDKUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load contacts
  useEffect(() => {
    if (!open) return;
    let active = true;

    async function loadContacts() {
      setLoading(true);
      try {
        const list = await sdk.user.getContacts();
        if (active) {
          setContacts(list);
        }
      } catch (err) {
        console.error('[CreateGroupDialog] failed to load contacts', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadContacts();

    return () => {
      active = false;
    };
  }, [open, sdk]);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setName('');
      setPhotoFile(null);
      setPhotoPreview('');
      setSearchQuery('');
      setSelectedIds(new Set());
    }
  }, [open]);

  // Filter contacts by search query
  const filteredContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) => {
      const display = contact.display;
      const fullName = `${display.name || ''} ${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
      return fullName.includes(query) || (contact.username && contact.username.toLowerCase().includes(query));
    });
  }, [contacts, searchQuery]);

  const handleToggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);

    try {
      const isSupergroup = selectedIds.size >= 199;
      let createdId = '';
      let accessHash = '';

      const usersArg = Array.from(selectedIds).map((id) => {
        const contact = contacts.find((c) => c.id === id);
        return {
          id,
          accessHash: contact?.accessHash,
        };
      });

      if (isSupergroup) {
        // Create Supergroup/Megagroup channel
        const channel = await sdk.channel.createGroup(name, '', usersArg);
        createdId = channel.id;
        accessHash = channel.accessHash ?? '';
      } else {
        // Create Basic Group
        const result = await sdk.chat.createBasicGroup(name, usersArg);
        createdId = result.chat.id;
        accessHash = '';
      }

      // Upload group photo if selected
      if (photoFile && createdId) {
        await sdk.chat.editPhoto(createdId, photoFile, accessHash);
      }

      onOpenChange(false);
      if (createdId) {
        void sdk.messageLoad.selectDialog(createdId);
      }
    } catch (err) {
      console.error('[CreateGroupDialog] failed to create group', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup showCloseButton={false} className="max-w-md h-[550px] flex flex-col rounded-2xl border bg-background shadow-lg outline-none">
        <DialogHeader className="px-6 py-4 flex flex-row items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <UserPlus className="size-5 text-primary" />
            <DialogTitle className="text-lg font-bold text-foreground">New Group</DialogTitle>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
              {selectedIds.size} / 200,000
            </span>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              loading={creating}
            >
              Create
            </Button>
          </div>
        </DialogHeader>

        <DialogPanel className="flex-1 flex flex-col p-6 pt-0 overflow-hidden" scrollFade={false}>
          {/* Basic Config: Name and Photo */}
          <div className="flex items-center gap-4 mt-4 mb-4 pb-4 border-b border-border">
            <button
              type="button"
              onClick={handlePhotoClick}
              className="relative size-16 rounded-full bg-accent border border-border flex items-center justify-center cursor-pointer overflow-hidden group hover:bg-accent/80 transition-colors duration-150 shrink-0"
              aria-label="Upload group photo"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Group preview" className="absolute inset-0 size-full object-cover" />
              ) : (
                <Camera className="size-6 text-muted-foreground group-hover:text-foreground transition-colors duration-150" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-150">
                <Camera className="size-5 text-white" />
              </div>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoChange}
              accept="image/*"
              className="hidden"
            />
            <div className="flex-1">
              <Input
                placeholder="Group name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-base font-medium px-3 py-2 border rounded-md"
                autoFocus
              />
            </div>
          </div>

          {/* Search Contacts */}
          <div className="mb-3 shrink-0">
            <InputGroup className="w-full">
              <InputGroupAddon align="inline-start">
                <Search className="size-4 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                placeholder="Who would you like to add?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </InputGroup>
          </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <span className="text-sm">Loading contacts...</span>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <span className="text-sm">No contacts found</span>
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {filteredContacts.map((contact) => {
                  const isChecked = selectedIds.has(contact.id);
                  const display = contact.display ?? fallbackPeerDisplay(contact.id);
                  return (
                    <li key={contact.id} className="w-full">
                      <div
                        onClick={() => handleToggleSelect(contact.id)}
                        className="flex w-full items-center justify-between py-2 px-2 hover:bg-accent/40 rounded-lg transition-colors duration-100 cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <PeerAvatar
                            peerId={contact.id}
                            display={display}
                            photo={contact.photo}
                            className="size-10"
                          />
                          <div className="flex flex-col text-left min-w-0">
                            <span className="text-sm font-semibold truncate text-foreground">
                              {display.name}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {formatUserStatus(contact.status)}
                            </span>
                          </div>
                        </div>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleToggleSelect(contact.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mr-2"
                        />
                      </div>
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

CreateGroupDialog.displayName = 'CreateGroupDialog';
export default CreateGroupDialog;
