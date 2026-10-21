import { Api } from '@telegenie/teleproto';
import { strippedPhotoToJpg } from '@telegenie/teleproto/Utils';

const DEFAULT_THUMB_SIZE = { w: 100, h: 100 };

export type ApiThumbnail = {
  dataUri: string;
  width: number;
  height: number;
};

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Convert binary bytes to a base64 data URI.
 * Mirrors telegram-genie's `bytesToDataUri`.
 */
export function bytesToDataUri(
  bytes: Uint8Array,
  shouldOmitPrefix = false,
  mimeType = 'image/jpeg',
): string {
  const prefix = shouldOmitPrefix ? '' : `data:${mimeType};base64,`;
  return `${prefix}${bytesToBase64(bytes)}`;
}

/**
 * Build a JPEG/webp data-URI thumbnail from Telegram stripped photo bytes
 * (e.g. `ChatPhoto.strippedThumb` / `UserProfilePhoto.strippedThumb`).
 */
export function buildStrippedThumbDataUri(
  stripped?: Uint8Array,
  mimeType = 'image/jpeg',
): string | undefined {
  if (!stripped || stripped.length === 0) {
    return undefined;
  }

  // GramJS `strippedPhotoToJpg` expects a Node Buffer; TL `bytes` are Buffers at runtime.
  const jpgBytes: Uint8Array =
    !mimeType || mimeType === 'image/jpeg'
      ? (strippedPhotoToJpg(
          stripped as unknown as Parameters<typeof strippedPhotoToJpg>[0],
        ) as Uint8Array)
      : stripped;

  return bytesToDataUri(jpgBytes, false, mimeType);
}

/**
 * Build an API thumbnail from a GramJS photo size list containing a
 * `PhotoStrippedSize`. Mirrors telegram-genie's `buildApiThumbnailFromStripped`.
 */
export function buildApiThumbnailFromStripped(
  sizes?: Api.TypePhotoSize[],
  mimeType?: string,
): ApiThumbnail | undefined {
  if (!sizes || !sizes.length) {
    return undefined;
  }

  const thumb = sizes.find(
    (s): s is Api.PhotoStrippedSize => s instanceof Api.PhotoStrippedSize,
  );
  if (!thumb) {
    return undefined;
  }

  const realSizes = sizes.filter(
    (s): s is Api.PhotoSize | Api.PhotoSizeProgressive =>
      s instanceof Api.PhotoSize || s instanceof Api.PhotoSizeProgressive,
  );
  const { w, h } = realSizes.length ? realSizes[realSizes.length - 1] : DEFAULT_THUMB_SIZE;
  const dataUri = buildStrippedThumbDataUri(thumb.bytes, mimeType ?? 'image/jpeg');
  if (!dataUri) {
    return undefined;
  }

  return {
    dataUri,
    width: w,
    height: h,
  };
}
