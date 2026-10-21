'use client';

import { cn } from '@/lib/utils';

export type MessagePreviewVariant = 'dialog' | 'reply';

export type MessagePreviewProps = {
  text: string;
  thumbs?: string[];
  variant?: MessagePreviewVariant;
  className?: string;
  textClassName?: string;
};

export default function MessagePreview({
  text,
  thumbs = [],
  variant = 'dialog',
  className,
  textClassName,
}: MessagePreviewProps) {
  if (variant === 'reply') {
    return (
      <span
        className={cn(
          'block h-4 min-w-0 truncate text-xs leading-4',
          textClassName,
          className,
        )}
      >
        {text}
      </span>
    );
  }

  return (
    <span className={cn('flex min-w-0 items-center gap-1', className)}>
      {thumbs.map((src, index) => (
        <img
          key={`${src}-${index}`}
          src={src}
          alt=""
          className="size-5 shrink-0 rounded-sm object-cover"
          aria-hidden="true"
          draggable={false}
        />
      ))}
      <span
        className={cn(
          'min-w-0 truncate text-xs leading-snug text-muted-foreground',
          textClassName,
        )}
      >
        {text}
      </span>
    </span>
  );
}
