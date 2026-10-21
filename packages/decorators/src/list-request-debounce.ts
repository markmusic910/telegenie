import { DECORATED_METHODS } from './method';
import { type ListRequestDebounceOptions } from './options';

export { type ListRequestDebounceOptions } from './options';

type AnyMethod = (...args: unknown[]) => unknown;
type Scalar = string | number;
type ScalarList = Scalar[];

const DEFAULT_DELAY_MS = 300;
const DEFAULT_CONCURRENCY = 5;

type PendingOne = {
  kind: 'one';
  keys: Scalar[];
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

type PendingTwo = {
  kind: 'two';
  firstKey: Scalar;
  secondKeys: Scalar[];
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

type PendingEntry = PendingOne | PendingTwo;

type SchedulerState = {
  timer: ReturnType<typeof setTimeout> | null;
  pending: PendingEntry[];
  mode: 'one' | 'two';
};

function isScalar(value: unknown): value is Scalar {
  return typeof value === 'string' || typeof value === 'number';
}

function isScalarList(value: unknown): value is ScalarList {
  return Array.isArray(value) && value.every(isScalar);
}

function normalizeScalars(value: Scalar | ScalarList): Scalar[] {
  return Array.isArray(value) ? [...value] : [value];
}

function uniqueScalars(values: Scalar[]): Scalar[] {
  return [...new Set(values)];
}

function scalarKey(value: Scalar): string {
  return String(value);
}

function validateArgs(
  args: unknown[],
  methodName: string,
): { mode: 'one'; value: Scalar | ScalarList } | { mode: 'two'; first: Scalar; second: ScalarList } {
  if (args.length === 1) {
    const value = args[0];
    if (isScalar(value) || isScalarList(value)) {
      return { mode: 'one', value };
    }
    throw new Error(buildInvalidArgsError(methodName));
  }

  if (args.length === 2) {
    const [first, second] = args;
    if (isScalar(first) && isScalarList(second)) {
      return { mode: 'two', first, second };
    }
    throw new Error(buildInvalidArgsError(methodName));
  }

  throw new Error(buildInvalidArgsError(methodName));
}

function buildInvalidArgsError(methodName: string): string {
  return (
    `@ListRequestDebounce: invalid arguments for method "${methodName}". `
    + 'Expected one argument of type string | number | string[] | number[], '
    + 'or two arguments where the first is string | number and the second is string[] | number[].'
  );
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as PromiseLike<unknown>).then === 'function'
  );
}

function isResultMap(value: unknown): value is Map<Scalar, unknown> {
  return value instanceof Map;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index]!);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function resolveOnePending(entry: PendingOne, batchResult: unknown): void {
  if (entry.keys.length === 1) {
    const key = entry.keys[0]!;
    if (isResultMap(batchResult)) {
      entry.resolve(batchResult.get(key));
      return;
    }
    entry.resolve(batchResult);
    return;
  }

  if (isResultMap(batchResult)) {
    entry.resolve(entry.keys.map((key) => batchResult.get(key)));
    return;
  }

  entry.resolve(batchResult);
}

function filterTwoArgResult(result: unknown, requestedKeys: Scalar[]): unknown {
  if (!Array.isArray(result)) return result;

  const requested = new Set(requestedKeys.map(scalarKey));

  if (result.some((item) => item != null && typeof item === 'object' && 'id' in item)) {
    return result.filter((item) => {
      if (item == null || typeof item !== 'object') return false;
      const id = (item as { id?: unknown }).id;
      return id != null && requested.has(String(id));
    });
  }

  return result.filter((item) => requested.has(String(item)));
}

function createSchedulerKey(methodName: string): symbol {
  return Symbol(`listRequestDebounce_${methodName}`);
}

function getScheduler(self: object, key: symbol): SchedulerState {
  const record = self as Record<symbol, SchedulerState | undefined>;
  if (!record[key]) {
    record[key] = {
      timer: null,
      pending: [],
      mode: 'one',
    };
  }
  return record[key]!;
}

/**
 * Debounces list-style controller requests and merges parameters before calling
 * the underlying method.
 *
 * - **One argument** (`string | number | string[] | number[]`): collects all keys
 *   within the debounce window and invokes the method once with the merged array.
 * - **Two arguments** (`first`, `second[]`): groups by `first`, merges `second`
 *   arrays per group, and runs each group with concurrency control.
 */
export function ListRequestDebounce(options: ListRequestDebounceOptions = {}): any {
  const delayMs = options.delay ?? DEFAULT_DELAY_MS;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  return function listRequestDebounceDecorator(
    original: AnyMethod,
    context: ClassMethodDecoratorContext,
  ): AnyMethod {
    if (context.kind !== 'method') {
      throw new Error('@ListRequestDebounce can only be applied to methods');
    }

    const methodName = String(context.name);
    const schedulerKey = createSchedulerKey(methodName);

    const wrapped = function listRequestDebounced(this: unknown, ...args: unknown[]) {
      const validated = validateArgs(args, methodName);
      const self = this as object;
      const scheduler = getScheduler(self, schedulerKey);

      return new Promise((resolve, reject) => {
        if (validated.mode === 'one') {
          if (scheduler.pending.length > 0 && scheduler.mode !== 'one') {
            reject(new Error(
              `@ListRequestDebounce: cannot mix one- and two-argument calls on "${methodName}".`,
            ));
            return;
          }
          scheduler.mode = 'one';
          scheduler.pending.push({
            kind: 'one',
            keys: normalizeScalars(validated.value),
            resolve,
            reject,
          });
        } else {
          if (scheduler.pending.length > 0 && scheduler.mode !== 'two') {
            reject(new Error(
              `@ListRequestDebounce: cannot mix one- and two-argument calls on "${methodName}".`,
            ));
            return;
          }
          scheduler.mode = 'two';
          scheduler.pending.push({
            kind: 'two',
            firstKey: validated.first,
            secondKeys: [...validated.second],
            resolve,
            reject,
          });
        }

        if (scheduler.timer != null) {
          clearTimeout(scheduler.timer);
        }

        scheduler.timer = setTimeout(() => {
          void flushScheduler(
            self,
            schedulerKey,
            original,
            methodName,
            concurrency,
          );
        }, delayMs);
      });
    };

    Object.defineProperty(wrapped, 'name', {
      value: original.name || methodName,
      configurable: true,
    });

    if (DECORATED_METHODS.has(original)) {
      DECORATED_METHODS.add(wrapped);
    }

    return wrapped;
  };
}

async function flushScheduler(
  self: object,
  schedulerKey: symbol,
  original: AnyMethod,
  methodName: string,
  concurrency: number,
): Promise<void> {
  const scheduler = getScheduler(self, schedulerKey);
  const pending = scheduler.pending;
  scheduler.pending = [];
  scheduler.timer = null;

  if (pending.length === 0) return;

  const mode = scheduler.mode;

  try {
    if (mode === 'one') {
      await flushOneArgBatch(self, original, pending as PendingOne[]);
      return;
    }

    await flushTwoArgBatch(self, original, pending as PendingTwo[], concurrency);
  } catch (error) {
    for (const entry of pending) {
      entry.reject(error);
    }
  }
}

async function flushOneArgBatch(
  self: object,
  original: AnyMethod,
  pending: PendingOne[],
): Promise<void> {
  const mergedKeys = uniqueScalars(pending.flatMap((entry) => entry.keys));
  const batchArg: Scalar | ScalarList = mergedKeys.length === 1 ? mergedKeys[0]! : mergedKeys;

  const result = original.apply(self, [batchArg]);
  const batchResult = isThenable(result) ? await result : result;

  for (const entry of pending) {
    try {
      resolveOnePending(entry, batchResult);
    } catch (error) {
      entry.reject(error);
    }
  }
}

async function flushTwoArgBatch(
  self: object,
  original: AnyMethod,
  pending: PendingTwo[],
  concurrency: number,
): Promise<void> {
  const groups = new Map<string, { firstKey: Scalar; secondKeys: Scalar[]; entries: PendingTwo[] }>();

  for (const entry of pending) {
    const key = scalarKey(entry.firstKey);
    const group = groups.get(key);
    if (group) {
      group.secondKeys.push(...entry.secondKeys);
      group.entries.push(entry);
    } else {
      groups.set(key, {
        firstKey: entry.firstKey,
        secondKeys: [...entry.secondKeys],
        entries: [entry],
      });
    }
  }

  const groupList = [...groups.values()].map((group) => ({
    ...group,
    secondKeys: uniqueScalars(group.secondKeys),
  }));

  await runWithConcurrency(groupList, concurrency, async (group) => {
    const result = original.apply(self, [group.firstKey, group.secondKeys]);
    const batchResult = isThenable(result) ? await result : result;

    for (const entry of group.entries) {
      try {
        entry.resolve(filterTwoArgResult(batchResult, entry.secondKeys));
      } catch (error) {
        entry.reject(error);
      }
    }
  });
}
