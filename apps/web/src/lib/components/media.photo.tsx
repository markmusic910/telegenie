'use client';

import { useCanLoadMedia, type ObserveFn } from '@/lib/hooks/use-intersection-observer';
import { useState } from 'react';
import MediaSpoiler from '@/lib/components/media.spoiler';
import MediaUploadProgress from '@/lib/components/media-upload.progress';
import type { Document, Photo } from '@telegenie/libs/foundation/telegram/types/file';
import { buildMediaUrl } from '@telegenie/sdk';
import { useStableMediaDimensions } from '@/lib/hooks/use-stable-media-dimensions';
import { AlbumRectPart } from '@/lib/utils/media-layout';
import {
  calculateMediaDimensions,
  getDocumentSourceDimensions,
  getPhotoSourceDimensions,
  mediaBoxStyle,
} from '@/lib/utils/media-dimensions';
import { cn } from '@/lib/utils';

export interface MediaPhotoProps {
  photo?: Photo;
  document?: Document;
  previewThumbDataUri?: string;
  localBlobUrl?: string;
  dimensions?: { width: number; height: number };
  sides?: number;
  isSpoiler?: boolean;
  isInAlbum?: boolean;
  className?: string;
  peerId?: string;
  messageId?: number | string;
  observeIntersectionForLoading?: ObserveFn;
  onClick?: () => void;
  uploadProgress?: number;
  onAbortUpload?: () => void;
}

export default function MediaPhoto({
  photo,
  document,
  previewThumbDataUri,
  localBlobUrl,
  dimensions,
  sides,
  isSpoiler,
  isInAlbum = false,
  className,
  peerId,
  messageId,
  observeIntersectionForLoading,
  onClick,
  uploadProgress,
  onAbortUpload,
}: MediaPhotoProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showSpoiler, setShowSpoiler] = useState(Boolean(isSpoiler));
  const { ref: loadRef, canLoad } = useCanLoadMedia(observeIntersectionForLoading);

  const metadataDims =
    getPhotoSourceDimensions(photo?.sizes) ?? getDocumentSourceDimensions(document);
  const sourceDims = dimensions ?? metadataDims;
  const computedDims = dimensions
    ? { width: dimensions.width, height: dimensions.height, aspectRatio: dimensions.width / dimensions.height }
    : calculateMediaDimensions(sourceDims ?? {});
  const mediaDims = useStableMediaDimensions(computedDims, !isInAlbum && Boolean(metadataDims));

  if (!photo && !document) {
    return null;
  }

  const numericMessageId = typeof messageId === 'number' ? messageId : Number(messageId);
  const validMessageId =
    Number.isInteger(numericMessageId) && numericMessageId > 0 ? numericMessageId : undefined;

  const mediaUrl = photo
    ? buildMediaUrl({
        fileId: `p:${photo.id}`,
        accessHash: photo.accessHash,
        dcId: photo.dcId,
        mimeType: 'image/jpeg',
        thumbSize: 'y',
        peerId,
        messageId: validMessageId,
      })
    : document
      ? buildMediaUrl({
          fileId: `d:${document.id}`,
          accessHash: document.accessHash,
          dcId: document.dcId,
          mimeType: document.mimeType || 'image/jpeg',
          fileSize: Number(document.size),
          peerId,
          messageId: validMessageId,
        })
      : '';

  // Extract thumb from local blob, photo sizes, or document thumbs if not explicitly provided
  const thumbUri =
    localBlobUrl ||
    previewThumbDataUri ||
    (photo?.sizes?.find(
      (s) => 'bytes' in s && typeof s.bytes === 'string' && s.bytes.startsWith('data:'),
    ) as { bytes?: string } | undefined)?.bytes ||
    (document?.thumbs?.find(
      (s) => 'bytes' in s && typeof s.bytes === 'string' && s.bytes.startsWith('data:'),
    ) as { bytes?: string } | undefined)?.bytes;

  // Corner rounding when in an album
  const albumCornerRounding = isInAlbum && sides != null
    ? cn(
        sides & AlbumRectPart.Top && sides & AlbumRectPart.Left && 'rounded-tl-2xl',
        sides & AlbumRectPart.Top && sides & AlbumRectPart.Right && 'rounded-tr-2xl',
        sides & AlbumRectPart.Bottom && sides & AlbumRectPart.Left && 'rounded-bl-2xl',
        sides & AlbumRectPart.Bottom && sides & AlbumRectPart.Right && 'rounded-br-2xl',
      )
    : !isInAlbum
      ? 'rounded-2xl'
      : '';

  return (
    <div
      ref={loadRef}
      className={cn(
        'relative overflow-hidden bg-muted/40 cursor-pointer select-none group',
        albumCornerRounding,
        className,
      )}
      style={mediaBoxStyle(mediaDims.width, mediaDims.height)}
      onClick={() => {
        if (showSpoiler) {
          setShowSpoiler(false);
          return;
        }
        onClick?.();
      }}
    >
      {/* Low-Res Placeholder or Local Upload Blob */}
      {thumbUri && (
        <img
          src={thumbUri}
          alt=""
          aria-hidden="true"
          width={mediaDims.width}
          height={mediaDims.height}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
            thumbUri.startsWith('blob:')
              ? 'opacity-100 filter-none scale-100'
              : cn(
                  'filter blur-xs scale-105',
                  isLoaded && !showSpoiler ? 'opacity-0' : 'opacity-100',
                ),
          )}
        />
      )}

      {/* High-Res Full Image */}
      {canLoad && !thumbUri?.startsWith('blob:') && (
        <img
          src={mediaUrl}
          alt="Photo"
          width={mediaDims.width}
          height={mediaDims.height}
          onLoad={() => setIsLoaded(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
            isLoaded && !showSpoiler ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}

      {/* In-Bubble Upload Progress with Abort Button */}
      {uploadProgress !== undefined && (
        <MediaUploadProgress
          progress={uploadProgress}
          onAbort={onAbortUpload}
        />
      )}

      {/* Spoiler Overlay */}
      <MediaSpoiler
        isVisible={showSpoiler && uploadProgress === undefined}
        label="Photo Spoiler"
        thumbUri={thumbUri}
        onReveal={() => setShowSpoiler(false)}
      />
    </div>
  );
}
