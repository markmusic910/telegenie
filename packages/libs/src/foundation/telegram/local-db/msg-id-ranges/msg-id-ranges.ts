import type { MsgIdRange, MsgIdRangeBox } from '../types';

/** Whether msgId is covered by any range (inclusive). */
export function rangesContain(ranges: MsgIdRange[], msgId: number): boolean {
  return ranges.some((r) => msgId >= r.start && msgId <= r.end);
}

/** Find first missing id in [from, to] inclusive, or null if fully covered. */
export function findGapInRanges(
  ranges: MsgIdRange[],
  from: number,
  to: number,
): [number, number] | null {
  if (from > to) return null;
  let cursor = from;
  const sorted = normalizeRanges(ranges);
  for (const r of sorted) {
    if (r.end < cursor) continue;
    if (r.start > cursor) {
      return [cursor, Math.min(to, r.start - 1)];
    }
    cursor = r.end + 1;
    if (cursor > to) return null;
  }
  if (cursor <= to) return [cursor, to];
  return null;
}

/**
 * Telegram docs algorithm for observing a message id via socket / getDifference:
 * - if pending: append Pair(msgId,msgId), pending=false
 * - else: extend last range end to msgId
 * Also merges overlapping/adjacent ranges for robustness.
 */
export function noteMessageIdInBox(box: MsgIdRangeBox | undefined, msgId: number, now: number): MsgIdRangeBox {
  if (!box) {
    return {
      boxId: '',
      pending: false,
      ranges: [{ start: msgId, end: msgId }],
      updatedAt: now,
    };
  }

  if (box.pending) {
    return {
      ...box,
      pending: false,
      ranges: normalizeRanges([...box.ranges, { start: msgId, end: msgId }]),
      updatedAt: now,
    };
  }

  if (box.ranges.length === 0) {
    return {
      ...box,
      ranges: [{ start: msgId, end: msgId }],
      updatedAt: now,
    };
  }

  const ranges = box.ranges.map((r) => ({ ...r }));
  const last = ranges[ranges.length - 1];
  // Docs: update end_msg_id of last Pair
  last.end = msgId;
  if (last.start > last.end) {
    // if msgId went backwards, fall back to merge insert
    ranges[ranges.length - 1] = { start: Math.min(last.start, msgId), end: Math.max(last.start, msgId) };
  }

  return {
    ...box,
    ranges: normalizeRanges(ranges),
    updatedAt: now,
  };
}

export function extendRangesFromSpan(
  box: MsgIdRangeBox | undefined,
  boxId: string,
  start: number,
  end: number,
  now: number,
): MsgIdRangeBox {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const base: MsgIdRangeBox = box ?? {
    boxId,
    pending: false,
    ranges: [],
    updatedAt: now,
  };
  return {
    ...base,
    boxId,
    pending: false,
    ranges: normalizeRanges([...base.ranges, { start: lo, end: hi }]),
    updatedAt: now,
  };
}

export function extendRangesFromIds(
  box: MsgIdRangeBox | undefined,
  boxId: string,
  ids: number[],
  now: number,
): MsgIdRangeBox {
  const base: MsgIdRangeBox = box ?? {
    boxId,
    pending: false,
    ranges: [],
    updatedAt: now,
  };
  if (ids.length === 0) return { ...base, boxId, updatedAt: now };

  const points = ids.map((id) => ({ start: id, end: id }));
  return {
    ...base,
    boxId,
    pending: false,
    ranges: normalizeRanges([...base.ranges, ...points]),
    updatedAt: now,
  };
}

export function normalizeRanges(ranges: MsgIdRange[]): MsgIdRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges]
    .map((r) => ({
      start: Math.min(r.start, r.end),
      end: Math.max(r.start, r.end),
    }))
    .sort((a, b) => a.start - b.start);

  const out: MsgIdRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (!last) {
      out.push({ ...r });
      continue;
    }
    if (r.start <= last.end + 1) {
      last.end = Math.max(last.end, r.end);
    } else {
      out.push({ ...r });
    }
  }
  return out;
}
