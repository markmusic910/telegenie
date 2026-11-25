'use client';

import type { Channel, Chat } from '@telegenie/sdk';
import { Bell, BellOff, Ellipsis, Megaphone, UserPlus } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from '@/lib/components/ui/menu';
import { useSDK, useStoreEntities } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import DialogInfoInviteDialog from './dialog-info.invite.dialog';

export interface DialogInfoActionsProps {
  peerId: string;
  peerKind: 'channel' | 'chat';
  channel?: Channel | null;
  chat?: Chat | null;
}

function isNotifyMuted(muteUntil?: number): boolean {
  if (!muteUntil) return false;
  return muteUntil > Math.floor(Date.now() / 1000);
}

const DialogInfoActions = observer(function DialogInfoActions({
  peerId,
  peerKind,
  channel,
  chat,
}: DialogInfoActionsProps) {
  const sdk = useSDK();
  const dialog = useStoreEntities('dialog', peerId);
  const channelFull = useStoreEntities('channelFull', peerKind === 'channel' ? peerId : null);
  const chatFull = useStoreEntities('chatFull', peerKind === 'chat' ? peerId : null);
  const notify =
    dialog?.notifySettings ?? channelFull?.notifySettings ?? chatFull?.notifySettings;
  const isMuted = isNotifyMuted(notify?.muteUntil);
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const showJoin = peerKind === 'channel' && Boolean(channel?.left);
  const showAdd =
    !showJoin && peerKind === 'channel' && Boolean(channel) && !channel?.broadcast;
  const tileClass =
    'flex h-14 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-border/60 bg-card px-3 text-xs font-medium text-primary transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  const handleJoin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await sdk.channel.join(peerId);
      toast.success('Joined channel');
    } catch {
      toast.error('Failed to join channel');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleMute = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await sdk.user.setMuted(peerId, !isMuted);
      toast.success(isMuted ? 'Unmuted' : 'Muted');
    } catch {
      toast.error('Failed to update notifications');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (peerKind !== 'channel' || busy) return;
    setBusy(true);
    try {
      await sdk.channel.leave(peerId);
      sdk.dialogInfo.pop();
      toast.success('Left channel');
    } catch {
      toast.error('Failed to leave channel');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2.5 pt-1">
        {showJoin ? (
          <button type="button" disabled={busy} onClick={() => void handleJoin()} className={tileClass}>
            <Megaphone className="size-5" aria-hidden="true" />
            <span>Join</span>
          </button>
        ) : showAdd ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setInviteOpen(true)}
            className={tileClass}
          >
            <UserPlus className="size-5" aria-hidden="true" />
            <span>Add</span>
          </button>
        ) : (
          <div className={cn(tileClass, 'pointer-events-none opacity-0')} aria-hidden="true">
            <span>—</span>
          </div>
        )}

      <button type="button" disabled={busy} onClick={() => void handleToggleMute()} className={tileClass}>
        {isMuted ? <BellOff className="size-5" aria-hidden="true" /> : <Bell className="size-5" aria-hidden="true" />}
        <span>{isMuted ? 'Unmute' : 'Mute'}</span>
      </button>

      <Menu>
        <MenuTrigger className={tileClass}>
          <Ellipsis className="size-5" aria-hidden="true" />
          <span>More</span>
        </MenuTrigger>
        <MenuPopup align="end" className="w-52">
          {peerKind === 'channel' && !channel?.left ? (
            <>
              <MenuItem closeOnClick variant="destructive" onClick={() => void handleLeave()}>
                <span>Leave</span>
              </MenuItem>
              <MenuSeparator />
            </>
          ) : null}
          <MenuItem disabled>Report</MenuItem>
        </MenuPopup>
      </Menu>
      </div>

      {showAdd ? (
        <DialogInfoInviteDialog peerId={peerId} open={inviteOpen} onOpenChange={setInviteOpen} />
      ) : null}
    </>
  );
});

export default DialogInfoActions;