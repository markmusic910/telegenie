/** Persistable leader fields (no computeds). */
export type LeaderSnapshot = {
  isLoading?: boolean;
  /** Tab id of the elected multi-tab leader. */
  leaderTabId?: string;
  /** Epoch ms of the last leader heartbeat. */
  leaderHeartbeatAt?: number;
};

/** Tab leader election and this-tab loading flag. No actions. */
export interface LeaderState {
  readonly isLoading: boolean;
  /** Tab id of the elected multi-tab leader (persisted via StoreCache). */
  readonly leaderTabId: string | undefined;
  /** Epoch ms of the last leader heartbeat (persisted). */
  readonly leaderHeartbeatAt: number;
  isLeader(tabId: string): boolean;
  isLeaderFresh(now?: number, ttlMs?: number): boolean;
}
