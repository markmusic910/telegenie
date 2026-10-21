'use client';

import MessageAction from '@/lib/components/message.action';
import MessageItem from '@/lib/components/message.item';
import MessageSelectControl from '@/lib/components/message.select-control';
import { useGlobalStoreDialog, useGlobalStoreThread, useSDK } from '@/lib/contexts/sdk.context';
import type { ObserveFn } from '@/lib/hooks/use-intersection-observer';
import { cn } from '@/lib/utils';
import { MAIN_THREAD_ID, type FlatListItem, type MessageAlbum } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';
import type { MouseEvent } from 'react';

type MessageListRowProps = {
  peerId: string;
  item: FlatListItem;
  isGroup: boolean;
  readOutboxMaxId?: number;
  observeIntersectionForRead?: ObserveFn;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  isMessageFocused: (messageId: string, album?: MessageAlbum) => boolean;
};

export default function MessageListRow({
  peerId,
  item,
  isGroup,
  readOutboxMaxId,
  observeIntersectionForRead,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  isMessageFocused,
}: MessageListRowProps) {
  if (item.kind === 'date') {
    return (
      <div
        data-list-item-id={item.id}
        className="sticky top-2 z-10 my-2 flex w-full justify-center pointer-events-none"
      >
        <span className="rounded-full border border-border/60 bg-background/95 px-3.5 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-sm pointer-events-auto select-none dark:bg-popover/95">
          {item.label}
        </span>
      </div>
    );
  }

  if (item.kind === 'unread-divider') {
    return (
      <div
        data-list-item-id={item.id}
        className="my-1 flex w-full items-center justify-center bg-[#d9e4ef] py-2.5 text-center text-xs font-medium text-[#5b7891] select-none dark:bg-[#2b3945] dark:text-[#8b9bab]"
      >
        Unread messages
      </div>
    );
  }

  if (item.kind === 'action') {
    return (
      <div data-list-item-id={item.id}>
        <MessageAction
          message={item.message}
          isFocused={isMessageFocused(item.message.id)}
          observeIntersectionForRead={observeIntersectionForRead}
        />
      </div>
    );
  }

  return (
    <SelectableMessageRow
      peerId={peerId}
      item={item}
      isGroup={isGroup}
      readOutboxMaxId={readOutboxMaxId}
      observeIntersectionForRead={observeIntersectionForRead}
      observeIntersectionForLoading={observeIntersectionForLoading}
      observeIntersectionForPlaying={observeIntersectionForPlaying}
      isMessageFocused={isMessageFocused}
    />
  );
}

type SelectableMessageRowProps = Omit<MessageListRowProps, 'item'> & {
  item: Extract<FlatListItem, { kind: 'message' | 'album' }>;
};

/**
 * One message or album row. An observer of its own so toggling a selection
 * re-renders only the rows whose ids changed, not the whole list.
 */
const SelectableMessageRow = observer(function SelectableMessageRow({
  peerId,
  item,
  isGroup,
  readOutboxMaxId,
  observeIntersectionForRead,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  isMessageFocused,
}: SelectableMessageRowProps) {
  const sdk = useSDK();
  const dialogUI = useGlobalStoreDialog(peerId);
  const threadId = dialogUI?.activeThreadId ?? MAIN_THREAD_ID;
  const thread = useGlobalStoreThread(peerId, threadId);

  const album = item.kind === 'album' ? item.album : undefined;
  const rowIds = album ? album.messages.map((entry) => entry.id) : [item.message.id];
  const selectable = item.message.kind === 'message' && Number(item.message.id) > 0;
  const isSelectMode = Boolean(thread?.isSelectMode) && selectable;
  const isSelected = isSelectMode && rowIds.every((id) => thread?.isMessageSelected(id));

  const handleSelectClick = (event: MouseEvent<HTMLDivElement>) => {
    // Capture phase: media, links, and buttons inside the bubble must not fire.
    event.preventDefault();
    event.stopPropagation();
    sdk.messageSelect.toggle(
      peerId,
      {
        messageId: item.message.id,
        childMessageIds: album ? rowIds : undefined,
        withShift: event.shiftKey,
      },
      threadId,
    );
  };

  return (
    <div
      data-list-item-id={item.id}
      data-selected={isSelected ? 'true' : undefined}
      className={cn(
        'relative transition-colors',
        isSelectMode && 'cursor-pointer select-none',
        isSelected && 'bg-primary/10',
      )}
      onClickCapture={isSelectMode ? handleSelectClick : undefined}
    >
      {isSelectMode ? (
        <MessageSelectControl selected={isSelected} className="absolute bottom-2 left-3 z-20" />
      ) : null}
      <MessageItem
        peerId={peerId}
        message={item.message}
        album={album}
        isOwn={item.isOwn}
        isFirstInGroup={item.isFirstInGroup}
        isLastInGroup={item.isLastInGroup}
        showAvatar={isGroup}
        showSenderName={item.isFirstInGroup && isGroup}
        senderName={item.senderName}
        senderPeerId={item.senderPeerId}
        readOutboxMaxId={readOutboxMaxId}
        isFocused={isMessageFocused(item.message.id, album)}
        isSelectMode={isSelectMode}
        observeIntersectionForRead={observeIntersectionForRead}
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
        className={cn('transition-[padding]', isSelectMode && !item.isOwn && 'pl-10')}
      />
    </div>
  );
});
