'use client';

import { observer } from 'mobx-react-lite';
import { collectAlbumPreview, fallbackPeerDisplay } from '@telegenie/sdk';
import { forwardRef, type CSSProperties, type HTMLAttributes } from 'react';

import DialogItemBadge from './dialog-item.badge';
import DialogItemSender from './dialog-item.sender';
import MessageMeta from '@/lib/components/message.meta';
import MessageSummary from '@/lib/components/message.summary';
import PeerAvatar from '@/lib/components/peer.avatar';
import PeerTitle from '@/lib/components/peer.title';
import {
  useDialogPeer,
  useGlobalStoreDialog,
  useMessage,
  useSDK,
  useStore,
  useStoreEntities,
} from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';

export const DIALOG_ITEM_ESTIMATE_PX = 60;

interface DialogItemProps extends HTMLAttributes<HTMLLIElement> {
  dialogId: string;
  style?: CSSProperties;
}

const DialogItem = observer(
  forwardRef<HTMLLIElement, DialogItemProps>(function DialogItem(
    { dialogId, style, className, ...liProps },
    ref,
  ) {
    const sdk = useSDK();
    const globalStore = useStore('global');
    const dialog = useStoreEntities('dialog', dialogId);
    const peerId = dialog?.peerId || dialogId;
    const dialogUI = useGlobalStoreDialog(peerId);
    const peer = useDialogPeer(peerId);
    const lastMessage = useMessage(peerId, dialog?.topMessageId);
    const senderPeerId =
      lastMessage?.fromId ?? (lastMessage?.out ? globalStore.auth.currentUser?.id : undefined);
    const sender = useDialogPeer(senderPeerId);

    if (!dialog?.peerId) {
      return (
        <li
          ref={ref}
          style={style}
          className={cn('h-[3.75rem]', className)}
          aria-hidden
          {...liProps}
        />
      );
    }

    const selected = dialogId === globalStore.nav.selectedDialogId;
    const display = peer?.display ?? fallbackPeerDisplay(peerId);
    const muted = dialog.isMuted;
    const hasUnread = dialog.unreadCount > 0 || Boolean(dialog.unreadMark);
    const draftText = dialog.draftText;
    const draftDate = dialog.draftDate;
    const messageDate = lastMessage?.date ?? 0;
    const metaDate = draftText && draftDate && draftDate > messageDate ? draftDate : messageDate;
    const outgoingStatus = lastMessage?.outgoingStatus(dialog.readOutboxMaxId);
    const showSender =
      !dialog.isPrivate &&
      !draftText &&
      Boolean(
        lastMessage && (lastMessage.out || (lastMessage.fromId && lastMessage.fromId !== peerId)),
      );
    const senderLabel = lastMessage?.out
      ? 'You'
      : (sender?.display.senderLabel ??
        sender?.display.name ??
        (senderPeerId ? fallbackPeerDisplay(senderPeerId).name : undefined));
    const preview =
      !draftText && lastMessage
        ? collectAlbumPreview(
            lastMessage.groupedId
              ? sdk.getMessageStore(peerId).getAllData().values()
              : [lastMessage],
            lastMessage,
          )
        : undefined;
    const currentUser = globalStore.auth.currentUser;
    const dialogPreview = {
      currentUserId: currentUser?.id,
      currentUsername: currentUser?.username,
    };
    const unreadMentionsCount =
      (dialog.unreadMentionsCount ?? 0) > 0
        ? dialog.unreadMentionsCount!
        : lastMessage?.hasUnreadMention
          ? 1
          : 0;
    const trackedReactions = dialogUI?.unreadReactionIds.length ?? 0;
    const unreadReactionsCount =
      trackedReactions > 0 ? trackedReactions : (dialog.unreadReactionsCount ?? 0);

    return (
      <li ref={ref} style={style} className={className} {...liProps}>
        <button
          id={`dialog-item-${dialog.id}`}
          type="button"
          onClick={() => {
            void sdk.messageLoad.selectDialog(dialogId);
          }}
          className={cn(
            'group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left',
            'transition-[background-color,border-color] duration-100 outline-none',
            'hover:border-ring hover:bg-accent focus-visible:border-ring focus-visible:bg-accent',
            selected && 'border-ring bg-accent',
          )}
        >
          <PeerAvatar peerId={peerId} display={display} photo={peer?.photo} />

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-baseline justify-between gap-1">
              <PeerTitle display={display} muted={muted} unread={hasUnread} />
              <MessageMeta unixSeconds={metaDate || undefined} outgoingStatus={outgoingStatus} />
            </div>

            {showSender && senderLabel ? (
              <DialogItemSender
                peerId={senderPeerId ?? 'you'}
                display={sender?.display}
                photo={sender?.photo}
                label={senderLabel}
              />
            ) : null}

            <div className="flex items-center justify-between gap-1">
              <MessageSummary
                className="min-w-0 flex-1"
                draftText={draftText}
                lastMessage={lastMessage}
                preview={preview}
                dialogPreview={dialogPreview}
              />
              <DialogItemBadge
                unreadCount={dialog.unreadCount}
                unreadMentionsCount={unreadMentionsCount}
                unreadReactionsCount={unreadReactionsCount}
                unreadMark={dialog.unreadMark}
                pinned={dialog.pinned}
                muted={muted}
              />
            </div>
          </div>
        </button>
      </li>
    );
  }),
);

DialogItem.displayName = 'DialogItem';

export default DialogItem;
