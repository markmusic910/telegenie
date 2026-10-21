'use client';

import { AtSign, Pin, SmilePlus } from 'lucide-react';

import { Badge } from '@/lib/components/ui/badge';
import { cn } from '@/lib/utils';

type DialogItemBadgeProps = {
  unreadCount: number;
  unreadMentionsCount?: number;
  unreadReactionsCount?: number;
  unreadMark?: boolean;
  pinned?: boolean;
  muted?: boolean;
  className?: string;
  /** When true, hide mention badge (e.g. jump-to-bottom chevron shows unread count only). */
  hideMentions?: boolean;
  hideReactions?: boolean;
};

function ReactionBadge({ className }: { className?: string }) {
  return (
    <Badge
      size="sm"
      variant="default"
      className={cn('size-5 min-w-5 rounded-full p-0', className)}
      aria-label="Unread reactions"
    >
      <SmilePlus className="size-3" aria-hidden="true" />
    </Badge>
  );
}

function MentionBadge({ className }: { className?: string }) {
  return (
    <Badge
      size="sm"
      variant="default"
      className={cn('size-5 min-w-5 rounded-full p-0', className)}
      aria-label="Unread mentions"
    >
      <AtSign className="size-2.5" aria-hidden="true" />
    </Badge>
  );
}

function UnreadCountBadge({
  unreadCount,
  unreadMark,
  muted,
  className,
}: {
  unreadCount: number;
  unreadMark?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <Badge
      size="sm"
      variant={muted ? 'secondary' : 'default'}
      className={cn('min-w-4.5 rounded-full px-1 tabular-nums', className)}
      aria-label={unreadMark && unreadCount === 0 ? 'Unread' : `${unreadCount} unread messages`}
    >
      {unreadCount > 0 ? unreadCount : unreadMark ? '' : null}
    </Badge>
  );
}

export default function DialogItemBadge({
  unreadCount,
  unreadMentionsCount = 0,
  unreadReactionsCount = 0,
  unreadMark = false,
  pinned = false,
  muted = false,
  className,
  hideMentions = false,
  hideReactions = false,
}: DialogItemBadgeProps) {
  const hasMentions = !hideMentions && unreadMentionsCount > 0;
  const hasReactions = !hideReactions && unreadReactionsCount > 0;
  const hasUnread = unreadCount > 0 || unreadMark;

  if (!hasMentions && !hasReactions && !hasUnread && !pinned) {
    return null;
  }

  if (hasMentions || hasReactions || hasUnread) {
    return (
      <div className={cn('flex shrink-0 items-center gap-1', className)}>
        {hasMentions ? <MentionBadge /> : null}
        {hasReactions ? <ReactionBadge /> : null}
        {hasUnread ? (
          <UnreadCountBadge
            unreadCount={unreadCount}
            unreadMark={unreadMark}
            muted={muted}
          />
        ) : null}
      </div>
    );
  }

  return (
    <Pin
      className={cn('size-3.5 shrink-0 text-muted-foreground', className)}
      aria-label="Pinned"
    />
  );
}
