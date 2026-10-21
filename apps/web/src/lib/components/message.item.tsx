'use client';

import MediaAlbum from '@/lib/components/media.album';
import MediaContact from '@/lib/components/media.contact';
import MediaDocument from '@/lib/components/media.document';
import MediaDocumentGroup from '@/lib/components/media.document-group';
import MediaMetaBadge from '@/lib/components/media.meta-badge';
import MediaPhoto from '@/lib/components/media.photo';
import MediaRoundVideo from '@/lib/components/media.round-video';
import MediaSticker from '@/lib/components/media.sticker';
import MediaVideo from '@/lib/components/media.video';
import MediaVoice from '@/lib/components/media.voice';
import MediaWebPage from '@/lib/components/media.webpage';
import { webpageHasPreviewData } from '@/lib/utils/webpage-preview';
import MessageForward from '@/lib/components/message.forward';
import MessageMeta from '@/lib/components/message.meta';
import MessageContextMenu from '@/lib/components/message.context-menu';
import MessageReactions from '@/lib/components/message.reactions';
import MessageReply from '@/lib/components/message.reply';
import CustomEmoji from '@/lib/components/custom.emoji';
import CustomEmojiCell from '@/lib/components/custom-emoji.cell';
import CustomEmojiSurface from '@/lib/components/custom-emoji.surface';
import MessageText from '@/lib/components/message.text';
import MessageMediaCaption from '@/lib/components/message-media.caption';
import PeerAvatar from '@/lib/components/peer.avatar';
import { useDialogPeer, useSDK } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import { coveringCustomEmojiId, SINGLE_CUSTOM_EMOJI_SIZE } from '@/lib/utils/emoji.grapheme';
import {
  calculateMediaDimensions,
  calculateStickerDimensions,
  getDocumentSourceDimensions,
} from '@/lib/utils/media-dimensions';
import type { Message, MessageAlbum } from '@telegenie/sdk';
import { fallbackPeerDisplay, initialsFromName, peerColorIndex } from '@telegenie/sdk';
import {
  BarChart2,
  CreditCard,
  FileText,
  Gamepad2,
  MapPin,
  Mic,
  User as UserIcon,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import { useCopyMessageId } from '@/lib/hooks/use-copy-message-id';
import type { ObserveFn } from '@/lib/hooks/use-intersection-observer';

export interface MessageItemProps {
  peerId: string;
  message: Message;
  album?: MessageAlbum;
  isOwn: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  showAvatar?: boolean;
  showSenderName?: boolean;
  senderName?: string;
  senderPeerId?: string;
  readOutboxMaxId?: number;
  observeIntersectionForRead?: ObserveFn;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  isFocused?: boolean;
  /** Selecting messages: the context menu and long-press reactions stay closed. */
  isSelectMode?: boolean;
  className?: string;
}

const SENDER_NAME_COLORS = [
  'text-violet-600 dark:text-violet-400',
  'text-blue-600 dark:text-blue-400',
  'text-emerald-600 dark:text-emerald-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-600 dark:text-rose-400',
  'text-sky-600 dark:text-sky-400',
  'text-fuchsia-600 dark:text-fuchsia-400',
  'text-teal-600 dark:text-teal-400',
];

function renderFallbackPlaceholder(message: Message, isOutgoing: boolean) {
  const media = message.media;
  if (!media) return null;

  let label = 'Attachment';
  let IconComponent = FileText;

  if ('voice' in media && media.voice) {
    label = 'Voice message';
    IconComponent = Mic;
  } else if ('poll' in media) {
    label = 'Poll';
    IconComponent = BarChart2;
  } else if ('geo' in media || 'venueId' in media) {
    label = 'Location';
    IconComponent = MapPin;
  } else if ('phoneNumber' in media) {
    label = 'Contact';
    IconComponent = UserIcon;
  } else if ('game' in media) {
    label = 'Game';
    IconComponent = Gamepad2;
  } else if ('currency' in media) {
    label = 'Invoice';
    IconComponent = CreditCard;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium select-none mb-1',
        isOutgoing
          ? 'bg-black/15 text-primary-foreground'
          : 'bg-muted/80 text-foreground border border-border/40',
      )}
    >
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-lg',
          isOutgoing ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary',
        )}
      >
        <IconComponent className="size-4" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-semibold truncate">{label}</span>
        <span className="text-[10px] opacity-75">Placeholder preview</span>
      </div>
    </div>
  );
}

const MessageItem = observer(function MessageItem({
  peerId,
  message,
  album,
  isOwn,
  isFirstInGroup,
  isLastInGroup,
  showAvatar = true,
  showSenderName = false,
  senderName,
  senderPeerId,
  readOutboxMaxId,
  observeIntersectionForRead,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  isFocused = false,
  isSelectMode = false,
  className,
}: MessageItemProps) {
  const bottomMarkerRef = useRef<HTMLDivElement>(null);
  const sdk = useSDK();
  const copyMessageId = useCopyMessageId(message.id);
  const senderPeer = useDialogPeer(senderPeerId);
  const senderDisplay =
    senderPeer?.display ??
    (senderName
      ? {
          name: senderName,
          initials: initialsFromName(senderName),
          isVerified: false,
          isSavedMessages: false,
        }
      : senderPeerId
        ? fallbackPeerDisplay(senderPeerId)
        : undefined);
  const senderPhoto = senderPeer?.photo;
  const isDeletedSender = Boolean(
    senderDisplay?.isDeleted ||
      (senderPeer && 'deleted' in senderPeer && senderPeer.deleted),
  );
  const resolvedSenderDisplay = isDeletedSender && senderDisplay
    ? {
        ...senderDisplay,
        name: 'Deleted Account',
        initials: '',
        isDeleted: true,
      }
    : senderDisplay;
  const senderTitle = isDeletedSender
    ? 'Deleted Account'
    : (senderPeer?.display?.name ?? senderName);

  const outgoingStatus = message.outgoingStatus(readOutboxMaxId);
  const senderColor = isDeletedSender
    ? 'text-[#e05d52] dark:text-[#e05d52]'
    : senderPeerId
      ? SENDER_NAME_COLORS[peerColorIndex(senderPeerId)]
      : SENDER_NAME_COLORS[0];

  // Media identification
  const isAlbum = Boolean(album && album.messages.length > 0);
  const isFileGroup = Boolean(
    isAlbum &&
    (album?.albumType === 'files' || album?.messages.every((m) => m.isDocument)),
  );
  const isMediaAlbum = Boolean(isAlbum && !isFileGroup);
  const isSticker = !isAlbum && message.isSticker && Boolean(message.stickerDocument);
  const isPhoto = !isAlbum && !isSticker && message.isPhoto && Boolean(message.photo || message.photoDocument);
  const isVideo = !isAlbum && !isSticker && message.isVideo && Boolean(message.videoDocument);
  const isRoundVideo = isVideo && message.isRoundVideo;
  const isDocument = !isAlbum && !isSticker && message.isDocument && Boolean(message.fileDocument);
  const isVoice = !isAlbum && message.isVoice && Boolean(message.voiceDocument);
  const isContact = Boolean(message.media && 'phoneNumber' in message.media);
  const isWebPage = Boolean(message.media && 'webpage' in message.media);
  const hasOtherMedia =
    Boolean(message.media) &&
    !isAlbum &&
    !isSticker &&
    !isPhoto &&
    !isVideo &&
    !isDocument &&
    !isVoice &&
    !isContact &&
    !isWebPage;

  // Text / Caption
  const textContent = isAlbum
    ? (album?.captionMessage || message).message
    : message.message;
  const textEntities = isAlbum
    ? (album?.captionMessage || message).entities
    : message.entities;
  const trimmedText = textContent?.trim() ?? '';
  // A message that is only one custom emoji uses telegram-genie's emoji-only size
  // and a clear bubble, the same shape as a sticker.
  const singleCustomEmojiId =
    !isAlbum && !message.media && textContent
      ? coveringCustomEmojiId(textContent, textEntities)
      : undefined;
  const isSingleCustomEmoji = Boolean(singleCustomEmojiId);
  const isUrlOnlyMessage = /^https?:\/\/\S+$/i.test(trimmedText);
  const hasWebPagePreview =
    isWebPage && message.media && 'webpage' in message.media
      ? webpageHasPreviewData(message.media)
      : false;
  const hasText =
    Boolean(trimmedText) &&
    !isContact &&
    (!isWebPage || !isUrlOnlyMessage || !hasWebPagePreview);

  // Pure visual media (image/video/album without text): full-bleed container with floating badge
  const isPureMedia = !isSticker && !isRoundVideo && (isMediaAlbum || isPhoto || isVideo) && !hasText;
  const isInvertedMedia = Boolean(
    (album?.captionMessage || message).invertMedia &&
      (isPhoto || (isVideo && !isRoundVideo) || isMediaAlbum),
  );
  const mediaDisplayDims =
    !isAlbum && message.mediaDimensions
      ? calculateMediaDimensions(message.mediaDimensions)
      : undefined;

  const numericMessageId = Number(message.id);
  const hasMessageId = Number.isInteger(numericMessageId) && numericMessageId > 0;
  const canOpenReactionMenu =
    hasMessageId &&
    !message.ttlPeriod &&
    (message.kind === 'message' || Boolean(message.reactionsArePossible));
  const canOpenMessageMenu = hasMessageId && message.kind === 'message';

  const lastAlbumMessageId = isAlbum
    ? album?.messages[album.messages.length - 1]?.id
    : undefined;
  const hasUnreadMention = isAlbum
    ? album!.messages.some((entry) => entry.hasUnreadMention)
    : message.hasUnreadMention;

  const hasReactionPills =
    (message.reactions?.results?.filter((item) => item.count > 0).length ?? 0) > 0;
  const showMetaRow =
    !isPureMedia && !isSticker && !isSingleCustomEmoji && !(isRoundVideo && !hasText);

  const handleMediaPlayed = () => {
    if (!message.mediaUnread || !message.peerId) return;
    sdk.messageRead.markMediaRead(message.peerId, [String(message.id)]);
  };

  useEffect(() => {
    const element = bottomMarkerRef.current;
    if (!element || !observeIntersectionForRead) return undefined;
    return observeIntersectionForRead(element);
  }, [message.id, lastAlbumMessageId, observeIntersectionForRead]);

  return (
    <MessageContextMenu
      peerId={peerId}
      message={message}
      enabled={canOpenReactionMenu || canOpenMessageMenu}
      selectMode={isSelectMode}
      albumMessageIds={isAlbum ? album?.messages.map((entry) => entry.id) : undefined}
      onMouseDown={copyMessageId}
      className={cn(
        'group relative flex w-full gap-2 py-0.5 px-3 transition-colors duration-500 ease-out',
        isFocused
          ? 'bg-primary/10 dark:bg-primary/15'
          : 'bg-transparent',
        isOwn ? 'justify-end' : 'justify-start',
        className,
      )}
    >
      <div
        ref={bottomMarkerRef}
        className="pointer-events-none absolute bottom-0 left-0 h-px w-full"
        data-message-id={message.id}
        data-last-message-id={lastAlbumMessageId}
        data-has-unread-mention={hasUnreadMention ? 'true' : undefined}
        aria-hidden
      />
      {/* Avatar column for incoming messages */}
      {!isOwn && showAvatar && (
        <div className="flex size-8 shrink-0 flex-col justify-end self-end mb-0.5">
          {isLastInGroup && senderPeerId && resolvedSenderDisplay ? (
            <PeerAvatar
              peerId={senderPeerId}
              display={resolvedSenderDisplay}
              photo={senderPhoto}
              className="size-8 text-xs"
            />
          ) : (
            <div className="size-8" />
          )}
        </div>
      )}

      {/* Bubble + reactions/meta sit in one column; chips render below the bubble */}
      <div
        className={cn(
          'flex min-w-0 w-fit max-w-[78%] flex-col',
          isOwn ? 'items-end' : 'items-start',
        )}
      >
      <CustomEmojiSurface
        className={cn(
          'flex w-fit max-w-full flex-col transition-colors',
          isSticker || isRoundVideo || isSingleCustomEmoji
            ? 'p-0 bg-transparent shadow-none border-none'
            : cn(
                'rounded-2xl shadow-xs',
                isPureMedia
                  ? 'p-0 overflow-hidden'
                  : isMediaAlbum || isPhoto || isVideo
                    ? 'p-1 pb-1.5 text-sm overflow-hidden'
                    : isFileGroup
                      ? 'p-1.5 pb-1 text-sm'
                      : isVoice && !hasText
                        ? 'w-72 max-w-full px-3 py-2 text-sm'
                        : 'px-3.5 py-2 text-sm',
                isOwn
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-card text-card-foreground border border-border/50 rounded-bl-md',
                !isLastInGroup && isOwn && 'rounded-br-2xl',
                !isLastInGroup && !isOwn && 'rounded-bl-2xl',
                !isFirstInGroup && isOwn && 'rounded-tr-md',
                !isFirstInGroup && !isOwn && 'rounded-tl-md',
              ),
          hasUnreadMention && 'ring-2 ring-primary/50 ring-offset-1 ring-offset-background',
        )}
      >
        {/* Sender name for first message in group chats */}
        {showSenderName && !isOwn && senderTitle && (
          <span
            className={cn(
              'font-semibold select-none leading-none truncate',
              isSticker || isRoundVideo || isSingleCustomEmoji
                ? 'mb-1 text-xs px-1'
                : isPureMedia
                  ? 'p-2.5 pb-1 text-xs'
                  : 'mb-1 text-xs',
              senderColor,
            )}
          >
            {senderTitle}
          </span>
        )}

        <MessageForward
          message={message}
          isOwn={isOwn}
          plain={isSticker || isRoundVideo || isSingleCustomEmoji}
          className={cn(
            (isSticker || isRoundVideo || isSingleCustomEmoji) && 'px-1',
            isPureMedia && 'px-2.5 pt-2',
            (isMediaAlbum || isPhoto || isVideo) && !isPureMedia && 'mx-1 mt-1',
            isFileGroup && 'mx-1.5 mt-1',
          )}
        />

        <MessageReply
          message={message}
          isOwn={isOwn}
          className={cn(
            (isSticker || isRoundVideo || isSingleCustomEmoji) && 'mb-1',
            isPureMedia && 'mx-2 mt-2',
            (isMediaAlbum || isPhoto || isVideo) && !isPureMedia && 'mx-1 mt-1',
            isFileGroup && 'mx-1.5 mt-1 mb-1',
          )}
        />

        {/* Caption above media when invertMedia is set */}
        {isInvertedMedia && (
          <MessageMediaCaption
            messageId={message.id}
            peerId={peerId}
            album={album}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
          />
        )}

        {/* 1. Multi-media Album (photo/video) */}
        {isMediaAlbum && album && (
          <div className="relative shrink-0">
            <MediaAlbum
              album={album}
              isOwn={isOwn}
              observeIntersectionForLoading={observeIntersectionForLoading}
            />
            {isPureMedia && (
              <MediaMetaBadge
                date={message.date}
                isOutgoing={isOwn}
                isEdited={Boolean(message.editDate && message.editDate > 0)}
                outgoingStatus={outgoingStatus}
                views={message.views}
                forwards={message.forwards}
                replies={message.replies?.replies}
              />
            )}
          </div>
        )}

        {/* 1b. Stacked File Group (documents) */}
        {isFileGroup && album && (
          <div className="relative shrink-0 w-full">
            <MediaDocumentGroup album={album} isOutgoing={isOwn} />
          </div>
        )}

        {/* 1c. Single Sticker */}
        {isSticker && message.stickerDocument && (
          <div className="relative shrink-0">
            {message.isAnimatedSticker && !message.isVideoSticker ? (
              <CustomEmojiCell
                document={message.stickerDocument}
                size={calculateStickerDimensions(
                  getDocumentSourceDimensions(message.stickerDocument) ?? {},
                ).width}
                peerId={message.peerId}
                messageId={Number(message.id)}
                observe={observeIntersectionForPlaying}
                label={message.stickerEmoji ? `${message.stickerEmoji} sticker` : 'Sticker'}
                className="pointer-events-none"
              />
            ) : (
              <MediaSticker
                document={message.stickerDocument}
                isOutgoing={isOwn}
                isAnimated={message.isAnimatedSticker}
                isVideo={message.isVideoSticker}
                emoji={message.stickerEmoji}
                previewThumbDataUri={message.previewThumbDataUri}
                peerId={message.peerId}
                messageId={Number(message.id)}
                observeIntersectionForLoading={observeIntersectionForLoading}
              />
            )}
            <MediaMetaBadge
              date={message.date}
              isOutgoing={isOwn}
              isEdited={Boolean(message.editDate && message.editDate > 0)}
              outgoingStatus={outgoingStatus}
              views={message.views}
              forwards={message.forwards}
              replies={message.replies?.replies}
              className="z-20"
            />
          </div>
        )}

        {/* 2. Single Photo */}
        {isPhoto && (message.photo || message.photoDocument) && (
          <div className="relative shrink-0">
            <MediaPhoto
              photo={message.photo}
              document={message.photoDocument}
              previewThumbDataUri={message.previewThumbDataUri}
              localBlobUrl={message.localBlobUrl}
              dimensions={mediaDisplayDims}
              isSpoiler={message.hasSpoiler}
              peerId={message.peerId}
              messageId={Number(message.id)}
              observeIntersectionForLoading={observeIntersectionForLoading}
              uploadProgress={message.uploadProgress}
              onAbortUpload={
                message.uploadId
                  ? () => {
                      void sdk.messageSend.cancelUpload(message.uploadId!);
                    }
                  : undefined
              }
            />
            {isPureMedia && (
              <MediaMetaBadge
                date={message.date}
                isOutgoing={isOwn}
                isEdited={Boolean(message.editDate && message.editDate > 0)}
                outgoingStatus={outgoingStatus}
                views={message.views}
                forwards={message.forwards}
                replies={message.replies?.replies}
              />
            )}
          </div>
        )}

        {/* 3. Round video note */}
        {isRoundVideo && message.videoDocument && (
          <div className="relative shrink-0">
            <MediaRoundVideo
              document={message.videoDocument}
              previewThumbDataUri={message.previewThumbDataUri}
              isSpoiler={message.hasSpoiler}
              isUnread={Boolean(message.mediaUnread)}
              peerId={message.peerId}
              messageId={Number(message.id)}
              observeIntersectionForLoading={observeIntersectionForLoading}
              onPlaybackStart={handleMediaPlayed}
            />
            {!hasText && (
              <MediaMetaBadge
                date={message.date}
                isOutgoing={isOwn}
                isEdited={Boolean(message.editDate && message.editDate > 0)}
                outgoingStatus={outgoingStatus}
                views={message.views}
                forwards={message.forwards}
                replies={message.replies?.replies}
              />
            )}
          </div>
        )}

        {/* 3b. Single Video */}
        {isVideo && !isRoundVideo && message.videoDocument && (
          <div className="relative shrink-0">
            <MediaVideo
              document={message.videoDocument}
              videoCover={message.videoCover}
              previewThumbDataUri={message.previewThumbDataUri}
              localBlobUrl={message.localBlobUrl}
              localCoverBlobUrl={message.localCoverBlobUrl}
              dimensions={mediaDisplayDims}
              isSpoiler={message.hasSpoiler}
              peerId={message.peerId}
              messageId={Number(message.id)}
              observeIntersectionForLoading={observeIntersectionForLoading}
              uploadProgress={message.uploadProgress}
              onAbortUpload={
                message.uploadId
                  ? () => {
                      void sdk.messageSend.cancelUpload(message.uploadId!);
                    }
                  : undefined
              }
            />
            {isPureMedia && (
              <MediaMetaBadge
                date={message.date}
                isOutgoing={isOwn}
                isEdited={Boolean(message.editDate && message.editDate > 0)}
                outgoingStatus={outgoingStatus}
                views={message.views}
                forwards={message.forwards}
                replies={message.replies?.replies}
              />
            )}
          </div>
        )}

        {isVoice && message.voiceDocument && (
          <MediaVoice
            document={message.voiceDocument}
            waveform={message.voiceWaveform}
            duration={message.voiceDuration}
            isOutgoing={isOwn}
            isUnread={Boolean(message.mediaUnread && !message.out)}
            peerId={message.peerId}
            messageId={Number(message.id)}
            onPlaybackStart={handleMediaPlayed}
          />
        )}

        {/* 4. File / Document */}
        {isDocument && message.fileDocument && (
          <MediaDocument
            document={message.fileDocument}
            isOutgoing={isOwn}
            peerId={message.peerId}
            messageId={Number(message.id)}
          />
        )}

        {/* 5. Contact card */}
        {isContact && message.media && 'phoneNumber' in message.media && (
          <MediaContact contact={message.media} isOutgoing={isOwn} />
        )}

        {isSingleCustomEmoji && singleCustomEmojiId ? (
          <div className="relative shrink-0">
            <CustomEmoji
              documentId={singleCustomEmojiId}
              fallback={textContent!}
              size={SINGLE_CUSTOM_EMOJI_SIZE}
              observeIntersectionForPlaying={observeIntersectionForPlaying}
            />
            <MediaMetaBadge
              date={message.date}
              isOutgoing={isOwn}
              isEdited={Boolean(message.editDate && message.editDate > 0)}
              outgoingStatus={outgoingStatus}
              views={message.views}
              forwards={message.forwards}
              replies={message.replies?.replies}
              className="z-20"
            />
          </div>
        ) : null}

        {/* Text above referred channel / link preview */}
        {hasText && isWebPage && hasWebPagePreview && (
          <div className="mb-1.5">
            <MessageText
              text={textContent!}
              entities={textEntities}
              className={isOwn ? 'text-primary-foreground' : 'text-foreground'}
              observeIntersectionForPlaying={observeIntersectionForPlaying}
            />
          </div>
        )}

        {/* 6. Referred channel / link preview */}
        {isWebPage && hasWebPagePreview && message.media && 'webpage' in message.media && (
          <MediaWebPage
            media={message.media}
            isOutgoing={isOwn}
            peerId={message.peerId}
            messageId={Number(message.id)}
            observeIntersectionForLoading={observeIntersectionForLoading}
          />
        )}

        {/* 7. Fallback badge for other types (poll, location, etc.) */}
        {hasOtherMedia && renderFallbackPlaceholder(message, isOwn)}

        {/* Text body / Caption (below media when not inverted) */}
        {!isInvertedMedia && (
          <MessageMediaCaption
            messageId={message.id}
            peerId={peerId}
            album={album}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
          />
        )}
      </CustomEmojiSurface>

      {(hasReactionPills || showMetaRow) && (
        <div
          className={cn(
            'relative z-10 mt-1.5 flex w-fit max-w-full items-end gap-1.5 pb-0.5 pointer-events-auto',
            isOwn ? 'justify-end' : 'justify-start',
            showMetaRow &&
              (isMediaAlbum || isPhoto || (isVideo && !isRoundVideo)) &&
              'px-1.5',
            showMetaRow && isFileGroup && 'px-1.5',
          )}
        >
          {hasReactionPills ? (
            <MessageReactions peerId={peerId} message={message} />
          ) : null}
          {showMetaRow ? (
            <div className="shrink-0">
              <MessageMeta
                date={message.date}
                isOutgoing={isOwn}
                surface="canvas"
                isEdited={Boolean(message.editDate && message.editDate > 0)}
                outgoingStatus={outgoingStatus}
                views={message.views}
                forwards={message.forwards}
                replies={message.replies?.replies}
                isPinned={message.pinned}
                postAuthor={message.postAuthor}
              />
            </div>
          ) : null}
        </div>
      )}
      </div>
    </MessageContextMenu>
  );
});

export default MessageItem;
