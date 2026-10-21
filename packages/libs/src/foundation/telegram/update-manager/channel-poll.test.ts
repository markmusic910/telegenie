import { ChannelPoller } from './channel-poll';

async function flushMicrotasks(times = 10): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

describe('ChannelPoller', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('polls until final then schedules timeout', async () => {
    const calls: Array<{ untilFinal: boolean }> = [];
    let n = 0;
    const poller = new ChannelPoller({
      maxWatchedChannels: 10,
      fetchChannelDifference: async (_id, opts) => {
        calls.push(opts);
        n += 1;
        if (n < 3) return { final: false };
        return { final: true, timeoutSec: 2 };
      },
      onWatchLimitReached: () => undefined,
      log: () => undefined,
      setTimeoutFn: setTimeout as typeof setTimeout,
      clearTimeoutFn: clearTimeout as typeof clearTimeout,
    });

    poller.watch('ch1');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(calls.every((c) => c.untilFinal === false)).toBe(true);

    // next poll after 2s
    const before = calls.length;
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    await Promise.resolve();
    expect(calls.length).toBeGreaterThan(before);

    poller.stop();
  });

  it('unwatch cancels further polls', async () => {
    let calls = 0;
    const poller = new ChannelPoller({
      maxWatchedChannels: 10,
      fetchChannelDifference: async () => {
        calls += 1;
        return { final: true, timeoutSec: 1 };
      },
      onWatchLimitReached: () => undefined,
      log: () => undefined,
    });

    poller.watch('ch1');
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toBe(1);
    poller.unwatch('ch1');
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    expect(calls).toBe(1);
    poller.stop();
  });

  it('enforces max watched and emits limit', () => {
    const limited: string[] = [];
    const poller = new ChannelPoller({
      maxWatchedChannels: 2,
      fetchChannelDifference: async () => ({ final: true, timeoutSec: 60 }),
      onWatchLimitReached: (id) => limited.push(id),
      log: () => undefined,
    });

    expect(poller.watch('a')).toBe(true);
    expect(poller.watch('b')).toBe(true);
    expect(poller.watch('c')).toBe(false);
    expect(limited).toEqual(['c']);
    expect(poller.watchedChannelIds).toEqual(['a', 'b']);
    poller.stop();
  });

  it('retries after fetch error while still watched', async () => {
    let calls = 0;
    const poller = new ChannelPoller({
      maxWatchedChannels: 10,
      fetchChannelDifference: async () => {
        calls += 1;
        if (calls === 1) throw new Error('network');
        return { final: true, timeoutSec: 60 };
      },
      onWatchLimitReached: () => undefined,
      log: () => undefined,
    });

    poller.watch('ch-err');
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toBe(1);
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toBe(2);
    poller.stop();
  });

  it('ignores watch after stop', () => {
    const poller = new ChannelPoller({
      maxWatchedChannels: 10,
      fetchChannelDifference: async () => ({ final: true }),
      onWatchLimitReached: () => undefined,
      log: () => undefined,
    });
    poller.stop();
    expect(poller.watch('x')).toBe(false);
  });

  it('is a no-op when the channel is already watched', async () => {
    let calls = 0;
    const poller = new ChannelPoller({
      maxWatchedChannels: 10,
      fetchChannelDifference: async () => {
        calls += 1;
        return { final: true, timeoutSec: 60 };
      },
      onWatchLimitReached: () => undefined,
      log: () => undefined,
    });

    expect(poller.watch('dup')).toBe(true);
    expect(poller.watch('dup')).toBe(true);
    await flushMicrotasks();
    expect(calls).toBe(1);
    expect(poller.watchedChannelIds).toEqual(['dup']);
    poller.stop();
  });

  it('unwatch clears a pending timer and is safe for unknown channels', async () => {
    const clearTimeoutMock = jest.fn(clearTimeout);
    const poller = new ChannelPoller({
      maxWatchedChannels: 10,
      fetchChannelDifference: async () => ({ final: true, timeoutSec: 30 }),
      onWatchLimitReached: () => undefined,
      log: () => undefined,
      clearTimeoutFn: clearTimeoutMock as unknown as typeof clearTimeout,
    });

    poller.unwatch('missing');
    expect(clearTimeoutMock).not.toHaveBeenCalled();

    poller.watch('ch');
    await flushMicrotasks();
    poller.unwatch('ch');
    expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
    expect(poller.watchedChannelIds).toEqual([]);
    poller.stop();
  });

  it('skips a scheduled poll for a channel that is no longer watched', async () => {
    let calls = 0;
    const timers: Array<() => void> = [];
    const poller = new ChannelPoller({
      maxWatchedChannels: 10,
      fetchChannelDifference: async () => {
        calls += 1;
        return { final: true, timeoutSec: 5 };
      },
      onWatchLimitReached: () => undefined,
      log: () => undefined,
      setTimeoutFn: ((fn: () => void) => {
        timers.push(fn);
        return timers.length as unknown as ReturnType<typeof setTimeout>;
      }) as unknown as typeof setTimeout,
      // Leave the captured callback alive so it can fire after unwatch.
      clearTimeoutFn: (() => undefined) as unknown as typeof clearTimeout,
    });

    poller.watch('ghost');
    await flushMicrotasks();
    expect(calls).toBe(1);

    poller.unwatch('ghost');
    timers[0]();
    await flushMicrotasks();
    expect(calls).toBe(1);
    poller.stop();
  });

  it('ignores a concurrent poll for the same channel', async () => {
    let started = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const poller = new ChannelPoller({
      maxWatchedChannels: 10,
      fetchChannelDifference: async () => {
        started += 1;
        await gate;
        return { final: true, timeoutSec: 60 };
      },
      onWatchLimitReached: () => undefined,
      log: () => undefined,
    });

    poller.watch('busy');
    await flushMicrotasks();
    expect(started).toBe(1);

    await (poller as unknown as { poll(id: string): Promise<void> }).poll('busy');
    expect(started).toBe(1);

    release();
    await flushMicrotasks();
    poller.stop();
  });

  it('stops the catch-up loop when the channel is unwatched mid-flight', async () => {
    let calls = 0;
    const poller: ChannelPoller = new ChannelPoller({
      maxWatchedChannels: 10,
      fetchChannelDifference: async (id) => {
        calls += 1;
        poller.unwatch(id);
        return { final: false };
      },
      onWatchLimitReached: () => undefined,
      log: () => undefined,
    });

    poller.watch('drop');
    await flushMicrotasks();
    expect(calls).toBe(1);
    poller.stop();
  });

  it('does not schedule a follow-up once the channel is gone', async () => {
    const setTimeoutMock = jest.fn(setTimeout);
    const poller: ChannelPoller = new ChannelPoller({
      maxWatchedChannels: 10,
      fetchChannelDifference: async (id) => {
        poller.unwatch(id);
        return { final: true, timeoutSec: 10 };
      },
      onWatchLimitReached: () => undefined,
      log: () => undefined,
      setTimeoutFn: setTimeoutMock as unknown as typeof setTimeout,
    });

    poller.watch('vanish');
    await flushMicrotasks();
    expect(setTimeoutMock).not.toHaveBeenCalled();
    poller.stop();
  });

  it('replaces an existing timer and defaults the delay to one second', async () => {
    const setTimeoutMock = jest.fn(setTimeout);
    const clearTimeoutMock = jest.fn(clearTimeout);
    const poller = new ChannelPoller({
      maxWatchedChannels: 10,
      fetchChannelDifference: async () => ({ final: true }),
      onWatchLimitReached: () => undefined,
      log: () => undefined,
      setTimeoutFn: setTimeoutMock as unknown as typeof setTimeout,
      clearTimeoutFn: clearTimeoutMock as unknown as typeof clearTimeout,
    });

    poller.watch('again');
    await flushMicrotasks();
    expect(setTimeoutMock).toHaveBeenLastCalledWith(expect.any(Function), 1000);
    expect(clearTimeoutMock).not.toHaveBeenCalled();

    await (poller as unknown as { poll(id: string): Promise<void> }).poll('again');
    expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
    expect(setTimeoutMock).toHaveBeenCalledTimes(2);
    poller.stop();
  });
});
