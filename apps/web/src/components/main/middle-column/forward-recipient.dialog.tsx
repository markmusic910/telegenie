'use client';

import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import ChatPickerDialog from '@/lib/components/chat-picker.dialog';
import { useSDK, useStore } from '@/lib/contexts/sdk.context';

export interface ForwardRecipientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromPeerId: string;
  messageId: string;
}

const ForwardRecipientDialog = observer(function ForwardRecipientDialog({
  open,
  onOpenChange,
  fromPeerId,
  messageId,
}: ForwardRecipientDialogProps) {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBusy(false);
  }, [open]);

  const selfId = globalStore.auth.currentUser?.id;

  const choose = async (peerId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      if (selfId && peerId === selfId) {
        const result = await sdk.messageSend.forwardToSavedMessages(fromPeerId, messageId);
        if (!result.ok) return;
      } else {
        sdk.messageDraft.stageForward(peerId, fromPeerId, messageId);
        await sdk.messageLoad.selectDialog(peerId);
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ChatPickerDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Forward to"
      mode="single"
      includeSavedMessages
      busy={busy}
      onSelectSingle={choose}
    />
  );
});

export default ForwardRecipientDialog;
