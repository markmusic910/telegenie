import { LEADER_HEARTBEAT_TTL_MS } from '@telegenie/libs/foundation/broadcast-channel';
import { GlobalStoreSlice } from '../global-store.slice';
import type { LeaderSnapshot, LeaderState } from './leader.state';

/** Tab leader election + this-tab loading flag. */
export class LeaderSlice extends GlobalStoreSlice implements LeaderState {
  isLoading = false;

  /** Tab id of the elected multi-tab leader (persisted via StoreCache). */
  leaderTabId: string | undefined = undefined;
  /** Epoch ms of the last leader heartbeat (persisted). */
  leaderHeartbeatAt = 0;

  constructor() {
    super();
    this.observe();
  }

  isLeader(tabId: string): boolean {
    return this.leaderTabId === tabId;
  }

  isLeaderFresh(now = Date.now(), ttlMs = LEADER_HEARTBEAT_TTL_MS): boolean {
    if (!this.leaderTabId) return false;
    return now - this.leaderHeartbeatAt <= ttlMs;
  }

  setLeader = (tabId: string, heartbeatAt = Date.now()) => {
    this.leaderTabId = tabId;
    this.leaderHeartbeatAt = heartbeatAt;
  };

  clearLeader = () => {
    this.leaderTabId = undefined;
    this.leaderHeartbeatAt = 0;
  };

  touchLeaderHeartbeat = (heartbeatAt = Date.now()) => {
    this.leaderHeartbeatAt = heartbeatAt;
  };

  setLoading = (loading: boolean) => {
    this.isLoading = loading;
  };

  hydrateFromSnapshot = (snapshot: Record<string, unknown> | undefined) => {
    if (!snapshot) return;
    if (typeof snapshot.leaderTabId === 'string' || snapshot.leaderTabId === undefined) {
      this.leaderTabId = snapshot.leaderTabId as string | undefined;
    }
    if (typeof snapshot.leaderHeartbeatAt === 'number') {
      this.leaderHeartbeatAt = snapshot.leaderHeartbeatAt;
    }
    if (typeof snapshot.isLoading === 'boolean') {
      this.isLoading = snapshot.isLoading;
    }
  };

  toSnapshot(): LeaderSnapshot {
    return {
      isLoading: this.isLoading,
      leaderTabId: this.leaderTabId,
      leaderHeartbeatAt: this.leaderHeartbeatAt,
    };
  }

  toJS(): Record<string, unknown> {
    return this.toSnapshot();
  }
}

export { LEADER_HEARTBEAT_TTL_MS };
