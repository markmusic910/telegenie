import {
  coveringCustomEmojiId,
  rebaseEntities,
  SINGLE_CUSTOM_EMOJI_SIZE,
  soleEmoji,
} from './emoji.grapheme';

describe('rebaseEntities', () => {
  const emoji = { className: 'MessageEntityCustomEmoji', offset: 2, length: 2, documentId: '9' };

  it('keeps an entity when text is typed after it', () => {
    expect(rebaseEntities('hi😁', 'hi😁 yo', [emoji])).toEqual([emoji]);
  });

  it('shifts an entity when text is typed before it', () => {
    expect(rebaseEntities('hi😁', 'oh hi😁', [emoji])).toEqual([{ ...emoji, offset: 5 }]);
    expect(rebaseEntities('hi😁', 'h😁', [emoji])).toEqual([{ ...emoji, offset: 1 }]);
  });

  it('keeps entities on both sides of an edit between them', () => {
    const left = { ...emoji, offset: 0 };
    const right = { ...emoji, offset: 3, documentId: '7' };
    expect(rebaseEntities('😁 😁', '😁xx 😁', [left, right])).toEqual([
      left,
      { ...right, offset: 5 },
    ]);
  });

  it('drops an entity the edit removed or split', () => {
    expect(rebaseEntities('hi😁', 'hi', [emoji])).toEqual([]);
    expect(rebaseEntities('hi😁', 'hi😀', [emoji])).toEqual([]);
  });
});

describe('soleEmoji', () => {
  it('accepts one emoji grapheme and rejects surrounding text', () => {
    expect(soleEmoji('😁')).toBe('😁');
    expect(soleEmoji('  😁  ')).toBe('😁');
    expect(soleEmoji('😁😁')).toBeUndefined();
    expect(soleEmoji('hi')).toBeUndefined();
  });

  it('uses the 7rem emoji-only size for one custom emoji', () => {
    expect(SINGLE_CUSTOM_EMOJI_SIZE).toBe(112);
  });

  it('reads a custom emoji that covers the whole string', () => {
    expect(
      coveringCustomEmojiId('😁', [
        { className: 'MessageEntityCustomEmoji', offset: 0, length: 2, documentId: '9' },
      ]),
    ).toBe('9');
    expect(
      coveringCustomEmojiId('😁 hi', [
        { className: 'MessageEntityCustomEmoji', offset: 0, length: 2, documentId: '9' },
      ]),
    ).toBeUndefined();
  });
});
