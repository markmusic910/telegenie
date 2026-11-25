'use client';

import { mtpChannelIdFromPeerId } from '@telegenie/libs/foundation/telegram/helpers';
import { Dialog, fallbackPeerDisplay, peerProfileDisplay } from '@telegenie/sdk';
import { BadgeCheck, ChevronLeft } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import PeerAvatar from '@/lib/components/peer.avatar';
import { Button } from '@/lib/components/ui/button';
import { ScrollArea } from '@/lib/components/ui/scroll-area';
import { useDialogPeer, useSDK, useStoreEntities } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import { formatCompactNumber } from '@/lib/utils/format';
import DialogInfoActions from './dialog-info.actions';
import DialogInfoDetailsCard from './dialog-info.details.card';
import DialogInfoTabs from './dialog-info.tabs';

export interface DialogInfoViewProps {
  peerId: string;
}

const DialogInfoView = observer(function DialogInfoView({ peerId }: DialogInfoViewProps) {
  const sdk = useSDK();
  const peerKind = Dialog.peerKindFromId(peerId);
  const peer = useDialogPeer(peerId);
  const channel = peerKind === 'channel' ? peer : null;
  const chat = peerKind === 'chat' ? peer : null;
  const channelFull = useStoreEntities('channelFull', peerKind === 'channel' ? peerId : null);
  const chatFull = useStoreEntities('chatFull', peerKind === 'chat' ? peerId : null);

  const display = peer ? peerProfileDisplay(peer) : fallbackPeerDisplay(peerId);

  let subtitle: string | undefined;
  if (peerKind === 'channel' && channel) {
    const isBroadcast = channel.broadcast;
    const count = channelFull?.participantsCount ?? channel.participantsCount;
    const online = channelFull?.onlineCount;
    if (count != null) {
      if (isBroadcast) {
        subtitle = `${formatCompactNumber(count)} ${count === 1 ? 'subscriber' : 'subscribers'}`;
      } else {
        subtitle = `${formatCompactNumber(count)} ${count === 1 ? 'member' : 'members'}${
          online && online > 0 ? `, ${formatCompactNumber(online)} online` : ''
        }`;
      }
    }
  } else if (peerKind === 'chat') {
    const parts =
      chatFull?.participants && 'participants' in chatFull.participants
        ? chatFull.participants.participants
        : undefined;
    const members = chat?.participantsCount ?? parts?.length;
    if (members != null) {
      subtitle = `${formatCompactNumber(members)} ${members === 1 ? 'member' : 'members'}`;
    }
  }

  const about = channelFull?.about ?? chatFull?.about;

  const activeUsernames = (channel?.usernames ?? chat?.usernames ?? [])
    .filter((entry) => entry.active && entry.username)
    .map((entry) => entry.username);
  const primaryUsername = channel?.username ?? chat?.username ?? activeUsernames[0];
  const extraUsernames = activeUsernames.filter(
    (uname) => uname.toLowerCase() !== primaryUsername?.toLowerCase(),
  );

  const displayPeerId =
    peerKind === 'channel'
      ? (mtpChannelIdFromPeerId(peerId)?.toString() ?? peerId)
      : peerKind === 'chat'
        ? peerId.replace(/^-/, '')
        : peerId;

  const showMembers =
    peerKind === 'chat' || (peerKind === 'channel' && Boolean(channel) && !channel?.broadcast);

  if (peerKind !== 'channel' && peerKind !== 'chat') {
    return null;
  }

  return (
    <div className="flex h-full w-full flex-col bg-background" data-testid="dialog-info-view">
      <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => sdk.dialogInfo.pop()}
          className="-ml-2 gap-1 px-2 text-sm font-medium text-primary hover:bg-primary/10 hover:text-primary"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
          <span>Back</span>
        </Button>

        <h1 className="pointer-events-none absolute inset-x-24 truncate text-center text-sm font-semibold text-foreground">
          Info
        </h1>

        <div className="w-14 shrink-0" aria-hidden="true" />
      </header>

      <ScrollArea className="flex-1">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 py-6">
          <div className="flex flex-col items-center gap-2.5 text-center">
            <PeerAvatar
              peerId={peerId}
              display={display}
              photo={peer?.photo}
              isBig
              className="size-28 text-3xl shadow-xs"
            />

            <div className="flex max-w-full flex-col items-center gap-0.5">
              <div className="flex max-w-full items-center justify-center gap-1.5">
                <h2 className="truncate text-xl font-semibold leading-tight text-foreground">
                  {display.name}
                </h2>
                {display.isVerified ? (
                  <BadgeCheck className="size-4.5 shrink-0 text-primary" aria-label="Verified" />
                ) : null}
              </div>
              {subtitle ? (
                <p className={cn('text-sm text-muted-foreground leading-snug')}>{subtitle}</p>
              ) : null}
            </div>
          </div>

          <DialogInfoActions peerId={peerId} peerKind={peerKind} channel={channel} chat={chat} />

          <DialogInfoDetailsCard
            about={about}
            username={primaryUsername}
            extraUsernames={extraUsernames}
            peerId={displayPeerId}
          />

          <DialogInfoTabs peerId={peerId} peerKind={peerKind} showMembers={showMembers} />
        </div>
      </ScrollArea>
    </div>
  );
});

export default DialogInfoView;