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

export interface PinMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peerId: string;
  messageId: string;
  /** Private chats, basic groups, and supergroups can pin without notifying. */
  notifyChoice: boolean;
}

export default function PinMessageDialog({
  open,
  onOpenChange,
  peerId,
  messageId,
  notifyChoice,
}: PinMessageDialogProps) {
  const sdk = useSDK();
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNotifyMembers(true);
    setBusy(false);
  }, [open]);

  const confirm = async () => {
    if (busy) return;
    const id = Number(messageId);
    if (!Number.isInteger(id) || id <= 0) return;
    const notify = !notifyChoice || notifyMembers;
    setBusy(true);
    try {
      const result = await sdk.messageSend.updatePinnedMessage(peerId, id, {
        silent: !notify,
        pmOneside: !notify,
      });
      if (result.ok) onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Pin message?</AlertDialogTitle>
          <AlertDialogDescription>Pinned messages stay at the top of the chat.</AlertDialogDescription>
        </AlertDialogHeader>
        {notifyChoice ? (
          <label className="flex items-center gap-2 px-6 pb-2 text-sm">
            <Checkbox
              checked={notifyMembers}
              onCheckedChange={(checked) => setNotifyMembers(checked === true)}
            />
            Pin and notify members
          </label>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="outline" disabled={busy} />}>
            Cancel
          </AlertDialogClose>
          <Button type="button" loading={busy} onClick={() => void confirm()}>
            Pin
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
