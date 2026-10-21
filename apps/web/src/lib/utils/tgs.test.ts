import { DecompressionStream, ReadableStream } from 'node:stream/web';
import { TextDecoder } from 'node:util';
import { gzipSync } from 'zlib';
import { decodeTgs } from '@/lib/utils/tgs';

beforeAll(() => {
  Object.assign(globalThis, { DecompressionStream, ReadableStream, TextDecoder });
});

describe('decodeTgs', () => {
  it('gunzips a telegram animated sticker into lottie json', async () => {
    const animation = { v: '5.5.2', fr: 60, w: 512, h: 512, layers: [] };
    const gzipped = gzipSync(Buffer.from(JSON.stringify(animation)));
    const bytes = gzipped.buffer.slice(gzipped.byteOffset, gzipped.byteOffset + gzipped.byteLength);

    await expect(decodeTgs(bytes)).resolves.toEqual(animation);
  });

  it('accepts uncompressed lottie json', async () => {
    const animation = { v: '5.5.2', layers: [{ ty: 4 }] };
    const bytes = Uint8Array.from(Buffer.from(JSON.stringify(animation)));

    await expect(decodeTgs(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))).resolves.toEqual(
      animation,
    );
  });
});