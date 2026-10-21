'use client';

import CustomEmoji from '@/lib/components/custom.emoji';
import MentionLink from '@/lib/components/mention.link';
import type { ObserveFn } from '@/lib/hooks/use-intersection-observer';
import { cn } from '@/lib/utils';
import type { TypeMessageEntity } from '@telegenie/libs/foundation/telegram/types/api-types';
import { useMemo, type ReactNode } from 'react';

interface MessageTextProps {
  text: string;
  entities?: TypeMessageEntity[];
  className?: string;
  observeIntersectionForPlaying?: ObserveFn;
}

interface Segment {
  start: number;
  end: number;
  entity?: TypeMessageEntity;
}

function mentionUserId(entity: TypeMessageEntity): string | undefined {
  if (!('userId' in entity) || entity.userId == null) {
    return undefined;
  }
  const { userId } = entity;
  if (typeof userId === 'string') {
    return userId;
  }
  if (typeof userId === 'object' && 'userId' in userId && typeof userId.userId === 'string') {
    return userId.userId;
  }
  return undefined;
}

function renderFormattedSegment(
  content: string,
  entity: TypeMessageEntity | undefined,
  index: number,
  observeIntersectionForPlaying?: ObserveFn,
): ReactNode {
  if (!entity) {
    return content;
  }

  const key = `entity-${index}-${entity.offset}`;
  const entityType =
    entity.className ||
    ('documentId' in entity && (entity as any).documentId ? 'MessageEntityCustomEmoji' : undefined) ||
    ((entity as any)._ === 'messageEntityCustomEmoji' ? 'MessageEntityCustomEmoji' : undefined);

  switch (entityType) {
    case 'MessageEntityBold':
      return (
        <strong key={key} className="font-bold">
          {content}
        </strong>
      );
    case 'MessageEntityItalic':
      return (
        <em key={key} className="italic">
          {content}
        </em>
      );
    case 'MessageEntityUnderline':
      return (
        <u key={key} className="underline">
          {content}
        </u>
      );
    case 'MessageEntityStrike':
      return (
        <del key={key} className="line-through">
          {content}
        </del>
      );
    case 'MessageEntityCode':
      return (
        <code
          key={key}
          className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.5 font-mono text-[0.9em]"
        >
          {content}
        </code>
      );
    case 'MessageEntityPre':
      return (
        <pre
          key={key}
          className="my-1 rounded bg-black/10 dark:bg-white/10 p-2 font-mono text-[0.85em] overflow-x-auto"
        >
          {content}
        </pre>
      );
    case 'MessageEntityBlockquote':
      return (
        <blockquote
          key={key}
          className="my-1 border-l-2 border-primary/60 pl-2 italic text-muted-foreground"
        >
          {content}
        </blockquote>
      );
    case 'MessageEntitySpoiler':
      return (
        <span
          key={key}
          className="rounded bg-foreground/20 px-0.5 text-transparent hover:text-inherit hover:bg-transparent transition-colors cursor-pointer select-none"
          title="Click to reveal spoiler"
        >
          {content}
        </span>
      );
    case 'MessageEntityUrl': {
      const href = content.startsWith('http') ? content : `https://${content}`;
      return (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80 break-all"
        >
          {content}
        </a>
      );
    }
    case 'MessageEntityTextUrl': {
      const url = 'url' in entity && typeof entity.url === 'string' ? entity.url : content;
      return (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80 break-all"
        >
          {content}
        </a>
      );
    }
    case 'MessageEntityEmail':
      return (
        <a key={key} href={`mailto:${content}`} className="underline hover:opacity-80">
          {content}
        </a>
      );
    case 'MessageEntityMentionName':
    case 'InputMessageEntityMentionName':
      return (
        <MentionLink key={key} userId={mentionUserId(entity)}>
          {content}
        </MentionLink>
      );
    case 'MessageEntityMention':
      return (
        <MentionLink key={key} username={content}>
          {content}
        </MentionLink>
      );
    case 'MessageEntityCustomEmoji': {
      const documentId =
        'documentId' in entity && typeof entity.documentId === 'string'
          ? entity.documentId
          : undefined;
      return (
        <CustomEmoji
          key={key}
          documentId={documentId}
          fallback={content}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
        />
      );
    }
    default:
      return content;
  }
}

export default function MessageText({
  text,
  entities,
  className,
  observeIntersectionForPlaying,
}: MessageTextProps) {
  const renderedContent = useMemo(() => {
    if (!text) return null;
    if (!entities || entities.length === 0) {
      return text;
    }

    // Sort entities by offset ascending
    const sorted = [...entities].sort((a, b) => a.offset - b.offset);
    const segments: Segment[] = [];
    let currentOffset = 0;

    for (const entity of sorted) {
      const start = entity.offset;
      const end = entity.offset + entity.length;

      if (start > currentOffset) {
        segments.push({
          start: currentOffset,
          end: start,
        });
      }

      if (start >= currentOffset) {
        segments.push({
          start,
          end,
          entity,
        });
        currentOffset = Math.max(currentOffset, end);
      }
    }

    if (currentOffset < text.length) {
      segments.push({
        start: currentOffset,
        end: text.length,
      });
    }

    return segments.map((segment, index) => {
      const slice = text.substring(segment.start, segment.end);
      return renderFormattedSegment(
        slice,
        segment.entity,
        index,
        observeIntersectionForPlaying,
      );
    });
  }, [text, entities, observeIntersectionForPlaying]);

  if (!text) return null;

  return (
    <span className={cn('whitespace-pre-wrap break-words leading-relaxed text-sm', className)}>
      {renderedContent}
    </span>
  );
}
