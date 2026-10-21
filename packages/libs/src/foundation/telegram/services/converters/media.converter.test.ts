import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import {
  convertBytesToBase64,
  convertTypeDocumentAttribute,
  convertTypeDocumentSerializable,
  convertTypeInputStickerSet,
  convertTypeMaskCoords,
  convertTypePeerStoriesSerializable,
  convertTypePhotoSerializable,
  convertTypePhotoSize,
  convertTypeStoryItemLightweight,
  convertTypeVideoSize,
  convertTypeWebPage,
} from './media.converter';

const STRIPPED = Buffer.from([1, 10, 20, 0xaa, 0xbb]);
/** Any object that is not an instance of a known Api class hits the fallback arms. */
const unknown = { className: 'TotallyUnknown' } as any;

describe('convertBytesToBase64', () => {
  it.each([
    ['undefined', undefined, undefined],
    ['empty', new Uint8Array([]), undefined],
    ['bytes', new Uint8Array([104, 105]), 'aGk='],
  ])('handles %s input', (_label, input, expected) => {
    expect(convertBytesToBase64(input as Uint8Array | undefined)).toBe(expected);
  });
});

describe('convertTypeInputStickerSet', () => {
  it('returns undefined without a stickerset', () => {
    expect(convertTypeInputStickerSet(undefined)).toBeUndefined();
  });

  it('maps InputStickerSetEmpty to an empty marker', () => {
    expect(convertTypeInputStickerSet(new Api.InputStickerSetEmpty())).toEqual({});
  });

  it('maps InputStickerSetID', () => {
    const set = new Api.InputStickerSetID({ id: bigInt(7), accessHash: bigInt(8) });
    expect(convertTypeInputStickerSet(set)).toEqual({ id: '7', accessHash: '8' });
  });

  it('maps InputStickerSetShortName', () => {
    expect(convertTypeInputStickerSet(new Api.InputStickerSetShortName({ shortName: 'pack' }))).toEqual({
      shortName: 'pack',
    });
  });

  it('defaults a missing short name', () => {
    expect(convertTypeInputStickerSet(new Api.InputStickerSetShortName({} as any))).toEqual({
      shortName: '',
    });
  });

  it('maps InputStickerSetDice', () => {
    expect(convertTypeInputStickerSet(new Api.InputStickerSetDice({ emoticon: '🎲' }))).toEqual({
      emoticon: '🎲',
    });
  });

  it('defaults a missing dice emoticon', () => {
    expect(convertTypeInputStickerSet(new Api.InputStickerSetDice({} as any))).toEqual({
      emoticon: '',
    });
  });

  it('maps other empty marker variants to an empty object', () => {
    expect(convertTypeInputStickerSet(new Api.InputStickerSetAnimatedEmoji())).toEqual({});
  });
});

describe('convertTypeMaskCoords', () => {
  it('returns undefined without coords', () => {
    expect(convertTypeMaskCoords(undefined)).toBeUndefined();
  });

  it('maps MaskCoords', () => {
    const coords = new Api.MaskCoords({ n: 1, x: 0.5, y: 0.25, zoom: 2 });
    expect(convertTypeMaskCoords(coords)).toEqual({ n: 1, x: 0.5, y: 0.25, zoom: 2 });
  });

  it('defaults missing coord fields', () => {
    expect(convertTypeMaskCoords(new Api.MaskCoords({} as any))).toEqual({
      n: 0,
      x: 0,
      y: 0,
      zoom: 0,
    });
  });

  it('returns undefined for unknown coords', () => {
    expect(convertTypeMaskCoords(unknown)).toBeUndefined();
  });
});

describe('convertTypePhotoSize', () => {
  it('returns undefined without a size', () => {
    expect(convertTypePhotoSize(undefined)).toBeUndefined();
  });

  it('maps PhotoSizeEmpty', () => {
    expect(convertTypePhotoSize(new Api.PhotoSizeEmpty({ type: 'e' }))).toEqual({ type: 'e' });
  });

  it('maps PhotoSize', () => {
    const size = new Api.PhotoSize({ type: 'm', w: 1, h: 2, size: 3 });
    expect(convertTypePhotoSize(size)).toEqual({ type: 'm', w: 1, h: 2, size: 3 });
  });

  it('maps PhotoSizeProgressive', () => {
    const size = new Api.PhotoSizeProgressive({ type: 'y', w: 4, h: 5, sizes: [1, 2] });
    expect(convertTypePhotoSize(size)).toEqual({ type: 'y', w: 4, h: 5, sizes: [1, 2] });
  });

  it('maps PhotoCachedSize to a data uri', () => {
    const size = new Api.PhotoCachedSize({
      type: 'c',
      w: 6,
      h: 7,
      bytes: Buffer.from([104, 105]),
    });
    expect(convertTypePhotoSize(size)).toEqual({
      type: 'c',
      w: 6,
      h: 7,
      bytes: 'data:image/jpeg;base64,aGk=',
    });
  });

  it('maps PhotoStrippedSize', () => {
    const result = convertTypePhotoSize(
      new Api.PhotoStrippedSize({ type: 'i', bytes: STRIPPED }),
    ) as { type: string; bytes: string };
    expect(result.type).toBe('i');
    expect(result.bytes.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('maps PhotoStrippedSize with empty bytes to an empty string', () => {
    expect(
      convertTypePhotoSize(new Api.PhotoStrippedSize({ type: 'i', bytes: Buffer.alloc(0) })),
    ).toEqual({ type: 'i', bytes: '' });
  });

  it('maps PhotoPathSize to plain base64', () => {
    const size = new Api.PhotoPathSize({ type: 'j', bytes: Buffer.from([104, 105]) });
    expect(convertTypePhotoSize(size)).toEqual({ type: 'j', bytes: 'aGk=' });
  });

  it('maps PhotoPathSize with empty bytes to an empty string', () => {
    const size = new Api.PhotoPathSize({ type: 'j', bytes: Buffer.alloc(0) });
    expect(convertTypePhotoSize(size)).toEqual({ type: 'j', bytes: '' });
  });

  it('defaults missing size fields', () => {
    expect(convertTypePhotoSize(new Api.PhotoSize({} as any))).toEqual({
      type: '',
      w: 0,
      h: 0,
      size: 0,
    });
    expect(
      convertTypePhotoSize(new Api.PhotoCachedSize({ bytes: Buffer.from([104, 105]) } as any)),
    ).toEqual({ type: '', w: 0, h: 0, bytes: 'data:image/jpeg;base64,aGk=' });
    expect(convertTypePhotoSize(new Api.PhotoStrippedSize({ bytes: STRIPPED } as any))).toMatchObject(
      { type: '' },
    );
    expect(
      convertTypePhotoSize(new Api.PhotoPathSize({ bytes: Buffer.from([104, 105]) } as any)),
    ).toEqual({ type: '', bytes: 'aGk=' });
    expect(convertTypePhotoSize(new Api.PhotoSizeEmpty({} as any))).toEqual({ type: '' });
    expect(convertTypePhotoSize(new Api.PhotoSizeProgressive({} as any))).toEqual({
      type: '',
      w: 0,
      h: 0,
      sizes: [],
    });
  });

  it('returns undefined for an unknown size', () => {
    expect(convertTypePhotoSize(unknown)).toBeUndefined();
  });
});

describe('convertTypeVideoSize', () => {
  it('returns undefined without a video size', () => {
    expect(convertTypeVideoSize(undefined)).toBeUndefined();
  });

  it('maps VideoSize', () => {
    const size = new Api.VideoSize({ type: 'v', w: 1, h: 2, size: 3, videoStartTs: 4 });
    expect(convertTypeVideoSize(size)).toEqual({
      type: 'v',
      w: 1,
      h: 2,
      size: 3,
      videoStartTs: 4,
    });
  });

  it('defaults missing VideoSize fields', () => {
    expect(convertTypeVideoSize(new Api.VideoSize({} as any))).toEqual({
      type: '',
      w: 0,
      h: 0,
      size: 0,
      videoStartTs: undefined,
    });
  });

  it('maps VideoSizeEmojiMarkup', () => {
    const size = new Api.VideoSizeEmojiMarkup({
      emojiId: bigInt(99),
      backgroundColors: [1, 2],
    });
    expect(convertTypeVideoSize(size)).toEqual({ emojiId: '99', backgroundColors: [1, 2] });
  });

  it('defaults missing emoji markup colors', () => {
    const size = new Api.VideoSizeEmojiMarkup({ emojiId: bigInt(99) } as any);
    expect(convertTypeVideoSize(size)).toEqual({ emojiId: '99', backgroundColors: [] });
  });

  it('maps VideoSizeStickerMarkup', () => {
    const size = new Api.VideoSizeStickerMarkup({
      stickerset: new Api.InputStickerSetShortName({ shortName: 'pack' }),
      stickerId: bigInt(5),
      backgroundColors: [3],
    });
    expect(convertTypeVideoSize(size)).toEqual({
      stickerset: { shortName: 'pack' },
      stickerId: '5',
      backgroundColors: [3],
    });
  });

  it('defaults missing sticker markup colors', () => {
    const size = new Api.VideoSizeStickerMarkup({
      stickerset: new Api.InputStickerSetEmpty(),
      stickerId: bigInt(5),
    } as any);
    expect(convertTypeVideoSize(size)).toEqual({
      stickerset: {},
      stickerId: '5',
      backgroundColors: [],
    });
  });

  it('returns undefined for an unknown video size', () => {
    expect(convertTypeVideoSize(unknown)).toBeUndefined();
  });
});

describe('convertTypeDocumentAttribute', () => {
  it('returns undefined without an attribute', () => {
    expect(convertTypeDocumentAttribute(undefined)).toBeUndefined();
  });

  it('maps DocumentAttributeImageSize', () => {
    expect(
      convertTypeDocumentAttribute(new Api.DocumentAttributeImageSize({ w: 1, h: 2 })),
    ).toEqual({ w: 1, h: 2 });
  });

  it('defaults missing image size fields', () => {
    expect(convertTypeDocumentAttribute(new Api.DocumentAttributeImageSize({} as any))).toEqual({
      w: 0,
      h: 0,
    });
  });

  it('maps DocumentAttributeAnimated to an empty marker', () => {
    expect(convertTypeDocumentAttribute(new Api.DocumentAttributeAnimated())).toEqual({});
  });

  it('maps DocumentAttributeHasStickers to an empty marker', () => {
    expect(convertTypeDocumentAttribute(new Api.DocumentAttributeHasStickers())).toEqual({});
  });

  it('maps DocumentAttributeFilename', () => {
    expect(
      convertTypeDocumentAttribute(new Api.DocumentAttributeFilename({ fileName: 'a.png' })),
    ).toEqual({ fileName: 'a.png' });
  });

  it('defaults a missing file name', () => {
    expect(convertTypeDocumentAttribute(new Api.DocumentAttributeFilename({} as any))).toEqual({
      fileName: '',
    });
  });

  it('maps DocumentAttributeSticker', () => {
    const attr = new Api.DocumentAttributeSticker({
      mask: true,
      alt: '😀',
      stickerset: new Api.InputStickerSetShortName({ shortName: 'pack' }),
      maskCoords: new Api.MaskCoords({ n: 1, x: 2, y: 3, zoom: 4 }),
    });
    expect(convertTypeDocumentAttribute(attr)).toEqual({
      mask: true,
      alt: '😀',
      stickerset: { shortName: 'pack' },
      maskCoords: { n: 1, x: 2, y: 3, zoom: 4 },
    });
  });

  it('defaults missing sticker fields', () => {
    const attr = new Api.DocumentAttributeSticker({
      stickerset: new Api.InputStickerSetEmpty(),
    } as any);
    expect(convertTypeDocumentAttribute(attr)).toEqual({
      mask: false,
      alt: '',
      stickerset: {},
      maskCoords: undefined,
    });
  });

  it('maps DocumentAttributeCustomEmoji', () => {
    const attr = new Api.DocumentAttributeCustomEmoji({
      free: true,
      textColor: true,
      alt: '🔥',
      stickerset: new Api.InputStickerSetEmpty(),
    });
    expect(convertTypeDocumentAttribute(attr)).toEqual({
      free: true,
      textColor: true,
      alt: '🔥',
      stickerset: {},
    });
  });

  it('defaults missing custom emoji fields', () => {
    const attr = new Api.DocumentAttributeCustomEmoji({
      stickerset: new Api.InputStickerSetEmpty(),
    } as any);
    expect(convertTypeDocumentAttribute(attr)).toEqual({
      free: false,
      textColor: false,
      alt: '',
      stickerset: {},
    });
  });

  it('maps DocumentAttributeAudio', () => {
    const attr = new Api.DocumentAttributeAudio({
      voice: true,
      duration: 12,
      title: 'song',
      performer: 'band',
      waveform: Buffer.from([104, 105]),
    });
    expect(convertTypeDocumentAttribute(attr)).toEqual({
      voice: true,
      duration: 12,
      title: 'song',
      performer: 'band',
      waveform: 'aGk=',
    });
  });

  it('defaults missing audio fields', () => {
    expect(convertTypeDocumentAttribute(new Api.DocumentAttributeAudio({} as any))).toEqual({
      voice: false,
      duration: 0,
      title: undefined,
      performer: undefined,
      waveform: undefined,
    });
  });

  it('maps DocumentAttributeVideo', () => {
    const attr = new Api.DocumentAttributeVideo({
      roundMessage: true,
      supportsStreaming: true,
      nosound: true,
      duration: 3,
      w: 4,
      h: 5,
      preloadPrefixSize: 6,
      videoStartTs: 7,
      videoCodec: 'h264',
    });
    expect(convertTypeDocumentAttribute(attr)).toEqual({
      roundMessage: true,
      supportsStreaming: true,
      nosound: true,
      duration: 3,
      w: 4,
      h: 5,
      preloadPrefixSize: 6,
      videoStartTs: 7,
      videoCodec: 'h264',
    });
  });

  it('defaults missing video fields', () => {
    expect(convertTypeDocumentAttribute(new Api.DocumentAttributeVideo({} as any))).toMatchObject({
      roundMessage: false,
      supportsStreaming: false,
      nosound: false,
      duration: 0,
      w: 0,
      h: 0,
    });
  });

  it('returns undefined for an unknown attribute', () => {
    expect(convertTypeDocumentAttribute(unknown)).toBeUndefined();
  });
});

describe('convertTypePhotoSerializable', () => {
  it('returns undefined without a photo', () => {
    expect(convertTypePhotoSerializable(undefined)).toBeUndefined();
  });

  it('returns undefined for PhotoEmpty', () => {
    expect(convertTypePhotoSerializable(new Api.PhotoEmpty({ id: bigInt(1) }))).toBeUndefined();
  });

  it('maps a full photo', () => {
    const photo = new Api.Photo({
      hasStickers: true,
      id: bigInt(11),
      accessHash: bigInt(12),
      fileReference: Buffer.from([104, 105]),
      date: 42,
      sizes: [
        new Api.PhotoSize({ type: 'm', w: 1, h: 2, size: 3 }),
        unknown as Api.TypePhotoSize,
      ],
      videoSizes: [new Api.VideoSize({ type: 'v', w: 1, h: 2, size: 3 })],
      dcId: 4,
    });
    expect(convertTypePhotoSerializable(photo)).toEqual({
      hasStickers: true,
      id: '11',
      accessHash: '12',
      fileReference: 'aGk=',
      date: 42,
      sizes: [{ type: 'm', w: 1, h: 2, size: 3 }],
      videoSizes: [{ type: 'v', w: 1, h: 2, size: 3, videoStartTs: undefined }],
      dcId: 4,
    });
  });

  it('defaults missing photo fields', () => {
    const photo = new Api.Photo({
      id: bigInt(11),
      accessHash: bigInt(12),
    } as any);
    expect(convertTypePhotoSerializable(photo)).toEqual({
      hasStickers: false,
      id: '11',
      accessHash: '12',
      fileReference: '',
      date: 0,
      sizes: [],
      videoSizes: undefined,
      dcId: 0,
    });
  });

  it('returns undefined for an unknown photo', () => {
    expect(convertTypePhotoSerializable(unknown)).toBeUndefined();
  });
});

describe('convertTypeDocumentSerializable', () => {
  it('returns undefined without a document', () => {
    expect(convertTypeDocumentSerializable(undefined)).toBeUndefined();
  });

  it('maps DocumentEmpty to an id-only shape', () => {
    expect(convertTypeDocumentSerializable(new Api.DocumentEmpty({ id: bigInt(5) }))).toEqual({
      id: '5',
    });
  });

  it('maps a full document', () => {
    const document = new Api.Document({
      id: bigInt(1),
      accessHash: bigInt(2),
      fileReference: Buffer.from([104, 105]),
      date: 3,
      mimeType: 'image/png',
      size: bigInt(1024),
      thumbs: [new Api.PhotoSize({ type: 'm', w: 1, h: 2, size: 3 })],
      videoThumbs: [new Api.VideoSize({ type: 'v', w: 1, h: 2, size: 3 })],
      dcId: 4,
      attributes: [new Api.DocumentAttributeFilename({ fileName: 'a.png' }), unknown],
    });
    expect(convertTypeDocumentSerializable(document)).toEqual({
      id: '1',
      accessHash: '2',
      fileReference: 'aGk=',
      date: 3,
      mimeType: 'image/png',
      size: '1024',
      thumbs: [{ type: 'm', w: 1, h: 2, size: 3 }],
      videoThumbs: [{ type: 'v', w: 1, h: 2, size: 3, videoStartTs: undefined }],
      dcId: 4,
      attributes: [{ fileName: 'a.png' }],
    });
  });

  it('defaults missing document fields', () => {
    const document = new Api.Document({ id: bigInt(1), accessHash: bigInt(2) } as any);
    expect(convertTypeDocumentSerializable(document)).toEqual({
      id: '1',
      accessHash: '2',
      fileReference: '',
      date: 0,
      mimeType: '',
      size: '0',
      thumbs: undefined,
      videoThumbs: undefined,
      dcId: 0,
      attributes: [],
    });
  });

  it('returns undefined for an unknown document', () => {
    expect(convertTypeDocumentSerializable(unknown)).toBeUndefined();
  });
});

describe('convertTypeStoryItemLightweight', () => {
  it('returns undefined without an item', () => {
    expect(convertTypeStoryItemLightweight(undefined)).toBeUndefined();
  });

  it('maps StoryItemDeleted', () => {
    expect(convertTypeStoryItemLightweight(new Api.StoryItemDeleted({ id: 3 }))).toEqual({ id: 3 });
  });

  it('maps StoryItemSkipped', () => {
    const item = new Api.StoryItemSkipped({
      closeFriends: true,
      id: 4,
      date: 5,
      expireDate: 6,
    });
    expect(convertTypeStoryItemLightweight(item)).toEqual({
      closeFriends: true,
      id: 4,
      date: 5,
      expireDate: 6,
    });
  });

  it('defaults missing skipped fields', () => {
    expect(convertTypeStoryItemLightweight(new Api.StoryItemSkipped({ id: 4 } as any))).toEqual({
      closeFriends: false,
      id: 4,
      date: 0,
      expireDate: 0,
    });
  });

  it('maps StoryItem metadata and omits media', () => {
    const item = new Api.StoryItem({
      pinned: true,
      public: true,
      closeFriends: true,
      min: true,
      noforwards: true,
      edited: true,
      contacts: true,
      selectedContacts: true,
      out: true,
      id: 7,
      date: 8,
      fromId: new Api.PeerUser({ userId: bigInt(9) }),
      expireDate: 10,
      caption: 'hello',
      media: new Api.MessageMediaEmpty(),
    } as any);
    expect(convertTypeStoryItemLightweight(item)).toEqual({
      pinned: true,
      public: true,
      closeFriends: true,
      min: true,
      noforwards: true,
      edited: true,
      contacts: true,
      selectedContacts: true,
      out: true,
      id: 7,
      date: 8,
      fromId: { userId: '9' },
      expireDate: 10,
      caption: 'hello',
      media: undefined,
    });
  });

  it('defaults missing StoryItem fields', () => {
    const item = new Api.StoryItem({ id: 7 } as any);
    expect(convertTypeStoryItemLightweight(item)).toMatchObject({
      pinned: false,
      public: false,
      min: false,
      out: false,
      id: 7,
      date: 0,
      fromId: undefined,
      expireDate: 0,
    });
  });

  it('returns undefined for an unknown story item', () => {
    expect(convertTypeStoryItemLightweight(unknown)).toBeUndefined();
  });
});

describe('convertTypePeerStoriesSerializable', () => {
  it('returns undefined without stories', () => {
    expect(convertTypePeerStoriesSerializable(undefined)).toBeUndefined();
  });

  it('maps PeerStories and drops unconvertible items', () => {
    const stories = new Api.PeerStories({
      peer: new Api.PeerChannel({ channelId: bigInt(5) }),
      maxReadId: 3,
      stories: [new Api.StoryItemDeleted({ id: 1 }), unknown],
    });
    expect(convertTypePeerStoriesSerializable(stories)).toEqual({
      peer: { channelId: '-1000000000005' },
      maxReadId: 3,
      stories: [{ id: 1 }],
    });
  });

  it('defaults missing PeerStories fields', () => {
    const stories = new Api.PeerStories({
      peer: new Api.PeerChat({ chatId: bigInt(2) }),
    } as any);
    expect(convertTypePeerStoriesSerializable(stories)).toEqual({
      peer: { chatId: '-2' },
      maxReadId: 0,
      stories: [],
    });
  });

  it('returns undefined for unknown stories', () => {
    expect(convertTypePeerStoriesSerializable(unknown)).toBeUndefined();
  });
});

describe('convertTypeWebPage', () => {
  it('converts WebPage with JSON-safe photo ids', () => {
    const webpage = new Api.WebPage({
      id: bigInt(99),
      url: 'https://t.me/tailwindcss_tips',
      displayUrl: 't.me/tailwindcss_tips',
      hash: 0,
      siteName: 'Telegram',
      title: 'Tailwind CSS Tips',
      photo: new Api.Photo({
        id: bigInt(50),
        accessHash: bigInt(51),
        fileReference: Buffer.from([104, 105]),
        date: 1,
        sizes: [],
        dcId: 2,
      }),
    });

    expect(convertTypeWebPage(webpage)).toEqual({
      hasLargeMedia: undefined,
      id: '99',
      url: 'https://t.me/tailwindcss_tips',
      displayUrl: 't.me/tailwindcss_tips',
      hash: 0,
      type: undefined,
      siteName: 'Telegram',
      title: 'Tailwind CSS Tips',
      description: undefined,
      photo: {
        hasStickers: false,
        id: '50',
        accessHash: '51',
        fileReference: 'aGk=',
        date: 1,
        sizes: [],
        videoSizes: undefined,
        dcId: 2,
      },
      embedUrl: undefined,
      embedType: undefined,
      embedWidth: undefined,
      embedHeight: undefined,
      duration: undefined,
      author: undefined,
      document: undefined,
    });
  });
});
