// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const DECORATED_METHODS = new WeakSet<Function>();

export type MethodOptions = {
  timeout?: number;
  rateLimit?: {
    limit: number;
    windowMs: number;
  };
};

/**
 * Method decorator that wraps a class method and adds optional behaviors.
 * - timeout: If specified, fails the method call if it runs longer than the given ms.
 * - rateLimit: If specified, limits the number of allowed calls to the method
 *   within a window (windowMs) per instance.
 *
 * Usage:
 *   @Method({ timeout: 2000, rateLimit: { limit: 10, windowMs: 60000 } })
 *   async fetchData() { ... }
 */
export function Method(options: MethodOptions = {}): any {
  return function (value: any, context: ClassMethodDecoratorContext) {
    if (context.kind !== 'method') {
      throw new Error('@Method can only be applied to methods');
    }

    let wrapped = value;

    // Apply timeout if specified
    if (options.timeout !== undefined) {
      const timeoutMs = options.timeout;
      const original = wrapped;
      wrapped = function (this: any, ...args: any[]) {
        const result = original.apply(this, args);
        if (isThenable(result)) {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              reject(new Error(`Method "${String(context.name)}" timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            Promise.resolve(result).then(
              (val) => {
                clearTimeout(timer);
                resolve(val);
              },
              (err) => {
                clearTimeout(timer);
                reject(err);
              },
            );
          });
        }
        return result;
      };
    }

    // Apply rate limit if specified
    if (options.rateLimit !== undefined) {
      const { limit, windowMs } = options.rateLimit;
      const rateLimitKey = Symbol(`rate_limit_${String(context.name)}`);
      const original = wrapped;
      wrapped = function (this: any, ...args: any[]) {
        if (!this[rateLimitKey]) {
          this[rateLimitKey] = [];
        }
        const now = Date.now();
        const timestamps: number[] = this[rateLimitKey];
        const windowStart = now - windowMs;
        const activeTimestamps = timestamps.filter((t) => t > windowStart);
        if (activeTimestamps.length >= limit) {
          throw new Error(
            `Rate limit exceeded for method "${String(context.name)}". Limit: ${limit}/${windowMs}ms`,
          );
        }
        activeTimestamps.push(now);
        this[rateLimitKey] = activeTimestamps;
        return original.apply(this, args);
      };
    }

    // Keep function name intact
    Object.defineProperty(wrapped, 'name', {
      value: value.name || String(context.name),
      configurable: true,
    });

    // Register this wrapped function as decorated with @Method
    DECORATED_METHODS.add(wrapped);

    return wrapped;
  };
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  );
}
