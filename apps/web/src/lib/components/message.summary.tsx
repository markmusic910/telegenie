'use client';

import {
  albumPreviewPlaceholder,
  formatDialogPreviewText,
  replaceSelfMentionsInText,
  type DialogPreviewOptions,
  type Message,
  type MessagePreviewKind,
} from '@telegenie/sdk';

import MessagePreview from '@/lib/components/message.preview';
import { cn } from '@/lib/utils';

type MessageSummaryProps = {
  draftText?: string;
  lastMessage?: Message | null;
  preview?: {
    kind: MessagePreviewKind;
    count: number;
    thumbs: string[];
    caption?: string;
  };
  dialogPreview?: DialogPreviewOptions;
  className?: string;
};

export default function MessageSummary({
  draftText,
  lastMessage,
  preview,
  dialogPreview,
  className,
}: MessageSummaryProps) {
  if (draftText) {
    return (
      <span className={cn('min-w-0 truncate text-xs leading-snug text-muted-foreground', className)}>
        <span className="text-destructive">Draft:</span> {draftText}
      </span>
    );
  }

  if (preview) {
    const caption = preview.caption
      ? replaceSelfMentionsInText(
          preview.caption,
          lastMessage?.entities,
          dialogPreview ?? {},
          lastMessage?.mentioned,
        )
      : undefined;
    const text = caption || albumPreviewPlaceholder(preview.kind, preview.count);
    return (
      <MessagePreview
        variant="dialog"
        text={text}
        thumbs={preview.thumbs}
        className={className}
      />
    );
  }

  const summary = lastMessage
    ? formatDialogPreviewText(lastMessage, dialogPreview ?? {})
    : undefined;
  if (!summary) {
    return <span className={cn('min-w-0 truncate text-xs leading-snug text-muted-foreground', className)} />;
  }

  return (
    <span className={cn('min-w-0 truncate text-xs leading-snug text-muted-foreground', className)}>
      {summary}
    </span>
  );
}
