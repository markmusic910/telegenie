import {
  assertMethodContext,
  isLegacyDescriptor,
  isNativeDecoratorContext,
  isPropertyKey,
} from './log.guards';
import type { FuncLogOptions } from './options';

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

/** Production `@FuncLog`: leave the method unchanged and emit no logs. */
export function FuncLog<This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
): (this: This, ...args: Args) => Return;
export function FuncLog(
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): PropertyDescriptor;
export function FuncLog(options?: FuncLogOptions): FuncLogDecorator;
export function FuncLog(
  targetOrOptions?: unknown,
  contextOrKey?: unknown,
  descriptor?: PropertyDescriptor,
): unknown {
  if (isNativeDecoratorContext(contextOrKey)) {
    assertMethodContext(contextOrKey, '@FuncLog');
    return targetOrOptions;
  }

  if (isLegacyDescriptor(descriptor) && isPropertyKey(contextOrKey)) {
    if (typeof descriptor.value !== 'function') {
      throw new Error('@FuncLog can only be applied to methods');
    }
    return descriptor;
  }

  return function funcLogDecorator(
    target: unknown,
    contextOrPropertyKey?: unknown,
    maybeDescriptor?: PropertyDescriptor,
  ) {
    if (isNativeDecoratorContext(contextOrPropertyKey)) {
      assertMethodContext(contextOrPropertyKey, '@FuncLog');
      return target as AnyMethod;
    }

    if (isLegacyDescriptor(maybeDescriptor) && isPropertyKey(contextOrPropertyKey)) {
      if (typeof maybeDescriptor.value !== 'function') {
        throw new Error('@FuncLog can only be applied to methods');
      }
      return maybeDescriptor;
    }

    throw new Error('@FuncLog can only be applied to methods');
  };
}
