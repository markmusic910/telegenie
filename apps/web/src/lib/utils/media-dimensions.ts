import type { CSSProperties } from 'react';
import type { Document, TypePhotoSize } from '@telegenie/libs/foundation/telegram/types/file';

export const MIN_MEDIA_WIDTH = 140;
export const MAX_MEDIA_WIDTH = 420;
export const MIN_MEDIA_HEIGHT = 90;
export const MAX_MEDIA_HEIGHT = 420;
/** Telegram video-note diameter (`ROUND_VIDEO_DIMENSIONS_PX` in telegram-genie). */
export const ROUND_VIDEO_SIZE = 240;
/** Last-resort box when Telegram metadata has no width/height (telegram-genie uses 100×100). */
export const DEFAULT_MEDIA_DIMENSIONS = { width: 100, height: 100 };

const INLINE_PHOTO_SIZE_TYPES = ['x', 'y', 'w', 'm'] as const;

export type MediaDimensionsInput = {
  width?: number;
  height?: number;
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  minHeight?: number;
};

export type MediaDimensionsResult = {
  width: number;
  height: number;
  aspectRatio: number;
};

type SizedPhoto = TypePhotoSize & { w: number; h: number };

function isSizedPhoto(size: TypePhotoSize): size is SizedPhoto {
  return (
    'w' in size &&
    'h' in size &&
    typeof size.w === 'number' &&
    typeof size.h === 'number' &&
    size.w > 0 &&
    size.h > 0
  );
}

/**
 * Picks Telegram photo dimensions for inline display, matching telegram-genie:
 * prefer type `x` / `y` / `w` / `m` (true aspect ratio), then the largest remaining size.
 * Never uses the first thumbnail-only size, which can be a cropped square.
 */
export function getPhotoSourceDimensions(
  sizes?: TypePhotoSize[],
): { width: number; height: number } | undefined {
  if (!sizes?.length) return undefined;

  for (const type of INLINE_PHOTO_SIZE_TYPES) {
    const match = sizes.find((size) => size.type === type && isSizedPhoto(size));
    if (match && isSizedPhoto(match)) {
      return { width: match.w, height: match.h };
    }
  }

  let best: { width: number; height: number } | undefined;
  let bestArea = 0;
  for (const size of sizes) {
    if (!isSizedPhoto(size)) continue;
    const area = size.w * size.h;
    if (area > bestArea) {
      bestArea = area;
      best = { width: size.w, height: size.h };
    }
  }
  return best;
}

export function getDocumentSourceDimensions(
  document?: Document,
): { width: number; height: number } | undefined {
  const attr = document?.attributes?.find(
    (item): item is { w: number; h: number } =>
      typeof item === 'object' &&
      item !== null &&
      'w' in item &&
      'h' in item &&
      typeof (item as { w: unknown }).w === 'number' &&
      typeof (item as { h: unknown }).h === 'number' &&
      (item as { w: number }).w > 0 &&
      (item as { h: number }).h > 0,
  );
  if (!attr) return undefined;
  return { width: attr.w, height: attr.h };
}

/**
 * Calculates display dimensions for a photo or video while preserving its aspect ratio
 * and clamping to responsive chat bubble constraints.
 */
export function calculateMediaDimensions(params: MediaDimensionsInput): MediaDimensionsResult {
  const origW = params.width && params.width > 0 ? params.width : DEFAULT_MEDIA_DIMENSIONS.width;
  const origH = params.height && params.height > 0 ? params.height : DEFAULT_MEDIA_DIMENSIONS.height;
  const aspectRatio = origW / origH;

  const maxWidth = params.maxWidth ?? MAX_MEDIA_WIDTH;
  const maxHeight = params.maxHeight ?? MAX_MEDIA_HEIGHT;
  const minWidth = params.minWidth ?? MIN_MEDIA_WIDTH;
  const minHeight = params.minHeight ?? MIN_MEDIA_HEIGHT;

  let width = origW;
  let height = origH;

  if (width > maxWidth) {
    width = maxWidth;
    height = Math.round(width / aspectRatio);
  }

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspectRatio);
  }

  if (width < minWidth) {
    width = minWidth;
    height = Math.max(minHeight, Math.round(width / aspectRatio));
  }

  if (height < minHeight) {
    height = minHeight;
    width = Math.max(minWidth, Math.round(height * aspectRatio));
  }

  width = Math.min(width, maxWidth);
  height = Math.min(height, maxHeight);

  return { width, height, aspectRatio };
}

/** Inline box that cannot grow after the image/video bytes arrive. */
export function mediaBoxStyle(width: number, height: number): CSSProperties {
  return {
    width,
    height,
    aspectRatio: `${width} / ${height}`,
    flexShrink: 0,
  };
}

/** Standard sticker size in Telegram Desktop (192×192px box). */
export const STICKER_SIZE = 192;
export const MAX_STICKER_SIZE = 256;

/**
 * Calculates display dimensions for a sticker matching Telegram Desktop constraints
 * (max 192×192 maintaining aspect ratio).
 */
export function calculateStickerDimensions(params: {
  width?: number;
  height?: number;
  maxSize?: number;
}): MediaDimensionsResult {
  const origW = params.width && params.width > 0 ? params.width : 512;
  const origH = params.height && params.height > 0 ? params.height : 512;
  const aspectRatio = origW / origH;
  const max = params.maxSize ?? STICKER_SIZE;

  let width = origW;
  let height = origH;

  if (width >= height) {
    width = Math.min(width, max);
    height = Math.round(width / aspectRatio);
  } else {
    height = Math.min(height, max);
    width = Math.round(height * aspectRatio);
  }

  // Message stickers stay readable, but an explicit smaller maxSize (picker cells) wins.
  const min = Math.min(64, max);
  width = Math.max(min, width);
  height = Math.max(min, height);

  return { width, height, aspectRatio };
}
