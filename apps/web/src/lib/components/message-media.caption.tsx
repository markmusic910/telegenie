'use client';

import React from 'react';
import { observer } from 'mobx-react-lite';
import type { Message, MessageAlbum } from '@telegenie/sdk';
import { useMessage, useSDK, useStore } from '@/lib/contexts/sdk.context';
import MessageText from '@/lib/components/message.text';
import { coveringCustomEmojiId } from '@/lib/utils/emoji.grapheme';
import { webpageHasPreviewData } from '@/lib/utils/webpage-preview';
import type { ObserveFn } from '@/lib/hooks/use-intersection-observer';
import { cn } from '@/lib/utils';

export interface MessageMediaCaptionProps {
  messageId: string | number;
  peerId?: string;
  message?: Message;
  album?: MessageAlbum;
  observeIntersectionForPlaying?: ObserveFn;
  className?: string;
}

const MessageMediaCaption = observer(function MessageMediaCaption({
  messageId,
  peerId: propPeerId,
  message: propMessage,
  album,
  observeIntersectionForPlaying,
  className,
}: MessageMediaCaptionProps) {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const resolvedPeerId = propPeerId ?? propMessage?.peerId ?? globalStore.nav.selectedDialogId ?? '';

  const storeMessage = useMessage(resolvedPeerId, String(messageId));
  const message = propMessage ?? storeMessage;

  if (!message) {
    return null;
  }

  // If album is not provided as prop, check if message is part of an album in store
  let resolvedAlbum = album;
  if (!resolvedAlbum && message.groupedId && resolvedPeerId) {
    try {
      const store = sdk.getMessageStore(resolvedPeerId);
      const peerMessages = Array.from(store.getAllData().values());
      const groupedMessages = peerMessages.filter((m) => m.groupedId === message.groupedId);
      if (groupedMessages.length > 1) {
        const isMediaGroup = message.isInAlbum;
        const albumType = isMediaGroup ? 'media' : 'files';
        const captionMsg = groupedMessages.find((m) => m.message?.trim());
        resolvedAlbum = {
          albumId: message.groupedId,
          albumType,
          messages: groupedMessages,
          mainMessage: groupedMessages[0],
          captionMessage: captionMsg,
        };
      }
    } catch {
      // Ignore if store cannot be retrieved
    }
  }

  const isOwn = message.out;

  // Media identification
  const isAlbum = Boolean(resolvedAlbum && resolvedAlbum.messages.length > 0);
  const isFileGroup = Boolean(
    isAlbum &&
      (resolvedAlbum?.albumType === 'files' || resolvedAlbum?.messages.every((m) => m.isDocument)),
  );
  const isMediaAlbum = Boolean(isAlbum && !isFileGroup);
  const isSticker = !isAlbum && message.isSticker && Boolean(message.stickerDocument);
  const isPhoto =
    !isAlbum && !isSticker && message.isPhoto && Boolean(message.photo || message.photoDocument);
  const isVideo = !isAlbum && !isSticker && message.isVideo && Boolean(message.videoDocument);
  const isRoundVideo = isVideo && message.isRoundVideo;
  const isContact = Boolean(message.media && 'phoneNumber' in message.media);
  const isWebPage = Boolean(message.media && 'webpage' in message.media);
  const hasWebPagePreview =
    isWebPage && message.media && 'webpage' in message.media
      ? webpageHasPreviewData(message.media)
      : false;

  // Text / Caption
  const textContent = isAlbum
    ? (resolvedAlbum?.captionMessage || message).message
    : message.message;
  const textEntities = isAlbum
    ? (resolvedAlbum?.captionMessage || message).entities
    : message.entities;
  const trimmedText = textContent?.trim() ?? '';

  const singleCustomEmojiId =
    !isAlbum && !message.media && textContent
      ? coveringCustomEmojiId(textContent, textEntities)
      : undefined;
  const isSingleCustomEmoji = Boolean(singleCustomEmojiId);
  const isUrlOnlyMessage = /^https?:\/\/\S+$/i.test(trimmedText);
  const hasText =
    Boolean(trimmedText) &&
    !isContact &&
    (!isWebPage || !isUrlOnlyMessage || !hasWebPagePreview);

  if (!hasText || isSingleCustomEmoji || (isWebPage && hasWebPagePreview)) {
    return null;
  }

  const isPureMedia = !isSticker && !isRoundVideo && (isMediaAlbum || isPhoto || isVideo) && !hasText;
  const isInvertedMedia = Boolean(
    (resolvedAlbum?.captionMessage || message).invertMedia &&
      (isPhoto || (isVideo && !isRoundVideo) || isMediaAlbum),
  );

  return (
    <div
      className={cn(
        isRoundVideo && hasText
          ? cn(
              'mt-1 max-w-full rounded-2xl px-3.5 py-2 text-sm shadow-xs',
              isOwn
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-card-foreground border border-border/50',
            )
          : 'contents',
        className,
      )}
    >
      <div
        className={cn(
          isPureMedia
            ? 'px-3.5 pt-2 pb-1.5'
            : isMediaAlbum || isPhoto || (isVideo && !isRoundVideo)
              ? isInvertedMedia
                ? 'px-2 pt-1 pb-1.5'
                : 'px-2 pt-1.5 pb-0.5'
              : isFileGroup
                ? 'px-1.5 pt-1.5 pb-0.5'
                : undefined,
        )}
      >
        {isWebPage && isUrlOnlyMessage && !textEntities?.length ? (
          <a
            href={trimmedText}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'whitespace-pre-wrap break-all text-sm underline',
              isOwn ? 'text-primary-foreground' : 'text-foreground',
            )}
          >
            {trimmedText}
          </a>
        ) : (
          <MessageText
            text={textContent!}
            entities={textEntities}
            className={isOwn ? 'text-primary-foreground' : 'text-foreground'}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
          />
        )}
      </div>
    </div>
  );
});

export default MessageMediaCaption;
