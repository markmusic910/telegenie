'use client';

import { Check, CheckCheck, CornerUpLeft, Eye, Pin, Share2 } from 'lucide-react';
import type { MessageOutgoingStatus } from '@telegenie/sdk';
import { cn } from '@/lib/utils';
import { formatPastTimeShort } from '@/lib/utils/date';
import { formatCompactNumber } from '@/lib/utils/format';

interface MessageMetaProps {
  unixSeconds?: number;
  date?: number;
  isOutgoing?: boolean;
  isEdited?: boolean;
  outgoingStatus?: MessageOutgoingStatus;
  views?: number;
  forwards?: number;
  replies?: number;
  isPinned?: boolean;
  postAuthor?: string;
  format?: 'bubble' | 'relative';
  /** `canvas` sits on the page background, not inside a colored bubble. */
  surface?: 'bubble' | 'canvas';
  className?: string;
}

function formatMetaTime(timestamp: number): string {
  if (!timestamp) return '';
  const d = new Date(timestamp * 1000);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function MessageMeta({
  unixSeconds,
  date,
  isOutgoing,
  isEdited,
  outgoingStatus,
  views,
  forwards,
  replies,
  isPinned,
  postAuthor,
  format,
  surface = 'bubble',
  className,
}: MessageMetaProps) {
  const timestamp = date ?? unixSeconds;
  if (!timestamp && !outgoingStatus && !views && !forwards && !replies && !isPinned) return null;

  const isBubble = format === 'bubble' || date !== undefined;
  const onColoredBubble = surface !== 'canvas' && Boolean(isOutgoing);
  const timeStr = timestamp
    ? isBubble
      ? formatMetaTime(timestamp)
      : formatPastTimeShort(timestamp)
    : '';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 select-none text-[11px] leading-none whitespace-nowrap text-muted-foreground/75',
        onColoredBubble && 'text-primary-foreground/70',
        className,
      )}
    >
      {postAuthor && (
        <span className="truncate max-w-[120px] opacity-85">{postAuthor}</span>
      )}

      {isPinned && (
        <Pin className="size-3 stroke-[2.2] rotate-45 opacity-80" aria-label="Pinned" />
      )}

      {views != null && views > 0 && (
        <span
          className="inline-flex items-center gap-0.5 opacity-85"
          title={`${views.toLocaleString()} views`}
        >
          <Eye className="size-3" />
          <span>{formatCompactNumber(views)}</span>
        </span>
      )}

      {forwards != null && forwards > 0 && (
        <span
          className="inline-flex items-center gap-0.5 opacity-85"
          title={`${forwards.toLocaleString()} forwards`}
        >
          <Share2 className="size-3" />
          <span>{formatCompactNumber(forwards)}</span>
        </span>
      )}

      {replies != null && replies > 0 && (
        <span
          className="inline-flex items-center gap-0.5 opacity-85"
          title={`${replies.toLocaleString()} replies`}
        >
          <CornerUpLeft className="size-3" />
          <span>{formatCompactNumber(replies)}</span>
        </span>
      )}

      {isEdited && <span className="text-[10px] opacity-80">edited</span>}

      {timeStr ? <span>{timeStr}</span> : null}

      {outgoingStatus && (
        <span className="inline-flex items-center ml-0.5">
          {outgoingStatus === 'read' ? (
            <CheckCheck
              className={cn(
                'size-3.5 stroke-[2.5]',
                onColoredBubble ? 'text-primary-foreground' : 'text-primary',
              )}
              aria-label="Read"
            />
          ) : (
            <Check
              className={cn(
                'size-3.5 stroke-[2.5]',
                onColoredBubble ? 'text-primary-foreground/80' : 'text-muted-foreground',
              )}
              aria-label="Sent"
            />
          )}
        </span>
      )}
    </span>
  );
}
