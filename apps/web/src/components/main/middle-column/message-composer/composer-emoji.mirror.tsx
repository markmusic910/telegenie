'use client';

import CustomEmoji from '@/lib/components/custom.emoji';
import { cn } from '@/lib/utils';
import type { ReactNode, Ref } from 'react';

export type ComposerEmojiSpan = {
  offset: number;
  length: number;
  documentId: string;
};

export type ComposerMentionSpan = {
  offset: number;
  length: number;
  userId: string;
};

export interface ComposerEmojiMirrorProps {
  text: string;
  spans: ComposerEmojiSpan[];
  mentionSpans?: ComposerMentionSpan[];
  /** Matches the composer's multiline state: only then does the textarea scroll. */
  multiline: boolean;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Emoji image size. It is centered on the ~17px fallback glyph, so it spills about 1.5px
 * past each side; layout is unaffected. Larger would draw over the caret, which sits at the
 * glyph's edge: the textarea can't widen one glyph, so the emoji can't grow without covering it.
 */
const EMOJI_SIZE = 20;

type MirrorEntry =
  | ({ kind: 'emoji' } & ComposerEmojiSpan)
  | ({ kind: 'mention' } & ComposerMentionSpan);

/**
 * Paints a message draft under a transparent `<textarea>`: the text as written,
 * with each custom emoji drawn over its fallback glyph and mention-by-id spans
 * highlighted in the primary link color. The glyphs stay in the flow so line
 * breaks and caret positions match the textarea. Scroll is synced by the parent.
 */
export default function ComposerEmojiMirror({
  text,
  spans,
  mentionSpans,
  multiline,
  ref,
}: ComposerEmojiMirrorProps) {
  const entries: MirrorEntry[] = [
    ...spans.map((span) => ({ kind: 'emoji' as const, ...span })),
    ...(mentionSpans ?? []).map((span) => ({ kind: 'mention' as const, ...span })),
  ].sort((a, b) => a.offset - b.offset);

  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const span of entries) {
    if (span.offset < cursor || span.offset + span.length > text.length) continue;
    if (span.offset > cursor) nodes.push(text.slice(cursor, span.offset));
    const segment = text.slice(span.offset, span.offset + span.length);
    if (span.kind === 'emoji') {
      nodes.push(
        <span key={`e:${span.offset}:${span.documentId}`} className="relative inline-block">
          <span className="invisible">{segment}</span>
          {/* `shrink-0`: the cell has a fixed size, but as a flex item it was squeezed to the glyph width. */}
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center [&>*]:shrink-0"
          >
            <CustomEmoji
              documentId={span.documentId}
              fallback={segment}
              size={EMOJI_SIZE}
              placeholder={false}
            />
          </span>
        </span>,
      );
    } else {
      nodes.push(
        <span key={`m:${span.offset}:${span.userId}`} className="text-primary">
          {segment}
        </span>,
      );
    }
    cursor = span.offset + span.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 z-10 overflow-x-hidden whitespace-pre-wrap break-words',
        'border border-transparent bg-transparent text-base leading-5 text-foreground sm:text-sm',
        'ps-3 pe-12 py-2.5 [scrollbar-color:transparent_transparent]',
        // Box height comes from the wrapper (`inset-0`), which follows the textarea.
        // The invisible scrollbar keeps the same text width as the textarea's.
        multiline ? 'overflow-y-auto' : 'overflow-y-hidden',
      )}
    >
      {nodes}
      {/* A trailing newline only renders a line when something follows it. */}
      {'\u200b'}
    </div>
  );
}
