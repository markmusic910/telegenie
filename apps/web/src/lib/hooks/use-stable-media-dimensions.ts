import { useRef } from 'react';
import type { MediaDimensionsResult } from '@/lib/utils/media-dimensions';

/**
 * Freeze display size once Telegram metadata is known so later store updates
 * cannot resize a listed row (telegram-genie pre-sizes media the same way).
 *
 * When `lock` is false the latest computed size is used (album tiles, or the
 * fallback box before width/height exist).
 */
export function useStableMediaDimensions(
  computed: MediaDimensionsResult,
  lock: boolean,
): MediaDimensionsResult {
  const ref = useRef<MediaDimensionsResult | null>(null);
  if (!lock) {
    return computed;
  }
  if (!ref.current) {
    ref.current = computed;
  }
  return ref.current;
}
