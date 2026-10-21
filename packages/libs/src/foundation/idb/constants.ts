/** Default debounce before draining the write queue (ms). */
export const DEFAULT_FLUSH_DELAY_MS = 32;

/** Max pending ops written per IndexedDB transaction during flush. */
export const DEFAULT_MAX_BATCH_SIZE = 500;