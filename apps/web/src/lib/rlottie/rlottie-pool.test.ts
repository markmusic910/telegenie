import {
  customEmojiPixelSize,
  resetCustomEmojiPlayersForTests,
  retainCustomEmoji,
  setRLottieTransportForTests,
  type RLottieTransport,
} from '@/lib/rlottie/rlottie-pool';

describe('retainCustomEmoji', () => {
  const inits: string[] = [];
  const destroyed: string[] = [];

  const transport: RLottieTransport = {
    init: (key) => {
      inits.push(key);
      return Promise.resolve({ reduceFactor: 1, msPerFrame: 10_000, framesCount: 2 });
    },
    render: () => new Promise(() => undefined),
    destroy: (key) => {
      destroyed.push(key);
    },
  };

  beforeEach(() => {
    inits.length = 0;
    destroyed.length = 0;
    resetCustomEmojiPlayersForTests();
    setRLottieTransportForTests(transport);
  });

  afterEach(() => {
    resetCustomEmojiPlayersForTests();
    setRLottieTransportForTests(undefined);
  });

  it('starts one renderer for two views of the same document and size', async () => {
    const first = retainCustomEmoji({ documentId: '9', src: '/media/?a', size: 32 });
    const second = retainCustomEmoji({ documentId: '9', src: '/media/?a', size: 32 });
    await Promise.resolve();
    expect(inits).toEqual([`9:${customEmojiPixelSize(32)}`]);
    first.release();
    expect(destroyed).toEqual([]);
    second.release();
    expect(destroyed).toEqual([`9:${customEmojiPixelSize(32)}`]);
  });

  it('uses a separate renderer when the pixel size changes', async () => {
    const small = retainCustomEmoji({ documentId: '9', src: '/media/?a', size: 20 });
    const large = retainCustomEmoji({ documentId: '9', src: '/media/?a', size: 32 });
    await Promise.resolve();
    expect(inits).toEqual([
      `9:${customEmojiPixelSize(20)}`,
      `9:${customEmojiPixelSize(32)}`,
    ]);
    small.release();
    large.release();
    expect(destroyed).toEqual([
      `9:${customEmojiPixelSize(20)}`,
      `9:${customEmojiPixelSize(32)}`,
    ]);
  });
});
