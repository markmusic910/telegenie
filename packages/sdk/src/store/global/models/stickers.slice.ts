import type {
  FeaturedStickerKind,
  FeaturedStickerSet,
} from '@telegenie/libs/foundation/telegram/services/sticker.service';
import { toJS } from 'mobx';
import { GlobalStoreSlice } from '../global-store.slice';
import {
  FEATURED_SETS_TTL_MS,
  type FeaturedSetsCache,
  type StickersSnapshot,
  type StickersState,
} from './stickers.state';

function isFeaturedSet(value: unknown): value is FeaturedStickerSet {
  if (!value || typeof value !== 'object') return false;
  const set = value as FeaturedStickerSet;
  return (
    typeof set.id === 'string' &&
    typeof set.accessHash === 'string' &&
    typeof set.title === 'string'
  );
}

function readCache(value: unknown): FeaturedSetsCache | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const entry = value as { sets?: unknown; fetchedAt?: unknown };
  if (
    !Array.isArray(entry.sets) ||
    typeof entry.fetchedAt !== 'number' ||
    !Number.isFinite(entry.fetchedAt)
  ) {
    return undefined;
  }
  return {
    sets: entry.sets.filter(isFeaturedSet),
    fetchedAt: entry.fetchedAt,
  };
}

/** Featured sticker and custom-emoji sets, with a 7-day cache. */
export class StickersSlice extends GlobalStoreSlice implements StickersState {
  featured: Partial<Record<FeaturedStickerKind, FeaturedSetsCache>> = {};

  constructor() {
    super();
    this.observe();
  }

  freshFeatured = (
    kind: FeaturedStickerKind,
    now = Date.now(),
  ): FeaturedStickerSet[] | undefined => {
    const entry = this.featured[kind];
    if (!entry) return undefined;
    if (now - entry.fetchedAt >= FEATURED_SETS_TTL_MS) return undefined;
    return toJS(entry.sets);
  };

  rememberFeatured = (
    kind: FeaturedStickerKind,
    sets: FeaturedStickerSet[],
    fetchedAt = Date.now(),
  ) => {
    this.featured = {
      ...this.featured,
      [kind]: { sets, fetchedAt },
    };
  };

  hydrateFromSnapshot = (snapshot: Record<string, unknown> | undefined) => {
    const raw = snapshot?.stickers;
    if (!raw || typeof raw !== 'object') return;
    const source = raw as Record<string, unknown>;
    const featured: Partial<Record<FeaturedStickerKind, FeaturedSetsCache>> = {};
    const emoji = readCache(source.emoji);
    const stickers = readCache(source.stickers);
    if (emoji) featured.emoji = emoji;
    if (stickers) featured.stickers = stickers;
    this.featured = featured;
  };

  toSnapshot(): StickersSnapshot {
    return { stickers: toJS(this.featured) };
  }

  toJS(): Record<string, unknown> {
    return this.toSnapshot();
  }
}
