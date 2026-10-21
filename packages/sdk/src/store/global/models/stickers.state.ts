import type {
  FeaturedStickerKind,
  FeaturedStickerSet,
} from '@telegenie/libs/foundation/telegram/services/sticker.service';

/** Featured sticker or emoji sets stay fresh for 7 days. */
export const FEATURED_SETS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type FeaturedSetsCache = {
  sets: FeaturedStickerSet[];
  fetchedAt: number;
};

export type StickersSnapshot = {
  stickers?: Partial<Record<FeaturedStickerKind, FeaturedSetsCache>>;
};

/** Cached featured sets. No actions. */
export interface StickersState {
  freshFeatured(kind: FeaturedStickerKind, now?: number): FeaturedStickerSet[] | undefined;
}
