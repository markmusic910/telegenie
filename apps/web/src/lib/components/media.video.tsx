'use client';

import { useCanLoadMedia, type ObserveFn } from '@/lib/hooks/use-intersection-observer';
import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import type { Document, DocumentAttributeVideo, Photo } from '@telegenie/libs/foundation/telegram/types/file';
import { buildMediaUrl, buildProgressiveUrl } from '@telegenie/sdk';
import MediaSpoiler from '@/lib/components/media.spoiler';
import MediaUploadProgress from '@/lib/components/media-upload.progress';
import { useStableMediaDimensions } from '@/lib/hooks/use-stable-media-dimensions';
import { AlbumRectPart } from '@/lib/utils/media-layout';
import {
  calculateMediaDimensions,
  getDocumentSourceDimensions,
  mediaBoxStyle,
} from '@/lib/utils/media-dimensions';
import { formatDuration } from '@/lib/utils/format';
import { cn } from '@/lib/utils';

export interface MediaVideoProps {
  document: Document;
  videoCover?: Photo;
  previewThumbDataUri?: string;
  localBlobUrl?: string;
  localCoverBlobUrl?: string;
  dimensions?: { width: number; height: number };
  sides?: number;
  isSpoiler?: boolean;
  isInAlbum?: boolean;
  className?: string;
  peerId?: string;
  messageId?: number | string;
  observeIntersectionForLoading?: ObserveFn;
  uploadProgress?: number;
  onAbortUpload?: () => void;
}

export default function MediaVideo({
  document,
  videoCover,
  previewThumbDataUri,
  localBlobUrl,
  localCoverBlobUrl,
  dimensions,
  sides,
  isSpoiler = false,
  isInAlbum = false,
  className,
  peerId,
  messageId,
  observeIntersectionForLoading,
  uploadProgress,
  onAbortUpload,
}: MediaVideoProps) {
  // Extract video attribute (w, h, duration)
  const videoAttr = document.attributes?.find(
    (a): a is DocumentAttributeVideo => typeof a === 'object' && a !== null && 'duration' in a,
  );
  const duration = videoAttr?.duration;

  const [showSpoiler, setShowSpoiler] = useState(isSpoiler);
  const hasCover = Boolean(videoCover);
  const isShort = duration != null && duration > 0 && duration < 30;
  const shouldAutoPlay = !isInAlbum && !showSpoiler && !hasCover && isShort;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(shouldAutoPlay);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ref: loadRef, canLoad } = useCanLoadMedia(observeIntersectionForLoading);

  useEffect(() => {
    if (canLoad && shouldAutoPlay) {
      setIsPlaying(true);
      setIsMuted(true);
    }
  }, [canLoad, shouldAutoPlay]);

  const metadataDims = getDocumentSourceDimensions(document);
  const sourceDims = dimensions ?? metadataDims;
  const computedDims = dimensions
    ? { width: dimensions.width, height: dimensions.height, aspectRatio: dimensions.width / dimensions.height }
    : calculateMediaDimensions(sourceDims ?? {});
  const mediaDims = useStableMediaDimensions(computedDims, !isInAlbum && Boolean(metadataDims));

  const numericMessageId = typeof messageId === 'number' ? messageId : Number(messageId);
  const validMessageId =
    Number.isInteger(numericMessageId) && numericMessageId > 0 ? numericMessageId : undefined;

  const streamUrl = buildProgressiveUrl({
    fileId: `d:${document.id}`,
    accessHash: document.accessHash,
    dcId: document.dcId,
    mimeType: document.mimeType || 'video/mp4',
    fileSize: Number(document.size),
    peerId,
    messageId: validMessageId,
  });

  const effectiveStreamUrl = localBlobUrl || streamUrl;

  const coverSize =
    videoCover?.sizes?.find((s) => s.type === 'y') ||
    videoCover?.sizes?.[videoCover.sizes.length - 1];
  const coverUrl = videoCover
    ? buildMediaUrl({
        fileId: `p:${videoCover.id}`,
        accessHash: videoCover.accessHash,
        dcId: videoCover.dcId,
        mimeType: 'image/jpeg',
        thumbSize: coverSize && 'type' in coverSize ? coverSize.type : 'y',
        peerId,
        messageId: validMessageId,
      })
    : undefined;

  const effectiveCoverUrl = localCoverBlobUrl || coverUrl;

  const docThumb =
    document.thumbs?.find(
      (t) => 'type' in t && (t.type === 'm' || t.type === 's' || t.type === 'x' || t.type === 'y'),
    ) || document.thumbs?.find((t) => 'type' in t && t.type);
  const docThumbUrl =
    docThumb && 'type' in docThumb && docThumb.type && validMessageId
      ? buildMediaUrl({
          fileId: `d:${document.id}`,
          accessHash: document.accessHash,
          dcId: document.dcId,
          mimeType: 'image/jpeg',
          thumbSize: docThumb.type,
          peerId,
          messageId: validMessageId,
        })
      : undefined;

  // Do not treat a raw video blob as an image thumbnail URI
  const isVideoBlob = previewThumbDataUri && localBlobUrl && previewThumbDataUri === localBlobUrl;
  const thumbUri =
    (!isVideoBlob ? previewThumbDataUri : undefined) ||
    (document.thumbs?.find(
      (s) => 'bytes' in s && typeof s.bytes === 'string' && s.bytes.startsWith('data:'),
    ) as { bytes?: string } | undefined)?.bytes ||
    docThumbUrl;

  const effectivePosterUrl = effectiveCoverUrl || thumbUri;

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

  useEffect(() => {
    if (isPlaying && videoRef.current) {
      void videoRef.current.play()?.catch(() => {});
    }
  }, [isPlaying]);

  const handlePlayClick = () => {
    if (showSpoiler) {
      setShowSpoiler(false);
      return;
    }
    setIsMuted(false);
    setIsPlaying(true);
    setTimeout(() => {
      void videoRef.current?.play()?.catch(() => {});
    }, 50);
  };

  const handleRevealSpoiler = () => {
    setShowSpoiler(false);
    if (isShort && !isInAlbum && !hasCover) {
      setIsMuted(true);
      setIsPlaying(true);
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const target = e.currentTarget;
    if (!isInAlbum && !isSpoiler && !hasCover && !isPlaying) {
      if (target.duration > 0 && target.duration < 30) {
        setIsMuted(true);
        setIsPlaying(true);
      }
    }
  };

  return (
    <div
      ref={loadRef}
      className={cn(
        'relative overflow-hidden bg-muted/40 select-none group',
        albumCornerRounding,
        className,
      )}
      style={mediaBoxStyle(mediaDims.width, mediaDims.height)}
    >
      {/* Video element when active */}
      {isPlaying ? (
        <video
          ref={videoRef}
          src={effectiveStreamUrl}
          poster={effectivePosterUrl}
          controls
          autoPlay
          muted={isMuted}
          playsInline
          loop={duration != null && duration < 30}
          onLoadedMetadata={handleLoadedMetadata}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <>
          {/* Cover / Thumbnail Poster / Video Preview */}
          {effectiveCoverUrl ? (
            <img
              src={effectiveCoverUrl}
              alt="Video cover"
              width={mediaDims.width}
              height={mediaDims.height}
              className={cn(
                'absolute inset-0 h-full w-full object-cover',
                effectiveCoverUrl.startsWith('blob:') && 'filter-none scale-100',
              )}
            />
          ) : thumbUri ? (
            <img
              src={thumbUri}
              alt="Video preview"
              width={mediaDims.width}
              height={mediaDims.height}
              className={cn(
                'absolute inset-0 h-full w-full object-cover',
                thumbUri.startsWith('blob:')
                  ? 'filter-none scale-100'
                  : 'filter blur-2xs scale-105',
              )}
            />
          ) : effectiveStreamUrl ? (
            <video
              src={effectiveStreamUrl}
              preload="metadata"
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover pointer-events-none"
            />
          ) : (
            <div className="absolute inset-0 bg-neutral-900" />
          )}

          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

          {/* Duration Badge (top-left) */}
          {duration != null && duration > 0 && (
            <div className="absolute top-2 left-2 z-10 rounded-full bg-black/50 backdrop-blur-xs px-2 py-0.5 text-[11px] font-medium text-white/95 shadow-xs">
              {formatDuration(duration)}
            </div>
          )}

          {/* Play Button (hidden when uploading) */}
          {uploadProgress === undefined && (
            <button
              type="button"
              onClick={handlePlayClick}
              aria-label="Play video"
              className="absolute inset-0 z-10 m-auto flex size-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-xs transition-all duration-200 group-hover:scale-110 group-hover:bg-black/75 shadow-lg active:scale-95"
            >
              <Play className="size-5 fill-white ml-0.5" />
            </button>
          )}
        </>
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
        label="Video Spoiler"
        thumbUri={coverUrl || thumbUri}
        onReveal={handleRevealSpoiler}
      />
    </div>
  );
}
