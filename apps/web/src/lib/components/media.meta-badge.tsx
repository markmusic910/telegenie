'use client';

import MessageMeta from '@/lib/components/message.meta';
import { cn } from '@/lib/utils';
import type { MessageOutgoingStatus } from '@telegenie/sdk';

interface MediaMetaBadgeProps {
  date?: number;
  isOutgoing?: boolean;
  isEdited?: boolean;
  outgoingStatus?: MessageOutgoingStatus;
  views?: number;
  forwards?: number;
  replies?: number;
  className?: string;
}

/**
 * Floating translucent pill badge for pure media messages without caption text.
 * Displays formatted timestamp and outgoing read ticks over images/videos/albums.
 */
export default function MediaMetaBadge({
  date,
  isOutgoing,
  isEdited,
  outgoingStatus,
  views,
  forwards,
  replies,
  className,
}: MediaMetaBadgeProps) {
  return (
    <div
      className={cn(
        'absolute bottom-1.5 right-1.5 z-10 flex items-center rounded-full bg-black/50 backdrop-blur-xs px-2 py-0.5 pointer-events-none select-none',
        className,
      )}
    >
      <MessageMeta
        date={date}
        isOutgoing={isOutgoing}
        isEdited={isEdited}
        outgoingStatus={outgoingStatus}
        views={views}
        forwards={forwards}
        replies={replies}
        className="text-white/95 [&_svg]:text-white/95"
      />
    </div>
  );
}
