'use client';

import {
  useDialogPeer,
  useGlobalStoreDialog,
  useGlobalStoreThread,
  useSDK,
  useStoreEntities,
} from '@/lib/contexts/sdk.context';
import { useEnsureListedMessages } from '@/lib/hooks/message-list/use-ensure-listed-messages';
import { useMessageListFocus } from '@/lib/hooks/message-list/use-focus';
import { useMessageListHistory } from '@/lib/hooks/message-list/use-history';
import { useJumpToBottom } from '@/lib/hooks/message-list/use-jump-to-bottom';
import { useMessageListScrollerHost } from '@/lib/hooks/message-list/use-message-list-scroller';
import { usePinToBottom } from '@/lib/hooks/message-list/use-pin-to-bottom';
import { useMessageListRead } from '@/lib/hooks/message-list/use-read';
import { useRecordScrollOffset } from '@/lib/hooks/message-list/use-record-scroll-offset';
import { useRestoreScrollPositionWhenOpen } from '@/lib/hooks/message-list/use-restore-scroll-position-when-open';
import { useIntersectionObserver } from '@/lib/hooks/use-intersection-observer';
import { cn } from '@/lib/utils';
import { type Channel, type FlatListItem, MAIN_THREAD_ID } from '@telegenie/sdk';
import { Loader2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useRef, useState } from 'react';
import JumpToBottomButton from './jump-to-bottom.button';
import MessageEmpty from './message.empty';
import MessageListRow from './message.list-row';

type DateSection = {
  id: string;
  date: Extract<FlatListItem, { kind: 'date' }> | null;
  items: FlatListItem[];
};

/** Group rows so each date header sticks only while that day's messages are in view. */
function groupItemsByDate(items: FlatListItem[]): DateSection[] {
  const sections: DateSection[] = [];
  for (const item of items) {
    if (item.kind === 'date') {
      sections.push({ id: item.id, date: item, items: [] });
      continue;
    }
    const current = sections.at(-1);
    if (current) {
      current.items.push(item);
    } else {
      sections.push({ id: 'ungrouped', date: null, items: [item] });
    }
  }
  return sections;
}

interface MessageListProps {
  peerId: string;
  className?: string;
}

const MessageList = observer(({ peerId, className }: MessageListProps) => {
  const dialog = useStoreEntities('dialog', peerId);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [emojiRoot, setEmojiRoot] = useState<HTMLDivElement | null>(null);
  const bindScroller = useCallback((node: HTMLDivElement | null) => {
    scrollerRef.current = node;
    setEmojiRoot(node);
  }, []);
  const scroller = useMessageListScrollerHost(scrollerRef);

  const dialogUI = useGlobalStoreDialog(peerId);
  const activeThreadId = dialogUI?.activeThreadId ?? MAIN_THREAD_ID;
  const threadUI = useGlobalStoreThread(peerId, activeThreadId);

  const peer = useDialogPeer(peerId);
  const channel = dialog?.peerKind === 'channel' ? (peer as Channel | null) : null;
  const isGroup =
    dialog?.peerKind === 'chat' || (dialog?.peerKind === 'channel' && !channel?.broadcast);

  const flatItems = threadUI?.flatItems ?? [];
  const isLoadingHistory = threadUI?.isLoadingHistory ?? false;
  const listedBodiesReady = useEnsureListedMessages(peerId);
  const jumpToBottom = useJumpToBottom(scrollerRef, peerId);
  usePinToBottom({
    scroller,
    jumpToBottom,
    peerId,
  });
  useRecordScrollOffset({ scroller, peerId });
  useRestoreScrollPositionWhenOpen({ scrollerRef, peerId });
  const { backwardsTriggerRef, forwardsTriggerRef, hasHistoryTriggers } = useMessageListHistory({
    scroller,
    scrollerRef,
    root: emojiRoot,
    peerId,
  });
  const { isMessageFocused } = useMessageListFocus({ scrollerRef, peerId });
  const observeForRead = useMessageListRead({
    peerId,
    threadId: activeThreadId,
    scrollRootRef: scrollerRef,
    root: emojiRoot,
  });
  const { observe: observeForEmoji } = useIntersectionObserver({
    rootRef: scrollerRef,
    root: emojiRoot,
    throttleMs: 200,
    rootMargin: '100px',
  });
  const pinToBottom = threadUI?.pinToBottom ?? true;
  const trackedReactions = dialogUI?.unreadReactionIds.length ?? 0;
  const unreadReactionsCount =
    trackedReactions > 0 ? trackedReactions : (dialog?.unreadReactionsCount ?? 0);
  const unreadMentionsCount = dialog?.unreadMentionsCount ?? 0;
  const dateSections = groupItemsByDate(flatItems);
  const sdk = useSDK();
  const listedIdsRef = useRef(threadUI?.listedIds);
  listedIdsRef.current = threadUI?.listedIds;

  useEffect(() => {
    if (!dialog || dialog.peerKind === 'user') return undefined;
    const timer = window.setInterval(() => {
      const ids = listedIdsRef.current;
      if (!ids?.length) return;
      void sdk.messageReaction.refreshVisibleReactions(peerId, [...ids]);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [sdk, peerId, dialog]);

  const isInitialLoading = flatItems.length === 0 && (isLoadingHistory || !listedBodiesReady);
  const isEmpty = flatItems.length === 0 && !isInitialLoading;

  return (
    <div className={cn('relative flex flex-1 flex-col overflow-hidden', className)}>
      {isLoadingHistory && flatItems.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-xs border border-border/30">
            <Loader2 className="size-3 animate-spin" />
            Loading history
          </span>
        </div>
      )}

      <div
        ref={bindScroller}
        data-select-mode={threadUI?.isSelectMode ? 'true' : undefined}
        className={cn(
          'h-full w-full overflow-x-hidden overflow-y-auto px-1 py-3 [overflow-anchor:none]',
          (isInitialLoading || isEmpty) && 'flex items-center justify-center',
        )}
      >
        {isInitialLoading ? (
          <Loader2
            className="size-6 animate-spin text-muted-foreground"
            aria-label="Loading messages"
          />
        ) : isEmpty ? (
          <MessageEmpty />
        ) : (
          <div>
            {hasHistoryTriggers && (
              <div ref={backwardsTriggerRef} className="backwards-trigger h-0 w-full" aria-hidden />
            )}
            {dateSections.map((section) => (
              <div key={section.id}>
                {section.date ? (
                  <MessageListRow
                    peerId={peerId}
                    item={section.date}
                    isGroup={isGroup}
                    readOutboxMaxId={dialog?.readOutboxMaxId}
                    isMessageFocused={isMessageFocused}
                    observeIntersectionForRead={observeForRead}
                    observeIntersectionForPlaying={observeForEmoji}
                  />
                ) : null}
                {section.items.map((item) => (
                  <MessageListRow
                    key={item.id}
                    peerId={peerId}
                    item={item}
                    isGroup={isGroup}
                    readOutboxMaxId={dialog?.readOutboxMaxId}
                    isMessageFocused={isMessageFocused}
                    observeIntersectionForRead={observeForRead}
                    observeIntersectionForPlaying={observeForEmoji}
                  />
                ))}
              </div>
            ))}
            {hasHistoryTriggers && (
              <div ref={forwardsTriggerRef} className="forwards-trigger h-0 w-full" aria-hidden />
            )}
          </div>
        )}
      </div>
      {flatItems.length > 0 && (!pinToBottom || unreadReactionsCount > 0 || unreadMentionsCount > 0) ? (
        <JumpToBottomButton
          peerId={peerId}
          unreadCount={dialog?.unreadCount ?? 0}
          unreadMark={dialog?.unreadMark}
          unreadMentionsCount={unreadMentionsCount}
          unreadReactionsCount={unreadReactionsCount}
          showJump={!pinToBottom}
          onJump={jumpToBottom}
        />
      ) : null}
    </div>
  );
});

export default MessageList;
