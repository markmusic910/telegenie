'use client';

import { fallbackPeerDisplay, peerProfileDisplay } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';

import PeerAvatar from '@/lib/components/peer.avatar';
import { useDialogPeer, useSDK } from '@/lib/contexts/sdk.context';
import { formatUserStatus } from '@/lib/utils/date';

export interface DialogInfoMemberRowProps {
  userId: string;
  admin?: boolean;
}

const DialogInfoMemberRow = observer(function DialogInfoMemberRow({
  userId,
  admin,
}: DialogInfoMemberRowProps) {
  const sdk = useSDK();
  const user = useDialogPeer(userId);
  const display = user ? peerProfileDisplay(user) : fallbackPeerDisplay(userId);
  const status = user && 'status' in user ? formatUserStatus(user.status) : undefined;

  return (
    <button
      type="button"
      onClick={() => sdk.user.openProfile(userId)}
      className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/60"
    >
      <PeerAvatar peerId={userId} display={display} photo={user?.photo} className="size-11 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{display.name}</p>
        {status ? <p className="truncate text-xs text-muted-foreground">{status}</p> : null}
      </div>
      {admin ? (
        <span className="shrink-0 text-xs font-medium text-primary">admin</span>
      ) : null}
    </button>
  );
});

export default DialogInfoMemberRow;