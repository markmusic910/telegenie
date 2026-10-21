'use client';

import MessageReactionReactorsList from '@/lib/components/message.reaction-reactors.list';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/lib/components/ui/dialog';
import { useSDK } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import { reactionKey, reactionsEqual } from '@telegenie/libs/foundation/telegram/helpers';
import type {
  TypeMessagePeerReaction,
  TypeReaction,
  TypeReactionCount,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function canonicalEmoticon(value: string): string {
  return value.replace(/\uFE0F/g, '');
}

function reactionTabLabel(reaction: TypeReaction): string {
  if ('emoticon' in reaction && reaction.emoticon) return canonicalEmoticon(reaction.emoticon);
  if ('documentId' in reaction) return 'Custom';
  if ('paid' in reaction) return '⭐';
  return 'Reaction';
}

export interface ReactorListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peerId: string;
  messageId: string;
  results: TypeReactionCount[];
  totalCount: number;
}

/**
 * Full-screen reactor list with optional reaction tabs and infinite scroll.
 */
export default function ReactorListDialog({
  open,
  onOpenChange,
  peerId,
  messageId,
  results,
  totalCount,
}: ReactorListDialogProps) {
  const sdk = useSDK();
  const [activeReaction, setActiveReaction] = useState<TypeReaction | undefined>(undefined);
  const [items, setItems] = useState<TypeMessagePeerReaction[]>([]);
  const [nextOffset, setNextOffset] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [listCount, setListCount] = useState(totalCount);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const reactionTabs = useMemo(() => {
    const distinct = results.filter((row) => row.count > 0);
    return distinct.map((row) => row.reaction);
  }, [results]);

  const showTabs = listCount >= 10 && reactionTabs.length > 1;

  const loadPage = useCallback(
    async (offset?: string, replace = false) => {
      setLoading(true);
      try {
        const result = await sdk.messageReaction.getReactionList({
          peerId,
          messageId,
          offset,
          limit: 100,
          reaction: activeReaction,
        });
        setListCount(result.count);
        setNextOffset(result.nextOffset);
        setItems((prev) => (replace ? result.reactions : [...prev, ...result.reactions]));
      } finally {
        setLoading(false);
      }
    },
    [activeReaction, messageId, peerId, sdk.messageReaction],
  );

  useEffect(() => {
    if (!open) {
      setItems([]);
      setNextOffset(undefined);
      setActiveReaction(undefined);
      return;
    }
    void loadPage(undefined, true);
  }, [open, activeReaction, loadPage]);

  useEffect(() => {
    if (!open) return;
    const node = sentinelRef.current;
    if (!node || !nextOffset || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadPage(nextOffset, false);
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadPage, loading, nextOffset, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(640px,90vh)] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>Reactions</DialogTitle>
        </DialogHeader>
        {showTabs ? (
          <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
            <button
              type="button"
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-sm',
                activeReaction == null ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
              onClick={() => setActiveReaction(undefined)}
            >
              All
            </button>
            {reactionTabs.map((reaction) => (
              <button
                key={reactionKey(reaction)}
                type="button"
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-sm',
                  activeReaction && reactionsEqual(activeReaction, reaction)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted',
                )}
                onClick={() => setActiveReaction(reaction)}
              >
                {reactionTabLabel(reaction)}
              </button>
            ))}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <MessageReactionReactorsList
            reactions={items}
            loading={loading && !items.length}
            showTime
          />
          <div ref={sentinelRef} className="h-px" aria-hidden />
        </div>
      </DialogContent>
    </Dialog>
  );
}
