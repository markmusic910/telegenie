import {
  createBroadcastBus,
  TAB_MSG,
  type BroadcastBus,
} from '@telegenie/libs/foundation/broadcast-channel';
import type GlobalStore from '../../store/global/global.store';

export { TAB_MSG } from '@telegenie/libs/foundation/broadcast-channel';

export const TAB_ID_STORAGE_KEY = 'telegenie.tabId';

const HEARTBEAT_INTERVAL_MS = 3_000;
const ELECTION_GRACE_MS = 500;

export type TabLeaderElectionOptions = {
  globalStore: GlobalStore;
  broadcast?: BroadcastBus;
  tabId?: string;
  now?: () => number;
};

/**
 * BroadcastChannel leader election. Leader id + heartbeat are written to LeaderSlice
 * (persisted by StoreCache). Only the leader should broker TG↔SW MessageChannel
 * and listen for `controllerchange`.
 */
export class TabLeaderElection {
  readonly tabId: string;
  readonly broadcast: BroadcastBus;
  private readonly globalStore: GlobalStore;
  private readonly now: () => number;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private disposed = false;
  private readonly unsubscribers: Array<() => void> = [];

  constructor(options: TabLeaderElectionOptions) {
    this.globalStore = options.globalStore;
    this.broadcast = options.broadcast ?? createBroadcastBus();
    this.tabId = options.tabId ?? resolveTabId();
    this.now = options.now ?? Date.now;
  }

  get isLeader(): boolean {
    return this.globalStore.leader.isLeader(this.tabId);
  }

  async start(): Promise<boolean> {
    this.unsubscribers.push(
      this.broadcast.on<{ tabId: string; heartbeatAt: number }>(TAB_MSG.heartbeat, (env) => {
        const { tabId, heartbeatAt } = env.payload;
        if (!tabId) return;
        if (this.globalStore.leader.leaderTabId === tabId || !this.globalStore.leader.isLeaderFresh(this.now())) {
          this.globalStore.leader.setLeader(tabId, heartbeatAt);
        }
      }),
      this.broadcast.on<{ tabId: string }>(TAB_MSG.leaderClaim, (env) => {
        const claimer = env.payload.tabId;
        if (!claimer) return;
        this.onLeaderClaim(claimer);
      }),
      this.broadcast.on<{ tabId: string }>(TAB_MSG.leaderResign, (env) => {
        if (env.payload.tabId && env.payload.tabId === this.globalStore.leader.leaderTabId) {
          this.globalStore.leader.clearLeader();
          void this.tryClaim();
        }
      }),
      this.broadcast.on<{ tabId: string }>(TAB_MSG.leaderChallenge, (env) => {
        if (this.isLeader && env.payload.tabId !== this.tabId) {
          this.broadcast.post(TAB_MSG.leaderClaim, {
            tabId: this.tabId,
            heartbeatAt: this.now(),
          });
        }
      }),
    );

    this.broadcast.post(TAB_MSG.hello, { tabId: this.tabId });

    if (this.globalStore.leader.isLeaderFresh(this.now()) && this.globalStore.leader.leaderTabId !== this.tabId) {
      this.broadcast.post(TAB_MSG.leaderChallenge, { tabId: this.tabId });
      await sleep(ELECTION_GRACE_MS);
      if (this.globalStore.leader.isLeaderFresh(this.now()) && !this.isLeader) {
        return false;
      }
    }

    await this.tryClaim();
    return this.isLeader;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.isLeader) {
      this.broadcast.post(TAB_MSG.leaderResign, { tabId: this.tabId });
      this.globalStore.leader.clearLeader();
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    for (const off of this.unsubscribers) off();
    this.unsubscribers.length = 0;
  }

  private async tryClaim(): Promise<void> {
    if (this.disposed) return;
    if (this.globalStore.leader.isLeaderFresh(this.now()) && !this.isLeader) {
      return;
    }
    this.becomeLeader();
  }

  private onLeaderClaim(claimer: string): void {
    if (claimer === this.tabId) return;
    // Lexicographically smaller tabId wins ties.
    if (this.isLeader && claimer < this.tabId) {
      this.stopHeartbeat();
      this.globalStore.leader.setLeader(claimer, this.now());
      return;
    }
    if (!this.globalStore.leader.isLeaderFresh(this.now()) || claimer < (this.globalStore.leader.leaderTabId ?? '')) {
      this.globalStore.leader.setLeader(claimer, this.now());
      this.stopHeartbeat();
    }
  }

  private becomeLeader(): void {
    const at = this.now();
    this.globalStore.leader.setLeader(this.tabId, at);
    this.broadcast.post(TAB_MSG.leaderClaim, { tabId: this.tabId, heartbeatAt: at });
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.isLeader) {
        this.stopHeartbeat();
        return;
      }
      const at = this.now();
      this.globalStore.leader.touchLeaderHeartbeat(at);
      this.broadcast.post(TAB_MSG.heartbeat, { tabId: this.tabId, heartbeatAt: at });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
}

export function resolveTabId(): string {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const existing = sessionStorage.getItem(TAB_ID_STORAGE_KEY);
      if (existing) return existing;
      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID().slice(0, 8)
          : Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem(TAB_ID_STORAGE_KEY, id);
      return id;
    }
  } catch {
    // ignore
  }
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
