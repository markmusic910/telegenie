import { Controller, Method, RequestLog } from '@telegenie/decorators';
import type {
  FeaturedStickerKind,
  FeaturedStickerSet,
  GifSearchHit,
  InstalledStickerSet,
  StickerSetContents,
} from '@telegenie/libs/foundation/telegram/services/sticker.service';
import type { Document } from '@telegenie/libs/foundation/telegram/types/file';
import { readPeerAccessHash } from '@telegenie/libs/foundation/telegram/utils';
import type { TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';
import type { GlobalStore } from '../../store/global/global.store';
import type StoreManager from '../../store/store.manager';

const CUSTOM_EMOJI_BATCH_LIMIT = 100;
const CUSTOM_EMOJI_BATCH_INTERVAL_MS = 200;

type StickerControllerOptions = {
  worker: TelegramWorkerClient;
  sm: StoreManager;
  globalStore: GlobalStore;
  /** Point-read persisted documents before calling Telegram. */
  loadCachedDocuments?: (ids: string[]) => Promise<Document[]>;
};

function isLoadedDocument(document: { mimeType?: string } | undefined): boolean {
  return Boolean(document?.mimeType);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

@Controller
export class StickerController {
  worker: TelegramWorkerClient;
  private readonly sm: StoreManager;
  private readonly globalStore: GlobalStore;
  private readonly loadCachedDocuments: (ids: string[]) => Promise<Document[]>;

  constructor({ worker, sm, globalStore, loadCachedDocuments }: StickerControllerOptions) {
    this.worker = worker;
    this.sm = sm;
    this.globalStore = globalStore;
    this.loadCachedDocuments = loadCachedDocuments ?? (async () => []);
  }

  @RequestLog()
  @Method()
  async getInstalledSets(): Promise<InstalledStickerSet[]> {
    return this.worker.call('sticker.getInstalledSets', []);
  }

  @RequestLog()
  @Method()
  async getInstalledEmojiSets(): Promise<InstalledStickerSet[]> {
    return this.worker.call('sticker.getInstalledEmojiSets', []);
  }

  @RequestLog()
  @Method()
  async getSet(id: string, accessHash: string): Promise<StickerSetContents> {
    return this.worker.call('sticker.getSet', [id, accessHash]);
  }

  @RequestLog()
  @Method()
  async uninstallSet(id: string, accessHash: string): Promise<void> {
    await this.worker.call('sticker.uninstallSet', [id, accessHash]);
  }

  @RequestLog()
  @Method()
  async getRecentStickers(): Promise<Document[]> {
    return this.worker.call('sticker.getRecentStickers', []);
  }

  @RequestLog()
  @Method()
  async clearRecentStickers(): Promise<void> {
    await this.worker.call('sticker.clearRecentStickers', []);
  }

  @RequestLog()
  @Method()
  async getFeaturedSets(kind: FeaturedStickerKind): Promise<FeaturedStickerSet[]> {
    const cached = this.globalStore.stickers.freshFeatured(kind);
    if (cached) return cached;
    const sets = await this.worker.call('sticker.getFeaturedSets', [kind]);
    this.globalStore.stickers.rememberFeatured(kind, sets);
    return sets;
  }

  @RequestLog()
  @Method()
  async installSet(id: string, accessHash: string): Promise<void> {
    await this.worker.call('sticker.installSet', [id, accessHash]);
  }

  @RequestLog()
  @Method()
  async searchStickers(query: string): Promise<Document[]> {
    return this.worker.call('sticker.searchStickers', [query]);
  }

  @RequestLog()
  @Method()
  async searchEmoji(query: string): Promise<Document[]> {
    return this.worker.call('sticker.searchEmoji', [query]);
  }

  @RequestLog()
  @Method()
  async getSavedGifs(): Promise<Document[]> {
    return this.worker.call('sticker.getSavedGifs', []);
  }

  @RequestLog()
  @Method()
  async getStickersForEmoji(emoticon: string): Promise<Document[]> {
    return this.worker.call('sticker.getStickersForEmoji', [emoticon]);
  }

  @RequestLog()
  @Method()
  async searchCustomEmoji(emoticon: string): Promise<Document[]> {
    return this.worker.call('sticker.searchCustomEmoji', [emoticon]);
  }

  @RequestLog()
  @Method()
  async getCustomEmojiDocuments(ids: string[]): Promise<Document[]> {
    return this.worker.call('sticker.getCustomEmojiDocuments', [ids]);
  }

  /** Keep documents the UI already has (picker, composer) in the entity store. */
  @RequestLog()
  @Method()
  rememberCustomEmoji(documents: Document[]): void {
    const loaded = documents.filter((document) => document.id && isLoadedDocument(document));
    if (loaded.length === 0) return;
    this.sm.get('customEmoji').update(loaded);
  }

  /**
   * Fill missing custom-emoji documents: memory, then IndexedDB, then Telegram.
   * Remote calls send at most 100 ids and wait 200ms between batches.
   */
  @RequestLog()
  @Method()
  async ensureCustomEmojiDocuments(ids: string[]): Promise<void> {
    const store = this.sm.get('customEmoji');
    const missing = [...new Set(ids.filter(Boolean))].filter(
      (id) => !isLoadedDocument(store.getAllData().get(id)),
    );
    if (missing.length === 0) return;

    let cached: Document[] = [];
    try {
      cached = await this.loadCachedDocuments(missing);
    } catch {
      cached = [];
    }
    const fromCache = cached.filter((document) => isLoadedDocument(document));
    if (fromCache.length > 0) {
      store.hydrate(fromCache);
    }
    const cachedIds = new Set(fromCache.map((document) => document.id));
    const remoteIds = missing.filter((id) => !cachedIds.has(id));

    for (let index = 0; index < remoteIds.length; index += CUSTOM_EMOJI_BATCH_LIMIT) {
      if (index > 0) await sleep(CUSTOM_EMOJI_BATCH_INTERVAL_MS);
      const chunk = remoteIds.slice(index, index + CUSTOM_EMOJI_BATCH_LIMIT);
      const loaded = await this.getCustomEmojiDocuments(chunk);
      if (loaded.length > 0) store.update(loaded);
    }
  }

  @RequestLog()
  @Method()
  async searchGifs(peerId: string, query: string): Promise<GifSearchHit[]> {
    const accessHash = readPeerAccessHash(this.sm, peerId);
    return this.worker.call('sticker.searchGifs', [peerId, query, accessHash]);
  }
}
