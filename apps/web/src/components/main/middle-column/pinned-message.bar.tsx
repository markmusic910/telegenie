'use client';

import { Dialog } from '@telegenie/sdk';
import { List } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useGlobalStoreDialog, useMessage, useSDK, useStoreEntities } from '@/lib/contexts/sdk.context';
import { buildPinnedSnippet } from '@/lib/components/message.action';
import { cn } from '@/lib/utils';

interface PinnedMessageBarProps {
  peerId: string;
}

const PinnedMessageBar = observer(function PinnedMessageBar({ peerId }: PinnedMessageBarProps) {
  const sdk = useSDK();
  const dialogUI = useGlobalStoreDialog(peerId);

  const peerKind = Dialog.peerKindFromId(peerId);
  const channelFull = useStoreEntities('channelFull', peerKind === 'channel' ? peerId : null);
  const chatFull = useStoreEntities('chatFull', peerKind === 'chat' ? peerId : null);
  const userFull = useStoreEntities('userFull', peerKind === 'user' ? peerId : null);
  const fullPinnedMsgId =
    channelFull?.pinnedMsgId ?? chatFull?.pinnedMsgId ?? userFull?.pinnedMsgId;

  const rawPinnedIds = dialogUI?.pinnedMessageIds ?? [];
  const pinnedIds =
    rawPinnedIds.length > 0
      ? rawPinnedIds
      : fullPinnedMsgId && fullPinnedMsgId > 0
        ? [fullPinnedMsgId]
        : [];
  const pinnedCount = dialogUI?.pinnedMessagesCount || pinnedIds.length;
  const currentIndex = dialogUI?.currentPinnedIndex ?? 0;
  const currentPinnedId = pinnedIds[currentIndex] ?? pinnedIds[0];

  const currentMessage = useMessage(
    peerId,
    currentPinnedId ? String(currentPinnedId) : null,
  );

  useEffect(() => {
    if (peerId && rawPinnedIds.length === 0) {
      void sdk.messageLoad.loadPinnedMessages(peerId);
    }
  }, [peerId, rawPinnedIds.length, sdk]);

  useEffect(() => {
    if (peerId && currentPinnedId && !currentMessage) {
      void sdk.messageLoad.getMessagesByIds(peerId, [String(currentPinnedId)]);
    }
  }, [peerId, currentPinnedId, currentMessage, sdk]);

  if (pinnedIds.length === 0 && pinnedCount === 0) {
    return null;
  }

  const segmentCount = Math.min(Math.max(pinnedCount, 1), 6);
  // pinnedMessageIds is newest-first; the top segment is the oldest pin.
  const activeSegment = segmentCount - 1 - (currentIndex % segmentCount);

  const snippet = currentMessage
    ? buildPinnedSnippet(currentMessage) ||
      currentMessage.message?.trim() ||
      currentMessage.summaryText ||
      'Pinned message'
    : 'Pinned message';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => void sdk.messageLoad.cyclePinnedMessage(peerId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void sdk.messageLoad.cyclePinnedMessage(peerId);
        }
      }}
      className="flex h-12 w-full shrink-0 cursor-pointer items-center border-b border-border/60 bg-background/95 px-3 py-1.5 backdrop-blur-sm transition-colors hover:bg-muted/40 select-none"
      aria-label="Pinned message banner"
    >
      {/* Left indicator: segmented vertical bar */}
      <div className="flex h-8 w-[3px] shrink-0 flex-col gap-0.5 justify-center py-0.5">
        {Array.from({ length: segmentCount }).map((_, idx) => (
          <div
            key={idx}
            className={cn(
              'w-full flex-1 rounded-full transition-all duration-200',
              idx === activeSegment ? 'bg-primary' : 'bg-primary/30',
            )}
          />
        ))}
      </div>

      {/* Text area */}
      <div className="flex min-w-0 flex-1 flex-col justify-center pl-2.5 pr-2">
        <span className="truncate text-xs font-semibold text-primary leading-tight">
          Pinned message
        </span>
        <span className="truncate text-xs text-foreground/80 leading-normal mt-0.5">
          {snippet}
        </span>
      </div>

      {/* Right button: pin list icon to open pinned messages view */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void sdk.messageLoad.openPinnedView(peerId);
        }}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-primary hover:bg-primary/10 transition-colors"
        title="View all pinned messages"
        aria-label="View all pinned messages"
      >
        <List className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
});

export default PinnedMessageBar;
