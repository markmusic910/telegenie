import {
  assertMethodContext,
  isLegacyDescriptor,
  isNativeDecoratorContext,
  isPropertyKey,
} from './log.guards';
import { DECORATED_METHODS } from './method';
import { type RequestLogOptions } from './options';

export { type RequestLogOptions } from './options';

type AnyMethod = (...args: unknown[]) => unknown;

type NativeMethodDecorator = <This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) => (this: This, ...args: Args) => Return;

type LegacyMethodDecorator = (
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
) => PropertyDescriptor;

type RequestLogDecorator = NativeMethodDecorator & LegacyMethodDecorator;

export function getTabId(): string {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const existing = sessionStorage.getItem('telegenie.tabId');
      if (existing) return existing;
      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID().slice(0, 8)
          : Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('telegenie.tabId', id);
      return id;
    }
  } catch {
    // ignore
  }
  return 'unknown-tab';
}

export function logRequest(options: {
  methodName: string;
  args: any[];
  start: number;
  timestamp: string;
  tabId: string;
  outgoing: boolean;
  success: boolean;
  result?: any;
  error?: any;
}) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  const { methodName, args, start, timestamp, tabId, outgoing, success, result, error } = options;
  const duration = Date.now() - start;
  console.info(`[RequestLog] ${outgoing ? 'Outgoing' : 'Incoming'} request: ${methodName}`, {
    timestamp,
    from: tabId,
    outgoing,
    duration: `${duration}ms`,
    success,
    parameters: args,
    ...(success ? { response: result } : { error: error instanceof Error ? error.message : String(error) }),
  });
}

/**
 * Logs request and response parameters for module methods.
 *
 * No-op when `process.env.NODE_ENV === 'production'`.
 */
export function RequestLog<This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
): (this: This, ...args: Args) => Return;
/** Bare `@RequestLog` (legacy experimentalDecorators). */
export function RequestLog(
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): PropertyDescriptor;
/** Factory `@RequestLog()` / `@RequestLog({ outgoing })`. */
export function RequestLog(options?: RequestLogOptions): RequestLogDecorator;
export function RequestLog(
  targetOrOptions?: unknown,
  contextOrKey?: unknown,
  descriptor?: PropertyDescriptor,
): unknown {
  if (isNativeDecoratorContext(contextOrKey)) {
    assertMethodContext(contextOrKey, '@RequestLog');
    return wrapNative(targetOrOptions as AnyMethod, contextOrKey, {});
  }

  if (isLegacyDescriptor(descriptor) && isPropertyKey(contextOrKey)) {
    return wrapLegacy(descriptor, contextOrKey, {});
  }

  const options = (typeof targetOrOptions === 'object' && targetOrOptions !== null) ? targetOrOptions : {};
  return function requestLogDecorator(
    target: unknown,
    contextOrPropertyKey?: unknown,
    maybeDescriptor?: PropertyDescriptor,
  ) {
    if (isNativeDecoratorContext(contextOrPropertyKey)) {
      assertMethodContext(contextOrPropertyKey, '@RequestLog');
      return wrapNative(target as AnyMethod, contextOrPropertyKey, options);
    }

    if (isLegacyDescriptor(maybeDescriptor) && isPropertyKey(contextOrPropertyKey)) {
      return wrapLegacy(maybeDescriptor, contextOrPropertyKey, options);
    }

    throw new Error('@RequestLog can only be applied to methods');
  };
}

function wrapNative(
  original: AnyMethod,
  context: ClassMethodDecoratorContext,
  options: RequestLogOptions,
): AnyMethod {
  if (process.env.NODE_ENV === 'production') return original;
  const logged = createLoggedMethod(original, String(context.name), options);
  if (DECORATED_METHODS.has(original)) {
    DECORATED_METHODS.add(logged);
  }
  return logged;
}

function wrapLegacy(
  descriptor: PropertyDescriptor,
  propertyKey: string | symbol,
  options: RequestLogOptions,
): PropertyDescriptor {
  if (typeof descriptor.value !== 'function') {
    throw new Error('@RequestLog can only be applied to methods');
  }
  if (process.env.NODE_ENV === 'production') return descriptor;
  const original = descriptor.value as AnyMethod;
  const logged = createLoggedMethod(
    original,
    String(propertyKey),
    options,
  );
  if (DECORATED_METHODS.has(original)) {
    DECORATED_METHODS.add(logged);
  }
  descriptor.value = logged;
  return descriptor;
}

function createLoggedMethod(
  original: AnyMethod,
  methodName: string,
  options: RequestLogOptions,
): AnyMethod {
  const outgoing = options.outgoing ?? false;

  const logged = function logged(this: unknown, ...args: unknown[]) {
    const start = Date.now();
    const timestamp = new Date().toISOString();
    const tabId = getTabId();
    const label = resolveLabel(this, methodName);

    try {
      const result = original.apply(this, args);
      if (isThenable(result)) {
        return Promise.resolve(result).then(
          (value: unknown) => {
            logRequest({
              methodName: label,
              args,
              start,
              timestamp,
              tabId,
              outgoing,
              success: true,
              result: value,
            });
            return value;
          },
          (error: unknown) => {
            logRequest({
              methodName: label,
              args,
              start,
              timestamp,
              tabId,
              outgoing,
              success: false,
              error,
            });
            throw error;
          },
        );
      }

      logRequest({
        methodName: label,
        args,
        start,
        timestamp,
        tabId,
        outgoing,
        success: true,
        result,
      });
      return result;
    } catch (error) {
      logRequest({
        methodName: label,
        args,
        start,
        timestamp,
        tabId,
        outgoing,
        success: false,
        error,
      });
      throw error;
    }
  };

  Object.defineProperty(logged, 'name', {
    value: original.name || methodName,
    configurable: true,
  });
  return logged;
}

function resolveLabel(self: unknown, methodName: string): string {
  let className = '';
  if (typeof self === 'function') {
    className = self.name;
  } else if (self !== null && self !== undefined && typeof self === 'object') {
    className = (self as { constructor?: { name?: string } }).constructor?.name ?? '';
  }
  return className ? `${className}.${methodName}` : methodName;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  );
}
