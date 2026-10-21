import { Api } from '@telegenie/teleproto';

import {
  buildApiThumbnailFromStripped,
  buildStrippedThumbDataUri,
  bytesToBase64,
  bytesToDataUri,
} from './thumbnail.converter';

/** Valid stripped-thumb payload: marker byte `1` + width/height bytes + jpeg body. */
const STRIPPED = Buffer.from([1, 10, 20, 0xaa, 0xbb, 0xcc]);

describe('bytesToBase64', () => {
  it('encodes a short buffer', () => {
    expect(bytesToBase64(new Uint8Array([104, 105]))).toBe('aGk=');
  });

  it('encodes an empty buffer', () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe('');
  });

  it('encodes across multiple 0x8000 chunks', () => {
    const bytes = new Uint8Array(0x8000 * 2 + 5).fill(65);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });
});

describe('bytesToDataUri', () => {
  it('prefixes with the default jpeg mime type', () => {
    expect(bytesToDataUri(new Uint8Array([104, 105]))).toBe('data:image/jpeg;base64,aGk=');
  });

  it('omits the prefix when requested', () => {
    expect(bytesToDataUri(new Uint8Array([104, 105]), true)).toBe('aGk=');
  });

  it('uses a custom mime type', () => {
    expect(bytesToDataUri(new Uint8Array([104, 105]), false, 'image/webp')).toBe(
      'data:image/webp;base64,aGk=',
    );
  });
});

describe('buildStrippedThumbDataUri', () => {
  it('returns undefined without bytes', () => {
    expect(buildStrippedThumbDataUri(undefined)).toBeUndefined();
  });

  it('returns undefined for empty bytes', () => {
    expect(buildStrippedThumbDataUri(new Uint8Array([]))).toBeUndefined();
  });

  it('expands stripped bytes into a jpeg data uri by default', () => {
    const uri = buildStrippedThumbDataUri(STRIPPED);
    expect(uri?.startsWith('data:image/jpeg;base64,')).toBe(true);
    // JPEG header expansion makes the payload much larger than the raw stripped bytes.
    expect(uri!.length).toBeGreaterThan(100);
  });

  it('treats an empty mime type as jpeg', () => {
    expect(buildStrippedThumbDataUri(STRIPPED, '')?.startsWith('data:;base64,')).toBe(true);
  });

  it('passes bytes through untouched for non-jpeg mime types', () => {
    expect(buildStrippedThumbDataUri(STRIPPED, 'image/webp')).toBe(
      `data:image/webp;base64,${Buffer.from(STRIPPED).toString('base64')}`,
    );
  });
});

describe('buildApiThumbnailFromStripped', () => {
  it('returns undefined without sizes', () => {
    expect(buildApiThumbnailFromStripped(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty size list', () => {
    expect(buildApiThumbnailFromStripped([])).toBeUndefined();
  });

  it('returns undefined when no stripped size is present', () => {
    const sizes = [new Api.PhotoSize({ type: 'm', w: 3, h: 4, size: 5 })];
    expect(buildApiThumbnailFromStripped(sizes)).toBeUndefined();
  });

  it('falls back to the default 100x100 size when only a stripped size exists', () => {
    const sizes = [new Api.PhotoStrippedSize({ type: 'i', bytes: STRIPPED })];
    expect(buildApiThumbnailFromStripped(sizes)).toMatchObject({ width: 100, height: 100 });
  });

  it('uses the last real size for dimensions', () => {
    const sizes = [
      new Api.PhotoStrippedSize({ type: 'i', bytes: STRIPPED }),
      new Api.PhotoSize({ type: 'm', w: 10, h: 20, size: 1 }),
      new Api.PhotoSizeProgressive({ type: 'y', w: 30, h: 40, sizes: [1, 2] }),
    ];
    expect(buildApiThumbnailFromStripped(sizes)).toMatchObject({ width: 30, height: 40 });
  });

  it('honours an explicit mime type', () => {
    const sizes = [new Api.PhotoStrippedSize({ type: 'i', bytes: STRIPPED })];
    const thumb = buildApiThumbnailFromStripped(sizes, 'image/webp');
    expect(thumb?.dataUri.startsWith('data:image/webp;base64,')).toBe(true);
  });

  it('returns undefined when the stripped payload is empty', () => {
    const sizes = [new Api.PhotoStrippedSize({ type: 'i', bytes: Buffer.alloc(0) })];
    expect(buildApiThumbnailFromStripped(sizes)).toBeUndefined();
  });
});
