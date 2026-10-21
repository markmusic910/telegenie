'use client';

import MessageSummary from '@/lib/components/message.summary';
import { Button } from '@/lib/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { useDialogPeer, useMessage, useSDK, useStore } from '@/lib/contexts/sdk.context';
import { formatReactionTimestamp } from '@/lib/utils/date';
import { emojiPresentation } from '@/lib/utils/emoji';
import { collectAlbumPreview, type RecentReactionMessage } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export interface RecentReactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RecentReactionRow = observer(function RecentReactionRow({
  row,
  onOpen,
}: {
  row: RecentReactionMessage;
  onOpen: (row: RecentReactionMessage) => void;
}) {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const peer = useDialogPeer(row.peerId);
  const message = useMessage(row.peerId, row.messageId);
  const peerName = peer?.display.name;
  const dialogName = peerName && peerName !== row.peerId ? peerName : row.dialogTitle;
  const currentUser = globalStore.auth.currentUser;
  const preview =
    message &&
    collectAlbumPreview(
      message.groupedId ? sdk.getMessageStore(row.peerId).getAllData().values() : [message],
      message,
    );

  return (
    <li className="min-w-0">
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-lg px-1 py-2 text-left hover:bg-accent"
        onClick={() => onOpen(row)}
      >
        <span className="w-8 shrink-0 text-center text-2xl leading-none" aria-hidden>
          {emojiPresentation(row.emoticon)}
        </span>
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="block truncate text-sm">{dialogName}</span>
          {message ? (
            <MessageSummary
              lastMessage={message}
              preview={preview || undefined}
              dialogPreview={{
                currentUserId: currentUser?.id,
                currentUsername: currentUser?.username,
              }}
            />
          ) : (
            <span className="block truncate text-xs leading-snug text-muted-foreground">
              {row.messageText}
            </span>
          )}
        </span>
        {row.date ? (
          <time
            dateTime={new Date(row.date * 1000).toISOString()}
            className="shrink-0 text-xs tabular-nums text-muted-foreground"
          >
            {formatReactionTimestamp(row.date)}
          </time>
        ) : null}
      </button>
    </li>
  );
});

/**
 * Recent reactions already loaded on messages, each with the message text and chat.
 */
export default function RecentReactionsDialog({ open, onOpenChange }: RecentReactionsDialogProps) {
  const sdk = useSDK();
  const router = useRouter();
  const [rows, setRows] = useState<RecentReactionMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void sdk.messageReaction
      .listRecentReactionMessages()
      .then((next) => {
        if (!cancelled) setRows(Array.isArray(next) ? next : []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sdk.messageReaction]);

  const onOpenMessage = (row: RecentReactionMessage) => {
    onOpenChange(false);
    void sdk.messageLoad.focusMessage(row.peerId, { messageId: row.messageId });
    router.push('/');
  };

  const onClear = () => {
    void sdk.messageReaction.clearRecentReactions().then(() => onOpenChange(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recent reactions</DialogTitle>
        </DialogHeader>
        <DialogPanel className="min-w-0 overflow-x-clip">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !Array.isArray(rows) || rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent reactions in your loaded chats.</p>
          ) : (
            <ul className="flex w-0 min-w-full flex-col">
              {rows.map((row) => (
                <RecentReactionRow key={row.key} row={row} onOpen={onOpenMessage} />
              ))}
            </ul>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClear}>
            Clear recent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
