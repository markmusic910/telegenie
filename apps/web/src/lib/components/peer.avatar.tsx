'use client';

import { Bookmark, Ghost } from 'lucide-react';
import { buildPeerAvatarUrl, peerColorIndex, type PeerDisplay } from '@telegenie/sdk';

import { Avatar, AvatarFallback, AvatarImage } from '@/lib/components/ui/avatar';
import { cn } from '@/lib/utils';

const AVATAR_COLORS = [
  'bg-violet-500/20 text-violet-700 dark:text-violet-300',
  'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  'bg-rose-500/20 text-rose-700 dark:text-rose-300',
  'bg-sky-500/20 text-sky-700 dark:text-sky-300',
  'bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300',
  'bg-teal-500/20 text-teal-700 dark:text-teal-300',
];

export type PeerAvatarPhoto = {
  photoId?: string;
  dcId?: number;
  strippedThumb?: string;
};

type PeerAvatarProps = {
  peerId: string;
  display: PeerDisplay;
  photo?: PeerAvatarPhoto | null;
  className?: string;
};

export default function PeerAvatar({ peerId, display, photo, className }: PeerAvatarProps) {
  const isDeleted = Boolean(display.isDeleted);
  const avatarColor = isDeleted
    ? 'bg-gradient-to-b from-[#ff885e] to-[#ff516a] text-white'
    : AVATAR_COLORS[peerColorIndex(peerId)];
  const isSavedMessages = display.isSavedMessages;
  const strippedThumb = !isSavedMessages && !isDeleted ? photo?.strippedThumb : undefined;
  const photoId = photo?.photoId;
  const dcId = photo?.dcId;
  const avatarUrl =
    !isSavedMessages && !isDeleted && photoId && dcId != null && Number.isFinite(dcId)
      ? buildPeerAvatarUrl({ peerId, photoId, dcId })
      : undefined;

  return (
    <Avatar
      aria-label={display.name}
      className={cn(
        'relative size-10 shrink-0 overflow-hidden text-sm font-semibold',
        avatarColor,
        className,
      )}
    >
      {strippedThumb ? (
        <img
          src={strippedThumb}
          alt=""
          className="absolute inset-0 size-full object-cover z-0"
          aria-hidden="true"
          draggable={false}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
      {avatarUrl ? (
        <AvatarImage className="relative z-10" src={avatarUrl} alt={display.name} />
      ) : null}
      <AvatarFallback className={cn('size-full rounded-full', avatarColor)}>
        {isSavedMessages ? (
          <Bookmark className="size-4" aria-hidden="true" />
        ) : isDeleted ? (
          <Ghost className="size-1/2 text-white stroke-[2.25]" aria-hidden="true" />
        ) : (
          display.initials
        )}
      </AvatarFallback>
    </Avatar>
  );
}
