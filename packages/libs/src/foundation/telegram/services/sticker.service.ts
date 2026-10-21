import { Api } from '@telegenie/teleproto';
import bigint from 'big-integer';
import type { Document } from '../types/file';
import { convertTypeDocumentSerializable } from './converters/media.converter';
import { buildApiThumbnailFromStripped, bytesToDataUri } from './converters/thumbnail.converter';
import type { TransportService } from './transport.service';

export type InstalledStickerSet = {
  id: string;
  accessHash: string;
  title: string;
  count: number;
  /** Cover image for the set, as a data URI. */
  thumbDataUri?: string;
};

export type StickerSetContents = {
  id: string;
  accessHash: string;
  title: string;
  shortName: string;
  count: number;
  documents: Document[];
};

export type FeaturedStickerKind = 'stickers' | 'emoji';

export type FeaturedStickerSet = {
  id: string;
  accessHash: string;
  title: string;
  cover?: Document;
  thumbDataUri?: string;
};

export type GifSearchHit = {
  queryId: string;
  id: string;
  thumbUrl?: string;
  document?: Document;
};

type StickerServiceOptions = {
  transportService: TransportService;
};

export class StickerService {
  transportService: TransportService;
  private readonly sets = new Map<string, StickerSetContents>();
  private readonly coverUris = new Map<string, string>();
  private gifBot?: Api.InputUser;

  constructor({ transportService }: StickerServiceOptions) {
    this.transportService = transportService;
  }

  get client() {
    return this.transportService?.client ?? null;
  }

  getInstalledSets = async (): Promise<InstalledStickerSet[]> => {
    return this.listInstalledSets(new Api.messages.GetAllStickers({ hash: bigint(0) as never }));
  };

  /** Custom-emoji packs on this account (`messages.getEmojiStickers`). */
  getInstalledEmojiSets = async (): Promise<InstalledStickerSet[]> => {
    return this.listInstalledSets(new Api.messages.GetEmojiStickers({ hash: bigint(0) as never }));
  };

  private listInstalledSets = async (
    request: Api.messages.GetAllStickers | Api.messages.GetEmojiStickers,
  ): Promise<InstalledStickerSet[]> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const result = await this.client.invoke(request);
    if (result instanceof Api.messages.AllStickersNotModified) {
      return [];
    }
    if (!(result instanceof Api.messages.AllStickers)) {
      throw new Error('Unexpected installed sticker list');
    }
    const sets = (result.sets ?? []).filter(
      (set): set is Api.StickerSet => set instanceof Api.StickerSet && !set.archived,
    );
    return mapPool(sets, 4, (set) => this.toInstalledSet(set));
  };

  getSet = async (id: string, accessHash: string): Promise<StickerSetContents> => {
    const cached = this.sets.get(id);
    if (cached) return cached;
    return this.loadSet(id, accessHash);
  };

  private toInstalledSet = async (set: Api.StickerSet): Promise<InstalledStickerSet> => {
    const id = String(set.id);
    const accessHash = String(set.accessHash);
    const inline = thumbFromSizes(set.thumbs);
    let thumbDataUri = (await this.downloadSetThumb(set)) ?? inline;
    // getAllStickers often has no image thumb. Animated packs in particular
    // only point at a cover document, whose stripped preview is a real image.
    if (!thumbDataUri) {
      try {
        await this.loadSet(id, accessHash, set.thumbDocumentId?.toString());
        thumbDataUri = this.coverUris.get(id);
      } catch {
        thumbDataUri = undefined;
      }
    }
    return {
      id,
      accessHash,
      title: set.title,
      count: set.count,
      thumbDataUri,
    };
  };

  private loadSet = async (
    id: string,
    accessHash: string,
    thumbDocumentId?: string,
  ): Promise<StickerSetContents> => {
    const cached = this.sets.get(id);
    if (cached) return cached;
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const result = await this.client.invoke(
      new Api.messages.GetStickerSet({
        stickerset: new Api.InputStickerSetID({
          id: bigint(id),
          accessHash: bigint(accessHash),
        }),
        hash: 0,
      }),
    );
    if (!(result instanceof Api.messages.StickerSet)) {
      throw new Error('Unexpected getStickerSet response');
    }
    const info = result.set;
    if (!(info instanceof Api.StickerSet)) {
      throw new Error('Unexpected sticker set');
    }
    const rawDocuments = (result.documents ?? []).filter(
      (document): document is Api.Document => document instanceof Api.Document,
    );
    const documents = rawDocuments
      .map((document) => convertTypeDocumentSerializable(document))
      .filter((document): document is Document => Boolean(document && 'accessHash' in document));
    const coverId = thumbDocumentId ?? info.thumbDocumentId?.toString();
    const cover =
      documentThumbDataUri(documents, coverId) ??
      (await this.coverFromDocuments(rawDocuments, coverId));
    if (cover) this.coverUris.set(id, cover);
    const contents: StickerSetContents = {
      id,
      accessHash,
      title: info.title,
      shortName: info.shortName,
      count: info.count,
      documents,
    };
    this.sets.set(id, contents);
    return contents;
  };

  private coverFromDocuments = async (
    documents: Api.Document[],
    thumbDocumentId?: string,
  ): Promise<string | undefined> => {
    const cover =
      (thumbDocumentId
        ? documents.find((document) => String(document.id) === thumbDocumentId)
        : undefined) ?? documents[0];
    if (!cover) return undefined;
    const inline = thumbFromSizes(cover.thumbs);
    if (inline) return inline;
    const photoSize = (cover.thumbs ?? []).find(
      (size): size is Api.PhotoSize | Api.PhotoSizeProgressive =>
        (size instanceof Api.PhotoSize || size instanceof Api.PhotoSizeProgressive) &&
        Boolean(size.type),
    );
    if (photoSize) {
      const thumb = await this.downloadImage(
        new Api.InputDocumentFileLocation({
          id: cover.id,
          accessHash: cover.accessHash,
          fileReference: cover.fileReference,
          thumbSize: photoSize.type,
        }),
        cover.dcId,
      );
      if (thumb) return thumb;
    }
    if (
      cover.mimeType === 'image/webp' ||
      cover.mimeType === 'image/png' ||
      cover.mimeType === 'image/jpeg'
    ) {
      return this.downloadImage(
        new Api.InputDocumentFileLocation({
          id: cover.id,
          accessHash: cover.accessHash,
          fileReference: cover.fileReference,
          thumbSize: '',
        }),
        cover.dcId,
      );
    }
    return undefined;
  };

  private downloadImage = async (
    location: Api.TypeInputFileLocation,
    dcId?: number,
  ): Promise<string | undefined> => {
    if (!this.client) return undefined;
    try {
      const bytes = await this.client.downloadFile(location, { dcId });
      return imageDataUri(bytes);
    } catch {
      return undefined;
    }
  };

  private installedSetIds = async (kind: FeaturedStickerKind): Promise<Set<string>> => {
    if (!this.client) return new Set();
    const result = await this.client.invoke(
      kind === 'emoji'
        ? new Api.messages.GetEmojiStickers({ hash: bigint(0) as never })
        : new Api.messages.GetAllStickers({ hash: bigint(0) as never }),
    );
    if (!(result instanceof Api.messages.AllStickers)) return new Set();
    return new Set(
      (result.sets ?? []).flatMap((set) => (set instanceof Api.StickerSet ? [String(set.id)] : [])),
    );
  };

  private resolveGifBot = async (): Promise<Api.InputUser | undefined> => {
    if (this.gifBot) return this.gifBot;
    if (!this.client) return undefined;
    const result = await this.client.invoke(
      new Api.contacts.ResolveUsername({ username: 'gif' }),
    );
    if (!(result instanceof Api.contacts.ResolvedPeer)) return undefined;
    const peer = result.peer;
    if (!(peer instanceof Api.PeerUser)) return undefined;
    const user = (result.users ?? []).find(
      (entry): entry is Api.User =>
        entry instanceof Api.User && String(entry.id) === String(peer.userId),
    );
    if (!user?.accessHash) return undefined;
    this.gifBot = new Api.InputUser({ userId: user.id, accessHash: user.accessHash });
    return this.gifBot;
  };

  /**
   * Sets that still have no static image after the batched document lookup.
   * File downloads stay capped so a long featured list does not flood the connection.
   */
  private finishFeaturedThumb = async (
    set: FeaturedStickerSet,
    raw: Api.Document | undefined,
    info: Api.StickerSet,
  ): Promise<FeaturedStickerSet> => {
    if (set.thumbDataUri) return set;
    const fromCover = raw ? await this.coverFromDocuments([raw]) : undefined;
    const thumbDataUri = fromCover ?? (await this.downloadSetThumb(info));
    return thumbDataUri ? { ...set, thumbDataUri } : set;
  };

  private downloadSetThumb = async (set: Api.StickerSet): Promise<string | undefined> => {
    if (!this.client || set.thumbVersion == null) return undefined;
    try {
      const bytes = await this.client.downloadFile(
        new Api.InputStickerSetThumb({
          stickerset: new Api.InputStickerSetID({
            id: set.id,
            accessHash: set.accessHash,
          }),
          thumbVersion: set.thumbVersion,
        }),
        { dcId: set.thumbDcId },
      );
      if (!bytes || typeof bytes === 'string') return undefined;
      return imageDataUri(bytes);
    } catch {
      return undefined;
    }
  };

  /** Drop the cached set and load it again, for a file-reference retry. */
  freshFileReference = async (
    setId: string,
    accessHash: string,
    documentId: string,
  ): Promise<string | undefined> => {
    this.sets.delete(setId);
    const contents = await this.loadSet(setId, accessHash);
    const fileReference = contents.documents.find((document) => document.id === documentId)
      ?.fileReference;
    return fileReference || undefined;
  };

  getRecentStickers = async (): Promise<Document[]> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const result = await this.client.invoke(
      new Api.messages.GetRecentStickers({ hash: bigint(0) as never }),
    );
    if (!(result instanceof Api.messages.RecentStickers)) return [];
    return serializableDocuments(result.stickers);
  };

  clearRecentStickers = async (): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    await this.client.invoke(new Api.messages.ClearRecentStickers({}));
  };

  getFeaturedSets = async (kind: FeaturedStickerKind): Promise<FeaturedStickerSet[]> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const [featured, installedIds] = await Promise.all([
      this.client.invoke(
        kind === 'emoji'
          ? new Api.messages.GetFeaturedEmojiStickers({ hash: bigint(0) as never })
          : new Api.messages.GetFeaturedStickers({ hash: bigint(0) as never }),
      ),
      this.installedSetIds(kind),
    ]);
    if (!(featured instanceof Api.messages.FeaturedStickers)) return [];
    const pending = (featured.sets ?? []).flatMap((covered) => {
      const parsed = featuredSetFromCovered(covered);
      if (!parsed || installedIds.has(parsed.set.id)) return [];
      return [parsed];
    });
    const withCovers = await this.attachFeaturedDocuments(pending);
    return mapPool(withCovers, 4, ({ set, raw, info }) => this.finishFeaturedThumb(set, raw, info));
  };

  /**
   * Featured emoji packs often arrive as `stickerSetNoCovered` plus a
   * `thumbDocumentId`. A static set thumb is only a preview — the cover
   * document is what actually animates. One `messages.getCustomEmojiDocuments`
   * call loads those covers. A single bad id fails the whole page, so a failed
   * chunk is split. Sets that still have no cover fall back to `getStickerSet`.
   */
  private attachFeaturedDocuments = async (
    pending: { set: FeaturedStickerSet; raw?: Api.Document; info: Api.StickerSet }[],
  ): Promise<{ set: FeaturedStickerSet; raw?: Api.Document; info: Api.StickerSet }[]> => {
    const ids = [
      ...new Set(
        pending.flatMap(({ set, info }) => {
          if (set.cover) return [];
          const id = info.thumbDocumentId ? String(info.thumbDocumentId) : '';
          return id && id !== '0' ? [id] : [];
        }),
      ),
    ];
    const byId = await this.loadCustomEmojiDocuments(ids);
    const withDocuments = pending.map((item) => {
      if (item.set.cover) return item;
      const id = item.info.thumbDocumentId ? String(item.info.thumbDocumentId) : undefined;
      const cover = id ? byId.get(id) : undefined;
      if (!cover) return item;
      const thumbDataUri = item.set.thumbDataUri ?? documentThumbDataUri([cover]);
      return {
        ...item,
        set: { ...item.set, cover, ...(thumbDataUri ? { thumbDataUri } : {}) },
      };
    });
    return mapPool(withDocuments, 3, (item) => this.fillMissingFeaturedCover(item));
  };

  private loadCustomEmojiDocuments = async (ids: string[]): Promise<Map<string, Document>> => {
    const byId = new Map<string, Document>();
    const load = async (chunk: string[]): Promise<void> => {
      if (!chunk.length) return;
      try {
        const documents = await this.getCustomEmojiDocuments(chunk);
        for (const document of documents) byId.set(document.id, document);
      } catch {
        if (chunk.length === 1) return;
        const mid = Math.ceil(chunk.length / 2);
        await load(chunk.slice(0, mid));
        await load(chunk.slice(mid));
      }
    };
    const chunks: string[][] = [];
    for (let index = 0; index < ids.length; index += 100) {
      chunks.push(ids.slice(index, index + 100));
    }
    await mapPool(chunks, 2, async (chunk) => {
      await load(chunk);
      return [];
    });
    return byId;
  };

  private fillMissingFeaturedCover = async (item: {
    set: FeaturedStickerSet;
    raw?: Api.Document;
    info: Api.StickerSet;
  }): Promise<{ set: FeaturedStickerSet; raw?: Api.Document; info: Api.StickerSet }> => {
    if (item.set.cover) return item;
    try {
      const thumbId = item.info.thumbDocumentId?.toString();
      const contents = await this.loadSet(item.set.id, item.set.accessHash, thumbId);
      const cover =
        (thumbId ? contents.documents.find((document) => document.id === thumbId) : undefined) ??
        contents.documents[0];
      if (!cover) return item;
      const thumbDataUri =
        item.set.thumbDataUri ?? documentThumbDataUri(contents.documents, thumbId);
      return {
        ...item,
        set: { ...item.set, cover, ...(thumbDataUri ? { thumbDataUri } : {}) },
      };
    } catch {
      return item;
    }
  };

  /** Stickers whose alt emoji is `emoticon` (`messages.getStickers`). */
  getStickersForEmoji = async (emoticon: string): Promise<Document[]> => {
    const emoji = emoticon.trim();
    if (!emoji) return [];
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const result = await this.client.invoke(
      new Api.messages.GetStickers({ emoticon: emoji, hash: bigint(0) as never }),
    );
    if (!(result instanceof Api.messages.Stickers)) return [];
    return serializableDocuments(result.stickers);
  };

  /** Custom-emoji documents that substitute `emoticon` (`messages.searchCustomEmoji`). */
  searchCustomEmoji = async (emoticon: string): Promise<Document[]> => {
    const emoji = emoticon.trim();
    if (!emoji) return [];
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const list = await this.client.invoke(
      new Api.messages.SearchCustomEmoji({ emoticon: emoji, hash: bigint(0) as never }),
    );
    if (!(list instanceof Api.EmojiList) || !list.documentId?.length) return [];
    return this.getCustomEmojiDocuments(list.documentId.slice(0, 24).map((id) => String(id)));
  };

  getCustomEmojiDocuments = async (ids: string[]): Promise<Document[]> => {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return [];
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const documents = await this.client.invoke(
      new Api.messages.GetCustomEmojiDocuments({
        documentId: unique.map((id) => bigint(id)),
      }),
    );
    return serializableDocuments(documents);
  };

  installSet = async (id: string, accessHash: string): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    await this.client.invoke(
      new Api.messages.InstallStickerSet({
        stickerset: new Api.InputStickerSetID({
          id: bigint(id),
          accessHash: bigint(accessHash),
        }),
        archived: false,
      }),
    );
  };

  searchStickers = async (query: string): Promise<Document[]> => {
    return this.searchFoundStickers(query, false);
  };

  /** Custom emoji for a text query (`messages.searchStickers` with `emojis`). */
  searchEmoji = async (query: string): Promise<Document[]> => {
    return this.searchFoundStickers(query, true);
  };

  private searchFoundStickers = async (query: string, emojis: boolean): Promise<Document[]> => {
    const q = query.trim();
    if (!q) return [];
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const result = await this.client.invoke(
      new Api.messages.SearchStickers({
        emojis,
        q,
        emoticon: '',
        langCode: ['en'],
        offset: 0,
        limit: 40,
        hash: bigint(0) as never,
      }),
    );
    if (!(result instanceof Api.messages.FoundStickers)) return [];
    return serializableDocuments(result.stickers);
  };

  getSavedGifs = async (): Promise<Document[]> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const result = await this.client.invoke(
      new Api.messages.GetSavedGifs({ hash: bigint(0) as never }),
    );
    if (!(result instanceof Api.messages.SavedGifs)) return [];
    return serializableDocuments(result.gifs);
  };

  searchGifs = async (peer: Api.TypeInputPeer, query: string): Promise<GifSearchHit[]> => {
    const q = query.trim();
    if (!q) return [];
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const bot = await this.resolveGifBot();
    if (!bot) return [];
    const result = await this.client.invoke(
      new Api.messages.GetInlineBotResults({
        bot,
        peer,
        query: q,
        offset: '',
      }),
    );
    if (!(result instanceof Api.messages.BotResults)) return [];
    const queryId = String(result.queryId);
    return (result.results ?? []).flatMap((hit) => gifHit(queryId, hit));
  };

  uninstallSet = async (id: string, accessHash: string): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    await this.client.invoke(
      new Api.messages.UninstallStickerSet({
        stickerset: new Api.InputStickerSetID({
          id: bigint(id),
          accessHash: bigint(accessHash),
        }),
      }),
    );
    this.sets.delete(id);
    this.coverUris.delete(id);
  };
}

function serializableDocuments(documents?: Api.TypeDocument[]): Document[] {
  return (documents ?? []).flatMap((document) => {
    const converted = convertTypeDocumentSerializable(document);
    return converted && 'accessHash' in converted ? [converted] : [];
  });
}

function featuredSetFromCovered(
  covered: Api.TypeStickerSetCovered,
): { set: FeaturedStickerSet; raw?: Api.Document; info: Api.StickerSet } | undefined {
  const info = covered.set;
  if (!(info instanceof Api.StickerSet)) return undefined;
  let raw: Api.Document | undefined;
  if (covered instanceof Api.StickerSetCovered && covered.cover instanceof Api.Document) {
    raw = covered.cover;
  } else if (covered instanceof Api.StickerSetMultiCovered) {
    raw = covered.covers.find((document): document is Api.Document => document instanceof Api.Document);
  } else if (covered instanceof Api.StickerSetFullCovered) {
    raw = covered.documents.find(
      (document): document is Api.Document => document instanceof Api.Document,
    );
  }
  const documents = raw ? serializableDocuments([raw]) : [];
  const cover = documents[0];
  return {
    raw,
    info,
    set: {
      id: String(info.id),
      accessHash: String(info.accessHash),
      title: info.title,
      cover,
      thumbDataUri:
        thumbFromSizes(info.thumbs) ??
        (raw ? thumbFromSizes(raw.thumbs) : undefined) ??
        documentThumbDataUri(documents),
    },
  };
}

function gifHit(queryId: string, hit: Api.TypeBotInlineResult): GifSearchHit[] {
  if (hit instanceof Api.BotInlineMediaResult) {
    const documents = hit.document ? serializableDocuments([hit.document]) : [];
    return [{ queryId, id: hit.id, document: documents[0] }];
  }
  if (hit instanceof Api.BotInlineResult) {
    const thumb = hit.thumb;
    const thumbUrl =
      thumb instanceof Api.WebDocument || thumb instanceof Api.WebDocumentNoProxy
        ? thumb.url
        : undefined;
    return [{ queryId, id: hit.id, thumbUrl }];
  }
  return [];
}

function thumbFromSizes(sizes?: Api.TypePhotoSize[]): string | undefined {
  try {
    const stripped = buildApiThumbnailFromStripped(sizes)?.dataUri;
    if (stripped) return stripped;
  } catch {
    // A bad stripped thumb should not hide the downloaded cover.
  }
  const cached = sizes?.find(
    (size): size is Api.PhotoCachedSize => size instanceof Api.PhotoCachedSize,
  );
  if (!cached?.bytes?.length) return undefined;
  const bytes = cached.bytes instanceof Uint8Array ? cached.bytes : new Uint8Array(cached.bytes);
  const mime = imageMime(bytes);
  if (!mime) return undefined;
  return bytesToDataUri(bytes, false, mime);
}

export function documentThumbDataUri(
  documents: Document[],
  thumbDocumentId?: string,
): string | undefined {
  const cover =
    (thumbDocumentId ? documents.find((document) => document.id === thumbDocumentId) : undefined) ??
    documents[0];
  const thumb = cover?.thumbs?.find(
    (size) =>
      'bytes' in size && typeof size.bytes === 'string' && size.bytes.startsWith('data:image'),
  );
  return thumb && 'bytes' in thumb && typeof thumb.bytes === 'string' ? thumb.bytes : undefined;
}

async function imageDataUri(bytes: unknown): Promise<string | undefined> {
  if (!bytes || typeof bytes === 'string') return undefined;
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer);
  const image = await inflateIfGzip(data);
  const mime = imageMime(image);
  if (!mime) return undefined;
  return bytesToDataUri(image, false, mime);
}

function imageMime(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes.length >= 2 && bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return undefined;
}

async function inflateIfGzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  if (typeof DecompressionStream === 'undefined') return bytes;
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
  const reader = source.pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const payload = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return payload;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
