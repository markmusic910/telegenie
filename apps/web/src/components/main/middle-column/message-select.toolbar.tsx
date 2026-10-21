'use client';

import { Copy, Trash2, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import DeleteMessageDialog from '@/components/main/middle-column/delete-message.dialog';
import { Button } from '@/lib/components/ui/button';
import { toastManager } from '@/lib/components/ui/toast';
import {
  useDialogPeer,
  useGlobalStoreDialog,
  useGlobalStoreThread,
  useSDK,
  useStore,
} from '@/lib/contexts/sdk.context';
import { useDocumentEvent } from '@/lib/hooks/use-document-event';
import { actionChat } from '@/lib/utils/message-action-chat';
import { MAIN_THREAD_ID, selectionMenuActions } from '@telegenie/sdk';

const OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"]';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

export interface MessageSelectToolbarProps {
  peerId: string;
}

/**
 * Replaces the composer while the active thread is in selection mode.
 * Copy and Delete are offered only when every selected message allows them.
 */
const MessageSelectToolbar = observer(function MessageSelectToolbar({
  peerId,
}: MessageSelectToolbarProps) {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const peer = useDialogPeer(peerId);
  const dialogUI = useGlobalStoreDialog(peerId);
  const threadId = dialogUI?.activeThreadId ?? MAIN_THREAD_ID;
  const thread = useGlobalStoreThread(peerId, threadId);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selectedIds = thread?.selectedMessageIds ?? [];
  const selected = sdk.messageSelect.getSelectedMessages(peerId, threadId);
  const chat = actionChat(peer);
  const currentUserId = globalStore.auth.currentUser?.id;
  const actions = selectionMenuActions(
    selected.map((message) => ({ message, chat, currentUserId })),
  );
  const hasSelection = selectedIds.length > 0;

  const exit = () => sdk.messageSelect.exit(peerId, threadId);

  const copy = () => {
    if (!actions.canCopy) return;
    const text = sdk.messageSelect.copyText(peerId, threadId);
    void navigator.clipboard.writeText(text).then(
      () => {
        toastManager.add({ type: 'success', title: 'Copied' });
        exit();
      },
      () => toastManager.add({ type: 'error', title: 'Copy failed' }),
    );
  };

  useDocumentEvent('keydown', (event) => {
    if (event.defaultPrevented || deleteOpen) return;
    if (document.querySelector(OVERLAY_SELECTOR)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      exit();
      return;
    }
    if (isTyping(event.target)) return;
    if ((event.key === 'Delete' || event.key === 'Backspace') && actions.canDelete) {
      event.preventDefault();
      setDeleteOpen(true);
      return;
    }
    const isCopyKey =
      (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'c';
    if (isCopyKey && actions.canCopy && !window.getSelection()?.toString()) {
      event.preventDefault();
      copy();
    }
  });

  return (
    <>
      <div
        className="flex shrink-0 items-center gap-2 border-t border-border bg-background px-3 py-2"
        role="toolbar"
        aria-label="Selected messages"
      >
        <Button variant="ghost" size="icon" aria-label="Exit selection" onClick={exit}>
          <X className="size-4" />
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium" aria-live="polite">
          {selectedIds.length} selected
        </span>
        {hasSelection && actions.canCopy ? (
          <Button variant="outline" size="sm" onClick={copy}>
            <Copy className="size-4" />
            Copy
          </Button>
        ) : null}
        {hasSelection && actions.canDelete ? (
          <Button variant="destructive-outline" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
            Delete
          </Button>
        ) : null}
      </div>
      <DeleteMessageDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        peerId={peerId}
        messageIds={[...selectedIds]}
        allowForAll={actions.canDeleteForAll}
        onDeleted={exit}
      />
    </>
  );
});

export default MessageSelectToolbar;
