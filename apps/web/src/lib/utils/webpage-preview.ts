import type { MessageMediaWebPage } from '@telegenie/libs/foundation/telegram/types/api-types';
import type { Document, Photo } from '@telegenie/libs/foundation/telegram/types/file';

function isDataUri(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

function fileRefValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value || undefined;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'object' && 'toString' in value) {
    const serialized = (value as { toString(): string }).toString();
    return serialized && serialized !== '[object Object]' ? serialized : undefined;
  }
  return undefined;
}

function isRealPhoto(photo: unknown): photo is Photo {
  return Boolean(
    photo &&
      typeof photo === 'object' &&
      'id' in photo &&
      'accessHash' in photo &&
      Boolean(fileRefValue((photo as { accessHash?: unknown }).accessHash)),
  );
}

function isRealDocument(document: unknown): document is Document {
  return Boolean(
    document &&
      typeof document === 'object' &&
      'accessHash' in document &&
      Boolean(fileRefValue((document as { accessHash?: unknown }).accessHash)),
  );
}

function thumbUriFromPhoto(photo: Photo | undefined): string | undefined {
  if (!photo?.sizes) return undefined;
  for (const size of photo.sizes) {
    if (size && typeof size === 'object' && 'bytes' in size && isDataUri(size.bytes)) {
      return size.bytes;
    }
  }
  return undefined;
}

export function webpageHasPreviewData(media: MessageMediaWebPage): boolean {
  const webpage = media.webpage;
  if (!webpage) return false;

  if (webpage.title?.trim()) return true;
  if (webpage.description?.trim()) return true;
  if (webpage.siteName?.trim()) return true;
  if (webpage.author?.trim()) return true;
  if (webpage.embedUrl?.trim()) return true;

  const photo = isRealPhoto(webpage.photo) ? webpage.photo : undefined;
  if (photo) return true;
  if (thumbUriFromPhoto(photo)) return true;

  return isRealDocument(webpage.document);
}

export { fileRefValue, isRealDocument, isRealPhoto, thumbUriFromPhoto };
