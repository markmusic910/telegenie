'use client';

import { useDialogPeer, useMessage } from '@/lib/contexts/sdk.context';
import { useFocusMessage } from '@/lib/hooks/use-focus-message';
import MessagePreview from '@/lib/components/message.preview';
import { cn } from '@/lib/utils';
import type { TypeMessageFwdHeader, TypeMessageMedia } from '@telegenie/libs/foundation/telegram/types/api-types';
import type { Message } from '@telegenie/sdk';
import { fallbackPeerDisplay, peerActionName, peerColorIndex } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';

const REPLY_NAME_COLORS = [
  'text-violet-600 dark:text-violet-400',
  'text-blue-600 dark:text-blue-400',
  'text-emerald-600 dark:text-emerald-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-600 dark:text-rose-400',
  'text-sky-600 dark:text-sky-400',
  'text-fuchsia-600 dark:text-fuchsia-400',
  'text-teal-600 dark:text-teal-400',
] as const;

const REPLY_BAR_COLORS = [
  'bg-violet-600 dark:bg-violet-400',
  'bg-blue-600 dark:bg-blue-400',
  'bg-emerald-600 dark:bg-emerald-400',
  'bg-amber-600 dark:bg-amber-400',
  'bg-rose-600 dark:bg-rose-400',
  'bg-sky-600 dark:bg-sky-400',
  'bg-fuchsia-600 dark:bg-fuchsia-400',
  'bg-teal-600 dark:bg-teal-400',
] as const;

function resolveReplySenderName(
  replyFrom: TypeMessageFwdHeader | undefined,
  replyPeer: ReturnType<typeof useDialogPeer>,
  replySenderPeerIdValue?: string,
): string {
  const fromName = replyFrom?.fromName?.trim();
  if (fromName) return fromName;

  const postAuthor = replyFrom?.postAuthor?.trim();
  if (postAuthor) return postAuthor;

  const actionName = peerActionName(replyPeer ?? undefined);
  if (actionName) return actionName;

  if (replySenderPeerIdValue) {
    const fallback = fallbackPeerDisplay(replySenderPeerIdValue);
    if (fallback.name !== replySenderPeerIdValue) return fallback.name;
  }

  return 'Unknown';
}

function replyExpectsVisualThumb(
  replyMedia: TypeMessageMedia | undefined,
  repliedMessage: Message | null | undefined,
  thumbSrc?: string,
): boolean {
  if (thumbSrc) return true;
  if (repliedMessage?.isPhoto || repliedMessage?.isVideo) return true;
  if (!replyMedia) return false;
  if ('photo' in replyMedia && replyMedia.photo) return true;
  if ('video' in replyMedia && replyMedia.video) return true;
  if ('round' in replyMedia && replyMedia.round) return true;
  return false;
}

export interface MessageReplyProps {
  message: Message;
  isOwn: boolean;
  className?: string;
}

const MessageReply = observer(function MessageReply({
  message,
  isOwn,
  className,
}: MessageReplyProps) {
  const focusMessage = useFocusMessage();
  const replyHeader = message.messageReplyHeader;
  const replyToMsgId = message.replyToMessageId;
  const targetPeerId = message.replyTargetPeerId;
  const repliedMessage = useMessage(
    replyToMsgId != null ? targetPeerId : null,
    replyToMsgId != null ? String(replyToMsgId) : null,
  );

  const replyFrom = replyHeader?.replyFrom;
  const senderPeerId = message.replySenderPeerIdValue(repliedMessage);
  const replyPeer = useDialogPeer(senderPeerId);

  if (
    !replyHeader
    || replyToMsgId == null
    || !message.replyPreviewVerificationState(repliedMessage)
    || !message.hasReplyPreviewContent(repliedMessage)
  ) {
    return null;
  }

  const senderName = resolveReplySenderName(replyFrom, replyPeer, senderPeerId);
  const preview = message.replyPreviewContent(repliedMessage);
  const colorIndex = senderPeerId ? peerColorIndex(senderPeerId) : 0;
  const thumbSrc = preview.thumbs[0];
  const showThumbSlot = replyExpectsVisualThumb(replyHeader.replyMedia, repliedMessage, thumbSrc);

  const handleClick = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    focusMessage({
      peerId: targetPeerId,
      messageId: String(replyToMsgId),
      replyFromMessageId: message.id,
    });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick(event);
        }
      }}
      className={cn(
        'mb-1.5 flex h-11 min-h-11 w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-lg px-2 select-none transition-opacity hover:opacity-90',
        isOwn ? 'bg-black/15' : 'bg-muted/70',
        className,
      )}
    >
      <div
        className={cn(
          'w-0.5 shrink-0 self-stretch my-1.5 rounded-full',
          isOwn ? 'bg-primary-foreground' : REPLY_BAR_COLORS[colorIndex],
        )}
        aria-hidden
      />
      <div className="min-w-0 flex flex-1 flex-col justify-center gap-0.5 overflow-hidden">
        <span
          className={cn(
            'h-4 truncate text-xs font-semibold leading-4',
            isOwn ? 'text-primary-foreground' : REPLY_NAME_COLORS[colorIndex],
          )}
        >
          {senderName}
        </span>
        <MessagePreview
          variant="reply"
          text={preview.text}
          textClassName={isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground'}
        />
      </div>
      {showThumbSlot ? (
        <div className="size-8 shrink-0 overflow-hidden rounded bg-black/20">
          {thumbSrc ? (
            <img
              src={thumbSrc}
              alt=""
              width={32}
              height={32}
              className="size-8 object-cover"
              aria-hidden="true"
              draggable={false}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

export default MessageReply;
