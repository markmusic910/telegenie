/**
 * Pure helpers for a thread's message cache index (`ThreadUIState.msgIndexes`).
 *
 * `cachedIds` is sorted, but adjacent entries are not always neighbors in this
 * chat's history. Private chats / basic groups record island splits in
 * `breaksAfter` (left id is not connected to the next cached id). Example:
 * `cachedIds = [10, 12, 14, 79, 80, 82]`, `breaksAfter = [14]` → islands
 * `10–14` and `79–82`. Fill private holes with `getHistory` from an edge, never
 * by enumerating `15..78`. A delete does not add a break.
 *
 * Channels are sequential: `resolvedRanges` are ID spans we have resolved.
 * A numeric hole inside a span is deleted; a hole outside is unknown
 * (`getMessages`). Sliding skips deleted ids. `breaksAfter` is unused.
 */

export type MessageCacheKind = 'private' | 'channel';

export type MessageCacheIndex = {
  /** Sorted renderable message ids that exist in the entity store. */
  cachedIds: number[];
  /** Sorted ids known deleted; not listed and not refetched. */
  deletedIds: number[];
  /** Private: left edge of each island split (not connected to the next cached id). */
  breaksAfter: number[];
  /** Channel: inclusive ID spans that have been resolved (present or deleted). */
  resolvedRanges: Array<[number, number]>;
};

export type HistoryIngestDirection = 'older' | 'newer' | 'around' | 'replace';

/** Empty index used for new threads and failed snapshot coerce. */
export function emptyMessageCacheIndex(): MessageCacheIndex {
  return {
    cachedIds: [],
    deletedIds: [],
    breaksAfter: [],
    resolvedRanges: [],
  };
}

/** Normalize a persisted or partial snapshot into a valid index. */
export function coerceMessageCacheIndex(value: unknown): MessageCacheIndex {
  if (!value || typeof value !== 'object') return emptyMessageCacheIndex();
  const row = value as Partial<MessageCacheIndex>;
  return {
    cachedIds: sortUniqueNumbers(row.cachedIds ?? []),
    deletedIds: sortUniqueNumbers(row.deletedIds ?? []),
    breaksAfter: sortUniqueNumbers(row.breaksAfter ?? []),
    resolvedRanges: normalizeResolvedRanges(row.resolvedRanges ?? []),
  };
}

/** Positive unique ids, sorted ascending. Drops 0 / NaN / negatives. */
export function sortUniqueNumbers(ids: Iterable<number>): number[] {
  const unique = new Set<number>();
  for (const id of ids) {
    if (!Number.isFinite(id) || id <= 0) continue;
    unique.add(id);
  }
  return [...unique].sort((a, b) => a - b);
}

/**
 * Merge a `getHistory` page into the index.
 *
 * Ids in the slice are connected to each other. If `edgeId` is already cached,
 * they are also connected to that fetch edge (island merge). Disjoint pages
 * (e.g. two `around` loads) add a `breaksAfter` on the left of the new gap.
 * Does not insert `edgeId` into `cachedIds` unless it is in the slice or was
 * already cached.
 */
export function ingestHistorySlice(
  index: MessageCacheIndex,
  ids: number[],
  opts?: { edgeId?: number },
): MessageCacheIndex {
  const slice = sortUniqueNumbers(ids);
  if (slice.length === 0 && !(opts?.edgeId && index.cachedIds.includes(opts.edgeId))) {
    return index;
  }

  const cachedBefore = index.cachedIds;
  const cachedIds = sortUniqueNumbers([...cachedBefore, ...slice]);
  const deletedIds = index.deletedIds.filter((id) => !slice.includes(id));
  const connected = new Set(sortUniqueNumbers(
    opts?.edgeId != null && cachedIds.includes(opts.edgeId) ? [...slice, opts.edgeId] : slice,
  ));
  const breaks = new Set(index.breaksAfter);
  const beforePairs = consecutivePairs(cachedBefore);

  for (let i = 0; i < cachedIds.length - 1; i += 1) {
    const left = cachedIds[i];
    const right = cachedIds[i + 1];
    if (connected.has(left) && connected.has(right)) {
      breaks.delete(left);
      continue;
    }
    if (!beforePairs.has(pairKey(left, right))) {
      breaks.add(left);
    }
  }

  for (const id of [...breaks]) {
    if (!cachedIds.includes(id)) breaks.delete(id);
  }

  return {
    ...index,
    cachedIds,
    deletedIds,
    breaksAfter: sortUniqueNumbers(breaks),
  };
}

/**
 * Append live newest ids. If they sit above the previous cached max, the
 * previous max is treated as connected (no break between the live tail and
 * the newest island).
 */
export function ingestLiveIds(index: MessageCacheIndex, ids: number[]): MessageCacheIndex {
  const incoming = sortUniqueNumbers(ids);
  if (incoming.length === 0) return index;
  const prevMax = index.cachedIds[index.cachedIds.length - 1];
  const next = ingestHistorySlice(index, incoming);
  const newMax = incoming[incoming.length - 1];
  if (prevMax != null && newMax > prevMax) {
    return {
      ...next,
      breaksAfter: next.breaksAfter.filter((id) => id !== prevMax),
    };
  }
  return next;
}

/**
 * Record a resolved channel ID span. Present ids join `cachedIds`; every other
 * integer in `[min, max]` is treated as deleted. Overlapping spans merge.
 */
export function ingestChannelSpan(
  index: MessageCacheIndex,
  min: number,
  max: number,
  cachedIds: number[],
  deletedIds: number[] = [],
): MessageCacheIndex {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return index;

  const cached = sortUniqueNumbers(cachedIds);
  const cachedSet = new Set(cached);
  const deleted = new Set(deletedIds);
  for (let id = lo; id <= hi; id += 1) {
    if (!cachedSet.has(id)) deleted.add(id);
  }

  return {
    cachedIds: sortUniqueNumbers([...index.cachedIds, ...cached]),
    deletedIds: sortUniqueNumbers([...index.deletedIds.filter((id) => !cachedSet.has(id)), ...deleted]),
    breaksAfter: index.breaksAfter,
    resolvedRanges: normalizeResolvedRanges([...index.resolvedRanges, [lo, hi]]),
  };
}

/**
 * Remove ids from `cachedIds` and add them to `deletedIds`. Neighbors that
 * were already connected stay connected (no new break). If the deleted id was
 * a break edge, the split moves to the remaining left neighbor.
 */
export function markCachedDeleted(index: MessageCacheIndex, ids: number[]): MessageCacheIndex {
  const drop = new Set(sortUniqueNumbers(ids));
  if (drop.size === 0) return index;

  const cachedBefore = index.cachedIds;
  const cachedIds: number[] = [];
  const breaks = new Set(index.breaksAfter);

  for (let i = 0; i < cachedBefore.length; i += 1) {
    const id = cachedBefore[i];
    if (!drop.has(id)) {
      cachedIds.push(id);
      continue;
    }
    const left = cachedIds[cachedIds.length - 1];
    const right = nextKeptCached(cachedBefore, i + 1, drop);
    breaks.delete(id);
    if (left == null || right == null) continue;
    const leftBroke = breaks.has(left);
    const idBroke = index.breaksAfter.includes(id);
    if (leftBroke || idBroke) {
      breaks.add(left);
    } else {
      breaks.delete(left);
    }
  }

  return {
    ...index,
    cachedIds,
    deletedIds: sortUniqueNumbers([...index.deletedIds, ...drop]),
    breaksAfter: sortUniqueNumbers([...breaks].filter((id) => cachedIds.includes(id))),
  };
}

/**
 * Walk `cachedIds` from `fromId` until `limit`, a private `breaksAfter`, or an
 * unresolved channel hole. `fromId` itself is not included. Empty if `fromId`
 * is not cached.
 */
export function takeCachedRun(
  index: MessageCacheIndex,
  fromId: number,
  direction: 'older' | 'newer',
  limit: number,
  kind: MessageCacheKind,
): number[] {
  if (limit <= 0) return [];
  const cached = index.cachedIds;
  const fromIndex = binarySearch(cached, fromId);
  if (fromIndex < 0) return [];

  const out: number[] = [];
  if (direction === 'older') {
    for (let i = fromIndex - 1; i >= 0 && out.length < limit; i -= 1) {
      if (!pairConnected(index, cached[i], cached[i + 1], kind)) break;
      out.push(cached[i]);
    }
    out.reverse();
    return out;
  }

  for (let i = fromIndex + 1; i < cached.length && out.length < limit; i += 1) {
    if (!pairConnected(index, cached[i - 1], cached[i], kind)) break;
    out.push(cached[i]);
  }
  return out;
}

/**
 * Connected window around `anchorId` (or the nearest cached id), capped at
 * `limit`. Extra budget is filled from the older side first, then newer.
 */
export function takeCachedAround(
  index: MessageCacheIndex,
  anchorId: number,
  limit: number,
  kind: MessageCacheKind,
): number[] {
  if (limit <= 0) return [];
  const cached = index.cachedIds;
  let anchorIndex = binarySearch(cached, anchorId);
  if (anchorIndex < 0) {
    anchorIndex = nearestCachedIndex(cached, anchorId);
    if (anchorIndex < 0) return [];
  }

  const olderBudget = Math.floor((limit - 1) / 2);
  const newerBudget = limit - 1 - olderBudget;
  const older = takeCachedRun(index, cached[anchorIndex], 'older', olderBudget, kind);
  const newer = takeCachedRun(index, cached[anchorIndex], 'newer', newerBudget, kind);
  let ids = [...older, cached[anchorIndex], ...newer];

  if (ids.length < limit) {
    const extraOlder = takeCachedRun(
      index,
      ids[0],
      'older',
      limit - ids.length,
      kind,
    );
    ids = [...extraOlder, ...ids];
  }
  if (ids.length < limit) {
    const extraNewer = takeCachedRun(
      index,
      ids[ids.length - 1],
      'newer',
      limit - ids.length,
      kind,
    );
    ids = [...ids, ...extraNewer];
  }
  return ids.slice(0, limit);
}

/**
 * Newest connected run ending at `topId`, capped at `limit`. Empty if `topId`
 * is not cached (does not snap to a nearby island).
 */
export function takeCachedNewest(
  index: MessageCacheIndex,
  topId: number,
  limit: number,
  kind: MessageCacheKind,
): number[] {
  if (limit <= 0 || !isCachedId(index, topId)) return [];
  const older = takeCachedRun(index, topId, 'older', limit - 1, kind);
  return [...older, topId];
}

/**
 * First inclusive `[from, to]` span that is not covered by `resolvedRanges`.
 * `null` means the whole interval is known (present or deleted).
 */
export function findUnresolvedChannelHole(
  index: MessageCacheIndex,
  from: number,
  to: number,
): [number, number] | null {
  return findGapInResolved(index.resolvedRanges, from, to);
}

/**
 * Drop `cachedIds` that no longer exist in the entity store (post-hydrate).
 * Reply-target orphans in the store are ignored — they were never in `cachedIds`.
 */
export function reconcileIndex(
  index: MessageCacheIndex,
  presentIds: Iterable<number>,
): MessageCacheIndex {
  const present = new Set(sortUniqueNumbers(presentIds));
  const cachedIds = index.cachedIds.filter((id) => present.has(id));
  const cachedSet = new Set(cachedIds);
  return {
    cachedIds,
    deletedIds: index.deletedIds.filter((id) => !cachedSet.has(id)),
    breaksAfter: index.breaksAfter.filter((id, i, arr) => {
      if (!cachedSet.has(id)) return false;
      const cachedIndex = cachedIds.indexOf(id);
      return cachedIndex >= 0 && cachedIndex < cachedIds.length - 1 && arr.indexOf(id) === i;
    }),
    resolvedRanges: index.resolvedRanges,
  };
}

/** Whether `id` is in `cachedIds` (renderable, not merely in the entity store). */
export function isCachedId(index: MessageCacheIndex, id: number): boolean {
  return binarySearch(index.cachedIds, id) >= 0;
}

/** True if `left` and the next cached id `right` may be slid across. */
function pairConnected(
  index: MessageCacheIndex,
  left: number,
  right: number,
  kind: MessageCacheKind,
): boolean {
  if (kind === 'channel') {
    return findGapInResolved(index.resolvedRanges, left, right) == null;
  }
  return !index.breaksAfter.includes(left);
}

/** Next cached id after `start` that is not being deleted. */
function nextKeptCached(cached: number[], start: number, drop: Set<number>): number | undefined {
  for (let i = start; i < cached.length; i += 1) {
    if (!drop.has(cached[i])) return cached[i];
  }
  return undefined;
}

/** Adjacent pairs in a sorted id list, keyed as `left:right`. */
function consecutivePairs(ids: number[]): Set<string> {
  const pairs = new Set<string>();
  for (let i = 0; i < ids.length - 1; i += 1) {
    pairs.add(pairKey(ids[i], ids[i + 1]));
  }
  return pairs;
}

/** Stable key for an ordered adjacent pair. */
function pairKey(left: number, right: number): string {
  return `${left}:${right}`;
}

/** Index of `id` in a sorted array, or `-1`. */
function binarySearch(ids: number[], id: number): number {
  let lo = 0;
  let hi = ids.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ids[mid] === id) return mid;
    if (ids[mid] < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

/** Closest index to `id` in a sorted array, or `-1` if empty. */
function nearestCachedIndex(ids: number[], id: number): number {
  if (ids.length === 0) return -1;
  let lo = 0;
  let hi = ids.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ids[mid] === id) return mid;
    if (ids[mid] < id) lo = mid + 1;
    else hi = mid - 1;
  }
  if (lo <= 0) return 0;
  if (lo >= ids.length) return ids.length - 1;
  const prev = ids[lo - 1];
  const next = ids[lo];
  return Math.abs(id - prev) <= Math.abs(next - id) ? lo - 1 : lo;
}

/** Sort, clamp, and merge overlapping or adjacent `[start, end]` spans. */
function normalizeResolvedRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  if (ranges.length === 0) return [];
  const sorted = ranges
    .map(([start, end]) => [Math.min(start, end), Math.max(start, end)] as [number, number])
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end))
    .sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  for (const range of sorted) {
    const last = out[out.length - 1];
    if (!last) {
      out.push([...range]);
      continue;
    }
    if (range[0] <= last[1] + 1) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      out.push([...range]);
    }
  }
  return out;
}

/**
 * First hole in `[from, to]` not covered by `ranges`. `null` if fully covered.
 */
function findGapInResolved(
  ranges: Array<[number, number]>,
  from: number,
  to: number,
): [number, number] | null {
  if (from > to) return null;
  let cursor = from;
  const sorted = normalizeResolvedRanges(ranges);
  for (const [start, end] of sorted) {
    if (end < cursor) continue;
    if (start > cursor) {
      return [cursor, Math.min(to, start - 1)];
    }
    cursor = end + 1;
    if (cursor > to) return null;
  }
  if (cursor <= to) return [cursor, to];
  return null;
}
