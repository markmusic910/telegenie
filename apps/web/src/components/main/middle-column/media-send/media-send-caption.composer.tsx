'use client';

import React, { useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import {
  ArrowUp,
  EyeOff,
  Image as ImageIcon,
  Smile,
  Send,
} from 'lucide-react';
import type { CustomEmojiEntity, Document } from '@telegenie/sdk';
import { useSDK } from '@/lib/contexts/sdk.context';
import { Button } from '@/lib/components/ui/button';
import {
  Popover,
  PopoverTrigger,
  PopoverPopup,
} from '@/lib/components/ui/popover';
import { Textarea } from '@/lib/components/ui/textarea';
import MessageStickerPicker from '../message.sticker-picker';
import ComposerEmojiMirror, { type ComposerEmojiSpan } from '../message-composer/composer-emoji.mirror';
import { cn } from '@/lib/utils';

export interface MediaSendCaptionComposerProps {
  peerId: string;
  caption: string;
  onCaptionChange: (caption: string) => void;
  entities: CustomEmojiEntity[];
  onEntitiesChange: React.Dispatch<React.SetStateAction<CustomEmojiEntity[]>>;
  invertMedia: boolean;
  hasAnySpoiler: boolean;
  allSpoilers: boolean;
  hasAnyCover: boolean;
  onSend: () => void;
}

export default function MediaSendCaptionComposer({
  peerId,
  caption,
  onCaptionChange,
  entities,
  onEntitiesChange,
  invertMedia,
  hasAnySpoiler,
  allSpoilers,
  hasAnyCover,
  onSend,
}: MediaSendCaptionComposerProps) {
  const sdk = useSDK();

  const emojiSpans: ComposerEmojiSpan[] = useMemo(
    () =>
      entities.map((entity) => ({
        offset: entity.offset,
        length: entity.length,
        documentId: entity.documentId,
      })),
    [entities],
  );
  const hasEmojiSpans = emojiSpans.length > 0;

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const syncMirrorScroll = useCallback(() => {
    const textarea = inputRef.current;
    const mirror = mirrorRef.current;
    if (textarea && mirror) mirror.scrollTop = textarea.scrollTop;
  }, []);

  useLayoutEffect(() => {
    syncMirrorScroll();
  }, [caption, hasEmojiSpans, syncMirrorScroll]);

  const handleInsertEmoji = useCallback(
    (emoji: string) => {
      const input = inputRef.current;
      const current = caption;
      const start = input?.selectionStart ?? current.length;
      const end = input?.selectionEnd ?? start;
      const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;
      onCaptionChange(next);
      const caret = start + emoji.length;
      requestAnimationFrame(() => {
        input?.focus();
        input?.setSelectionRange(caret, caret);
      });
    },
    [caption, onCaptionChange],
  );

  const handleInsertCustomEmoji = useCallback(
    (document: Document, alt: string) => {
      sdk.sticker.rememberCustomEmoji([document]);
      const input = inputRef.current;
      const current = caption;
      const start = input?.selectionStart ?? current.length;
      const end = input?.selectionEnd ?? start;
      const next = `${current.slice(0, start)}${alt}${current.slice(end)}`;
      const delta = alt.length - (end - start);

      onEntitiesChange((prev) => {
        const nextEntities = prev.flatMap((entity) => {
          if (typeof entity.offset !== 'number' || typeof entity.length !== 'number') return [];
          if (entity.offset >= end) return [{ ...entity, offset: entity.offset + delta }];
          if (entity.offset + entity.length <= start) return [entity];
          return [];
        });
        nextEntities.push({
          className: 'MessageEntityCustomEmoji',
          _: 'messageEntityCustomEmoji',
          offset: start,
          length: alt.length,
          documentId: document.id,
        });
        return nextEntities;
      });

      onCaptionChange(next);
      const caret = start + alt.length;
      requestAnimationFrame(() => {
        input?.focus();
        input?.setSelectionRange(caret, caret);
      });
    },
    [caption, onCaptionChange, onEntitiesChange, sdk.sticker],
  );

  return (
    <div
      className={cn(
        'flex flex-col gap-2 px-4 py-3 bg-muted/20',
        invertMedia ? 'border-b border-border' : 'border-t border-border',
      )}
    >
      {/* Active state pills (invertMedia / spoiler / cover) */}
      {(invertMedia || hasAnySpoiler || hasAnyCover) && (
        <div className="flex items-center gap-1.5 px-0.5 text-[11px] text-muted-foreground flex-wrap">
          {invertMedia && (
            <span className="flex items-center gap-1 text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
              <ArrowUp className="size-3" />
              Caption on top
            </span>
          )}
          {hasAnySpoiler && (
            <span className="flex items-center gap-1 text-amber-500 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full">
              <EyeOff className="size-3" />
              {allSpoilers ? 'All Spoilers' : 'Spoiler'}
            </span>
          )}
          {hasAnyCover && (
            <span className="flex items-center gap-1 text-sky-500 font-medium bg-sky-500/10 px-2 py-0.5 rounded-full">
              <ImageIcon className="size-3" />
              Custom cover
            </span>
          )}
        </div>
      )}

      {/* Input row: vertically centered with composer-identical send button */}
      <div className="flex items-center gap-2 w-full">
        <div className="relative min-w-0 flex-1">
          <Textarea
            ref={inputRef}
            placeholder="Add a caption..."
            size="sm"
            rows={1}
            value={caption}
            className={cn(
              'w-full',
              '[&_[data-slot=textarea]]:!min-h-0',
              '[&_[data-slot=textarea]]:!field-sizing-fixed',
              '[&_[data-slot=textarea]]:resize-none',
              '[&_[data-slot=textarea]]:ps-3',
              '[&_[data-slot=textarea]]:pe-10',
              '[&_[data-slot=textarea]]:leading-5',
              '[&_[data-slot=textarea]]:py-2.5',
              '[&_[data-slot=textarea]]:max-h-32',
              '[&_[data-slot=textarea]]:overflow-y-auto',
              hasEmojiSpans &&
                '[&_[data-slot=textarea]]:relative [&_[data-slot=textarea]]:z-20 [&_[data-slot=textarea]]:text-transparent [&_[data-slot=textarea]]:[-webkit-text-fill-color:transparent] [&_[data-slot=textarea]]:caret-foreground',
            )}
            onChange={(e) => onCaptionChange(e.target.value)}
            onScroll={syncMirrorScroll}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          {hasEmojiSpans && (
            <ComposerEmojiMirror
              ref={mirrorRef}
              text={caption}
              spans={emojiSpans}
              multiline={true}
            />
          )}

          <div className="absolute end-1.5 bottom-1 z-30">
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Emoji"
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                  />
                }
              >
                <Smile className="size-4" />
              </PopoverTrigger>
              <PopoverPopup
                side="top"
                align="end"
                className="w-auto [&_[data-slot=popover-viewport]]:px-0 [&_[data-slot=popover-viewport]]:py-0"
              >
                <MessageStickerPicker
                  peerId={peerId}
                  canSendStickers={false}
                  canSendGifs={false}
                  sending={false}
                  onInsertEmoji={handleInsertEmoji}
                  onInsertCustomEmoji={handleInsertCustomEmoji}
                  onSendSticker={() => {}}
                  onSendGifResult={() => {}}
                />
              </PopoverPopup>
            </Popover>
          </div>
        </div>

        {/* Button style identical to message.composer.tsx */}
        <Button
          type="button"
          size="icon"
          aria-label="Send"
          onClick={onSend}
        >
          <Send aria-hidden />
        </Button>
      </div>
    </div>
  );
}
