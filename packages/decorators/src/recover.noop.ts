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

/** Production `@Recover`: leave the method unchanged and emit no logs. */
export function Recover<This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
): (this: This, ...args: Args) => Return;
export function Recover(
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): PropertyDescriptor;
export function Recover(options?: RecoverOptions): RecoverDecorator;
export function Recover(
  targetOrOptions?: unknown,
  contextOrKey?: unknown,
  descriptor?: PropertyDescriptor,
): unknown {
  if (isNativeDecoratorContext(contextOrKey)) {
    assertMethodContext(contextOrKey, '@Recover');
    return targetOrOptions;
  }

  if (isLegacyDescriptor(descriptor) && isPropertyKey(contextOrKey)) {
    if (typeof descriptor.value !== 'function') {
      throw new Error('@Recover can only be applied to methods');
    }
    return descriptor;
  }

  return function recoverDecorator(
    target: unknown,
    contextOrPropertyKey?: unknown,
    maybeDescriptor?: PropertyDescriptor,
  ) {
    if (isNativeDecoratorContext(contextOrPropertyKey)) {
      assertMethodContext(contextOrPropertyKey, '@Recover');
      return target as AnyMethod;
    }

    if (isLegacyDescriptor(maybeDescriptor) && isPropertyKey(contextOrPropertyKey)) {
      if (typeof maybeDescriptor.value !== 'function') {
        throw new Error('@Recover can only be applied to methods');
      }
      return maybeDescriptor;
    }

    throw new Error('@Recover can only be applied to methods');
  };
}
