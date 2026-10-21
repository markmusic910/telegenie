import {
  coerceMessageCacheIndex,
  emptyMessageCacheIndex,
  findUnresolvedChannelHole,
  ingestChannelSpan,
  ingestHistorySlice,
  ingestLiveIds,
  markCachedDeleted,
  reconcileIndex,
  takeCachedAround,
  takeCachedNewest,
  takeCachedRun,
} from './message-cache-index';

describe('message-cache-index', () => {
  it('connects a history page into one island', () => {
    const index = ingestHistorySlice(emptyMessageCacheIndex(), [14, 12, 10]);
    expect(index.cachedIds).toEqual([10, 12, 14]);
    expect(index.breaksAfter).toEqual([]);
  });

  it('adds a private break for a disjoint around load', () => {
    const first = ingestHistorySlice(emptyMessageCacheIndex(), [10, 12, 14]);
    const index = ingestHistorySlice(first, [79, 80, 82]);
    expect(index.cachedIds).toEqual([10, 12, 14, 79, 80, 82]);
    expect(index.breaksAfter).toEqual([14]);
  });

  it('merges islands when a later page overlaps both edges', () => {
    const split = ingestHistorySlice(
      ingestHistorySlice(emptyMessageCacheIndex(), [10, 12, 14]),
      [79, 80, 82],
    );
    const index = ingestHistorySlice(split, [14, 50, 70], { edgeId: 79 });
    expect(index.cachedIds).toEqual([10, 12, 14, 50, 70, 79, 80, 82]);
    expect(index.breaksAfter).toEqual([]);
  });

  it('does not add a break when deleting inside an island', () => {
    const index = markCachedDeleted(ingestHistorySlice(emptyMessageCacheIndex(), [10, 12, 14]), [
      12,
    ]);
    expect(index.cachedIds).toEqual([10, 14]);
    expect(index.deletedIds).toEqual([12]);
    expect(index.breaksAfter).toEqual([]);
  });

  it('keeps an island split when deleting the left edge of a break', () => {
    const split = ingestHistorySlice(
      ingestHistorySlice(emptyMessageCacheIndex(), [10, 12, 14]),
      [79, 80],
    );
    const index = markCachedDeleted(split, [14]);
    expect(index.cachedIds).toEqual([10, 12, 79, 80]);
    expect(index.breaksAfter).toEqual([12]);
  });

  it('stops takeCachedRun at a private break', () => {
    const index = ingestHistorySlice(
      ingestHistorySlice(emptyMessageCacheIndex(), [10, 12, 14]),
      [79, 80, 82],
    );
    expect(takeCachedRun(index, 79, 'older', 10, 'private')).toEqual([]);
    expect(takeCachedRun(index, 14, 'newer', 10, 'private')).toEqual([]);
    expect(takeCachedRun(index, 80, 'older', 10, 'private')).toEqual([79]);
    expect(takeCachedRun(index, 10, 'newer', 10, 'private')).toEqual([12, 14]);
  });

  it('marks missing ids inside a channel span as deleted and unknown outside', () => {
    const index = ingestChannelSpan(emptyMessageCacheIndex(), 10, 20, [10, 12, 20], []);
    expect(index.cachedIds).toEqual([10, 12, 20]);
    expect(index.deletedIds).toContain(11);
    expect(index.deletedIds).toContain(19);
    expect(findUnresolvedChannelHole(index, 1, 9)).toEqual([1, 9]);
    expect(findUnresolvedChannelHole(index, 10, 20)).toBeNull();
    expect(takeCachedRun(index, 12, 'older', 5, 'channel')).toEqual([10]);
    expect(takeCachedRun(index, 12, 'newer', 5, 'channel')).toEqual([20]);
  });

  it('connects a live newest id to the previous max', () => {
    const index = ingestLiveIds(ingestHistorySlice(emptyMessageCacheIndex(), [80, 82]), [101]);
    expect(index.cachedIds).toEqual([80, 82, 101]);
    expect(index.breaksAfter).toEqual([]);
  });

  it('takes a window around an anchor within one island', () => {
    const index = ingestHistorySlice(
      emptyMessageCacheIndex(),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    );
    expect(takeCachedAround(index, 5, 5, 'private')).toEqual([3, 4, 5, 6, 7]);
  });

  it('takes a newest run only when topId is cached', () => {
    const index = ingestHistorySlice(
      ingestHistorySlice(emptyMessageCacheIndex(), [10, 12, 14]),
      [79, 80, 82],
    );
    expect(takeCachedNewest(index, 82, 10, 'private')).toEqual([79, 80, 82]);
    expect(takeCachedNewest(index, 14, 10, 'private')).toEqual([10, 12, 14]);
    expect(takeCachedNewest(index, 100, 10, 'private')).toEqual([]);
  });

  it('reconciles cached ids against the entity store', () => {
    const index = ingestHistorySlice(emptyMessageCacheIndex(), [10, 12, 14]);
    const next = reconcileIndex(index, [10, 14]);
    expect(next.cachedIds).toEqual([10, 14]);
    expect(next.breaksAfter).toEqual([]);
  });

  it('coerces missing snapshot fields', () => {
    expect(coerceMessageCacheIndex(undefined)).toEqual(emptyMessageCacheIndex());
  });
});
