'use client';

import { useCustomEmojiSurface } from '@/lib/components/custom-emoji.surface';
import type { ObserveFn } from '@/lib/hooks/use-intersection-observer';
import { retainCustomEmoji } from '@/lib/rlottie/rlottie-pool';
import { cn } from '@/lib/utils';
import type { Document } from '@telegenie/sdk';
import { buildMediaUrl } from '@telegenie/sdk';
import { useEffect, useRef, useState } from 'react';

const PATH_SVG =
  '<?xml version="1.0" encoding="utf-8"?><svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {{width}} {{height}}" xml:space="preserve"><path fill="#808080" fill-opacity="0.55" d="{{path}}" /></svg>';
const PATH_LOOKUP = 'AACAAAAHAAALMAAAQASTAVAAAZaacaaaahaaalmaaaqastava.az0123456789-,';

/** Telegram `photoPathSize` bytes are a packed SVG path, not image pixels. */
function pathBytesToSvg(bytes: Uint8Array, width: number, height: number): string {
  let path = 'M';
  for (const num of bytes) {
    if (num >= 192) {
      path += PATH_LOOKUP[num - 192] ?? '';
    } else {
      if (num >= 128) path += ',';
      else if (num >= 64) path += '-';
      path += String(num & 63);
    }
  }
  return PATH_SVG.replace('{{path}}', `${path}z`)
    .replace('{{width}}', String(width))
    .replace('{{height}}', String(height));
}

function decodeBase64(value: string): Uint8Array | undefined {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return undefined;
  }
}

function thumbBox(document: Document): { w: number; h: number } {
  const attribute = document.attributes?.find(
    (item) =>
      'w' in item && 'h' in item && typeof item.w === 'number' && typeof item.h === 'number',
  );
  if (attribute && 'w' in attribute && 'h' in attribute) return { w: attribute.w, h: attribute.h };
  const photo = document.thumbs?.find(
    (size) =>
      'w' in size && 'h' in size && typeof size.w === 'number' && typeof size.h === 'number',
  );
  if (photo && 'w' in photo && 'h' in photo) return { w: photo.w, h: photo.h };
  return { w: 512, h: 512 };
}

export function customEmojiThumb(document: Document): string | undefined {
  const sizes = document.thumbs ?? [];
  const inline = sizes.find(
    (size) => 'bytes' in size && typeof size.bytes === 'string' && size.bytes.startsWith('data:'),
  );
  if (inline && 'bytes' in inline && typeof inline.bytes === 'string') return inline.bytes;

  // `photoPathSize` (type "j") is stored as raw base64. A sized thumb (type "m") has no pixels.
  const path = sizes.find(
    (size) =>
      'bytes' in size && typeof size.bytes === 'string' && size.bytes.length > 0 && !('w' in size),
  );
  if (!path || !('bytes' in path) || typeof path.bytes !== 'string') return undefined;
  const bytes = decodeBase64(path.bytes);
  if (!bytes?.length) return undefined;
  const { w, h } = thumbBox(document);
  return `data:image/svg+xml;utf8,${encodeURIComponent(pathBytesToSvg(bytes, w, h))}`;
}

export function customEmojiMediaUrl(
  document: Document,
  source?: { peerId?: string; messageId?: number },
): string {
  return buildMediaUrl({
    ...source,
    fileId: `d:${document.id}`,
    accessHash: document.accessHash,
    dcId: document.dcId,
    mimeType: document.mimeType,
    fileSize: Number(document.size),
  });
}

export interface CustomEmojiCellProps {
  document: Document;
  size: number;
  /** When set, full media starts only while the element intersects. */
  observe?: ObserveFn;
  /** Accessible name. Omitted when a parent control already names the emoji. */
  label?: string;
  className?: string;
  /**
   * Draw the blurry inline thumb (and the loading pulse) under the real emoji.
   * Turn off where the emoji sits on top of other content, e.g. the composer.
   */
  placeholder?: boolean;
  /** Message the document came from (message stickers), used to refresh file references. */
  peerId?: string;
  messageId?: number;
}

/**
 * One custom-emoji placeholder. Shows the inline thumb immediately.
 * Animated `.tgs` plays on the parent `CustomEmojiSurface` canvas, and only
 * after `observe` reports the cell is near the scroller. Without a surface
 * (the composer preview), this cell owns a small canvas of its own.
 */
export default function CustomEmojiCell({
  document,
  size,
  observe,
  label,
  className,
  placeholder = true,
  peerId,
  messageId,
}: CustomEmojiCellProps) {
  const surface = useCustomEmojiSurface();
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [playing, setPlaying] = useState(!observe);
  const [frameReady, setFrameReady] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const thumbRef = useRef<HTMLImageElement>(null);
  const animated = document.mimeType === 'application/x-tgsticker';
  const video = document.mimeType.startsWith('video/');
  const thumb = placeholder ? customEmojiThumb(document) : undefined;
  const playbackSrc = customEmojiMediaUrl(document, { peerId, messageId });
  const mediaUrl = playing && !animated ? playbackSrc : undefined;
  const loading = animated && playing && !frameReady;

  useEffect(() => {
    setMediaReady(false);
  }, [mediaUrl]);

  useEffect(() => {
    if (!observe) {
      setPlaying(true);
      return undefined;
    }
    if (!element) return undefined;
    return observe(element, () => {
      setPlaying(true);
    });
  }, [element, observe, document?.id]);

  useEffect(() => {
    if (!playing || !animated || !element) {
      setFrameReady(false);
      return undefined;
    }
    let ready = false;
    const markReady = () => {
      if (ready) return;
      ready = true;
      // Hide before the next paint so the outline does not blink under the first frames.
      if (thumbRef.current) thumbRef.current.hidden = true;
      setFrameReady(true);
    };
    if (surface) {
      return surface.register({
        documentId: document.id,
        src: playbackSrc,
        size,
        element,
        onReady: markReady,
      });
    }

    const canvas = window.document.createElement('canvas');
    canvas.className = 'absolute inset-0 h-full w-full';
    canvas.setAttribute('aria-hidden', 'true');
    element.appendChild(canvas);
    const retained = retainCustomEmoji({ documentId: document.id, src: playbackSrc, size });
    const draw = () => {
      const bitmap = retained.getBitmap();
      if (!bitmap) return;
      markReady();
      const dpr = window.devicePixelRatio || 1;
      const pixels = Math.max(1, Math.round(size * dpr));
      if (canvas.width !== pixels || canvas.height !== pixels) {
        canvas.width = pixels;
        canvas.height = pixels;
      }
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, pixels, pixels);
    };
    const unsubscribe = retained.subscribe(draw);
    return () => {
      unsubscribe();
      retained.release();
      canvas.remove();
    };
  }, [animated, document.id, element, playbackSrc, playing, size, surface]);

  return (
    <span
      ref={setElement}
      role={label ? 'img' : undefined}
      aria-label={label}
      className={cn('relative inline-block overflow-hidden align-text-bottom', className)}
      style={{ width: size, height: size }}
    >
      {thumb ? (
        <img
          ref={thumbRef}
          src={thumb}
          alt=""
          aria-hidden
          hidden={frameReady || mediaReady}
          className={cn(
            'absolute inset-0 h-full w-full object-contain',
            loading && 'animate-pulse',
          )}
        />
      ) : placeholder && loading ? (
        <span aria-hidden className="absolute inset-0 animate-pulse bg-muted" />
      ) : null}
      {playing && video && mediaUrl ? (
        <video
          src={mediaUrl}
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setMediaReady(true)}
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : null}
      {playing && !animated && !video && mediaUrl ? (
        <img
          src={mediaUrl}
          alt=""
          onLoad={() => setMediaReady(true)}
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : null}
    </span>
  );
}
