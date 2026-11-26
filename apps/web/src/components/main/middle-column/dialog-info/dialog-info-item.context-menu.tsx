'use client';

import { Forward, MessageSquareQuote } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

import ForwardRecipientDialog from '@/components/main/middle-column/forward-recipient.dialog';
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuTrigger,
} from '@/lib/components/ui/context-menu';

export interface DialogInfoItemContextMenuProps {
  peerId: string;
  messageId: string;
  onShowMessage: () => void;
  triggerClassName?: string;
  onTriggerClick?: () => void;
  children: React.ReactNode;
}

export default function DialogInfoItemContextMenu({
  peerId,
  messageId,
  onShowMessage,
  triggerClassName,
  onTriggerClick,
  children,
}: DialogInfoItemContextMenuProps) {
  const [forwardOpen, setForwardOpen] = useState(false);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger className={triggerClassName} onClick={onTriggerClick}>
          {children}
        </ContextMenuTrigger>

        <ContextMenuPopup className="min-w-40">
          <ContextMenuItem onClick={onShowMessage}>
            <MessageSquareQuote className="size-4" aria-hidden="true" />
            Show Message
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setForwardOpen(true)}>
            <Forward className="size-4" aria-hidden="true" />
            Forward
          </ContextMenuItem>
        </ContextMenuPopup>
      </ContextMenu>

      <ForwardRecipientDialog
        open={forwardOpen}
        onOpenChange={setForwardOpen}
        fromPeerId={peerId}
        messageId={messageId}
      />
    </>
  );
}
