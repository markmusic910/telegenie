'use client';

import PeerAvatar from '@/lib/components/peer.avatar';
import { useDialogPeer } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import type { Message } from '@telegenie/sdk';
import { initialsFromName, peerActionName, peerColorIndex, peerProfileDisplay } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';

const FORWARD_NAME_COLORS = [
  'text-violet-600 dark:text-violet-400',
  'text-blue-600 dark:text-blue-400',
  'text-emerald-600 dark:text-emerald-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-600 dark:text-rose-400',
  'text-sky-600 dark:text-sky-400',
  'text-fuchsia-600 dark:text-fuchsia-400',
  'text-teal-600 dark:text-teal-400',
] as const;

export interface MessageForwardProps {
  message: Message;
  isOwn: boolean;
  /** Transparent bubbles (stickers, round video) sit on the chat background. */
  plain?: boolean;
  className?: string;
}

const MessageForward = observer(function MessageForward({
  message,
  isOwn,
  plain = false,
  className,
}: MessageForwardProps) {
  const peerId = message.forwardSenderPeerId;
  const peer = useDialogPeer(peerId);
  const fwd = message.fwdFrom;
  if (!fwd) return null;

  const name = fwd.fromName?.trim() || peerActionName(peer ?? undefined) || fwd.postAuthor?.trim();
  const onColoredBubble = isOwn && !plain;
  const labelClass = onColoredBubble ? 'text-primary-foreground/70' : 'text-muted-foreground';

  if (!name) {
    return (
      <div className={cn('mb-1 text-xs leading-4', labelClass, className)}>Forwarded message</div>
    );
  }

  const profile = peer ? peerProfileDisplay(peer) : undefined;
  const display =
    profile ??
    (peerId
      ? {
          name,
          initials: initialsFromName(name),
          isVerified: false,
          isSavedMessages: false,
        }
      : undefined);
  const colorIndex = peerId ? peerColorIndex(peerId) : 0;

  return (
    <div className={cn('mb-1 flex min-w-0 items-center gap-1 text-xs leading-4', className)}>
      <span className={cn('shrink-0 whitespace-nowrap', labelClass)}>Forwarded from:</span>
      {peerId && display ? (
        <PeerAvatar
          peerId={peerId}
          display={display}
          photo={peer?.photo}
          className="size-4 text-[8px]"
        />
      ) : null}
      <span
        className={cn(
          'min-w-0 truncate font-medium',
          onColoredBubble ? 'text-primary-foreground' : FORWARD_NAME_COLORS[colorIndex],
        )}
      >
        {name}
      </span>
    </div>
  );
});

export default MessageForward;
