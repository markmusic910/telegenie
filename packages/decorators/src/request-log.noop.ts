import {
  assertMethodContext,
  isLegacyDescriptor,
  isNativeDecoratorContext,
  isPropertyKey,
} from './log.guards';
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

/** Production `@RequestLog`: leave the method unchanged and emit no logs. */
export function RequestLog<This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
): (this: This, ...args: Args) => Return;
export function RequestLog(
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): PropertyDescriptor;
export function RequestLog(options?: RequestLogOptions): RequestLogDecorator;
export function RequestLog(
  targetOrOptions?: unknown,
  contextOrKey?: unknown,
  descriptor?: PropertyDescriptor,
): unknown {
  if (isNativeDecoratorContext(contextOrKey)) {
    assertMethodContext(contextOrKey, '@RequestLog');
    return targetOrOptions;
  }

  if (isLegacyDescriptor(descriptor) && isPropertyKey(contextOrKey)) {
    if (typeof descriptor.value !== 'function') {
      throw new Error('@RequestLog can only be applied to methods');
    }
    return descriptor;
  }

  return function requestLogDecorator(
    target: unknown,
    contextOrPropertyKey?: unknown,
    maybeDescriptor?: PropertyDescriptor,
  ) {
    if (isNativeDecoratorContext(contextOrPropertyKey)) {
      assertMethodContext(contextOrPropertyKey, '@RequestLog');
      return target as AnyMethod;
    }

    if (isLegacyDescriptor(maybeDescriptor) && isPropertyKey(contextOrPropertyKey)) {
      if (typeof maybeDescriptor.value !== 'function') {
        throw new Error('@RequestLog can only be applied to methods');
      }
      return maybeDescriptor;
    }

    throw new Error('@RequestLog can only be applied to methods');
  };
}
