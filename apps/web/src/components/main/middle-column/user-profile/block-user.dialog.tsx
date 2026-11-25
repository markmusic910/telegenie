'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/lib/components/ui/alert-dialog';
import { Button } from '@/lib/components/ui/button';
import { useSDK } from '@/lib/contexts/sdk.context';

export interface BlockUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  displayName: string;
}

export default function BlockUserDialog({
  open,
  onOpenChange,
  userId,
  displayName,
}: BlockUserDialogProps) {
  const sdk = useSDK();
  const [submitting, setSubmitting] = useState(false);

  const handleConfirmBlock = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await sdk.user.setBlocked(userId, true);
      toast.success(`Blocked ${displayName}`);
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to block user:', err);
      toast.error('Failed to block user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPopup className="sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Block {displayName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Do you want to block {displayName} from messaging and calling you on Telegram?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="ghost" disabled={submitting} />}>
            Cancel
          </AlertDialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={submitting}
            onClick={() => void handleConfirmBlock()}
          >
            {submitting ? 'Blocking…' : 'Block'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
