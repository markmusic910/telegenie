'use client';

import { fallbackPeerDisplay, peerProfileDisplay } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import PeerAvatar from '@/lib/components/peer.avatar';
import { Dialog as DialogRoot, DialogContent, DialogHeader, DialogTitle } from '@/lib/components/ui/dialog';
import { Input } from '@/lib/components/ui/input';
import { useDialogPeer, useSDK, useStore } from '@/lib/contexts/sdk.context';

export interface ForwardRecipientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromPeerId: string;
  messageId: string;
}

function matchesQuery(name: string, username: string | undefined, query: string): boolean {
  if (!query) return true;
  if (name.toLowerCase().includes(query)) return true;
  return Boolean(username && username.toLowerCase().includes(query));
}

const ForwardRecipientRow = observer(function ForwardRecipientRow({
  peerId,
  self,
  query,
  disabled,
  onSelect,
}: {
  peerId: string;
  self: boolean;
  query: string;
  disabled: boolean;
  onSelect: (peerId: string) => void;
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
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent disabled:opacity-64"
        onClick={() => onSelect(peerId)}
      >
        <PeerAvatar peerId={peerId} display={display} photo={peer?.photo} className="size-9" />
        <span className="min-w-0 flex-1 truncate text-sm">{display.name}</span>
      </button>
    </li>
  );
});

const ForwardRecipientDialog = observer(function ForwardRecipientDialog({
  open,
  onOpenChange,
  fromPeerId,
  messageId,
}: ForwardRecipientDialogProps) {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const dialogStore = useStore('dialog');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setBusy(false);
  }, [open]);

  const selfId = globalStore.auth.currentUser?.id;
  const dialogs = dialogStore.getAllData();
  const order =
    globalStore.nav.sortedDialogIds.length > 0
      ? globalStore.nav.sortedDialogIds
      : Array.from(dialogs.keys());
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
  if (selfId && !seen.has(selfId)) peerIds.unshift(selfId);

  const trimmed = query.trim().toLowerCase();

  const choose = async (peerId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      if (selfId && peerId === selfId) {
        const result = await sdk.messageSend.forwardToSavedMessages(fromPeerId, messageId);
        if (!result.ok) return;
      } else {
        sdk.messageDraft.stageForward(peerId, fromPeerId, messageId);
        await sdk.messageLoad.selectDialog(peerId);
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(560px,85vh)] flex-col gap-0 p-0 sm:max-w-md"
        showCloseButton
      >
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>Forward to</DialogTitle>
        </DialogHeader>
        <div className="px-4 py-3">
          <Input
            value={query}
            placeholder="Search"
            aria-label="Search chats"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {peerIds.map((peerId) => (
            <ForwardRecipientRow
              key={peerId}
              peerId={peerId}
              self={peerId === selfId}
              query={trimmed}
              disabled={busy}
              onSelect={(id) => void choose(id)}
            />
          ))}
        </ul>
      </DialogContent>
    </DialogRoot>
  );
});

export default ForwardRecipientDialog;
