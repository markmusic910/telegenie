'use client';

import MessageItem from '@/lib/components/message.item';
import { Button } from '@/lib/components/ui/button';
import {
  useDialogPeer,
  useGlobalStoreDialog,
  useSDK,
  useStoreEntities,
} from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import type { Channel, Message } from '@telegenie/sdk';
import { ChevronLeft, CornerDownRight, Loader2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

interface PinnedMessageListProps {
  peerId: string;
  onBack: () => void;
}

function formatDateHeader(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long' });
}

type PinnedDateSection = {
  dateKey: string;
  label: string;
  messages: Message[];
};

const PinnedMessageList = observer(function PinnedMessageList({
  peerId,
  onBack,
}: PinnedMessageListProps) {
  const sdk = useSDK();
  const dialog = useStoreEntities('dialog', peerId);
  const peer = useDialogPeer(peerId);
  const channel = dialog?.peerKind === 'channel' ? (peer as Channel | null) : null;
  const isGroup =
    dialog?.peerKind === 'chat' || (dialog?.peerKind === 'channel' && !channel?.broadcast);

  const dialogUI = useGlobalStoreDialog(peerId);
  const pinnedIds = dialogUI?.pinnedMessageIds ?? [];
  const pinnedCount = dialogUI?.pinnedMessagesCount || pinnedIds.length;
  const [isUnpinning, setIsUnpinning] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (peerId && pinnedIds.length === 0) {
      void sdk.messageLoad.loadPinnedMessages(peerId);
    }
  }, [peerId, pinnedIds.length, sdk]);

  // Load message entities for all pinned IDs
  const messageStore = sdk.getMessageStore(peerId);
  const pinnedMessages = useMemo(() => {
    const list: Message[] = [];
    for (const id of pinnedIds) {
      const msg = messageStore.get(String(id));
      if (msg && !msg.isEmpty) {
        list.push(msg);
      }
    }
    // Sort chronological (oldest at top, newest at bottom) as in Telegram pinned messages view
    return list.sort((a, b) => a.date - b.date);
  }, [pinnedIds, messageStore]);

  // If any pinned IDs are missing from local store, fetch them
  useEffect(() => {
    if (pinnedIds.length > 0) {
      const missing = pinnedIds.filter((id) => !messageStore.get(String(id)));
      if (missing.length > 0) {
        void sdk.messageLoad.getMessagesByIds(peerId, missing.map(String));
      }
    }
  }, [peerId, pinnedIds, messageStore, sdk]);

  // Group by date
  const dateSections = useMemo(() => {
    const sections: PinnedDateSection[] = [];
    let currentSection: PinnedDateSection | null = null;

    for (const msg of pinnedMessages) {
      const label = formatDateHeader(msg.date);
      if (!currentSection || currentSection.label !== label) {
        currentSection = {
          dateKey: `${msg.date}-${label}`,
          label,
          messages: [msg],
        };
        sections.push(currentSection);
      } else {
        currentSection.messages.push(msg);
      }
    }

    return sections;
  }, [pinnedMessages]);

  const handleJumpToMessage = useCallback(
    (messageId: number | string) => {
      onBack();
      void sdk.messageLoad.focusMessage(peerId, { messageId: String(messageId) });
    },
    [onBack, peerId, sdk],
  );

  const handleUnpinAll = useCallback(async () => {
    setIsUnpinning(true);
    try {
      await sdk.messageLoad.unpinAllMessages(peerId);
      toast.success('All pinned messages unpinned');
      onBack();
    } catch (err) {
      console.error('Failed to unpin messages:', err);
      toast.error('Failed to unpin messages');
    } finally {
      setIsUnpinning(false);
    }
  }, [onBack, peerId, sdk]);

  const titleText =
    pinnedCount === 1 ? '1 Pinned Message' : `${pinnedCount || pinnedIds.length} Pinned Messages`;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top Header: back button + title (no right corner icons per Requirement 4) */}
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4 gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back to chat"
          className="size-9 rounded-lg hover:bg-muted/80 text-foreground"
        >
          <ChevronLeft className="size-5" />
        </Button>

        <span className="text-sm font-semibold text-foreground truncate">{titleText}</span>
      </div>

      {/* Messages body */}
      <div
        ref={scrollerRef}
        className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-3 [overflow-anchor:none]"
      >
        {pinnedIds.length > 0 && pinnedMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : pinnedMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <p className="text-sm">No pinned messages</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-2">
            {dateSections.map((section) => (
              <div key={section.dateKey} className="flex flex-col">
                {/* Date header */}
                <div className="sticky top-2 z-10 my-2 flex w-full justify-center pointer-events-none">
                  <span className="rounded-full border border-border/60 bg-background/95 px-3.5 py-1 text-[11px] font-semibold text-foreground shadow-xs backdrop-blur-sm pointer-events-auto select-none dark:bg-popover/95">
                    {section.label}
                  </span>
                </div>

                {/* Section messages */}
                {section.messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn('my-0.5 flex', message.out ? 'justify-end' : 'justify-start')}
                  >
                    <div className="group relative w-fit max-w-[min(78%,calc(100%-3.25rem))]">
                      <MessageItem
                        peerId={peerId}
                        message={message}
                        isOwn={Boolean(message.out)}
                        isFirstInGroup={true}
                        isLastInGroup={true}
                        showAvatar={isGroup}
                        showSenderName={isGroup}
                        readOutboxMaxId={dialog?.readOutboxMaxId}
                        className="w-fit px-0 [&>div:last-child]:max-w-none"
                      />

                      <button
                        type="button"
                        onClick={() => handleJumpToMessage(message.id)}
                        title="Go to message"
                        aria-label="Go to message"
                        className={cn(
                          'absolute top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-card p-0 text-foreground/80 shadow-md opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-primary',
                          message.out ? '-left-12' : '-right-12',
                        )}
                      >
                        <CornerDownRight className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Bar: Unpin All button matching */}
      {pinnedCount > 0 && (
        <div className="shrink-0 border-t border-border p-3 flex justify-center bg-background/95">
          <Button
            variant="outline"
            onClick={handleUnpinAll}
            disabled={isUnpinning}
            className="w-full max-w-sm rounded-xl py-2.5 text-sm font-medium border-border/80 text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
          >
            {isUnpinning ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Unpinning…
              </>
            ) : (
              `Unpin All ${pinnedCount} Messages`
            )}
          </Button>
        </div>
      )}
    </div>
  );
});

export default PinnedMessageList;
