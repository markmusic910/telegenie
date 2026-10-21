import {
  assertMethodContext,
  isLegacyDescriptor,
  isFuncLogOptions,
  isNativeDecoratorContext,
  isPropertyKey,
} from './log.guards';
import { MUTED, type FuncLogOptions } from './options';

export { MUTED, type FuncLogOptions } from './options';

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

type FuncLogDecorator = NativeMethodDecorator & LegacyMethodDecorator;

/**
 * Logs method arguments and the return value via `console.info`.
 *
 * No-op when `process.env.NODE_ENV === 'production'` (bundlers can strip the
 * logging helpers). `muteArgs: true` omits argument values; `muteArgs: [index]`
 * replaces those arguments with {@link MUTED}. `muteReturn: true` skips the
 * return log. Works as `@FuncLog` / `@FuncLog()` (native Stage 3 and legacy).
 */
export function FuncLog<This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
): (this: This, ...args: Args) => Return;
/** Bare `@FuncLog` (legacy experimentalDecorators). */
export function FuncLog(
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): PropertyDescriptor;
/** Factory `@FuncLog()` / `@FuncLog({ muteArgs, muteReturn })`. */
export function FuncLog(options?: FuncLogOptions): FuncLogDecorator;
export function FuncLog(
  targetOrOptions?: unknown,
  contextOrKey?: unknown,
  descriptor?: PropertyDescriptor,
): unknown {
  if (isNativeDecoratorContext(contextOrKey)) {
    assertMethodContext(contextOrKey, '@FuncLog');
    return wrapNative(targetOrOptions as AnyMethod, contextOrKey, {});
  }

  if (isLegacyDescriptor(descriptor) && isPropertyKey(contextOrKey)) {
    return wrapLegacy(descriptor, contextOrKey, {});
  }

  const options = isFuncLogOptions(targetOrOptions) ? targetOrOptions : {};
  return function funcLogDecorator(
    target: unknown,
    contextOrPropertyKey?: unknown,
    maybeDescriptor?: PropertyDescriptor,
  ) {
    if (isNativeDecoratorContext(contextOrPropertyKey)) {
      assertMethodContext(contextOrPropertyKey, '@FuncLog');
      return wrapNative(target as AnyMethod, contextOrPropertyKey, options);
    }

    if (isLegacyDescriptor(maybeDescriptor) && isPropertyKey(contextOrPropertyKey)) {
      return wrapLegacy(maybeDescriptor, contextOrPropertyKey, options);
    }

    throw new Error('@FuncLog can only be applied to methods');
  };
}

function wrapNative(
  original: AnyMethod,
  context: ClassMethodDecoratorContext,
  options: FuncLogOptions,
): AnyMethod {
  if (process.env.NODE_ENV === 'production') return original;
  return createLoggedMethod(original, String(context.name), options);
}

function wrapLegacy(
  descriptor: PropertyDescriptor,
  propertyKey: string | symbol,
  options: FuncLogOptions,
): PropertyDescriptor {
  if (typeof descriptor.value !== 'function') {
    throw new Error('@FuncLog can only be applied to methods');
  }
  if (process.env.NODE_ENV === 'production') return descriptor;
  descriptor.value = createLoggedMethod(
    descriptor.value as AnyMethod,
    String(propertyKey),
    options,
  );
  return descriptor;
}

function createLoggedMethod(
  original: AnyMethod,
  methodName: string,
  options: FuncLogOptions,
): AnyMethod {
  const logged = function logged(this: unknown, ...args: unknown[]) {
    const label = resolveLabel(this, methodName);
    logCall(label, args, options);

    try {
      const result = original.apply(this, args);
      if (isThenable(result)) {
        return Promise.resolve(result).then(
          (value: unknown) => {
            logReturn(label, value, options);
            return value;
          },
          (error: unknown) => {
            logThrow(label, error);
            throw error;
          },
        );
      }

      logReturn(label, result, options);
      return result;
    } catch (error) {
      logThrow(label, error);
      throw error;
    }
  };

  Object.defineProperty(logged, 'name', {
    value: original.name || methodName,
    configurable: true,
  });
  return logged;
}

function logCall(label: string, args: unknown[], options: FuncLogOptions): void {
  if (options.muteArgs === true) {
    console.info(`[Log] call ${label}`);
    return;
  }
  console.info(`[Log] call ${label}`, formatArgs(args, options.muteArgs));
}

function logReturn(label: string, value: unknown, options: FuncLogOptions): void {
  if (options.muteReturn) return;
  console.info(`[Log] return ${label}`, value);
}

function logThrow(label: string, error: unknown): void {
  console.info(`[Log] throw ${label}`, error);
}

function formatArgs(
  args: unknown[],
  muteArgs: FuncLogOptions['muteArgs'],
): unknown[] {
  if (!Array.isArray(muteArgs) || muteArgs.length === 0) {
    return args;
  }
  const muted = new Set(muteArgs);
  return args.map((arg, index) => (muted.has(index) ? MUTED : arg));
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
