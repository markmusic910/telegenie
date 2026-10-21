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

function webpageLabel(webpage: TypeWebPage): string {
  return webpage.siteName?.trim() || webpage.author?.trim() || 'Telegram';
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
  className,
  peerId,
  messageId,
  observeIntersectionForLoading,
}: MediaWebPageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const { ref: loadRef, canLoad } = useCanLoadMedia(observeIntersectionForLoading);
  const webpage = media.webpage;
  if (!webpageHasPreviewData(media)) {
    return null;
  }

  const isChannelPreview = isTelegramChannelPreview(webpage);
  const label = webpageLabel(webpage);
  const description = webpage.description?.trim();
  const title = webpage.title?.trim();
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
    (media.forceLargeMedia || webpage.hasLargeMedia) && thumbSrc,
  );

  const accentClass = isChannelPreview
    ? isOutgoing
      ? 'text-primary-foreground'
      : 'text-emerald-500 dark:text-emerald-400'
    : isOutgoing
      ? 'text-primary-foreground'
      : 'text-sky-500 dark:text-sky-400';
  const barClass = isChannelPreview
    ? isOutgoing
      ? 'bg-primary-foreground'
      : 'bg-emerald-500 dark:bg-emerald-400'
    : isOutgoing
      ? 'bg-primary-foreground'
      : 'bg-sky-500 dark:bg-sky-400';
  const dividerClass = isOutgoing ? 'border-primary-foreground/20' : 'border-border/50';
  const bodyClass = isOutgoing ? 'text-primary-foreground/90' : 'text-foreground/90';
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
        'relative flex min-w-[220px] max-w-[340px] flex-col overflow-hidden rounded-xl mb-1 select-none',
        isOutgoing
          ? 'bg-black/15 text-primary-foreground'
          : 'bg-muted/80 text-foreground border border-border/40',
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
              <span className={cn('truncate text-sm font-semibold leading-snug', bodyClass)}>
                {title}
              </span>
            ) : null}
            {description ? (
              <MessageText
                text={description}
                className={cn('text-xs leading-snug line-clamp-6', bodyClass)}
              />
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
