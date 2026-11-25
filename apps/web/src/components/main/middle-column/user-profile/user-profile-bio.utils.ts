export type BioSegment =
  | { kind: 'text'; value: string }
  | { kind: 'mention'; value: string; username: string }
  | { kind: 'url'; value: string; href: string }
  | { kind: 'hashtag'; value: string; tag: string };

const BIO_TOKEN_REGEX =
  /(https?:\/\/[^\s<>]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?:\/[^\s<>]*)?|@[a-zA-Z][a-zA-Z0-9_]{2,31}|#[\p{L}\p{N}_]{1,64})/giu;

const TRAILING_PUNCTUATION_REGEX = /[.,!?;:)'"\]]+$/;

function splitTrailingPunctuation(raw: string): { core: string; trailing: string } {
  const match = raw.match(TRAILING_PUNCTUATION_REGEX);
  if (!match) {
    return { core: raw, trailing: '' };
  }
  const trailing = match[0];
  // Preserve balanced closing parentheses inside URLs like wikipedia.org/wiki/Foo_(bar)
  if (trailing.includes(')')) {
    const coreCandidate = raw.slice(0, raw.length - trailing.length);
    const openCount = (coreCandidate.match(/\(/g) ?? []).length;
    const closeCount = (coreCandidate.match(/\)/g) ?? []).length;
    if (openCount > closeCount && trailing.startsWith(')')) {
      return {
        core: `${coreCandidate})`,
        trailing: trailing.slice(1),
      };
    }
  }
  return {
    core: raw.slice(0, raw.length - trailing.length),
    trailing,
  };
}

function pushText(segments: BioSegment[], value: string) {
  if (!value) return;
  const last = segments[segments.length - 1];
  if (last?.kind === 'text') {
    last.value += value;
    return;
  }
  segments.push({ kind: 'text', value });
}

/**
 * Tokenizes plain Telegram bio / about text into plain text, `@mentions`, URLs, and `#hashtags`.
 */
export function parseBioSegments(text: string): BioSegment[] {
  if (!text) return [];
  const segments: BioSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(BIO_TOKEN_REGEX)) {
    const matchIndex = match.index ?? 0;
    const rawToken = match[0];

    // Prevent matching `@domain` inside an email address like `hi@example.com`
    if (
      (rawToken.startsWith('@') || rawToken.startsWith('#')) &&
      matchIndex > 0 &&
      /[\p{L}\p{N}._-]/u.test(text[matchIndex - 1] ?? '')
    ) {
      continue;
    }

    if (matchIndex > cursor) {
      pushText(segments, text.slice(cursor, matchIndex));
    }

    if (rawToken.startsWith('@')) {
      segments.push({
        kind: 'mention',
        value: rawToken,
        username: rawToken.slice(1),
      });
      cursor = matchIndex + rawToken.length;
      continue;
    }

    if (rawToken.startsWith('#')) {
      segments.push({
        kind: 'hashtag',
        value: rawToken,
        tag: rawToken.slice(1),
      });
      cursor = matchIndex + rawToken.length;
      continue;
    }

    const { core, trailing } = splitTrailingPunctuation(rawToken);
    if (core) {
      const href = /^https?:\/\//i.test(core) ? core : `https://${core}`;
      segments.push({
        kind: 'url',
        value: core,
        href,
      });
    }
    if (trailing) {
      pushText(segments, trailing);
    }
    cursor = matchIndex + rawToken.length;
  }

  if (cursor < text.length) {
    pushText(segments, text.slice(cursor));
  }

  return segments;
}
