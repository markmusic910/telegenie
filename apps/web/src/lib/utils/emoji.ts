/**
 * Append the emoji variation selector so BMP symbols such as ❤ render as color emoji.
 * Supplementary-plane pictographs (👍, 🔥) already use emoji presentation.
 */
export function emojiPresentation(emoticon: string): string {
  const base = emoticon.replace(/\uFE0F/g, '');
  if (!base) return emoticon;
  for (const char of base) {
    if ((char.codePointAt(0) ?? 0) > 0xffff) return base;
  }
  return `${base}\uFE0F`;
}
