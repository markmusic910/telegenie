'use client';

import MediaStickerAnimated from '@/lib/components/media.sticker.animated';
import { useCanLoadMedia, type ObserveFn } from '@/lib/hooks/use-intersection-observer';
import { useStableMediaDimensions } from '@/lib/hooks/use-stable-media-dimensions';
import { cn } from '@/lib/utils';
import {
  calculateStickerDimensions,
  getDocumentSourceDimensions,
  mediaBoxStyle,
} from '@/lib/utils/media-dimensions';
import { Skeleton } from '@/lib/components/ui/skeleton';
import type { Document } from '@telegenie/sdk';
import { buildMediaUrl } from '@telegenie/sdk';
import { useState } from 'react';

export interface MediaStickerProps {
  document: Document;
  isOutgoing?: boolean;
  isAnimated?: boolean;
  isVideo?: boolean;
  emoji?: string;
  previewThumbDataUri?: string;
  peerId?: string;
  messageId?: number;
  observeIntersectionForLoading?: ObserveFn;
  className?: string;
  /** Caps the rendered box. Message bubbles keep the default sticker size. */
  maxSize?: number;
  onClick?: () => void;
}

export default function MediaSticker({
  document,
  isAnimated = false,
  isVideo = false,
  emoji,
  previewThumbDataUri,
  peerId,
  messageId,
  observeIntersectionForLoading,
  className,
  maxSize,
  onClick,
}: MediaStickerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const { ref: loadRef, canLoad } = useCanLoadMedia(observeIntersectionForLoading);

  const metadataDims = getDocumentSourceDimensions(document);
  const computedDims = calculateStickerDimensions({ ...(metadataDims ?? {}), maxSize });
  const mediaDims = useStableMediaDimensions(computedDims, Boolean(metadataDims));

  const stickerUrl = buildMediaUrl({
    fileId: `d:${document.id}`,
    accessHash: document.accessHash,
    dcId: document.dcId,
    mimeType: document.mimeType || (isVideo ? 'video/webm' : 'image/webp'),
    fileSize: Number(document.size),
    peerId,
    messageId,
  });

  // Extract thumbnail from document thumbs if not explicitly provided
  const thumbUri =
    previewThumbDataUri ||
    (document.thumbs?.find(
      (s) => 'bytes' in s && typeof s.bytes === 'string' && s.bytes.startsWith('data:'),
    ) as { bytes?: string } | undefined)?.bytes;

  return (
    <div
      ref={loadRef}
      role="img"
      aria-label={emoji ? `${emoji} sticker` : 'Sticker'}
      title={emoji}
      className={cn(
        'relative overflow-hidden cursor-pointer select-none group flex items-center justify-center bg-transparent',
        className,
      )}
      style={mediaBoxStyle(mediaDims.width, mediaDims.height)}
      onClick={onClick}
    >
      {!isLoaded &&
        (thumbUri ? (
          <img
            src={thumbUri}
            alt=""
            aria-hidden="true"
            width={mediaDims.width}
            height={mediaDims.height}
            className="absolute inset-0 h-full w-full object-contain filter blur-xs scale-105 opacity-80"
          />
        ) : (
          <Skeleton aria-hidden="true" className="absolute inset-0 rounded-2xl" />
        ))}

      {/* Video sticker (WebM, often with alpha). Full file — these are small and do not stream. */}
      {canLoad && isVideo ? (
        <video
          src={stickerUrl}
          autoPlay
          loop
          muted
          playsInline
          width={mediaDims.width}
          height={mediaDims.height}
          onLoadedData={() => setIsLoaded(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-contain transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}

      {/* Animated sticker (gzipped Lottie / .tgs). */}
      {canLoad && isAnimated && !isVideo ? (
        <MediaStickerAnimated src={stickerUrl} onLoad={() => setIsLoaded(true)} />
      ) : null}

      {/* Static WebP sticker */}
      {canLoad && !isVideo && !isAnimated ? (
        <img
          src={stickerUrl}
          alt={emoji || 'Sticker'}
          width={mediaDims.width}
          height={mediaDims.height}
          onLoad={() => setIsLoaded(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-contain transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}
    </div>
  );
}
