export const TAB_MSG = {
  hello: 'tab.hello',
  heartbeat: 'tab.heartbeat',
  leaderClaim: 'tab.leaderClaim',
  leaderResign: 'tab.leaderResign',
  leaderChallenge: 'tab.leaderChallenge',
} as const;

export type TabMsgType = (typeof TAB_MSG)[keyof typeof TAB_MSG];

export type TabHelloPayload = { tabId: string };
export type TabHeartbeatPayload = { tabId: string; heartbeatAt: number };
export type TabLeaderClaimPayload = { tabId: string; heartbeatAt?: number };
export type TabLeaderResignPayload = { tabId: string };
export type TabLeaderChallengePayload = { tabId: string };

/** Same freshness window as SDK LeaderSlice — SW observes only, does not elect. */
export const LEADER_HEARTBEAT_TTL_MS = 8_000;
