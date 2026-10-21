import { DECORATED_METHODS } from './method';

export function Controller(target: any, context: ClassDecoratorContext) {
  if (context.kind !== 'class') {
    throw new Error('@Controller can only be applied to classes');
  }

  const prototype = target.prototype;

  // Find all methods on prototype and summarize them
  const propertyNames = Object.getOwnPropertyNames(prototype);
  const decoratedList: string[] = [];

  for (const name of propertyNames) {
    if (name === 'constructor') continue;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    if (descriptor && typeof descriptor.value === 'function') {
      const originalMethod = descriptor.value;
      const isDecorated = DECORATED_METHODS.has(originalMethod);
      if (isDecorated) {
        decoratedList.push(name);
      }

      // Wrap the method to enforce access control and error wrapping
      prototype[name] = function (this: any, ...args: any[]) {
        // Access check for undecorated methods called from outside
        if (!isDecorated) {
          if (!this._internalCallDepth || this._internalCallDepth <= 0) {
            throw new Error(
              `Method "${name}" is not decorated with @Method and cannot be accessed from outside.`
            );
          }
        }

        // Track internal call depth for @Method calls
        if (isDecorated) {
          this._internalCallDepth = (this._internalCallDepth || 0) + 1;
        }

        try {
          const result = originalMethod.apply(this, args);
          if (isThenable(result)) {
            return Promise.resolve(result).then(
              (val) => {
                if (isDecorated) {
                  this._internalCallDepth--;
                }
                return val;
              },
              (err) => {
                if (isDecorated) {
                  this._internalCallDepth--;
                }
                if (isDecorated) {
                  return {
                    success: false,
                    error: {
                      message: err instanceof Error ? err.message : String(err),
                      code: (err as any)?.code || 'CONTROLLER_ERROR',
                    },
                  };
                }
                throw err;
              }
            );
          }

          if (isDecorated) {
            this._internalCallDepth--;
          }
          return result;
        } catch (err) {
          if (isDecorated) {
            this._internalCallDepth--;
          }
          if (isDecorated) {
            return {
              success: false,
              error: {
                message: err instanceof Error ? err.message : String(err),
                code: (err as any)?.code || 'CONTROLLER_ERROR',
              },
            };
          }
          throw err;
        }
      };

      // Preserve function name
      Object.defineProperty(prototype[name], 'name', {
        value: originalMethod.name || name,
        configurable: true,
      });
    }
  }

  // Set the summarized public @Method methods on the prototype
  Object.defineProperty(prototype, 'registeredMethods', {
    get() {
      return decoratedList;
    },
    configurable: true,
    enumerable: true,
  });
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  );
}
