'use client';

import MessageText from '@/lib/components/message.text';
import { cn } from '@/lib/utils';
import {
  fileRefValue,
  isRealDocument,
  isRealPhoto,
  thumbUriFromPhoto,
  webpageHasPreviewData,
} from '@/lib/utils/webpage-preview';
import type {
  MessageMediaWebPage,
  TypeWebPage,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import { buildMediaUrl } from '@telegenie/sdk';
import { useState } from 'react';
import { useCanLoadMedia, type ObserveFn } from '@/lib/hooks/use-intersection-observer';

export interface MediaWebPageProps {
  media: MessageMediaWebPage;
  isOutgoing?: boolean;
  /** `profile` — shared-links list in dialog info (full width, card chrome). */
  variant?: 'bubble' | 'profile';
  /** Shown when the webpage has no title/description (profile links list). */
  fallbackText?: string;
  className?: string;
  peerId?: string;
  messageId?: number;
  observeIntersectionForLoading?: ObserveFn;
}

function buildFileMediaUrl(params: {
  kind: 'p' | 'd';
  id: unknown;
  accessHash: unknown;
  dcId: number;
  mimeType: string;
  fileSize?: number;
  thumbSize?: string;
  peerId?: string;
  messageId?: number;
}): string | undefined {
  const id = fileRefValue(params.id);
  const accessHash = fileRefValue(params.accessHash);
  if (!id || !accessHash) return undefined;

  return buildMediaUrl({
    fileId: `${params.kind}:${id}`,
    accessHash,
    dcId: params.dcId,
    mimeType: params.mimeType,
    fileSize: params.fileSize,
    thumbSize: params.thumbSize,
    peerId: params.peerId,
    messageId: params.messageId,
  });
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function webpageLabel(webpage: TypeWebPage): string {
  const site = webpage.siteName?.trim() || webpage.author?.trim();
  if (site) return site;
  const url = webpage.url?.trim();
  if (url) return hostnameFromUrl(url);
  return 'Telegram';
}

function isTelegramChannelPreview(webpage: TypeWebPage): boolean {
  const siteName = webpage.siteName?.trim().toLowerCase();
  if (siteName === 'telegram') return true;
  const type = webpage.type?.trim().toLowerCase();
  return Boolean(type && type.startsWith('telegram'));
}

export default function MediaWebPage({
  media,
  isOutgoing = false,
  variant = 'bubble',
  fallbackText,
  className,
  peerId,
  messageId,
  observeIntersectionForLoading,
}: MediaWebPageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const { ref: loadRef, canLoad } = useCanLoadMedia(observeIntersectionForLoading);
  const webpage = media.webpage;
  if (!webpage) return null;

  const isProfile = variant === 'profile';
  const linkUrl = webpage.url?.trim();
  const hasPreview = webpageHasPreviewData(media);
  if (!hasPreview && !linkUrl) return null;
  if (!hasPreview && !isProfile) return null;

  const isChannelPreview = isTelegramChannelPreview(webpage);
  const label = webpageLabel(webpage);
  const title = webpage.title?.trim();
  const description =
    webpage.description?.trim() || (!title ? fallbackText?.trim() : undefined);
  const previewThumb = thumbUriFromPhoto(
    isRealPhoto(webpage.photo) ? webpage.photo : undefined,
  );

  const photo = isRealPhoto(webpage.photo) ? webpage.photo : undefined;
  const document =
    !photo && isRealDocument(webpage.document) ? webpage.document : undefined;

  const mediaUrl = photo
    ? buildFileMediaUrl({
        kind: 'p',
        id: photo.id,
        accessHash: photo.accessHash,
        dcId: photo.dcId,
        mimeType: 'image/jpeg',
        thumbSize: 'x',
        peerId,
        messageId,
      })
    : document
      ? buildFileMediaUrl({
          kind: 'd',
          id: document.id,
          accessHash: document.accessHash,
          dcId: document.dcId,
          mimeType: document.mimeType || 'image/jpeg',
          fileSize: Number(document.size),
          peerId,
          messageId,
        })
      : undefined;

  const thumbSrc = previewThumb || (canLoad ? mediaUrl : undefined);
  const showLargeMedia = Boolean(
    thumbSrc && (media.forceLargeMedia || webpage.hasLargeMedia),
  );

  const bubbleOutgoing = isOutgoing && !isProfile;
  const accentClass = isChannelPreview
    ? bubbleOutgoing
      ? 'text-primary-foreground'
      : 'text-emerald-500 dark:text-emerald-400'
    : bubbleOutgoing
      ? 'text-primary-foreground'
      : isProfile
        ? 'text-primary'
        : 'text-sky-500 dark:text-sky-400';
  const barClass = isChannelPreview
    ? bubbleOutgoing
      ? 'bg-primary-foreground'
      : 'bg-emerald-500 dark:bg-emerald-400'
    : bubbleOutgoing
      ? 'bg-primary-foreground'
      : isProfile
        ? 'bg-primary'
        : 'bg-sky-500 dark:bg-sky-400';
  const dividerClass = bubbleOutgoing ? 'border-primary-foreground/20' : 'border-border/60';
  const bodyClass = bubbleOutgoing ? 'text-primary-foreground/90' : 'text-foreground';
  const actionLabel = isChannelPreview ? 'VIEW CHANNEL' : 'OPEN LINK';

  const handleOpen = () => {
    const url = webpage.url?.trim();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      ref={loadRef}
      className={cn(
        'relative flex flex-col overflow-hidden select-none',
        isProfile
          ? 'w-full min-w-0 max-w-none rounded-2xl border border-border/60 bg-card text-foreground'
          : cn(
              'mb-1 min-w-[220px] max-w-[340px] rounded-xl',
              isOutgoing
                ? 'bg-black/15 text-primary-foreground'
                : 'bg-muted/80 text-foreground border border-border/40',
            ),
        className,
      )}
    >
      <div className="flex min-w-0 flex-col px-3 py-2.5">
        <div className="flex min-w-0 gap-2">
          <div className={cn('w-0.5 shrink-0 self-stretch rounded-full', barClass)} aria-hidden />
          <div className="min-w-0 flex flex-1 flex-col gap-1">
            <span className={cn('truncate text-xs font-semibold leading-none', accentClass)}>
              {label}
            </span>
            {title ? (
              <span
                className={cn(
                  isProfile ? 'line-clamp-2 text-sm font-semibold leading-snug' : 'truncate text-sm font-semibold leading-snug',
                  bodyClass,
                )}
              >
                {title}
              </span>
            ) : null}
            {description ? (
              <MessageText
                text={description}
                className={cn(
                  isProfile ? 'text-sm leading-snug line-clamp-4' : 'text-xs leading-snug line-clamp-6',
                  bodyClass,
                )}
              />
            ) : null}
            {isProfile && linkUrl && !title && !description ? (
              <p className="break-all text-sm text-primary">{linkUrl}</p>
            ) : null}
          </div>
          {thumbSrc && !showLargeMedia ? (
            <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-black/10">
              <img
                src={thumbSrc}
                alt=""
                loading="lazy"
                draggable={false}
                className="size-11 object-cover"
              />
            </div>
          ) : null}
        </div>

        {showLargeMedia && thumbSrc ? (
          <div className="relative mt-2 overflow-hidden rounded-lg bg-black/10">
            <img
              src={thumbSrc}
              alt=""
              loading="lazy"
              draggable={false}
              onLoad={() => setIsLoaded(true)}
              className={cn(
                'block max-h-52 w-full object-cover transition-opacity duration-200',
                isLoaded || previewThumb ? 'opacity-100' : 'opacity-0',
              )}
            />
          </div>
        ) : null}
      </div>

      <div className={cn('border-t', dividerClass)} />
      <button
        type="button"
        onClick={handleOpen}
        disabled={!webpage.url?.trim()}
        className={cn(
          'w-full !border-0 !border-transparent bg-transparent px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide transition-none hover:!border-transparent hover:!bg-transparent focus-visible:outline-none disabled:cursor-default disabled:opacity-60',
          accentClass,
        )}
      >
        {actionLabel}
      </button>
    </div>
  );
}
