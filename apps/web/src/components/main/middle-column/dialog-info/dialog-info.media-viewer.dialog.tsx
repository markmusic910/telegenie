'use client';

import type { Message } from '@telegenie/sdk';
import { buildMediaUrl, buildProgressiveUrl } from '@telegenie/sdk';
import { Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import MediaSpoiler from '@/lib/components/media.spoiler';
import { Button } from '@/lib/components/ui/button';
import { Dialog, DialogPopup } from '@/lib/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface DialogInfoMediaViewerDialogProps {
  peerId: string;
  message: Message | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function validMessageId(messageId: string | number): number | undefined {
  const numeric = typeof messageId === 'number' ? messageId : Number(messageId);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : undefined;
}

export default function DialogInfoMediaViewerDialog({
  peerId,
  message,
  open,
  onOpenChange,
}: DialogInfoMediaViewerDialogProps) {
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) {
      setSpoilerRevealed(false);
      setVideoLoading(true);
      return;
    }
    const video = videoRef.current;
    setVideoLoading(!(video && video.readyState >= 3));
  }, [open, message?.id]);

  const payload = useMemo(() => {
    if (!message) return null;
    const messageId = validMessageId(message.id);

    if (message.isVideo && message.videoDocument) {
      const document = message.videoDocument;
      return {
        kind: 'video' as const,
        streamUrl: buildProgressiveUrl({
          fileId: `d:${document.id}`,
          accessHash: document.accessHash,
          dcId: document.dcId,
          mimeType: document.mimeType || 'video/mp4',
          fileSize: Number(document.size),
          peerId,
          messageId,
        }),
        poster:
          message.previewThumbDataUri ||
          (message.videoCover
            ? buildMediaUrl({
                fileId: `p:${message.videoCover.id}`,
                accessHash: message.videoCover.accessHash,
                dcId: message.videoCover.dcId,
                mimeType: 'image/jpeg',
                thumbSize: 'y',
                peerId,
                messageId,
              })
            : undefined),
        hasSpoiler: message.hasSpoiler,
      };
    }

    if (message.photo) {
      const photo = message.photo;
      return {
        kind: 'photo' as const,
        src: buildMediaUrl({
          fileId: `p:${photo.id}`,
          accessHash: photo.accessHash,
          dcId: photo.dcId,
          mimeType: 'image/jpeg',
          thumbSize: 'w',
          peerId,
          messageId,
        }),
        fallbackSrc: message.previewThumbDataUri,
        hasSpoiler: message.hasSpoiler,
      };
    }

    if (message.photoDocument) {
      const document = message.photoDocument;
      return {
        kind: 'photo' as const,
        src: buildMediaUrl({
          fileId: `d:${document.id}`,
          accessHash: document.accessHash,
          dcId: document.dcId,
          mimeType: document.mimeType || 'image/jpeg',
          fileSize: Number(document.size),
          peerId,
          messageId,
        }),
        fallbackSrc: message.previewThumbDataUri,
        hasSpoiler: message.hasSpoiler,
      };
    }

    return null;
  }, [message, peerId]);

  if (!payload) return null;

  const showSpoiler = payload.hasSpoiler && !spoilerRevealed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup
        showCloseButton={false}
        bottomStickOnMobile={false}
        className="fixed inset-0 flex h-[100dvh] w-screen max-w-none flex-col rounded-none border-0 bg-black/95 p-0 shadow-none"
        portalProps={{ container: typeof document !== 'undefined' ? document.body : undefined }}
      >
        <div
          data-testid="media-viewer-mask"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onOpenChange(false);
            }
          }}
          className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="absolute end-3 top-3 z-20 text-white hover:bg-white/10"
          >
            <X className="size-6" aria-hidden="true" />
          </Button>

          {showSpoiler ? (
            <MediaSpoiler
              isVisible
              onReveal={() => setSpoilerRevealed(true)}
              className="size-72 rounded-2xl sm:size-96"
            />
          ) : payload.kind === 'video' ? (
            <div className="relative inline-flex items-center justify-center">
              <video
                ref={videoRef}
                key={`${message?.id}-video`}
                src={payload.streamUrl}
                poster={payload.poster}
                controls={!message?.isGif}
                autoPlay
                muted={message?.isGif}
                loop={message?.isGif}
                playsInline
                onLoadStart={() => setVideoLoading(true)}
                onWaiting={() => setVideoLoading(true)}
                onLoadedData={() => setVideoLoading(false)}
                onCanPlay={() => setVideoLoading(false)}
                onPlaying={() => setVideoLoading(false)}
                onError={() => setVideoLoading(false)}
                className={cn(
                  'max-h-[min(85vh,900px)] max-w-[min(92vw,1200px)] object-contain',
                  'outline-none',
                )}
              />
              {videoLoading ? (
                <div
                  role="status"
                  aria-label="Loading video"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-xs">
                    <Loader2 className="size-6 animate-spin" aria-hidden="true" />
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <img
              key={`${message?.id}-photo`}
              src={payload.src ?? payload.fallbackSrc}
              alt=""
              className="max-h-[min(85vh,900px)] max-w-[min(92vw,1200px)] object-contain"
              draggable={false}
            />
          )}
        </div>
      </DialogPopup>
    </Dialog>
  );
}