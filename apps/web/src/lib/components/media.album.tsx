'use client';

import { useMemo, useRef } from 'react';
import type { MessageAlbum } from '@telegenie/sdk';
import { useSDK } from '@/lib/contexts/sdk.context';
import { calculateAlbumLayout, type IAlbumLayout } from '@/lib/utils/media-layout';
import { mediaBoxStyle } from '@/lib/utils/media-dimensions';
import MediaPhoto from '@/lib/components/media.photo';
import MediaVideo from '@/lib/components/media.video';
import { cn } from '@/lib/utils';
import type { ObserveFn } from '@/lib/hooks/use-intersection-observer';
import { observer } from 'mobx-react-lite';

export interface MediaAlbumProps {
  album: MessageAlbum;
  isOwn?: boolean;
  maxWidth?: number;
  className?: string;
  observeIntersectionForLoading?: ObserveFn;
}

function albumHasSourceDimensions(album: MessageAlbum): boolean {
  return album.messages.every((message) => {
    const dims = message.mediaDimensions;
    return Boolean(dims && dims.width > 0 && dims.height > 0);
  });
}

function useStableAlbumLayout(album: MessageAlbum, maxWidth: number): IAlbumLayout {
  const computed = useMemo(() => calculateAlbumLayout(album, maxWidth), [album, maxWidth]);
  const lockedRef = useRef<{ layout: IAlbumLayout; count: number; idsKey: string } | null>(null);

  const idsKey = album.messages.map((m) => m.id).join(',');
  if (!albumHasSourceDimensions(album)) {
    return computed;
  }
  if (
    !lockedRef.current ||
    lockedRef.current.count !== album.messages.length ||
    lockedRef.current.idsKey !== idsKey ||
    lockedRef.current.layout.layout.length !== album.messages.length
  ) {
    lockedRef.current = { layout: computed, count: album.messages.length, idsKey };
  }
  return lockedRef.current.layout;
}

/**
 * Multi-media album grid component rendering 2–10 photos and videos
 * with Telegram's proportional grouped layout.
 */
const MediaAlbum = observer(function MediaAlbum({
  album,
  maxWidth = 420,
  className,
  observeIntersectionForLoading,
}: MediaAlbumProps) {
  const sdk = useSDK();
  const { containerStyle, layout } = useStableAlbumLayout(album, maxWidth);

  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl select-none shrink-0', className)}
      style={mediaBoxStyle(containerStyle.width, containerStyle.height)}
    >
      {album.messages.map((message, index) => {
        const itemLayout = layout[index];
        if (!itemLayout) return null;

        const { dimensions, sides } = itemLayout;
        const uploadProgress = message.uploadProgress;
        const onAbortUpload = message.uploadId
          ? () => {
              void sdk.messageSend.cancelUpload(message.uploadId!);
            }
          : undefined;

        if (message.isPhoto && (message.photo || message.photoDocument)) {
          return (
            <div
              key={message.id}
              className="absolute"
              style={{
                left: `${dimensions.x}px`,
                top: `${dimensions.y}px`,
              }}
            >
              <MediaPhoto
                photo={message.photo}
                document={message.photoDocument}
                previewThumbDataUri={message.previewThumbDataUri}
                localBlobUrl={message.localBlobUrl}
                dimensions={dimensions}
                sides={sides}
                isInAlbum
                isSpoiler={message.hasSpoiler}
                peerId={message.peerId}
                messageId={Number(message.id)}
                observeIntersectionForLoading={observeIntersectionForLoading}
                uploadProgress={uploadProgress}
                onAbortUpload={onAbortUpload}
              />
            </div>
          );
        }

        if (message.isVideo && message.videoDocument) {
          return (
            <div
              key={message.id}
              className="absolute"
              style={{
                left: `${dimensions.x}px`,
                top: `${dimensions.y}px`,
              }}
            >
              <MediaVideo
                document={message.videoDocument}
                videoCover={message.videoCover}
                previewThumbDataUri={message.previewThumbDataUri}
                localBlobUrl={message.localBlobUrl}
                localCoverBlobUrl={message.localCoverBlobUrl}
                dimensions={dimensions}
                sides={sides}
                isInAlbum
                isSpoiler={message.hasSpoiler}
                peerId={message.peerId}
                messageId={Number(message.id)}
                observeIntersectionForLoading={observeIntersectionForLoading}
                uploadProgress={uploadProgress}
                onAbortUpload={onAbortUpload}
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
});

export default MediaAlbum;
