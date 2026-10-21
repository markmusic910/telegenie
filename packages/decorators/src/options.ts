export const MUTED = '[muted]' as const;

export type FuncLogOptions = {
  /**
   * Skip argument values (`true`), or replace specific 0-based indexes
   * with {@link MUTED}.
   */
  muteArgs?: boolean | readonly number[];
  /** Skip logging the return value. Thrown errors are still logged. */
  muteReturn?: boolean;
};

export type RequestLogOptions = {
  /** Mark request as outgoing (to SharedWorker/external system). */
  outgoing?: boolean;
};

export type RecoverOptions = {
  /** Optional fallback value or function to return when an error is caught. */
  fallback?: unknown | ((error: unknown, ...args: unknown[]) => unknown);
  /** Whether to rethrow the error after logging. Default: true. */
  rethrow?: boolean;
  /** Custom error handler callback. */
  onError?: (
    error: unknown,
    context: { self: unknown; methodName: string; args: unknown[] },
  ) => void;
};

export type ListRequestDebounceOptions = {
  /** Debounce window in milliseconds before flushing batched requests. Default: 300. */
  delay?: number;
  /** Max concurrent batched calls (two-argument mode groups by first argument). Default: 5. */
  concurrency?: number;
};
