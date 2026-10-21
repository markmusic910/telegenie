const PICTOGRAPH = /\p{Extended_Pictographic}/u;

/**
 * Display size of a message that is one custom emoji.
 * telegram-genie `getCustomEmojiSize(1)` / `.emoji-only-1` is 7rem.
 */
export const SINGLE_CUSTOM_EMOJI_SIZE = 7 * 16;

/** The text is a single emoji grapheme, including ZWJ sequences. */
export function soleEmoji(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed || typeof Intl.Segmenter !== 'function') return undefined;
  const parts = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(trimmed)];
  if (parts.length !== 1) return undefined;
  const grapheme = parts[0]?.segment;
  if (!grapheme || !PICTOGRAPH.test(grapheme)) return undefined;
  return grapheme;
}

type EntitySpan = {
  className?: string;
  offset: number;
  length: number;
  documentId?: string;
};

/**
 * Carry entity offsets across a plain-text edit. A `<textarea>` only reports the
 * new string, so the changed span is the part between the common prefix and
 * suffix. Entities before it stay, entities after it shift by the length
 * change, and entities the edit touched are dropped.
 */
export function rebaseEntities<T extends { offset: number; length: number }>(
  prev: string,
  next: string,
  entities: T[] | undefined,
): T[] {
  if (!entities?.length || prev === next) return entities ? [...entities] : [];
  const max = Math.min(prev.length, next.length);
  let start = 0;
  while (start < max && prev[start] === next[start]) start += 1;
  let prevEnd = prev.length;
  let nextEnd = next.length;
  while (prevEnd > start && nextEnd > start && prev[prevEnd - 1] === next[nextEnd - 1]) {
    prevEnd -= 1;
    nextEnd -= 1;
  }
  const delta = nextEnd - prevEnd;
  return entities.flatMap((entity) => {
    if (entity.offset + entity.length <= start) return [entity];
    if (entity.offset >= prevEnd) return [{ ...entity, offset: entity.offset + delta }];
    return [];
  });
}

/** Document id when one custom emoji covers the whole draft or message text. */
export function coveringCustomEmojiId(
  text: string,
  entities: EntitySpan[] | undefined,
): string | undefined {
  const entity = entities?.find(
    (item) => item.className === 'MessageEntityCustomEmoji' && typeof item.documentId === 'string',
  );
  if (!entity?.documentId) return undefined;
  if (entity.offset !== 0 || entity.length !== text.length) return undefined;
  return entity.documentId;
}
