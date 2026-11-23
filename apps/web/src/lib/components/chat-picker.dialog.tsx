'use client';

import { fallbackPeerDisplay, peerProfileDisplay } from '@telegenie/sdk';
import { Search } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import PeerAvatar from '@/lib/components/peer.avatar';
import { Button } from '@/lib/components/ui/button';
import { Checkbox } from '@/lib/components/ui/checkbox';
import {
  Dialog as DialogRoot,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/lib/components/ui/input-group';
import { useDialogPeer, useStore } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';

export type ChatPickerTypeOption = {
  id: string;
  label: string;
  icon?: ReactNode;
};

export interface ChatPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  mode: 'single' | 'multiple';
  /** Initial selected peer ids when `mode === 'multiple'`. */
  selectedPeerIds?: string[];
  /** Optional peer ids that cannot be toggled (e.g. already in the opposite list). */
  disabledPeerIds?: string[];
  /** Optional Telegram chat type toggles (e.g. Contacts, Groups, Muted, Archived). */
  chatTypes?: ChatPickerTypeOption[];
  selectedChatTypes?: string[];
  /** Include Saved Messages (self) at the top of the list. */
  includeSavedMessages?: boolean;
  /** Include archived dialogs in the candidate list (useful for folder rules). */
  includeArchived?: boolean;
  confirmLabel?: string;
  busy?: boolean;
  onSelectSingle?: (peerId: string) => void | Promise<void>;
  onConfirmMultiple?: (result: { peerIds: string[]; chatTypes: string[] }) => void;
}

function matchesQuery(name: string, username: string | undefined, query: string): boolean {
  if (!query) return true;
  if (name.toLowerCase().includes(query)) return true;
  return Boolean(username && username.toLowerCase().includes(query));
}

const ChatPickerRow = observer(function ChatPickerRow({
  peerId,
  self,
  query,
  mode,
  selected,
  disabled,
  onClick,
}: {
  peerId: string;
  self: boolean;
  query: string;
  mode: 'single' | 'multiple';
  selected: boolean;
  disabled: boolean;
  onClick: (peerId: string) => void;
}) {
  const peer = useDialogPeer(peerId);
  const base = peer?.display ?? (peer ? peerProfileDisplay(peer) : fallbackPeerDisplay(peerId));
  const display = self ? { ...base, name: 'Saved Messages', isSavedMessages: true } : base;
  const username = peer && 'username' in peer ? peer.username : undefined;
  if (!matchesQuery(display.name, username, query)) return null;

  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={mode === 'multiple' ? selected : undefined}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
          'hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
          mode === 'multiple' && selected && 'bg-accent/60',
        )}
        onClick={() => onClick(peerId)}
      >
        {mode === 'multiple' ? (
          <Checkbox
            checked={selected}
            disabled={disabled}
            tabIndex={-1}
            className="pointer-events-none shrink-0"
          />
        ) : null}
        <PeerAvatar peerId={peerId} display={display} photo={peer?.photo} className="size-9" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{display.name}</div>
          {username ? (
            <div className="truncate text-xs text-muted-foreground">@{username}</div>
          ) : null}
        </div>
      </button>
    </li>
  );
});

const ChatPickerDialog = observer(function ChatPickerDialog({
  open,
  onOpenChange,
  title,
  mode,
  selectedPeerIds = [],
  disabledPeerIds = [],
  chatTypes = [],
  selectedChatTypes = [],
  includeSavedMessages = true,
  includeArchived = false,
  confirmLabel = 'Save',
  busy = false,
  onSelectSingle,
  onConfirmMultiple,
}: ChatPickerDialogProps) {
  const globalStore = useStore('global');
  const dialogStore = useStore('dialog');

  const [query, setQuery] = useState('');
  const [draftPeers, setDraftPeers] = useState<Set<string>>(() => new Set(selectedPeerIds));
  const [draftTypes, setDraftTypes] = useState<Set<string>>(() => new Set(selectedChatTypes));

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setDraftPeers(new Set(selectedPeerIds));
    setDraftTypes(new Set(selectedChatTypes));
  }, [open, selectedPeerIds, selectedChatTypes]);

  const disabledSet = useMemo(() => new Set(disabledPeerIds), [disabledPeerIds]);

  const selfId = globalStore.auth.currentUser?.id;
  const dialogs = dialogStore.getAllData();
  const navOrder = includeArchived
    ? globalStore.nav.sortedDialogIdsWithArchived.length > 0
      ? globalStore.nav.sortedDialogIdsWithArchived
      : globalStore.nav.sortedDialogIds
    : globalStore.nav.sortedDialogIds;
  const order = navOrder.length > 0 ? navOrder : Array.from(dialogs.keys());

  const peerIds: string[] = [];
  const seen = new Set<string>();
  for (const dialogId of order) {
    const dialog = dialogs.get(dialogId);
    if (dialog?.isFolder) continue;
    const peerId = dialog?.peerId;
    if (!peerId || seen.has(peerId)) continue;
    seen.add(peerId);
    peerIds.push(peerId);
  }
  // Ensure already-selected peer IDs stay visible even if not in the active dialog list.
  for (const peerId of selectedPeerIds) {
    if (!seen.has(peerId)) {
      seen.add(peerId);
      peerIds.unshift(peerId);
    }
  }
  if (includeSavedMessages && selfId && !seen.has(selfId)) {
    peerIds.unshift(selfId);
  }

  const trimmed = query.trim().toLowerCase();
  const visibleTypes = useMemo(
    () =>
      chatTypes.filter((item) => !trimmed || item.label.toLowerCase().includes(trimmed)),
    [chatTypes, trimmed],
  );

  const togglePeer = (peerId: string) => {
    if (disabledSet.has(peerId)) return;
    setDraftPeers((prev) => {
      const next = new Set(prev);
      if (next.has(peerId)) next.delete(peerId);
      else next.add(peerId);
      return next;
    });
  };

  const toggleType = (typeId: string) => {
    setDraftTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });
  };

  const handleRowClick = (peerId: string) => {
    if (mode === 'single') {
      void onSelectSingle?.(peerId);
      return;
    }
    togglePeer(peerId);
  };

  const handleConfirm = () => {
    onConfirmMultiple?.({
      peerIds: Array.from(draftPeers),
      chatTypes: Array.from(draftTypes),
    });
    onOpenChange(false);
  };

  const totalSelected = draftPeers.size + draftTypes.size;

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogPopup
        className="flex max-h-[min(580px,85vh)] flex-col gap-0 p-0 sm:max-w-md"
        showCloseButton
      >
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="border-b border-border/60 px-4 py-3">
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Search className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              placeholder="Search chats"
              aria-label="Search chats"
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {mode === 'multiple' && visibleTypes.length > 0 ? (
            <div className="mb-2">
              <div className="px-2.5 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Chat Types
              </div>
              <ul className="flex flex-col gap-0.5" role="list">
                {visibleTypes.map((typeOption) => {
                  const checked = draftTypes.has(typeOption.id);
                  return (
                    <li key={typeOption.id}>
                      <button
                        type="button"
                        aria-pressed={checked}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                          'hover:bg-accent',
                          checked && 'bg-accent/60',
                        )}
                        onClick={() => toggleType(typeOption.id)}
                      >
                        <Checkbox
                          checked={checked}
                          tabIndex={-1}
                          className="pointer-events-none shrink-0"
                        />
                        {typeOption.icon ? (
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            {typeOption.icon}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {typeOption.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {mode === 'multiple' && chatTypes.length > 0 ? (
            <div className="px-2.5 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Chats
            </div>
          ) : null}

          <ul className="flex flex-col gap-0.5" role="list">
            {peerIds.map((peerId) => (
              <ChatPickerRow
                key={peerId}
                peerId={peerId}
                self={peerId === selfId}
                query={trimmed}
                mode={mode}
                selected={draftPeers.has(peerId)}
                disabled={busy || disabledSet.has(peerId)}
                onClick={handleRowClick}
              />
            ))}
          </ul>
        </div>

        {mode === 'multiple' ? (
          <DialogFooter className="border-t border-border px-4 py-3">
            <span className="mr-auto text-xs text-muted-foreground">
              {totalSelected} selected
            </span>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={handleConfirm}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogPopup>
    </DialogRoot>
  );
});

export default ChatPickerDialog;
