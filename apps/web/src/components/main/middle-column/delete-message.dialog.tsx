'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/lib/components/ui/button';
import { Checkbox } from '@/lib/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/lib/components/ui/alert-dialog';
import { useSDK } from '@/lib/contexts/sdk.context';

export interface DeleteMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peerId: string;
  messageIds: string[];
  /** Private chats and basic groups can delete for the other side. */
  allowForAll: boolean;
  /** Runs after the delete succeeded, before the dialog closes. */
  onDeleted?: () => void;
}

export default function DeleteMessageDialog({
  open,
  onOpenChange,
  peerId,
  messageIds,
  allowForAll,
  onDeleted,
}: DeleteMessageDialogProps) {
  const sdk = useSDK();
  const [deleteForAll, setDeleteForAll] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDeleteForAll(true);
    setBusy(false);
  }, [open]);

  const confirm = async () => {
    if (busy) return;
    const ids = messageIds.map(Number).filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const result = await sdk.messageSend.deleteMessages(peerId, ids, {
        revoke: allowForAll && deleteForAll,
      });
      if (result.ok) {
        onDeleted?.();
        onOpenChange(false);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {messageIds.length > 1 ? `Delete ${messageIds.length} messages?` : 'Delete message?'}
          </AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        {allowForAll ? (
          <label className="flex items-center gap-2 px-6 pb-2 text-sm">
            <Checkbox
              checked={deleteForAll}
              onCheckedChange={(checked) => setDeleteForAll(checked === true)}
            />
            Delete for the other person
          </label>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="outline" disabled={busy} />}>
            Cancel
          </AlertDialogClose>
          <Button type="button" variant="destructive" loading={busy} onClick={() => void confirm()}>
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
