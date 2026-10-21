'use client';

import type { ObserveFn } from '@/lib/hooks/use-intersection-observer';
import { claimMediaPlayback, releaseMediaPlayback } from '@/lib/media-playback';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/utils/format';
import { mediaBoxStyle, ROUND_VIDEO_SIZE } from '@/lib/utils/media-dimensions';
import type { Document, DocumentAttributeVideo } from '@telegenie/libs/foundation/telegram/types/file';
import { buildProgressiveUrl } from '@telegenie/sdk';
import { EyeOff, Loader2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const SIZE = ROUND_VIDEO_SIZE;
const PROGRESS_CENTER = SIZE / 2;
const PROGRESS_MARGIN = 6;
const PROGRESS_RADIUS = PROGRESS_CENTER - PROGRESS_MARGIN;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;

export interface MediaRoundVideoProps {
  document: Document;
  previewThumbDataUri?: string;
  isSpoiler?: boolean;
  isUnread?: boolean;
  peerId?: string;
  messageId?: number;
  observeIntersectionForLoading?: ObserveFn;
  /** User unmuted. Muted autoplay and spoiler reveal do not call this. */
  onPlaybackStart?: () => void;
  className?: string;
}

export default function MediaRoundVideo({
  document,
  previewThumbDataUri,
  isSpoiler = false,
  isUnread = false,
  peerId,
  messageId,
  observeIntersectionForLoading,
  onPlaybackStart,
  className,
}: MediaRoundVideoProps) {
  const videoAttr = document.attributes?.find(
    (attr): attr is DocumentAttributeVideo =>
      typeof attr === 'object' && attr !== null && 'duration' in attr && 'w' in attr,
  );
  const duration = videoAttr?.duration;

  const videoRef = useRef<HTMLVideoElement>(null);
  const startedRef = useRef(false);
  const activatedRef = useRef(false);
  const intersectingRef = useRef(true);
  const spoilerRef = useRef(isSpoiler);
  const onPlaybackStartRef = useRef(onPlaybackStart);
  onPlaybackStartRef.current = onPlaybackStart;

  const [element, setElement] = useState<HTMLElement | null>(null);
  const [canLoad, setCanLoad] = useState(!observeIntersectionForLoading);
  const [isIntersecting, setIsIntersecting] = useState(!observeIntersectionForLoading);
  const [activated, setActivated] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [showSpoiler, setShowSpoiler] = useState(isSpoiler);
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);

  intersectingRef.current = isIntersecting;
  spoilerRef.current = showSpoiler;
  activatedRef.current = activated;

  const stopSound = useCallback(() => {
    activatedRef.current = false;
    setActivated(false);
    setUserPaused(false);
    setProgress(0);
    setCurrentTime(0);
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.loop = true;
    if (intersectingRef.current && !spoilerRef.current) {
      void video.play().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    return () => releaseMediaPlayback(stopSound);
  }, [stopSound]);

  useEffect(() => {
    if (!observeIntersectionForLoading) {
      setCanLoad(true);
      setIsIntersecting(true);
      return undefined;
    }
    if (!element) return undefined;
    return observeIntersectionForLoading(element, (intersecting) => {
      setIsIntersecting(intersecting);
      if (intersecting) setCanLoad(true);
    });
  }, [element, observeIntersectionForLoading]);

  const streamUrl = buildProgressiveUrl({
    fileId: `d:${document.id}`,
    accessHash: document.accessHash,
    dcId: document.dcId,
    mimeType: document.mimeType || 'video/mp4',
    fileSize: Number(document.size),
    peerId,
    messageId,
  });

  const thumbUri =
    previewThumbDataUri ||
    (document.thumbs?.find(
      (size) => 'bytes' in size && typeof size.bytes === 'string' && size.bytes.startsWith('data:'),
    ) as { bytes?: string } | undefined)?.bytes;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !canLoad || showSpoiler) return;
    if (!isIntersecting) {
      video.pause();
      return;
    }
    if (!activated) {
      video.muted = true;
      video.loop = true;
      void video.play().catch(() => undefined);
      return;
    }
    video.muted = false;
    video.loop = false;
    if (!userPaused) void video.play().catch(() => undefined);
  }, [activated, canLoad, isIntersecting, showSpoiler, userPaused]);

  const handleClick = () => {
    if (showSpoiler) {
      setShowSpoiler(false);
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    if (!activated) {
      claimMediaPlayback(stopSound);
      video.pause();
      video.currentTime = 0;
      video.muted = false;
      video.loop = false;
      activatedRef.current = true;
      setActivated(true);
      setUserPaused(false);
      setProgress(0);
      setCurrentTime(0);
      void video.play().catch(() => undefined);
      if (!startedRef.current) {
        startedRef.current = true;
        onPlaybackStartRef.current?.();
      }
      return;
    }

    if (video.paused) {
      claimMediaPlayback(stopSound);
      setUserPaused(false);
      void video.play().catch(() => undefined);
      return;
    }

    video.pause();
    setUserPaused(true);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !activatedRef.current) return;
    setCurrentTime(video.currentTime);
    if (video.duration > 0) setProgress(video.currentTime / video.duration);
  };

  const handleEnded = () => {
    if (activatedRef.current) stopSound();
  };

  const shownTime = activated ? currentTime : duration;
  const label = activated && !userPaused ? 'Pause video message' : 'Play video message';

  return (
    <div
      ref={setElement}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      }}
      className={cn('relative cursor-pointer select-none', className)}
      style={mediaBoxStyle(SIZE, SIZE)}
    >
      <div className="absolute inset-0 overflow-hidden rounded-full bg-black">
        {thumbUri && (
          <img
            src={thumbUri}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {canLoad && !showSpoiler && !isReady && !thumbUri && (
          <Loader2 className="absolute inset-0 m-auto size-6 animate-spin text-white/80" aria-hidden />
        )}
        {canLoad && !showSpoiler && (
          <video
            ref={videoRef}
            src={streamUrl}
            muted
            loop
            autoPlay
            playsInline
            disablePictureInPicture
            onLoadedData={() => setIsReady(true)}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            className={cn(
              'absolute inset-0 h-full w-full object-cover',
              isReady ? 'opacity-100' : 'opacity-0',
            )}
          />
        )}
      </div>

      {activated && (
        <svg
          className="pointer-events-none absolute inset-0"
          width={SIZE}
          height={SIZE}
          aria-hidden
        >
          <circle
            cx={PROGRESS_CENTER}
            cy={PROGRESS_CENTER}
            r={PROGRESS_RADIUS}
            fill="none"
            stroke="white"
            strokeOpacity={0.35}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={PROGRESS_CIRCUMFERENCE}
            strokeDashoffset={PROGRESS_CIRCUMFERENCE - progress * PROGRESS_CIRCUMFERENCE}
            transform={`rotate(-90 ${PROGRESS_CENTER} ${PROGRESS_CENTER})`}
          />
        </svg>
      )}

      {!showSpoiler && (
        <span className="pointer-events-none absolute top-1 left-1 z-10 inline-flex items-center gap-1 rounded-full bg-black/25 px-1.5 text-xs leading-[18px] text-white">
          {formatDuration(shownTime)}
          {(!activated || userPaused) && <VolumeX className="size-3.5" aria-hidden />}
          {isUnread && <span className="size-1.5 rounded-full bg-white" aria-hidden />}
        </span>
      )}

      {showSpoiler && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden rounded-full bg-black/65 text-white backdrop-blur-md">
          <EyeOff className="mb-1 size-7 opacity-80" />
          <span className="text-xs font-semibold tracking-wide">Video Spoiler</span>
          <span className="text-[10px] opacity-75">Click to reveal</span>
        </div>
      )}
    </div>
  );
}
