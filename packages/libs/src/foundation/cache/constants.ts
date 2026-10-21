export const LANG_CACHE_NAME = 'tg-lang';
export const ASSET_CACHE_NAME = 'tg-assets';
export const MEDIA_CACHE_NAME = 'tg-media';
export const MEDIA_CACHE_NAME_AVATARS = 'tg-avatars';
export const MEDIA_PROGRESSIVE_CACHE_NAME = 'tg-media-progressive';

export const CLEARABLE_CACHE_NAMES = [
  MEDIA_CACHE_NAME,
  MEDIA_CACHE_NAME_AVATARS,
  MEDIA_PROGRESSIVE_CACHE_NAME,
];

export const LAST_ACCESS_HEADER = 'X-Last-Access';
export const DEFAULT_CACHE_TTL = 5 * 24 * 60 * 60 * 1000; // 5 days
export const DEFAULT_ACCESS_THROTTLE = 24 * 60 * 60 * 1000; // 1 day
export const DEFAULT_CLEANUP_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour

/** Max bytes cached per media/avatar/progressive part entry (5 MB). */
export const MEDIA_CACHE_MAX_BYTES = 5 * 1024 * 1024;
export const MEDIA_PROGRESSIVE_CACHE_DISABLED = false;