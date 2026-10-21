import { getEntityTypeById } from '../../helpers/peer-id.helper';
import { MSG_ID_BOX_COMMON, STORE } from '../constants';
import type { LocalDbContext } from '../context';
import type { MsgIdRangeBox } from '../types';
import {
  extendRangesFromIds,
  extendRangesFromSpan,
  findGapInRanges,
  noteMessageIdInBox,
  rangesContain,
} from './msg-id-ranges';

export class MsgIdRangeStore {
  constructor(private readonly ctx: LocalDbContext) {}

  async getMsgIdRanges(boxId: string): Promise<MsgIdRangeBox | undefined> {
    return this.ctx.idb.get<MsgIdRangeBox>(STORE.msgIdRanges, boxId);
  }

  async noteMessageId(boxId: string, msgId: number): Promise<void> {
    const existing = await this.getMsgIdRanges(boxId);
    const next = noteMessageIdInBox(existing, msgId, Date.now());
    next.boxId = boxId;
    void this.ctx.idb.putQueued(STORE.msgIdRanges, next);
  }

  async markMsgIdGapUnfillable(boxId: string): Promise<void> {
    const existing = (await this.getMsgIdRanges(boxId)) ?? {
      boxId,
      pending: true,
      ranges: [],
      updatedAt: Date.now(),
    };
    void this.ctx.idb.putQueued(STORE.msgIdRanges, {
      ...existing,
      boxId,
      pending: true,
      updatedAt: Date.now(),
    });
  }

  async containsMsgId(boxId: string, msgId: number): Promise<boolean> {
    const box = await this.getMsgIdRanges(boxId);
    if (!box) return false;
    return rangesContain(box.ranges, msgId);
  }

  async findGapInDisplayedRange(
    boxId: string,
    from: number,
    to: number,
  ): Promise<[number, number] | null> {
    const box = await this.getMsgIdRanges(boxId);
    if (!box) return [from, to];
    return findGapInRanges(box.ranges, from, to);
  }

  async extendRangesFromFetchedIds(boxId: string, ids: number[]): Promise<void> {
    const existing = await this.getMsgIdRanges(boxId);
    const next = extendRangesFromIds(existing, boxId, ids, Date.now());
    void this.ctx.idb.putQueued(STORE.msgIdRanges, next);
  }

  async extendRangesFromSpan(boxId: string, start: number, end: number): Promise<void> {
    const existing = await this.getMsgIdRanges(boxId);
    const next = extendRangesFromSpan(existing, boxId, start, end, Date.now());
    void this.ctx.idb.putQueued(STORE.msgIdRanges, next);
  }

  /** Helper: box id for a peer (`common` for user/chat, peerId for channel). */
  static msgIdBoxForPeer(peerId: string): string {
    const type = getEntityTypeById(peerId);
    return type === 'channel' ? peerId : MSG_ID_BOX_COMMON;
  }
}
