import {
  extendRangesFromIds,
  extendRangesFromSpan,
  findGapInRanges,
  normalizeRanges,
  noteMessageIdInBox,
  rangesContain,
} from './msg-id-ranges';

describe('msg-id-ranges', () => {
  it('notes first message into a new range', () => {
    const box = noteMessageIdInBox(undefined, 10, 1);
    expect(box.ranges).toEqual([{ start: 10, end: 10 }]);
    expect(box.pending).toBe(false);
  });

  it('extends last range end when not pending', () => {
    const box = noteMessageIdInBox(
      { boxId: 'common', pending: false, ranges: [{ start: 1, end: 5 }], updatedAt: 0 },
      8,
      1,
    );
    expect(rangesContain(box.ranges, 8)).toBe(true);
  });

  it('starts a new segment when pending after unfillable gap', () => {
    const box = noteMessageIdInBox(
      { boxId: 'common', pending: true, ranges: [{ start: 1, end: 5 }], updatedAt: 0 },
      100,
      1,
    );
    expect(box.pending).toBe(false);
    expect(box.ranges).toEqual([
      { start: 1, end: 5 },
      { start: 100, end: 100 },
    ]);
  });

  it('finds gaps in displayed range', () => {
    expect(findGapInRanges([{ start: 1, end: 3 }, { start: 6, end: 8 }], 1, 8)).toEqual([
      4, 5,
    ]);
    expect(findGapInRanges([{ start: 1, end: 10 }], 2, 5)).toBeNull();
  });

  it('returns null when from > to', () => {
    expect(findGapInRanges([{ start: 1, end: 10 }], 5, 3)).toBeNull();
  });

  it('returns trailing gap after last covering range', () => {
    expect(findGapInRanges([{ start: 1, end: 3 }], 1, 8)).toEqual([4, 8]);
  });

  it('skips ranges entirely before cursor', () => {
    expect(findGapInRanges([{ start: 1, end: 2 }, { start: 5, end: 6 }], 4, 6)).toEqual([4, 4]);
  });

  it('notes into empty non-pending ranges', () => {
    const box = noteMessageIdInBox(
      { boxId: 'common', pending: false, ranges: [], updatedAt: 0 },
      3,
      1,
    );
    expect(box.ranges).toEqual([{ start: 3, end: 3 }]);
  });

  it('falls back to merge insert when msgId goes backwards', () => {
    const box = noteMessageIdInBox(
      { boxId: 'common', pending: false, ranges: [{ start: 10, end: 10 }], updatedAt: 0 },
      5,
      1,
    );
    expect(box.ranges).toEqual([{ start: 5, end: 10 }]);
  });

  it('extends a contiguous channel history span', () => {
    const box = extendRangesFromSpan(undefined, 'chan', 25, 75, 1);
    expect(box.ranges).toEqual([{ start: 25, end: 75 }]);
    expect(findGapInRanges(box.ranges, 25, 75)).toBeNull();
  });

  it('extends from fetched ids', () => {
    const box = extendRangesFromIds(undefined, 'common', [1, 2, 4], 1);
    expect(box.ranges).toEqual([
      { start: 1, end: 2 },
      { start: 4, end: 4 },
    ]);
  });

  it('returns base box when extending with empty ids', () => {
    const box = extendRangesFromIds(
      { boxId: 'common', pending: true, ranges: [{ start: 1, end: 1 }], updatedAt: 0 },
      'common',
      [],
      9,
    );
    expect(box.ranges).toEqual([{ start: 1, end: 1 }]);
    expect(box.updatedAt).toBe(9);
    expect(box.pending).toBe(true);
  });

  describe('normalizeRanges', () => {
    it('returns empty array for empty input', () => {
      expect(normalizeRanges([])).toEqual([]);
    });

    it('keeps a single range unchanged', () => {
      expect(normalizeRanges([{ start: 5, end: 10 }])).toEqual([{ start: 5, end: 10 }]);
    });

    it('swaps inverted start/end within a range', () => {
      expect(normalizeRanges([{ start: 10, end: 3 }])).toEqual([{ start: 3, end: 10 }]);
    });

    it('sorts disjoint ranges by start', () => {
      expect(
        normalizeRanges([
          { start: 20, end: 25 },
          { start: 1, end: 5 },
        ]),
      ).toEqual([
        { start: 1, end: 5 },
        { start: 20, end: 25 },
      ]);
    });

    it('merges overlapping ranges', () => {
      expect(
        normalizeRanges([
          { start: 1, end: 5 },
          { start: 4, end: 10 },
        ]),
      ).toEqual([{ start: 1, end: 10 }]);
    });

    it('merges when one range fully contains another', () => {
      expect(
        normalizeRanges([
          { start: 1, end: 20 },
          { start: 5, end: 8 },
        ]),
      ).toEqual([{ start: 1, end: 20 }]);
    });

    it('merges adjacent ranges that touch (end + 1 === next.start)', () => {
      expect(
        normalizeRanges([
          { start: 1, end: 5 },
          { start: 6, end: 10 },
        ]),
      ).toEqual([{ start: 1, end: 10 }]);
    });

    it('merges multiple overlapping and adjacent ranges into one', () => {
      expect(
        normalizeRanges([
          { start: 8, end: 12 },
          { start: 1, end: 3 },
          { start: 3, end: 5 },
          { start: 6, end: 9 },
        ]),
      ).toEqual([{ start: 1, end: 12 }]);
    });

    it('keeps separate clusters when a gap remains', () => {
      expect(
        normalizeRanges([
          { start: 1, end: 4 },
          { start: 3, end: 5 },
          { start: 10, end: 12 },
          { start: 11, end: 15 },
        ]),
      ).toEqual([
        { start: 1, end: 5 },
        { start: 10, end: 15 },
      ]);
    });

    it('handles identical duplicate ranges', () => {
      expect(
        normalizeRanges([
          { start: 2, end: 4 },
          { start: 2, end: 4 },
        ]),
      ).toEqual([{ start: 2, end: 4 }]);
    });
  });
});
