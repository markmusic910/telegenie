'use client';

import MediaSticker from '@/lib/components/media.sticker';
import { Skeleton } from '@/lib/components/ui/skeleton';
import { useSDK } from '@/lib/contexts/sdk.context';
import type { Document, SendStickerDocument } from '@telegenie/sdk';
import { useEffect, useRef, useState } from 'react';
import { VList } from 'virtua';

export interface EmojiSuggestProps {
  emoji: string;
  canSendStickers: boolean;
  sending: boolean;
  onPickEmoji: (document: Document, fallback: string) => void;
  onSendSticker: (document: SendStickerDocument) => void;
  onDismiss: () => void;
}

function altOf(document: Document): string | undefined {
  for (const attr of document.attributes) {
    if ('alt' in attr && typeof attr.alt === 'string' && attr.alt) return attr.alt;
  }
  return undefined;
}

function stickerSetOf(document: Document): { setId: string; setAccessHash: string } | undefined {
  for (const attr of document.attributes) {
    if (!('stickerset' in attr)) continue;
    const set = attr.stickerset;
    if (set && 'id' in set && 'accessHash' in set && set.id && set.accessHash) {
      return { setId: set.id, setAccessHash: set.accessHash };
    }
  }
  return undefined;
}

function sendPayload(document: Document): SendStickerDocument {
  const set = stickerSetOf(document);
  return {
    id: document.id,
    accessHash: document.accessHash,
    fileReference: document.fileReference,
    setId: set?.setId,
    setAccessHash: set?.setAccessHash,
  };
}

const STICKER_COLS = 5;
/** Matches `max-h-56` after the panel's `p-2`. */
const STICKER_VIEWPORT_PX = 208;
const STICKER_ROW_PX = 76;

function stickerRows(documents: Document[]): Document[][] {
  const rows: Document[][] = [];
  for (let index = 0; index < documents.length; index += STICKER_COLS) {
    rows.push(documents.slice(index, index + STICKER_COLS));
  }
  return rows;
}

function StickerSuggestList({
  stickers,
  emoji,
  sending,
  onSendSticker,
}: {
  stickers: Document[];
  emoji: string;
  sending: boolean;
  onSendSticker: (document: SendStickerDocument) => void;
}) {
  const rows = stickerRows(stickers);
  return (
    <VList
      itemSize={STICKER_ROW_PX}
      className="w-full"
      style={{ height: Math.min(STICKER_VIEWPORT_PX, rows.length * STICKER_ROW_PX) }}
    >
      {rows.map((row) => (
        <ul
          key={row[0]?.id}
          className="grid grid-cols-5 gap-1"
          style={{ height: STICKER_ROW_PX }}
        >
          {row.map((document) => {
            const label = altOf(document) ?? emoji;
            return (
              <li key={document.id} className="flex min-w-0 items-center justify-center">
                <button
                  type="button"
                  className="flex items-center justify-center rounded-md p-0 hover:bg-accent disabled:opacity-64"
                  aria-label={`Send ${label} sticker`}
                  disabled={sending}
                  onClick={() => onSendSticker(sendPayload(document))}
                >
                  <MediaSticker
                    document={document}
                    emoji={label}
                    maxSize={72}
                    isAnimated={document.mimeType === 'application/x-tgsticker'}
                    isVideo={document.mimeType.startsWith('video/')}
                    className="pointer-events-none"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ))}
    </VList>
  );
}

function EmojiButton({
  document,
  label,
  onPick,
}: {
  document: Document;
  label: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex size-9 shrink-0 items-center justify-center rounded-md p-0 hover:bg-accent"
      aria-label={label}
      onClick={onPick}
    >
      <MediaSticker
        document={document}
        emoji={label}
        maxSize={32}
        isAnimated={document.mimeType === 'application/x-tgsticker'}
        isVideo={document.mimeType.startsWith('video/')}
        className="pointer-events-none"
      />
    </button>
  );
}

export default function EmojiSuggest({
  emoji,
  canSendStickers,
  sending,
  onPickEmoji,
  onSendSticker,
  onDismiss,
}: EmojiSuggestProps) {
  const sdk = useSDK();
  const rootRef = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState<Document[]>([]);
  const [stickers, setStickers] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCustom([]);
    setStickers([]);
    void Promise.all([
      sdk.sticker.searchCustomEmoji(emoji),
      canSendStickers ? sdk.sticker.getStickersForEmoji(emoji) : Promise.resolve([]),
    ])
      .then(([equivalents, found]) => {
        if (cancelled) return;
        sdk.sticker.rememberCustomEmoji(equivalents);
        setCustom(equivalents);
        setStickers(found);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCustom([]);
        setStickers([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sdk, emoji, canSendStickers]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onDismiss();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [onDismiss]);

  if (!loading && custom.length === 0 && stickers.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="absolute bottom-full start-0 z-30 mb-2 flex w-[22rem] max-w-full flex-col items-start gap-1.5"
    >
      {loading || custom.length > 0 ? (
      <div className="max-w-full overflow-x-auto rounded-xl border border-border bg-popover p-1 shadow-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-0.5">
          {loading && custom.length === 0
            ? Array.from({ length: 6 }, (_, index) => (
                <li key={index}>
                  <Skeleton className="size-9 rounded-md" />
                </li>
              ))
            : custom.map((document) => (
                <li key={document.id}>
                  <EmojiButton
                    document={document}
                    label={altOf(document) ?? emoji}
                    onPick={() => onPickEmoji(document, altOf(document) ?? emoji)}
                  />
                </li>
              ))}
        </ul>
      </div>
      ) : null}
      {canSendStickers && (loading || stickers.length > 0) ? (
        <div className="max-h-56 w-full overflow-hidden rounded-xl border border-border bg-popover p-2 shadow-md">
          {loading && stickers.length === 0 ? (
            <ul className="grid grid-cols-5 gap-1">
              {Array.from({ length: 10 }, (_, index) => (
                <li key={index} className="flex items-center justify-center">
                  <Skeleton className="size-14 rounded-md" />
                </li>
              ))}
            </ul>
          ) : (
            <StickerSuggestList
              stickers={stickers}
              emoji={emoji}
              sending={sending}
              onSendSticker={onSendSticker}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
