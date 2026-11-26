'use client';

import type { Message } from '@telegenie/sdk';
import { Play } from 'lucide-react';
import { useState } from 'react';

import MediaPhoto from '@/lib/components/media.photo';
import MediaVideo from '@/lib/components/media.video';
import { cn } from '@/lib/utils';

import DialogInfoItemContextMenu from './dialog-info-item.context-menu';
import DialogInfoMediaViewerDialog from './dialog-info.media-viewer.dialog';

export interface DialogInfoMediaTileProps {
  message: Message;
  peerId: string;
  onShowMessage: () => void;
  /** Items in the GIFs profile tab are always treated as GIFs. */
  forceGif?: boolean;
}

export default function DialogInfoMediaTile({
  message,
  peerId,
  onShowMessage,
  forceGif = false,
}: DialogInfoMediaTileProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const isGif = message.isGif || forceGif;
  const showVideo = message.isVideo && message.videoDocument;

  return (
    <>
      <DialogInfoItemContextMenu
        peerId={peerId}
        messageId={String(message.id)}
        onShowMessage={onShowMessage}
        triggerClassName={cn(
          'relative block aspect-square w-full overflow-hidden bg-muted',
          'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
        onTriggerClick={() => setViewerOpen(true)}
      >
        {showVideo ? (
          <MediaVideo
            document={message.videoDocument!}
            videoCover={message.videoCover}
            previewThumbDataUri={message.previewThumbDataUri}
            peerId={peerId}
            messageId={message.id}
            isInAlbum
            isGif={isGif}
            sides={1}
            dimensions={{ width: 1, height: 1 }}
            className="pointer-events-none !size-full max-h-none max-w-none rounded-none"
          />
        ) : (
          <MediaPhoto
            photo={message.photo}
            document={message.photoDocument}
            previewThumbDataUri={message.previewThumbDataUri}
            peerId={peerId}
            messageId={message.id}
            isInAlbum
            sides={1}
            dimensions={{ width: 1, height: 1 }}
            isSpoiler={message.hasSpoiler}
            className="pointer-events-none !size-full max-h-none max-w-none rounded-none"
          />
        )}
        {showVideo && !isGif ? (
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25"
            aria-hidden
          >
            <Play className="size-7 fill-white text-white drop-shadow-sm" />
          </span>
        ) : null}
      </DialogInfoItemContextMenu>

      <DialogInfoMediaViewerDialog
        peerId={peerId}
        message={message}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </>
  );
}