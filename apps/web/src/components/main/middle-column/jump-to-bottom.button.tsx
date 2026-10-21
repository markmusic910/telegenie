'use client';

import DialogItemBadge from '@/components/main/left-column/dialog-item.badge';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { useGlobalStoreDialog, useGlobalStoreThread, useSDK } from '@/lib/contexts/sdk.context';
import type { JumpToBottomFn } from '@/lib/hooks/message-list/use-jump-to-bottom';
import { MAIN_THREAD_ID } from '@telegenie/sdk';
import { AtSign, ChevronsDown, SmilePlus } from 'lucide-react';
import { useCallback, useEffect } from 'react';

type JumpToBottomButtonProps = {
  peerId: string;
  unreadCount: number;
  unreadMentionsCount?: number;
  unreadReactionsCount?: number;
  unreadMark?: boolean;
  /** Hide the scroll-to-latest control while the list is already pinned to the bottom. */
  showJump?: boolean;
  onJump: JumpToBottomFn;
};

function messageIdFromScrollAnchor(itemId?: string): string | undefined {
  if (!itemId?.startsWith('msg-')) return undefined;
  return itemId.slice(4);
}

export default function JumpToBottomButton({
  peerId,
  unreadCount,
  unreadMentionsCount = 0,
  unreadReactionsCount = 0,
  unreadMark,
  showJump = true,
  onJump,
}: JumpToBottomButtonProps) {
  const sdk = useSDK();
  const dialogUI = useGlobalStoreDialog(peerId);
  const threadId = dialogUI?.activeThreadId ?? MAIN_THREAD_ID;
  const threadUI = useGlobalStoreThread(peerId, threadId);
  const hasMentions = unreadMentionsCount > 0;
  const hasReactions = unreadReactionsCount > 0;
  const hasUnread = unreadCount > 0 || Boolean(unreadMark);
  const ariaLabel = hasUnread
    ? unreadMark && unreadCount === 0
      ? 'Unread messages'
      : `${unreadCount} unread messages`
    : 'Jump to latest messages';

  useEffect(() => {
    if (!hasMentions) return;
    void sdk.messageRead.fetchUnreadMentions(peerId);
  }, [hasMentions, peerId, sdk.messageRead]);

  useEffect(() => {
    if (!hasReactions) return;
    void sdk.messageReaction.fetchUnreadReactions(peerId);
  }, [hasReactions, peerId, sdk.messageReaction]);

  const onMentionJump = useCallback(() => {
    const anchorMessageId = messageIdFromScrollAnchor(threadUI?.scrollAnchorItemId);
    void sdk.messageRead.focusClosestUnreadMention(peerId, threadId, anchorMessageId);
  }, [peerId, sdk.messageRead, threadId, threadUI?.scrollAnchorItemId]);

  const onReactionJump = useCallback(() => {
    const anchorMessageId = messageIdFromScrollAnchor(threadUI?.scrollAnchorItemId);
    void sdk.messageReaction.focusClosestUnreadReaction(peerId, threadId, anchorMessageId);
  }, [peerId, sdk.messageReaction, threadId, threadUI?.scrollAnchorItemId]);

  return (
    <div className="pointer-events-none absolute right-4 bottom-4 z-20 flex flex-col items-end gap-2">
      {hasReactions ? (
        <div className="pointer-events-auto relative origin-center rounded-full shadow-md transition-[transform,box-shadow] duration-200 ease-out hover:scale-110 hover:shadow-lg">
          <Badge
            size="sm"
            variant="default"
            className="absolute -top-1.5 left-1/2 z-10 min-w-4.5 -translate-x-1/2 rounded-full px-1 tabular-nums"
            aria-hidden
          >
            {unreadReactionsCount}
          </Badge>
          <Button
            aria-label={`${unreadReactionsCount} unread reactions — jump to nearest`}
            className="rounded-full hover:bg-popover dark:hover:bg-popover"
            onClick={onReactionJump}
            size="icon-xl"
            type="button"
            variant="outline"
          >
            <SmilePlus className="size-5" />
          </Button>
        </div>
      ) : null}
      {hasMentions ? (
        <div className="pointer-events-auto relative origin-center rounded-full shadow-md transition-[transform,box-shadow] duration-200 ease-out hover:scale-110 hover:shadow-lg">
          <Badge
            size="sm"
            variant="default"
            className="absolute -top-1.5 left-1/2 z-10 min-w-4.5 -translate-x-1/2 rounded-full px-1 tabular-nums"
            aria-hidden
          >
            {unreadMentionsCount}
          </Badge>
          <Button
            aria-label={`${unreadMentionsCount} unread mentions — jump to nearest`}
            className="rounded-full hover:bg-popover dark:hover:bg-popover"
            onClick={onMentionJump}
            size="icon-xl"
            type="button"
            variant="outline"
          >
            <AtSign className="size-5 opacity-100" />
          </Button>
        </div>
      ) : null}

      {showJump ? (
        <div className="pointer-events-auto relative origin-center rounded-full shadow-md transition-[transform,box-shadow] duration-200 ease-out hover:scale-110 hover:shadow-lg">
          <DialogItemBadge
            className="absolute -top-1.5 left-1/2 z-10 -translate-x-1/2"
            unreadCount={unreadCount}
            unreadMark={unreadMark}
          />
          <Button
            aria-label={ariaLabel}
            className="rounded-full hover:bg-popover dark:hover:bg-popover"
            onClick={() => {
              void onJump('smooth');
            }}
            size="icon-xl"
            type="button"
            variant="outline"
          >
            <ChevronsDown className="size-6 opacity-100" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
