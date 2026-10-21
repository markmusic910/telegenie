import { Recover } from './recover';
import { Recover as ProductionRecover } from './recover.noop';

describe('Recover decorator', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('catches sync error, logs it, and rethrows by default', () => {
    class TestService {
      @Recover()
      failingMethod() {
        throw new Error('sync explosion');
      }
    }

    const svc = new TestService();
    expect(() => svc.failingMethod()).toThrow('sync explosion');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Recover] Exception in TestService.failingMethod:'),
      expect.any(Error),
      expect.objectContaining({ args: [] }),
    );
  });

  it('catches async error, logs it, and rethrows by default', async () => {
    class TestService {
      @Recover
      async failingAsync() {
        throw new Error('async explosion');
      }
    }

    const svc = new TestService();
    await expect(svc.failingAsync()).rejects.toThrow('async explosion');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Recover] Exception in TestService.failingAsync:'),
      expect.any(Error),
      expect.objectContaining({ args: [] }),
    );
  });

  it('returns static fallback value when provided', async () => {
    class TestService {
      @Recover({ fallback: 'safe-fallback' })
      async failingAsync() {
        throw new Error('boom');
      }
    }

    const svc = new TestService();
    const result = await svc.failingAsync();
    expect(result).toBe('safe-fallback');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('returns fallback function result when provided', async () => {
    class TestService {
      @Recover({ fallback: (err: any) => `handled-${err.message}` })
      async failingAsync() {
        throw new Error('custom-error');
      }
    }

    const svc = new TestService();
    const result = await svc.failingAsync();
    expect(result).toBe('handled-custom-error');
  });

  it('calls onError callback and suppresses rethrow when rethrow is false', async () => {
    let capturedError: unknown;
    class TestService {
      @Recover({
        rethrow: false,
        onError: (err) => {
          capturedError = err;
        },
      })
      async failingAsync() {
        throw new Error('swallowed');
      }
    }

    const svc = new TestService();
    const result = await svc.failingAsync();
    expect(result).toBeUndefined();
    expect(capturedError).toBeInstanceOf(Error);
  });

  it('does not interfere with successful execution', async () => {
    class TestService {
      @Recover()
      async successMethod(val: number) {
        return val * 2;
      }
    }

    const svc = new TestService();
    await expect(svc.successMethod(21)).resolves.toBe(42);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('supports legacy experimental decorator format', () => {
    const descriptor: PropertyDescriptor = {
      value: () => {
        throw new Error('legacy error');
      },
    };
    const wrapped = Recover({}, 'legacyMethod', descriptor);
    expect(typeof wrapped.value).toBe('function');
    expect(() => wrapped.value()).toThrow('legacy error');
  });

  it('validates method-only decorator usage', () => {
    expect(() => {
      Recover({} as any, 'prop', { value: 123 });
    }).toThrow('@Recover can only be applied to methods');

    expect(() => {
      Recover()({} as any, 'prop', { value: 123 });
    }).toThrow('@Recover can only be applied to methods');
  });

  describe('ProductionRecover (noop)', () => {
    it('leaves methods unchanged in production noop version', async () => {
      class Sample {
        @ProductionRecover()
        async doSomething(val: string) {
          return val;
        }

        @ProductionRecover
        syncMethod() {
          return 'ok';
        }
      }

      const s = new Sample();
      expect(await s.doSomething('test')).toBe('test');
      expect(s.syncMethod()).toBe('ok');
    });

    it('supports legacy descriptor in production noop', () => {
      const descriptor: PropertyDescriptor = {
        value: () => 'legacy',
      };
      const result = ProductionRecover({}, 'test', descriptor);
      expect(result).toBe(descriptor);
    });
  });
});
