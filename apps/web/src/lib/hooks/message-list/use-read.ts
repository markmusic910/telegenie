'use client';

import { useGlobalStoreDialog, useGlobalStoreThread, useSDK, useStoreEntities } from '@/lib/contexts/sdk.context';
import { isBackgroundModeActive, useBackgroundMode } from '@/lib/hooks/use-background-mode';
import { useIntersectionObserver, type ObserveFn } from '@/lib/hooks/use-intersection-observer';
import { MAIN_THREAD_ID } from '@telegenie/sdk';
import { useCallback, useEffect, useRef, type RefObject } from 'react';

const READ_THROTTLE_MS = 500;

type UseMessageListReadOptions = {
  peerId: string;
  threadId?: string;
  scrollRootRef: RefObject<HTMLElement | null>;
  root?: HTMLElement | null;
};

export function useMessageListRead({
  peerId,
  threadId = MAIN_THREAD_ID,
  scrollRootRef,
  root,
}: UseMessageListReadOptions) {
  const sdk = useSDK();
  const dialog = useStoreEntities('dialog', peerId);
  const dialogUI = useGlobalStoreDialog(peerId);
  const threadUI = useGlobalStoreThread(peerId, threadId);
  const unreadReactionIds = dialogUI?.unreadReactionIds ?? [];
  const unreadReactionKey = unreadReactionIds.join('\0');
  const unreadReactionIdsRef = useRef(unreadReactionIds);
  unreadReactionIdsRef.current = unreadReactionIds;
  const visibleMessageIdsRef = useRef(new Set<string>());
  const peerIdRef = useRef(peerId);
  if (peerIdRef.current !== peerId) {
    peerIdRef.current = peerId;
    visibleMessageIdsRef.current.clear();
  }

  const hasUnread = (dialog?.unreadCount ?? 0) > 0 || Boolean(dialog?.unreadMark);
  const unreadDividerId = threadUI?.unreadDividerId;

  const markVisibleReactions = useCallback(() => {
    if (isBackgroundModeActive()) return;
    const unread = new Set(unreadReactionIdsRef.current);
    if (unread.size === 0) return;
    const ids: string[] = [];
    for (const id of visibleMessageIdsRef.current) {
      if (unread.has(id)) ids.push(id);
    }
    if (ids.length > 0) {
      sdk.messageReaction.markReactionsRead(peerId, ids);
    }
  }, [peerId, sdk.messageReaction]);

  const onIntersect = useCallback(
    (entries: Array<{ isIntersecting: boolean; target: Element }>) => {
      if (isBackgroundModeActive()) return;

      const currentReadMax = dialog?.readInboxMaxId ?? 0;
      let maxVisibleId = 0;
      const mentionIds: string[] = [];

      for (const entry of entries) {
        const dataset = (entry.target as HTMLElement).dataset;
        const ids = [dataset.messageId, dataset.lastMessageId].filter(
          (id): id is string => Boolean(id),
        );
        for (const id of ids) {
          if (entry.isIntersecting) visibleMessageIdsRef.current.add(id);
          else visibleMessageIdsRef.current.delete(id);
        }
        if (!entry.isIntersecting) continue;
        const rawId = dataset.lastMessageId || dataset.messageId;
        const messageId = Number(rawId);
        if (Number.isFinite(messageId) && messageId > maxVisibleId) {
          maxVisibleId = messageId;
        }
        if (dataset.hasUnreadMention === 'true' && dataset.messageId) {
          mentionIds.push(dataset.messageId);
        }
      }

      markVisibleReactions();

      if (mentionIds.length > 0) {
        sdk.messageRead.markMentionsRead(peerId, mentionIds);
      }

      if (!hasUnread) return;

      if (maxVisibleId <= currentReadMax) return;

      if (unreadDividerId) {
        const threshold = Number(unreadDividerId);
        if (Number.isFinite(threshold) && maxVisibleId < threshold) return;
      }

      sdk.messageRead.markMessageListRead(peerId, maxVisibleId);
    },
    [
      dialog?.readInboxMaxId,
      hasUnread,
      markVisibleReactions,
      peerId,
      sdk.messageRead,
      unreadDividerId,
    ],
  );

  const { observe: observeElement, freeze, unfreeze } = useIntersectionObserver({
    rootRef: scrollRootRef,
    root,
    peerId,
    threadId,
    throttleMs: READ_THROTTLE_MS,
    onIntersect,
  });

  const observe: ObserveFn = useCallback(
    (element, onIntersecting) => {
      const stop = observeElement(element, onIntersecting);
      return () => {
        if (element) {
          const dataset = (element as HTMLElement).dataset;
          if (dataset.messageId) visibleMessageIdsRef.current.delete(dataset.messageId);
          if (dataset.lastMessageId) visibleMessageIdsRef.current.delete(dataset.lastMessageId);
        }
        stop();
      };
    },
    [observeElement],
  );

  useBackgroundMode((isBackground) => {
    if (isBackground) {
      freeze();
      sdk.messageRead.flushPendingInboxRead(peerId);
      return;
    }
    unfreeze();
  });

  useEffect(() => {
    markVisibleReactions();
  }, [markVisibleReactions, unreadReactionKey]);

  useEffect(() => {
    return () => {
      sdk.messageRead.flushPendingInboxRead(peerId);
    };
  }, [peerId, sdk.messageRead]);

  return observe;
}

export type { ObserveFn };
