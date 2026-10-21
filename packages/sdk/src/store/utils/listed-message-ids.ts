
/** Sorted unique numeric message ids for a listed scroller window. */
export function sortMessageIds(ids: Iterable<string>): string[] {
  const unique = new Set<string>();
  for (const id of ids) {
    if (!Number.isFinite(Number(id))) continue;
    unique.add(id);
  }
  return [...unique].sort((a, b) => Number(a) - Number(b));
}

export function listedIdsFromMessages(
  messages: Iterable<{ id: string | number; isEmpty?: boolean; date?: number; peerId?: string }>,
  peerId?: string,
): string[] {
  const ids: string[] = [];
  for (const message of messages) {
    if (message.isEmpty || !(message.date && message.date > 0)) continue;
    if (peerId && message.peerId && message.peerId !== peerId) continue;
    ids.push(String(message.id));
  }
  return sortMessageIds(ids);
}

export function mergeListedIds(listed: string[], incoming: string[]): string[] {
  return sortMessageIds([...listed, ...incoming]);
}

/** Default message count per slice (matches GET_HISTORY_LIMIT). */
export const MESSAGE_LIST_SLICE = 50;
/** Maximum viewport limit (2 * MESSAGE_LIST_SLICE = 100). */
export const MESSAGE_LIST_VIEWPORT_LIMIT = MESSAGE_LIST_SLICE * 2;
/** Alias for backwards compatibility. */
export const LISTED_WINDOW_MAX = MESSAGE_LIST_VIEWPORT_LIMIT;

export type LoadMoreDirection = 'backwards' | 'forwards' | 'around';

export interface ViewportSliceResult {
  newViewportIds: string[];
  areSomeLocal: boolean;
  areAllLocal: boolean;
}

/** Strip DOM list-item prefixes (e.g. "msg-123", "action-123") if present. */
export function normalizeAnchorMessageId(anchorId?: string): string | undefined {
  if (!anchorId) return undefined;
  if (anchorId.startsWith('msg-')) return anchorId.slice(4);
  if (anchorId.startsWith('action-')) return anchorId.slice(7);
  return anchorId;
}

/**
 * Finds the index of the closest message id in a sorted array,
 * matching telegram-genie findClosestIndex semantics.
 */
export function findClosestIndex(sourceIds: string[], offsetId: string): number {
  const { length } = sourceIds;
  if (length === 0) return -1;
  const numOffset = Number(offsetId);
  const first = Number(sourceIds[0]);
  const last = Number(sourceIds[length - 1]);

  if (numOffset < first) {
    return 0;
  }
  if (numOffset > last) {
    return length - 1;
  }

  return sourceIds.findIndex((id, i) => {
    const current = Number(id);
    const next = Number(sourceIds[i + 1]);
    return current === numOffset || (current < numOffset && next > numOffset);
  });
}

/**
 * Slices sourceIds around offsetId according to direction, matching telegram-genie getViewportSlice:
 * - backwards (sliding older): preserves up to sliceSize newly loaded messages before offsetId
 *   and keeps sliceSize buffer messages after offsetId.
 * - forwards (sliding newer): preserves up to sliceSize buffer messages before offsetId
 *   and captures up to sliceSize newly loaded messages after offsetId.
 * - around (focusing/jumping): centers sliceSize messages around offsetId.
 */
export function getViewportSlice(
  sourceIds: string[],
  offsetId: string | undefined,
  direction: LoadMoreDirection | 'prepend' | 'append' | 'replace',
  sliceSize: number = MESSAGE_LIST_SLICE,
): ViewportSliceResult {
  const { length } = sourceIds;
  if (length === 0) {
    return { newViewportIds: [], areSomeLocal: false, areAllLocal: true };
  }

  const normalizedOffset = normalizeAnchorMessageId(offsetId);
  const index = normalizedOffset != null ? findClosestIndex(sourceIds, normalizedOffset) : -1;
  const isBackwards = direction === 'backwards' || direction === 'prepend';
  const isAround = direction === 'around' || direction === 'replace';
  const indexForDirection = isBackwards
    ? (index >= 0 ? index : 0)
    : (index + 1) || length;
  const currentSliceSize = isAround ? Math.max(1, Math.round(sliceSize / 2)) : sliceSize;
  const targetLimit = isAround ? sliceSize : currentSliceSize * 2;

  const rawFrom = isBackwards && index < 0 ? 0 : indexForDirection - currentSliceSize;
  const rawTo =
    isBackwards && index < 0 ? currentSliceSize - 1 : indexForDirection + currentSliceSize - 1;

  let areSomeLocal = false;
  let areAllLocal = false;
  if (isBackwards) {
    areSomeLocal = indexForDirection >= 0;
    areAllLocal = rawFrom >= 0;
  } else if (!isAround) {
    areSomeLocal = indexForDirection < length;
    areAllLocal = rawTo <= length - 1;
  } else {
    areSomeLocal = rawTo >= 0 && rawFrom < length;
    areAllLocal = length >= targetLimit;
  }

  // If the total available messages fit in the target window, never drop anything.
  if (length <= targetLimit) {
    return {
      newViewportIds: sourceIds,
      areSomeLocal,
      areAllLocal: true,
    };
  }

  let from = rawFrom;
  let to = rawTo;

  if (isBackwards) {
    from = Math.max(0, rawFrom);
    to = Math.min(length - 1, rawTo);
  } else {
    // forwards and around: shift backwards when hitting the end of sourceIds
    // so older buffer messages and anchor rows are preserved up to targetLimit.
    if (to > length - 1) {
      const deficit = to - (length - 1);
      to = length - 1;
      from = Math.max(0, from - deficit);
    }
    if (from < 0) {
      from = 0;
    }
  }

  // Ensure window does not exceed targetLimit
  if (to - from + 1 > targetLimit) {
    if (isBackwards) {
      to = from + targetLimit - 1;
    } else {
      from = to - targetLimit + 1;
    }
  }

  const newViewportIds = sourceIds.slice(Math.max(0, from), to + 1);

  return { newViewportIds, areSomeLocal, areAllLocal };
}

export function trimListedWindow(
  listed: string[],
  mode: 'prepend' | 'append' | 'replace',
  max?: number,
  anchorId?: string,
): string[] {
  const ids = sortMessageIds(listed);
  const sliceSize = max ? Math.max(1, Math.round(max / 2)) : MESSAGE_LIST_SLICE;
  const direction: LoadMoreDirection =
    mode === 'prepend' ? 'backwards' : mode === 'append' ? 'forwards' : 'around';
  return getViewportSlice(ids, anchorId, direction, sliceSize).newViewportIds;
}

export function removeListedIds(listed: string[], remove: Iterable<string>): string[] {
  const drop = new Set(remove);
  return listed.filter((id) => !drop.has(id));
}

/** Pixel restore is valid only for the same listed island that was persisted. */
export function listedWindowMatchesScrollAnchor(
  listedIds: string[] | undefined,
  minId?: string,
  maxId?: string,
): boolean {
  if (!listedIds?.length || minId == null || maxId == null) return false;
  return listedIds[0] === minId && listedIds[listedIds.length - 1] === maxId;
}
