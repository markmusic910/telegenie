import { META_KEY_COMMON_STATE, STORE } from '../constants';
import type { LocalDbContext } from '../context';
import type { ApplyResult, ChannelUpdateState, CommonUpdateState, MetaRow } from '../types';

export class UpdateStateStore {
  constructor(private readonly ctx: LocalDbContext) {}

  async getCommonState(): Promise<CommonUpdateState | undefined> {
    const row = await this.ctx.idb.get<MetaRow>(STORE.meta, META_KEY_COMMON_STATE);
    return row?.value as CommonUpdateState | undefined;
  }

  async setCommonState(state: Omit<CommonUpdateState, 'updatedAt'>): Promise<void> {
    const value: CommonUpdateState = { ...state, updatedAt: Date.now() };
    const row: MetaRow = { key: META_KEY_COMMON_STATE, value };
    void this.ctx.idb.putQueued(STORE.meta, row);
  }

  async getMeta(key: string): Promise<unknown> {
    const row = await this.ctx.idb.get<MetaRow>(STORE.meta, key);
    return row?.value;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    const row: MetaRow = { key, value };
    void this.ctx.idb.putQueued(STORE.meta, row);
  }

  async applyCommonPts(pts: number, ptsCount: number): Promise<ApplyResult> {
    const state = (await this.getCommonState()) ?? emptyCommonState();
    const result = classifyPts(state.pts, pts, ptsCount);
    if (result === 'apply') {
      await this.setCommonState({ ...state, pts });
    }
    return result;
  }

  async applyQts(qts: number): Promise<ApplyResult> {
    const state = (await this.getCommonState()) ?? emptyCommonState();
    const result = classifyPts(state.qts, qts, 1);
    if (result === 'apply') {
      await this.setCommonState({ ...state, qts });
    }
    return result;
  }

  async applySeq(seqStart: number, seq: number, date: number): Promise<ApplyResult> {
    const state = (await this.getCommonState()) ?? emptyCommonState();
    if (seqStart === 0) {
      await this.setCommonState({ ...state, seq: seq || state.seq, date });
      return 'apply';
    }
    if (state.seq + 1 === seqStart) {
      await this.setCommonState({ ...state, seq, date });
      return 'apply';
    }
    if (state.seq + 1 > seqStart) return 'skip';
    return 'gap';
  }

  async getChannelPts(channelId: string): Promise<number | undefined> {
    const row = await this.ctx.idb.get<ChannelUpdateState>(STORE.channelStates, channelId);
    return row?.pts;
  }

  async setChannelPts(channelId: string, pts: number): Promise<void> {
    const row: ChannelUpdateState = { channelId, pts, updatedAt: Date.now() };
    void this.ctx.idb.putQueued(STORE.channelStates, row);
  }

  /**
   * Record channel pts from dialogs / full info only when we have no live
   * timestamp yet. Never store 0 — `GetChannelDifference` rejects it.
   */
  async seedChannelPts(channelId: string, pts: number): Promise<void> {
    if (!(pts > 0)) return;
    const existing = await this.getChannelPts(channelId);
    if (existing != null && existing > 0) return;
    await this.setChannelPts(channelId, pts);
  }

  async applyChannelPts(
    channelId: string,
    pts: number,
    ptsCount: number,
  ): Promise<ApplyResult> {
    const local = (await this.getChannelPts(channelId)) ?? 0;
    const result = classifyPts(local, pts, ptsCount);
    if (result === 'apply') {
      await this.setChannelPts(channelId, pts);
    }
    return result;
  }
}

function classifyPts(localPts: number, pts: number, ptsCount: number): ApplyResult {
  if (localPts + ptsCount === pts) return 'apply';
  if (localPts + ptsCount > pts) return 'skip';
  return 'gap';
}

function emptyCommonState(): CommonUpdateState {
  return { pts: 0, qts: 0, seq: 0, date: 0, updatedAt: 0 };
}
