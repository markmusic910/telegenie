import type { ChannelDiffResult } from './types';

export type ChannelPollDeps = {
  maxWatchedChannels: number;
  fetchChannelDifference: (
    channelId: string,
    options: { untilFinal: boolean },
  ) => Promise<ChannelDiffResult>;
  onWatchLimitReached: (channelId: string) => void;
  log: (...args: unknown[]) => void;
  /** Injectable clock for tests */
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
};

/**
 * Manages short-poll loops for channels the user is currently viewing.
 * @see https://core.telegram.org/api/updates#subscribing-to-updates-of-channelssupergroups
 */
export class ChannelPoller {
  private readonly watched = new Map<string, { timer?: ReturnType<typeof setTimeout> }>();
  private readonly inFlight = new Set<string>();
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private stopped = false;

  constructor(private readonly deps: ChannelPollDeps) {
    this.setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = deps.clearTimeoutFn ?? clearTimeout;
  }

  get watchedChannelIds(): string[] {
    return [...this.watched.keys()];
  }

  watch(channelId: string): boolean {
    if (this.stopped) return false;
    if (this.watched.has(channelId)) return true;
    if (this.watched.size >= this.deps.maxWatchedChannels) {
      this.deps.onWatchLimitReached(channelId);
      return false;
    }
    this.watched.set(channelId, {});
    void this.poll(channelId);
    return true;
  }

  unwatch(channelId: string): void {
    const entry = this.watched.get(channelId);
    if (!entry) return;
    if (entry.timer != null) this.clearTimeoutFn(entry.timer);
    this.watched.delete(channelId);
  }

  unwatchAll(): void {
    for (const id of [...this.watched.keys()]) {
      this.unwatch(id);
    }
  }

  stop(): void {
    this.stopped = true;
    this.unwatchAll();
  }

  private async poll(channelId: string): Promise<void> {
    if (this.stopped || !this.watched.has(channelId)) return;
    if (this.inFlight.has(channelId)) return;
    this.inFlight.add(channelId);
    try {
      // Catch up immediately until final, then schedule timeout
       
      while (true) {
        if (this.stopped || !this.watched.has(channelId)) return;
        const result = await this.deps.fetchChannelDifference(channelId, {
          untilFinal: false,
        });
        if (!result.final) {
          // immediately re-invoke
          continue;
        }
        this.scheduleNext(channelId, result.timeoutSec);
        return;
      }
    } catch (err) {
      this.deps.log('channel poll error', channelId, err);
      // retry after default 1s if still watched
      this.scheduleNext(channelId, 1);
    } finally {
      this.inFlight.delete(channelId);
    }
  }

  private scheduleNext(channelId: string, timeoutSec?: number): void {
    const entry = this.watched.get(channelId);
    if (!entry || this.stopped) return;
    if (entry.timer != null) this.clearTimeoutFn(entry.timer);
    const delayMs = Math.max(1, timeoutSec ?? 1) * 1000;
    entry.timer = this.setTimeoutFn(() => {
      void this.poll(channelId);
    }, delayMs);
  }
}
