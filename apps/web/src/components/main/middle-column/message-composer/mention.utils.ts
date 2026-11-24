import type { MentionNameEntity, OutgoingMessageEntity, User } from '@telegenie/sdk';

const RE_USERNAME_SEARCH = /(^|\s)@[-_\p{L}\p{M}\p{N}]*$/u;

export type MentionQueryMatch = {
  /** Query text after `@` (may be empty right after typing `@`). */
  query: string;
  /** UTF-16 index of the `@` character in `text`. */
  startIndex: number;
  /** UTF-16 index of the caret (end of `@query`). */
  endIndex: number;
  /** True when the `@` token starts at index 0 of the message (enables top inline bots). */
  atStartOfMessage: boolean;
};

export type MentionCandidateUser = Pick<
  User,
  'id' | 'firstName' | 'lastName' | 'username' | 'usernames' | 'deleted' | 'display'
>;

/**
 * Extract an active `@query` immediately before a collapsed caret.
 * Returns `undefined` when there is a non-empty selection or no valid `@` token at the caret.
 */
export function extractMentionQuery(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): MentionQueryMatch | undefined {
  if (selectionStart !== selectionEnd) return undefined;
  if (selectionStart <= 0 || selectionStart > text.length) return undefined;

  const beforeCaret = text.slice(0, selectionStart);
  if (!beforeCaret.includes('@')) return undefined;

  const match = beforeCaret.match(RE_USERNAME_SEARCH);
  if (!match) return undefined;

  const fullMatch = match[0];
  const leadingWhitespace = match[1] ?? '';
  const startIndex = beforeCaret.length - fullMatch.length + leadingWhitespace.length;
  const query = beforeCaret.slice(startIndex + 1);

  return {
    query,
    startIndex,
    endIndex: selectionStart,
    atStartOfMessage: startIndex === 0,
  };
}

/** Return a user's primary active username (without `@`), if any. */
export function getMainUsername(
  user: Pick<User, 'username' | 'usernames'>,
): string | undefined {
  if (user.username) return user.username;
  const active = user.usernames?.find((entry) => entry.active !== false && entry.username);
  return active?.username;
}

function getAllUsernames(user: Pick<User, 'username' | 'usernames'>): string[] {
  const result: string[] = [];
  if (user.username) result.push(user.username);
  for (const entry of user.usernames ?? []) {
    if (entry.active !== false && entry.username && !result.includes(entry.username)) {
      result.push(entry.username);
    }
  }
  return result;
}

function matchesQuery(user: MentionCandidateUser, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;

  for (const username of getAllUsernames(user)) {
    if (username.toLowerCase().includes(normalizedQuery)) return true;
  }

  const first = (user.firstName ?? '').trim().toLowerCase();
  const last = (user.lastName ?? '').trim().toLowerCase();
  const full = `${first} ${last}`.trim();

  if (full.includes(normalizedQuery)) return true;
  if (first.startsWith(normalizedQuery) || last.startsWith(normalizedQuery)) return true;

  const displayName = user.display?.name?.trim().toLowerCase();
  if (displayName && displayName.includes(normalizedQuery)) return true;

  return false;
}

/**
 * Deduplicate, drop self & deleted accounts, and filter candidate users by `@query`.
 * Preserves input ordering (e.g. top inline bots first, then group members).
 */
export function filterMentionUsers<T extends MentionCandidateUser>(
  users: readonly T[],
  query: string,
  currentUserId?: string,
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  const seen = new Set<string>();
  const filtered: T[] = [];

  for (const user of users) {
    if (!user || !user.id || seen.has(user.id)) continue;
    seen.add(user.id);
    if (user.deleted) continue;
    if (currentUserId && user.id === currentUserId) continue;
    if (!getMainUsername(user) && !user.display?.name?.trim()) continue;
    if (matchesQuery(user, normalizedQuery)) {
      filtered.push(user);
    }
  }

  return filtered;
}

export type MentionInsertionResult<T extends { offset: number; length: number }> = {
  text: string;
  entities: T[];
  caret: number;
};

/**
 * Replace `[range.startIndex, range.endIndex]` with either `@username` (plain text)
 * or `displayName` + a `MessageEntityMentionName` entity when the user has no username.
 * Re-bases existing entities around the replaced range and adds a trailing space unless one
 * is already present at `range.endIndex`.
 */
export function buildMentionInsertion<
  T extends { offset: number; length: number } = OutgoingMessageEntity,
>(
  text: string,
  entities: readonly T[] | undefined,
  range: Pick<MentionQueryMatch, 'startIndex' | 'endIndex'>,
  user: MentionCandidateUser,
): MentionInsertionResult<T> {
  const mainUsername = getMainUsername(user);
  const displayName = (user.display?.name || `${user.firstName ?? ''} ${user.lastName ?? ''}`).trim();
  const insertToken = mainUsername ? `@${mainUsername}` : displayName;

  if (!insertToken) {
    return {
      text,
      entities: entities ? [...entities] : [],
      caret: range.endIndex,
    };
  }

  const before = text.slice(0, range.startIndex);
  const after = text.slice(range.endIndex);
  const hasTrailingSpace = after.startsWith(' ');
  const inserted = hasTrailingSpace ? insertToken : `${insertToken} `;
  const nextText = `${before}${inserted}${after}`;

  const delta = inserted.length - (range.endIndex - range.startIndex);
  const nextEntities: T[] = (entities ?? []).flatMap((entity) => {
    if (typeof entity.offset !== 'number' || typeof entity.length !== 'number') return [];
    if (entity.offset >= range.endIndex) return [{ ...entity, offset: entity.offset + delta }];
    if (entity.offset + entity.length <= range.startIndex) return [entity];
    return [];
  });

  if (!mainUsername) {
    const mentionEntity: MentionNameEntity = {
      className: 'MessageEntityMentionName',
      _: 'messageEntityMentionName',
      offset: range.startIndex,
      length: insertToken.length,
      userId: user.id,
    };
    nextEntities.push(mentionEntity as unknown as T);
  }

  nextEntities.sort((a, b) => a.offset - b.offset);

  const caret = range.startIndex + insertToken.length + 1;
  return {
    text: nextText,
    entities: nextEntities,
    caret: Math.min(caret, nextText.length),
  };
}
