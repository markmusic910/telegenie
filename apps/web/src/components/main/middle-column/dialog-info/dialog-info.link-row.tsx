'use client';

import type { Message } from '@telegenie/sdk';
import type { MessageMediaWebPage } from '@telegenie/libs/foundation/telegram/types/api-types';

import MediaWebPage from '@/lib/components/media.webpage';

import { isLinkMessage } from './dialog-info.tab-content.utils';

function firstUrlInText(text: string | undefined): string | undefined {
  if (!text?.trim()) return undefined;
  const match = text.match(/https?:\/\/[^\s<>"')]+/i);
  return match?.[0];
}

export interface DialogInfoLinkRowProps {
  message: Message;
  peerId: string;
}

export default function DialogInfoLinkRow({ message, peerId }: DialogInfoLinkRowProps) {
  const media = message.media;

  if (media && isLinkMessage(message) && 'webpage' in media) {
    return (
      <MediaWebPage
        media={media as MessageMediaWebPage}
        peerId={peerId}
        messageId={Number(message.id)}
        variant="profile"
        fallbackText={message.message ?? undefined}
        className="shadow-none"
      />
    );
  }

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

  return (
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