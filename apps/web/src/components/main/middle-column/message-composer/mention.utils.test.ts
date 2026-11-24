import type { OutgoingMessageEntity } from '@telegenie/sdk';
import {
  buildMentionInsertion,
  extractMentionQuery,
  filterMentionUsers,
  getMainUsername,
  type MentionCandidateUser,
} from './mention.utils';

function makeUser(overrides: Partial<MentionCandidateUser> & { id: string }): MentionCandidateUser {
  const firstName = overrides.firstName ?? '';
  const lastName = overrides.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim() || 'User';
  return {
    id: overrides.id,
    firstName,
    lastName,
    username: overrides.username,
    usernames: overrides.usernames,
    deleted: overrides.deleted,
    display: overrides.display ?? {
      name: fullName,
      initials: fullName.slice(0, 2).toUpperCase(),
      isDeleted: Boolean(overrides.deleted),
      isSavedMessages: false,
    },
  };
}

describe('extractMentionQuery', () => {
  it('matches @ at the start of a message', () => {
    expect(extractMentionQuery('@', 1, 1)).toEqual({
      query: '',
      startIndex: 0,
      endIndex: 1,
      atStartOfMessage: true,
    });
    expect(extractMentionQuery('@gif', 4, 4)).toEqual({
      query: 'gif',
      startIndex: 0,
      endIndex: 4,
      atStartOfMessage: true,
    });
  });

  it('matches @ after whitespace and mid-sentence', () => {
    expect(extractMentionQuery('Hello @ali world', 10, 10)).toEqual({
      query: 'ali',
      startIndex: 6,
      endIndex: 10,
      atStartOfMessage: false,
    });
    expect(extractMentionQuery('Line 1\n@bob', 11, 11)).toEqual({
      query: 'bob',
      startIndex: 7,
      endIndex: 11,
      atStartOfMessage: false,
    });
  });

  it('supports unicode characters in query', () => {
    expect(extractMentionQuery('Hi @Алиса', 9, 9)).toEqual({
      query: 'Алиса',
      startIndex: 3,
      endIndex: 9,
      atStartOfMessage: false,
    });
  });

  it('ignores non-collapsed selections and emails', () => {
    expect(extractMentionQuery('@alice', 0, 6)).toBeUndefined();
    expect(extractMentionQuery('user@example.com', 12, 12)).toBeUndefined();
    expect(extractMentionQuery('Hello world', 11, 11)).toBeUndefined();
  });
});

describe('getMainUsername & filterMentionUsers', () => {
  const alice = makeUser({ id: '1', firstName: 'Alice', lastName: 'Smith', username: 'alicesmith' });
  const bob = makeUser({ id: '2', firstName: 'Bob', lastName: 'Jones' });
  const collectible = makeUser({
    id: '3',
    firstName: 'Carol',
    usernames: [
      { username: 'inactive_handle', active: false },
      { username: 'carol_nft', active: true },
    ],
  });
  const deleted = makeUser({ id: '4', firstName: 'Ghost', deleted: true });

  it('resolves primary username from username or active usernames', () => {
    expect(getMainUsername(alice)).toBe('alicesmith');
    expect(getMainUsername(bob)).toBeUndefined();
    expect(getMainUsername(collectible)).toBe('carol_nft');
  });

  it('excludes current user, deleted accounts, and duplicates', () => {
    const result = filterMentionUsers([alice, alice, bob, collectible, deleted], '', '1');
    expect(result.map((u) => u.id)).toEqual(['2', '3']);
  });

  it('filters by first name, last name, username, and active usernames', () => {
    const pool = [alice, bob, collectible, deleted];
    expect(filterMentionUsers(pool, 'ali').map((u) => u.id)).toEqual(['1']);
    expect(filterMentionUsers(pool, 'jones').map((u) => u.id)).toEqual(['2']);
    expect(filterMentionUsers(pool, 'nft').map((u) => u.id)).toEqual(['3']);
    expect(filterMentionUsers(pool, 'inactive').map((u) => u.id)).toEqual([]);
  });
});

describe('buildMentionInsertion', () => {
  const alice = makeUser({ id: '1', firstName: 'Alice', username: 'alicesmith' });
  const bob = makeUser({ id: '2', firstName: 'Bob', lastName: 'Jones' });

  it('inserts @username with a trailing space and rebases surrounding entities', () => {
    // Text: "🌟 hi @al 🌟" (UTF-16: 🌟=[0,2), " hi "=[2,6), "@al"=[6,9), " "=[9,10), 🌟=[10,12))
    const text = '🌟 hi @al 🌟';
    const existing: OutgoingMessageEntity[] = [
      { className: 'MessageEntityCustomEmoji', offset: 0, length: 2, documentId: '100' },
      { className: 'MessageEntityCustomEmoji', offset: 10, length: 2, documentId: '200' },
    ];
    const res = buildMentionInsertion(text, existing, { startIndex: 6, endIndex: 9 }, alice);

    // After "@al" there is already a space, so no double space is added
    expect(res.text).toBe('🌟 hi @alicesmith 🌟');
    expect(res.caret).toBe(6 + '@alicesmith'.length + 1);
    expect(res.entities).toEqual([
      { className: 'MessageEntityCustomEmoji', offset: 0, length: 2, documentId: '100' },
      { className: 'MessageEntityCustomEmoji', offset: 18, length: 2, documentId: '200' },
    ]);
  });

  it('inserts display name + MessageEntityMentionName for users without a username', () => {
    const res = buildMentionInsertion('Hey @bo', [], { startIndex: 4, endIndex: 7 }, bob);

    expect(res.text).toBe('Hey Bob Jones ');
    expect(res.caret).toBe('Hey Bob Jones '.length);
    expect(res.entities).toEqual([
      {
        className: 'MessageEntityMentionName',
        _: 'messageEntityMentionName',
        offset: 4,
        length: 'Bob Jones'.length,
        userId: '2',
      },
    ]);
  });
});
