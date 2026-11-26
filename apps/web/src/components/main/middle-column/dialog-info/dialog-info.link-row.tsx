'use client';

import type { Message } from '@telegenie/sdk';
import type { MessageMediaWebPage } from '@telegenie/libs/foundation/telegram/types/api-types';

import MediaWebPage from '@/lib/components/media.webpage';

import DialogInfoItemContextMenu from './dialog-info-item.context-menu';
import { isLinkMessage } from './dialog-info.tab-content.utils';

function firstUrlInText(text: string | undefined): string | undefined {
  if (!text?.trim()) return undefined;
  const match = text.match(/https?:\/\/[^\s<>"')]+/i);
  return match?.[0];
}

export interface DialogInfoLinkRowProps {
  message: Message;
  peerId: string;
  onShowMessage: () => void;
}

export default function DialogInfoLinkRow({
  message,
  peerId,
  onShowMessage,
}: DialogInfoLinkRowProps) {
  const media = message.media;

  let content: React.ReactNode = null;

  if (media && isLinkMessage(message) && 'webpage' in media) {
    content = (
      <MediaWebPage
        media={media as MessageMediaWebPage}
        peerId={peerId}
        messageId={Number(message.id)}
        variant="profile"
        fallbackText={message.message ?? undefined}
        className="shadow-none"
      />
    );
  } else {
    const url = firstUrlInText(message.message);
    if (!url) return null;

    const syntheticMedia: MessageMediaWebPage = {
      webpage: {
        url,
        displayUrl: url,
        siteName: undefined,
        title: undefined,
        description: undefined,
      },
    };

    content = (
      <MediaWebPage
        media={syntheticMedia}
        peerId={peerId}
        messageId={Number(message.id)}
        variant="profile"
        fallbackText={message.message ?? undefined}
        className="shadow-none"
      />
    );
  }

  return (
    <DialogInfoItemContextMenu
      peerId={peerId}
      messageId={String(message.id)}
      onShowMessage={onShowMessage}
      triggerClassName="block w-full"
    >
      {content}
    </DialogInfoItemContextMenu>
  );
}