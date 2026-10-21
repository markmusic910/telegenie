import {
  assertMethodContext,
  isLegacyDescriptor,
  isNativeDecoratorContext,
  isPropertyKey,
} from './log.guards';
import type { RecoverOptions } from './options';

export type { RecoverOptions } from './options';

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

type RecoverDecorator = NativeMethodDecorator & LegacyMethodDecorator;

/**
 * Catches exceptions (sync or async), prints error details via `console.error`,
 * and optionally returns a fallback or rethrows.
 *
 * Works as bare `@Recover` or factory `@Recover({ fallback, rethrow, onError })`.
 */
export function Recover<This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
): (this: This, ...args: Args) => Return;
/** Bare `@Recover` (legacy experimentalDecorators). */
export function Recover(
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): PropertyDescriptor;
/** Factory `@Recover()` / `@Recover({ fallback, rethrow, onError })`. */
export function Recover(options?: RecoverOptions): RecoverDecorator;
export function Recover(
  targetOrOptions?: unknown,
  contextOrKey?: unknown,
  descriptor?: PropertyDescriptor,
): unknown {
  if (isNativeDecoratorContext(contextOrKey)) {
    assertMethodContext(contextOrKey, '@Recover');
    return wrapNative(targetOrOptions as AnyMethod, contextOrKey, {});
  }

  if (isLegacyDescriptor(descriptor) && isPropertyKey(contextOrKey)) {
    return wrapLegacy(descriptor, contextOrKey, {});
  }

  const options: RecoverOptions =
    typeof targetOrOptions === 'object' && targetOrOptions !== null
      ? (targetOrOptions as RecoverOptions)
      : {};

  return function recoverDecorator(
    target: unknown,
    contextOrPropertyKey?: unknown,
    maybeDescriptor?: PropertyDescriptor,
  ) {
    if (isNativeDecoratorContext(contextOrPropertyKey)) {
      assertMethodContext(contextOrPropertyKey, '@Recover');
      return wrapNative(target as AnyMethod, contextOrPropertyKey, options);
    }

    if (isLegacyDescriptor(maybeDescriptor) && isPropertyKey(contextOrPropertyKey)) {
      return wrapLegacy(maybeDescriptor, contextOrPropertyKey, options);
    }

    throw new Error('@Recover can only be applied to methods');
  };
}

function wrapNative(
  original: AnyMethod,
  context: ClassMethodDecoratorContext,
  options: RecoverOptions,
): AnyMethod {
  return createRecoverMethod(original, String(context.name), options);
}

function wrapLegacy(
  descriptor: PropertyDescriptor,
  propertyKey: string | symbol,
  options: RecoverOptions,
): PropertyDescriptor {
  if (typeof descriptor.value !== 'function') {
    throw new Error('@Recover can only be applied to methods');
  }
  descriptor.value = createRecoverMethod(
    descriptor.value as AnyMethod,
    String(propertyKey),
    options,
  );
  return descriptor;
}

function createRecoverMethod(
  original: AnyMethod,
  methodName: string,
  options: RecoverOptions,
): AnyMethod {
  const recovered = function recovered(this: unknown, ...args: unknown[]) {
    try {
      const result = original.apply(this, args);
      if (isThenable(result)) {
        return Promise.resolve(result).catch((error: unknown) => {
          return handleException(this, methodName, args, error, options);
        });
      }
      return result;
    } catch (error) {
      return handleException(this, methodName, args, error, options);
    }
  };

  Object.defineProperty(recovered, 'name', {
    value: original.name || methodName,
    configurable: true,
  });
  return recovered;
}

function handleException(
  self: unknown,
  methodName: string,
  args: unknown[],
  error: unknown,
  options: RecoverOptions,
): unknown {
  const label = resolveLabel(self, methodName);
  console.error(`[Recover] Exception in ${label}:`, error, { args });

  options.onError?.(error, { self, methodName, args });

  if (options.fallback !== undefined) {
    return typeof options.fallback === 'function'
      ? options.fallback(error, ...args)
      : options.fallback;
  }

  if (options.rethrow !== false) {
    throw error;
  }
  return undefined;
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
