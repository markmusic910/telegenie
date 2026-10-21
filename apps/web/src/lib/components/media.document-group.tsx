'use client';

import MediaDocument from '@/lib/components/media.document';
import { cn } from '@/lib/utils';
import type { MessageAlbum } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';

export interface MediaDocumentGroupProps {
  album: MessageAlbum;
  isOutgoing?: boolean;
  className?: string;
}

/**
 * Stacked file group component rendering multiple documents
 * within a single message bubble, matching the Telegram official client design.
 */
const MediaDocumentGroup = observer(function MediaDocumentGroup({
  album,
  isOutgoing = false,
  className,
}: MediaDocumentGroupProps) {
  return (
    <div className={cn('flex flex-col gap-0.5 w-full', className)}>
      {album.messages.map((msg) => {
        const doc = msg.fileDocument;
        if (!doc) return null;
        return (
          <MediaDocument
            key={msg.id}
            document={doc}
            isOutgoing={isOutgoing}
            peerId={msg.peerId}
            messageId={Number(msg.id)}
            variant="stack"
          />
        );
      })}
    </div>
  );
});

export default MediaDocumentGroup;
