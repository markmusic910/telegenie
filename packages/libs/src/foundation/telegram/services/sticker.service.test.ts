import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';
import { gzipSync } from 'node:zlib';
import { StickerService } from './sticker.service';

function installedSet(overrides: Partial<ConstructorParameters<typeof Api.StickerSet>[0]> = {}) {
  return new Api.StickerSet({
    id: bigInt(10),
    accessHash: bigInt(20),
    title: 'Duck',
    shortName: 'duck',
    count: 1,
    hash: 1,
    ...overrides,
  });
}

function coverDocument() {
  return new Api.Document({
    id: bigInt(7),
    accessHash: bigInt(8),
    fileReference: Buffer.from([1]),
    date: 1,
    mimeType: 'image/webp',
    size: bigInt(100),
    dcId: 2,
    attributes: [
      new Api.DocumentAttributeSticker({
        alt: '🦆',
        stickerset: new Api.InputStickerSetEmpty(),
      } as ConstructorParameters<typeof Api.DocumentAttributeSticker>[0]),
    ],
    thumbs: [
      new Api.PhotoCachedSize({
        type: 's',
        w: 40,
        h: 40,
        bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      }),
    ],
  });
}

describe('StickerService sticker set covers', () => {
  it('uses the cover document when the set has no image thumb', async () => {
    const invoke = jest.fn(async (request: { className?: string }) => {
      if (request instanceof Api.messages.GetAllStickers) {
        return new Api.messages.AllStickers({
          hash: bigInt(0),
          sets: [installedSet()],
        });
      }
      if (request instanceof Api.messages.GetStickerSet) {
        return new Api.messages.StickerSet({
          set: installedSet(),
          packs: [],
          keywords: [],
          documents: [coverDocument()],
        });
      }
      throw new Error(`unexpected ${request.className}`);
    });
    const service = new StickerService({
      transportService: { client: { invoke, downloadFile: jest.fn() } } as never,
    });

    const sets = await service.getInstalledSets();

    expect(sets).toHaveLength(1);
    expect(sets[0]?.thumbDataUri?.startsWith('data:image/jpeg')).toBe(true);
    const contents = await service.getSet('10', '20');
    expect(contents.documents).toHaveLength(1);
    expect(contents.documents[0]?.mimeType).toBe('image/webp');
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('downloads the cover sticker thumb when the document has no inline image', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const downloadFile = jest.fn(async () => jpeg);
    const invoke = jest.fn(async (request: { className?: string }) => {
      if (request instanceof Api.messages.GetAllStickers) {
        return new Api.messages.AllStickers({
          hash: bigInt(0),
          sets: [installedSet()],
        });
      }
      if (request instanceof Api.messages.GetStickerSet) {
        return new Api.messages.StickerSet({
          set: installedSet(),
          packs: [],
          keywords: [],
          documents: [
            new Api.Document({
              id: bigInt(7),
              accessHash: bigInt(8),
              fileReference: Buffer.from([1]),
              date: 1,
              mimeType: 'application/x-tgsticker',
              size: bigInt(100),
              dcId: 2,
              thumbs: [new Api.PhotoSize({ type: 'm', w: 128, h: 128, size: 400 })],
            }),
          ],
        });
      }
      throw new Error(`unexpected ${request.className}`);
    });
    const service = new StickerService({
      transportService: { client: { invoke, downloadFile } } as never,
    });

    const sets = await service.getInstalledSets();

    expect(sets[0]?.thumbDataUri?.startsWith('data:image/jpeg')).toBe(true);
    expect(downloadFile.mock.calls[0]?.[0]).toBeInstanceOf(Api.InputDocumentFileLocation);
    expect(downloadFile.mock.calls[0]?.[0].thumbSize).toBe('m');
  });

  it('keeps a gzip-compressed image thumb and skips getStickerSet', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const downloadFile = jest.fn(async () => gzipSync(jpeg));
    const invoke = jest.fn(async (request: { className?: string }) => {
      if (request instanceof Api.messages.GetAllStickers) {
        return new Api.messages.AllStickers({
          hash: bigInt(0),
          sets: [installedSet({ thumbVersion: 3, thumbDcId: 2 })],
        });
      }
      throw new Error(`unexpected ${request.className}`);
    });
    const service = new StickerService({
      transportService: { client: { invoke, downloadFile } } as never,
    });

    const sets = await service.getInstalledSets();

    expect(downloadFile).toHaveBeenCalledTimes(1);
    expect(sets[0]?.thumbDataUri?.startsWith('data:image/jpeg')).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe('StickerService picker catalog', () => {
  function service(invoke: jest.Mock) {
    return new StickerService({
      transportService: { client: { invoke, downloadFile: jest.fn() } } as never,
    });
  }

  it('returns recent sticker documents and clears them', async () => {
    const invoke = jest.fn(async (request: { className?: string }) => {
      if (request instanceof Api.messages.GetRecentStickers) {
        return new Api.messages.RecentStickers({
          hash: bigInt(0),
          packs: [],
          stickers: [coverDocument()],
          dates: [1],
        });
      }
      if (request instanceof Api.messages.ClearRecentStickers) return true;
      throw new Error(`unexpected ${request.className}`);
    });
    const stickers = service(invoke);

    await expect(stickers.getRecentStickers()).resolves.toHaveLength(1);
    const recent = invoke.mock.calls[0][0] as Api.messages.GetRecentStickers;
    expect(recent.attached).toBeUndefined();
    await stickers.clearRecentStickers();
    expect(invoke.mock.calls[1][0]).toBeInstanceOf(Api.messages.ClearRecentStickers);
  });

  it('returns featured covers that are not already installed', async () => {
    const invoke = jest.fn(async (request: { className?: string }) => {
      if (request instanceof Api.messages.GetAllStickers) {
        return new Api.messages.AllStickers({ hash: bigInt(0), sets: [installedSet()] });
      }
      if (request instanceof Api.messages.GetFeaturedStickers) {
        return new Api.messages.FeaturedStickers({
          hash: bigInt(0),
          count: 2,
          sets: [
            new Api.StickerSetCovered({ set: installedSet(), cover: coverDocument() }),
            new Api.StickerSetCovered({
              set: installedSet({ id: bigInt(11), title: 'New' }),
              cover: coverDocument(),
            }),
          ],
          unread: [],
        });
      }
      throw new Error(`unexpected ${request.className}`);
    });

    const sets = await service(invoke).getFeaturedSets('stickers');

    expect(sets.map((set) => set.id)).toEqual(['11']);
    expect(sets[0]?.title).toBe('New');
    expect(sets[0]?.cover?.id).toBe('7');
    expect(sets[0]?.thumbDataUri?.startsWith('data:image/jpeg')).toBe(true);
  });

  it('returns installed emoji sets from getEmojiStickers', async () => {
    const invoke = jest.fn(async (request: { className?: string }) => {
      if (request instanceof Api.messages.GetEmojiStickers) {
        return new Api.messages.AllStickers({
          hash: bigInt(0),
          sets: [installedSet({ id: bigInt(11), title: 'Cats', emojis: true })],
        });
      }
      throw new Error(`unexpected ${request.className}`);
    });

    const sets = await service(invoke).getInstalledEmojiSets();

    expect(sets.map((set) => set.id)).toEqual(['11']);
    expect(sets[0]?.title).toBe('Cats');
    expect(invoke.mock.calls[0][0]).toBeInstanceOf(Api.messages.GetEmojiStickers);
  });

  it('omits a featured emoji set that is already installed', async () => {
    const invoke = jest.fn(async (request: { className?: string }) => {
      if (request instanceof Api.messages.GetEmojiStickers) {
        return new Api.messages.AllStickers({
          hash: bigInt(0),
          sets: [installedSet({ id: bigInt(11), title: 'Cats', emojis: true })],
        });
      }
      if (request instanceof Api.messages.GetFeaturedEmojiStickers) {
        return new Api.messages.FeaturedStickers({
          hash: bigInt(0),
          count: 1,
          sets: [
            new Api.StickerSetCovered({
              set: installedSet({ id: bigInt(11), title: 'Cats', emojis: true }),
              cover: coverDocument(),
            }),
          ],
          unread: [],
        });
      }
      throw new Error(`unexpected ${request.className}`);
    });

    await expect(service(invoke).getFeaturedSets('emoji')).resolves.toEqual([]);
  });

  it('installs a set and searches stickers', async () => {
    const invoke = jest.fn(async (request: { className?: string }) => {
      if (request instanceof Api.messages.InstallStickerSet) {
        return new Api.messages.StickerSetInstallResultSuccess();
      }
      if (request instanceof Api.messages.SearchStickers) {
        return new Api.messages.FoundStickers({
          hash: bigInt(0),
          stickers: [coverDocument()],
        });
      }
      throw new Error(`unexpected ${request.className}`);
    });
    const stickers = service(invoke);

    await stickers.installSet('11', '22');
    const install = invoke.mock.calls[0][0] as Api.messages.InstallStickerSet;
    expect(install).toBeInstanceOf(Api.messages.InstallStickerSet);
    expect(install.stickerset).toBeInstanceOf(Api.InputStickerSetID);
    expect(String((install.stickerset as Api.InputStickerSetID).id)).toBe('11');

    const found = await stickers.searchStickers('duck');
    expect(found).toHaveLength(1);
    const search = invoke.mock.calls[1][0] as Api.messages.SearchStickers;
    expect(search.q).toBe('duck');
    expect(search.emojis).toBe(false);

    const emoji = await stickers.searchEmoji('test');
    expect(emoji).toHaveLength(1);
    const emojiSearch = invoke.mock.calls[2][0] as Api.messages.SearchStickers;
    expect(emojiSearch.q).toBe('test');
    expect(emojiSearch.emojis).toBe(true);
  });

  it('returns saved GIFs and GIF search hits', async () => {
    const invoke = jest.fn(async (request: { className?: string }) => {
      if (request instanceof Api.messages.GetSavedGifs) {
        return new Api.messages.SavedGifs({ hash: bigInt(0), gifs: [coverDocument()] });
      }
      if (request instanceof Api.contacts.ResolveUsername) {
        return new Api.contacts.ResolvedPeer({
          peer: new Api.PeerUser({ userId: bigInt(5) }),
          chats: [],
          users: [
            new Api.User({
              id: bigInt(5),
              accessHash: bigInt(6),
              firstName: 'GIF',
              bot: true,
            } as never),
          ],
        });
      }
      if (request instanceof Api.messages.GetInlineBotResults) {
        return new Api.messages.BotResults({
          queryId: bigInt(99),
          results: [
            new Api.BotInlineResult({
              id: 'hit',
              type: 'gif',
              thumb: new Api.WebDocument({
                url: 'https://example.test/t.jpg',
                accessHash: bigInt(1),
                size: 10,
                mimeType: 'image/jpeg',
                attributes: [],
              }),
              sendMessage: new Api.BotInlineMessageMediaAuto({ message: '' }),
            }),
          ],
          cacheTime: 0,
          users: [],
        });
      }
      throw new Error(`unexpected ${request.className}`);
    });
    const stickers = service(invoke);
    const peer = new Api.InputPeerUser({ userId: bigInt(7), accessHash: bigInt(1) });

    await expect(stickers.getSavedGifs()).resolves.toHaveLength(1);
    const hits = await stickers.searchGifs(peer, 'cat');
    expect(hits).toEqual([{ queryId: '99', id: 'hit', thumbUrl: 'https://example.test/t.jpg' }]);
    const inline = invoke.mock.calls.find(
      (call) => call[0] instanceof Api.messages.GetInlineBotResults,
    )?.[0] as Api.messages.GetInlineBotResults;
    expect(inline.query).toBe('cat');
    expect(inline.bot).toBeInstanceOf(Api.InputUser);
  });

  it('uses the set thumbnail when a featured emoji set has no cover document', async () => {
    const invoke = jest.fn(async (request: { className?: string }) => {
      if (
        request instanceof Api.messages.GetAllStickers ||
        request instanceof Api.messages.GetEmojiStickers
      ) {
        return new Api.messages.AllStickers({ hash: bigInt(0), sets: [] });
      }
      if (request instanceof Api.messages.GetFeaturedEmojiStickers) {
        return new Api.messages.FeaturedStickers({
          hash: bigInt(0),
          count: 1,
          sets: [
            new Api.StickerSetNoCovered({
              set: installedSet({
                id: bigInt(11),
                title: 'Cats',
                emojis: true,
                thumbs: [
                  new Api.PhotoCachedSize({
                    type: 's',
                    w: 40,
                    h: 40,
                    bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
                  }),
                ],
              }),
            }),
          ],
          unread: [],
        });
      }
      throw new Error(`unexpected ${request.className}`);
    });

    const sets = await service(invoke).getFeaturedSets('emoji');

    expect(sets).toHaveLength(1);
    expect(sets[0]?.cover).toBeUndefined();
    expect(sets[0]?.thumbDataUri?.startsWith('data:image/jpeg')).toBe(true);
  });

  it('loads the cover document when a featured set only has a static thumb', async () => {
    const invoke = jest.fn(async (request: { className?: string }) => {
      if (
        request instanceof Api.messages.GetAllStickers ||
        request instanceof Api.messages.GetEmojiStickers
      ) {
        return new Api.messages.AllStickers({ hash: bigInt(0), sets: [] });
      }
      if (request instanceof Api.messages.GetFeaturedEmojiStickers) {
        return new Api.messages.FeaturedStickers({
          hash: bigInt(0),
          count: 1,
          sets: [
            new Api.StickerSetNoCovered({
              set: installedSet({
                id: bigInt(11),
                title: 'Animated',
                emojis: true,
                thumbDocumentId: bigInt(7),
                thumbs: [
                  new Api.PhotoCachedSize({
                    type: 's',
                    w: 40,
                    h: 40,
                    bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
                  }),
                ],
              }),
            }),
          ],
          unread: [],
        });
      }
      if (request instanceof Api.messages.GetCustomEmojiDocuments) return [coverDocument()];
      throw new Error(`unexpected ${request.className}`);
    });

    const sets = await service(invoke).getFeaturedSets('emoji');

    expect(sets[0]?.thumbDataUri?.startsWith('data:image/jpeg')).toBe(true);
    expect(sets[0]?.cover?.id).toBe('7');
  });

  it('loads a featured cover from the sticker set when no thumb document is listed', async () => {
    const invoke = jest.fn(async (request: { className?: string }) => {
      if (
        request instanceof Api.messages.GetAllStickers ||
        request instanceof Api.messages.GetEmojiStickers
      ) {
        return new Api.messages.AllStickers({ hash: bigInt(0), sets: [] });
      }
      if (request instanceof Api.messages.GetFeaturedEmojiStickers) {
        return new Api.messages.FeaturedStickers({
          hash: bigInt(0),
          count: 1,
          sets: [
            new Api.StickerSetNoCovered({
              set: installedSet({ id: bigInt(11), title: 'Bare', emojis: true }),
            }),
          ],
          unread: [],
        });
      }
      if (request instanceof Api.messages.GetStickerSet) {
        return new Api.messages.StickerSet({
          set: installedSet({ id: bigInt(11), title: 'Bare', emojis: true }),
          packs: [],
          keywords: [],
          documents: [coverDocument()],
        });
      }
      throw new Error(`unexpected ${request.className}`);
    });

    const sets = await service(invoke).getFeaturedSets('emoji');

    expect(sets[0]?.cover?.id).toBe('7');
    expect(sets[0]?.thumbDataUri?.startsWith('data:image/jpeg')).toBe(true);
  });

  it('loads featured covers that only have a thumb document in one batch', async () => {
    const invoke = jest.fn(async (request: { className?: string }) => {
      if (
        request instanceof Api.messages.GetAllStickers ||
        request instanceof Api.messages.GetEmojiStickers
      ) {
        return new Api.messages.AllStickers({ hash: bigInt(0), sets: [] });
      }
      if (request instanceof Api.messages.GetFeaturedEmojiStickers) {
        return new Api.messages.FeaturedStickers({
          hash: bigInt(0),
          count: 2,
          sets: [
            new Api.StickerSetNoCovered({
              set: installedSet({
                id: bigInt(11),
                title: 'One',
                emojis: true,
                thumbDocumentId: bigInt(7),
              }),
            }),
            new Api.StickerSetNoCovered({
              set: installedSet({
                id: bigInt(12),
                title: 'Two',
                emojis: true,
                thumbDocumentId: bigInt(8),
              }),
            }),
          ],
          unread: [],
        });
      }
      if (request instanceof Api.messages.GetCustomEmojiDocuments) return [coverDocument()];
      throw new Error(`unexpected ${request.className}`);
    });

    await service(invoke).getFeaturedSets('emoji');

    const lookups = invoke.mock.calls.filter(
      (call) => call[0] instanceof Api.messages.GetCustomEmojiDocuments,
    );
    expect(lookups).toHaveLength(1);
    const ids = (lookups[0][0] as Api.messages.GetCustomEmojiDocuments).documentId.map((id) =>
      String(id),
    );
    expect(ids).toEqual(['7', '8']);
  });

  it('loads stickers and custom emoji for one emoticon', async () => {
    const invoke = jest.fn(async (request: { className?: string }) => {
      if (request instanceof Api.messages.GetStickers) {
        return new Api.messages.Stickers({ hash: bigInt(0), stickers: [coverDocument()] });
      }
      if (request instanceof Api.messages.SearchCustomEmoji) {
        return new Api.EmojiList({ hash: bigInt(1), documentId: [bigInt(7)] });
      }
      if (request instanceof Api.messages.GetCustomEmojiDocuments) {
        return [coverDocument()];
      }
      throw new Error(`unexpected ${request.className}`);
    });
    const stickers = service(invoke);

    await expect(stickers.getStickersForEmoji('😁')).resolves.toHaveLength(1);
    const found = invoke.mock.calls[0][0] as Api.messages.GetStickers;
    expect(found.emoticon).toBe('😁');

    const custom = await stickers.searchCustomEmoji('😁');
    expect(custom).toHaveLength(1);
    expect(custom[0]?.id).toBe('7');
    const lookup = invoke.mock.calls[2][0] as Api.messages.GetCustomEmojiDocuments;
    expect(lookup.documentId.map((id) => String(id))).toEqual(['7']);
  });

  it('reloads a set for a fresh file reference', async () => {
    let generation = 0;
    const invoke = jest.fn(async (request: { className?: string }) => {
      if (request instanceof Api.messages.GetStickerSet) {
        generation += 1;
        return new Api.messages.StickerSet({
          set: installedSet(),
          packs: [],
          keywords: [],
          documents: [
            new Api.Document({
              id: bigInt(7),
              accessHash: bigInt(8),
              fileReference: Buffer.from([generation]),
              date: 1,
              mimeType: 'image/webp',
              size: bigInt(100),
              dcId: 2,
              attributes: [],
            }),
          ],
        });
      }
      throw new Error(`unexpected ${request.className}`);
    });
    const stickers = service(invoke);

    const first = await stickers.getSet('10', '20');
    const fresh = await stickers.freshFileReference('10', '20', '7');

    expect(fresh).toBeTruthy();
    expect(fresh).not.toBe(first.documents[0]?.fileReference);
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
