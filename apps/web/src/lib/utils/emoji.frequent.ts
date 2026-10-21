const STORAGE_KEY = 'telegenie.frequent-emoji';
const MAX_FREQUENT = 32;

export function readFrequentEmoji(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_FREQUENT);
  } catch {
    return [];
  }
}

export function rememberFrequentEmoji(emoji: string): string[] {
  const next = [emoji, ...readFrequentEmoji().filter((item) => item !== emoji)].slice(0, MAX_FREQUENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode can reject storage. The in-memory list still updates.
  }
  return next;
}
