export function isNativeDecoratorContext(
  value: unknown,
): value is ClassMemberDecoratorContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    'addInitializer' in value
  );
}

export function assertMethodContext(
  context: ClassMemberDecoratorContext,
  decoratorName = '@FuncLog',
): asserts context is ClassMethodDecoratorContext {
  if (context.kind !== 'method') {
    throw new Error(`${decoratorName} can only be applied to methods`);
  }
}

export function isLegacyDescriptor(value: unknown): value is PropertyDescriptor {
  return typeof value === 'object' && value !== null && 'value' in value;
}

export function isPropertyKey(value: unknown): value is string | symbol {
  return typeof value === 'string' || typeof value === 'symbol';
}

export function isFuncLogOptions(value: unknown): value is { [key: string]: unknown } {
  return typeof value === 'object' && value !== null;
}
