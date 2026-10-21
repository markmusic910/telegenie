// Explicit Resource Management Polyfill
// Reference: https://github.com/tc39/proposal-explicit-resource-management

if (typeof Symbol.dispose === 'undefined') {
  (Symbol as any).dispose = Symbol.for('Symbol.dispose');
}
if (typeof Symbol.asyncDispose === 'undefined') {
  (Symbol as any).asyncDispose = Symbol.for('Symbol.asyncDispose');
}

if (typeof SuppressedError === 'undefined') {
  class SuppressedErrorClass extends Error {
    error: any;
    suppressed: any;
    constructor(error: any, suppressed: any, message?: string) {
      super(message || 'An error occurred during disposal');
      this.name = 'SuppressedError';
      this.error = error;
      this.suppressed = suppressed;
    }
  }
  (globalThis as any).SuppressedError = SuppressedErrorClass;
}

if (typeof DisposableStack === 'undefined') {
  class DisposableStackClass {
    #disposables: Array<() => void> = [];
    #disposed = false;

    get disposed() {
      return this.#disposed;
    }

    dispose() {
      if (this.#disposed) return;
      this.#disposed = true;
      const errors: unknown[] = [];
      
      // Disposables are disposed in LIFO (Last-In-First-Out) order
      for (let i = this.#disposables.length - 1; i >= 0; i--) {
        try {
          this.#disposables[i]();
        } catch (e) {
          errors.push(e);
        }
      }
      
      this.#disposables = [];
      
      if (errors.length > 0) {
        if (errors.length === 1) {
          throw errors[0];
        }
        // If there are multiple errors, throw a SuppressedError
        let suppressedError = errors[0];
        for (let i = 1; i < errors.length; i++) {
          suppressedError = new (globalThis as any).SuppressedError(errors[i], suppressedError);
        }
        throw suppressedError;
      }
    }

    use<T extends { [Symbol.dispose](): void } | null | undefined>(value: T): T {
      if (this.#disposed) {
        throw new ReferenceError('DisposableStack has already been disposed');
      }
      if (value !== null && value !== undefined) {
        const disposeMethod = value[Symbol.dispose];
        if (typeof disposeMethod !== 'function') {
          throw new TypeError('Object is not disposable');
        }
        this.#disposables.push(() => disposeMethod.call(value));
      }
      return value;
    }

    adopt<T>(value: T, onDispose: (value: T) => void): T {
      if (this.#disposed) {
        throw new ReferenceError('DisposableStack has already been disposed');
      }
      if (typeof onDispose !== 'function') {
        throw new TypeError('onDispose must be a function');
      }
      this.#disposables.push(() => onDispose(value));
      return value;
    }

    defer(onDispose: () => void): void {
      if (this.#disposed) {
        throw new ReferenceError('DisposableStack has already been disposed');
      }
      if (typeof onDispose !== 'function') {
        throw new TypeError('onDispose must be a function');
      }
      this.#disposables.push(onDispose);
    }

    [Symbol.dispose](): void {
      this.dispose();
    }
  }

  (globalThis as any).DisposableStack = DisposableStackClass;
}

if (typeof AsyncDisposableStack === 'undefined') {
  class AsyncDisposableStackClass {
    #disposables: Array<() => Promise<void> | void> = [];
    #disposed = false;

    get disposed() {
      return this.#disposed;
    }

    async disposeAsync() {
      if (this.#disposed) return;
      this.#disposed = true;
      const errors: unknown[] = [];

      for (let i = this.#disposables.length - 1; i >= 0; i--) {
        try {
          await this.#disposables[i]();
        } catch (e) {
          errors.push(e);
        }
      }

      this.#disposables = [];

      if (errors.length > 0) {
        if (errors.length === 1) {
          throw errors[0];
        }
        let suppressedError = errors[0];
        for (let i = 1; i < errors.length; i++) {
          suppressedError = new (globalThis as any).SuppressedError(errors[i], suppressedError);
        }
        throw suppressedError;
      }
    }

    use<T extends { [Symbol.asyncDispose](): Promise<void> | void } | { [Symbol.dispose](): void } | null | undefined>(value: T): T {
      if (this.#disposed) {
        throw new ReferenceError('AsyncDisposableStack has already been disposed');
      }
      if (value !== null && value !== undefined) {
        const asyncDisposeMethod = (value as any)[Symbol.asyncDispose];
        if (typeof asyncDisposeMethod === 'function') {
          this.#disposables.push(() => asyncDisposeMethod.call(value));
        } else {
          const disposeMethod = (value as any)[Symbol.dispose];
          if (typeof disposeMethod === 'function') {
            this.#disposables.push(() => disposeMethod.call(value));
          } else {
            throw new TypeError('Object is not disposable');
          }
        }
      }
      return value;
    }

    adopt<T>(value: T, onDispose: (value: T) => Promise<void> | void): T {
      if (this.#disposed) {
        throw new ReferenceError('AsyncDisposableStack has already been disposed');
      }
      if (typeof onDispose !== 'function') {
        throw new TypeError('onDispose must be a function');
      }
      this.#disposables.push(() => onDispose(value));
      return value;
    }

    defer(onDispose: () => Promise<void> | void): void {
      if (this.#disposed) {
        throw new ReferenceError('AsyncDisposableStack has already been disposed');
      }
      if (typeof onDispose !== 'function') {
        throw new TypeError('onDispose must be a function');
      }
      this.#disposables.push(onDispose);
    }

    async [Symbol.asyncDispose](): Promise<void> {
      await this.disposeAsync();
    }
  }

  (globalThis as any).AsyncDisposableStack = AsyncDisposableStackClass;
}
