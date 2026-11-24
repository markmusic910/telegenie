'use client';

import React, { useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import {
  ArrowUp,
  EyeOff,
  Image as ImageIcon,
  Smile,
  Send,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { Document, OutgoingMessageEntity, User } from '@telegenie/sdk';
import { useSDK } from '@/lib/contexts/sdk.context';
import { Button } from '@/lib/components/ui/button';
import {
  Popover,
  PopoverTrigger,
  PopoverPopup,
} from '@/lib/components/ui/popover';
import { Textarea } from '@/lib/components/ui/textarea';
import { rebaseEntities } from '@/lib/utils/emoji.grapheme';
import MessageStickerPicker from '../message.sticker-picker';
import ComposerEmojiMirror, {
  type ComposerEmojiSpan,
  type ComposerMentionSpan,
} from '../message-composer/composer-emoji.mirror';
import MentionSuggest from '../message-composer/mention.suggest';
import { buildMentionInsertion, type MentionQueryMatch } from '../message-composer/mention.utils';
import { useComposerMentions } from '../message-composer/use-composer-mentions';
import { cn } from '@/lib/utils';

export interface MediaSendCaptionComposerProps {
  peerId: string;
  caption: string;
  onCaptionChange: (caption: string) => void;
  entities: OutgoingMessageEntity[];
  onEntitiesChange: React.Dispatch<React.SetStateAction<OutgoingMessageEntity[]>>;
  invertMedia: boolean;
  hasAnySpoiler: boolean;
  allSpoilers: boolean;
  hasAnyCover: boolean;
  onSend: () => void;
}

const MediaSendCaptionComposer = observer(function MediaSendCaptionComposer({
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
      entities.flatMap((entity) =>
        'documentId' in entity && typeof entity.documentId === 'string'
          ? [{ offset: entity.offset, length: entity.length, documentId: entity.documentId }]
          : [],
      ),
    [entities],
  );
  const mentionSpans: ComposerMentionSpan[] = useMemo(
    () =>
      entities.flatMap((entity) =>
        'userId' in entity && typeof entity.userId === 'string'
          ? [{ offset: entity.offset, length: entity.length, userId: entity.userId }]
          : [],
      ),
    [entities],
  );
  const hasMirrorSpans = emojiSpans.length > 0 || mentionSpans.length > 0;

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const syncMirrorScroll = useCallback(() => {
    const textarea = inputRef.current;
    const mirror = mirrorRef.current;
    if (textarea && mirror) mirror.scrollTop = textarea.scrollTop;
  }, []);

  useLayoutEffect(() => {
    syncMirrorScroll();
  }, [caption, hasMirrorSpans, syncMirrorScroll]);

  const handleCaptionEdit = useCallback(
    (next: string) => {
      onEntitiesChange((prev) => rebaseEntities(caption, next, prev));
      onCaptionChange(next);
    },
    [caption, onCaptionChange, onEntitiesChange],
  );

  const handleInsertMention = useCallback(
    (user: User, range: MentionQueryMatch) => {
      const input = inputRef.current;
      const current = input?.value ?? caption;
      const inserted = buildMentionInsertion<OutgoingMessageEntity>(current, entities, range, user);
      onEntitiesChange(inserted.entities);
      onCaptionChange(inserted.text);
      requestAnimationFrame(() => {
        input?.focus();
        input?.setSelectionRange(inserted.caret, inserted.caret);
        mentions.syncSelection(input);
      });
    },
    [caption, entities, onCaptionChange, onEntitiesChange],
  );

  const mentions = useComposerMentions({
    peerId,
    text: caption,
    inputRef,
    onInsertUser: handleInsertMention,
  });

  const handleInsertEmoji = useCallback(
    (emoji: string) => {
      const input = inputRef.current;
      const current = caption;
      const start = input?.selectionStart ?? current.length;
      const end = input?.selectionEnd ?? start;
      const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;
      handleCaptionEdit(next);
      const caret = start + emoji.length;
      requestAnimationFrame(() => {
        input?.focus();
        input?.setSelectionRange(caret, caret);
      });
    },
    [caption, handleCaptionEdit],
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
      <div className={cn('relative flex items-center gap-2 w-full', mentions.isOpen && 'z-20')}>
        {mentions.isOpen ? (
          <MentionSuggest
            users={mentions.users}
            selectedIndex={mentions.selectedIndex}
            onSelect={mentions.selectUser}
            onHover={mentions.setSelectedIndex}
            onDismiss={mentions.dismiss}
          />
        ) : null}
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
              hasMirrorSpans &&
                '[&_[data-slot=textarea]]:relative [&_[data-slot=textarea]]:z-20 [&_[data-slot=textarea]]:text-transparent [&_[data-slot=textarea]]:[-webkit-text-fill-color:transparent] [&_[data-slot=textarea]]:caret-foreground',
            )}
            onChange={(e) => {
              handleCaptionEdit(e.target.value);
              mentions.syncSelection(e.currentTarget);
            }}
            onSelect={(e) => mentions.syncSelection(e.currentTarget)}
            onClick={(e) => mentions.syncSelection(e.currentTarget)}
            onKeyUp={(e) => mentions.syncSelection(e.currentTarget)}
            onScroll={syncMirrorScroll}
            onKeyDown={(e) => {
              if (mentions.handleKeyDown(e)) return;
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          {hasMirrorSpans && (
            <ComposerEmojiMirror
              ref={mirrorRef}
              text={caption}
              spans={emojiSpans}
              mentionSpans={mentionSpans}
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
});

export default MediaSendCaptionComposer;
