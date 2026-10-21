import { Controller } from './controller';
import { Method } from './method';
import { RequestLog, getTabId } from './request-log';
import { RequestLog as ProductionRequestLog } from './request-log.noop';

describe('Controller, Method, and RequestLog decorators', () => {
  let info: jest.SpyInstance;

  beforeEach(() => {
    info = jest.spyOn(console, 'info').mockImplementation(() => {});
    // Mock sessionStorage for tab ID
    if (typeof global.sessionStorage === 'undefined') {
      const mockStorage: Record<string, string> = {
        'telegenie.tabId': 'test-tab-id',
      };
      global.sessionStorage = {
        getItem: (key: string) => mockStorage[key] || null,
        setItem: (key: string, value: string) => {
          mockStorage[key] = value;
        },
        removeItem: (key: string) => {
          delete mockStorage[key];
        },
        clear: () => {},
        key: () => null,
        length: 0,
      };
    }
  });

  afterEach(() => {
    info.mockRestore();
  });

  it('allows access to decorated methods and logs request/response', async () => {
    @Controller
    class SampleController {
      @RequestLog()
      @Method()
      async doSomething(val: string) {
        return `done-${val}`;
      }

      @RequestLog({ outgoing: true })
      @Method()
      doSync(val: string) {
        return `sync-${val}`;
      }

      @RequestLog()
      @Method()
      async doFail(val: string) {
        throw new Error(`fail-${val}`);
      }
    }

    const controller = new SampleController();
    const res = await controller.doSomething('work');
    expect(res).toBe('done-work');

    const syncRes = controller.doSync('now');
    expect(syncRes).toBe('sync-now');

    const failRes = await controller.doFail('hard');
    expect(failRes).toEqual({
      success: false,
      error: {
        message: 'fail-hard',
        code: 'CONTROLLER_ERROR',
      },
    });

    // Verify RequestLog printed logs
    expect(info.mock.calls.length).toBe(3);
  });

  it('exposes registeredMethods on prototype and instance', () => {
    @Controller
    class SampleController {
      @Method()
      foo() {}

      @Method()
      bar() {}

      baz() {}
    }

    const controller = new SampleController();
    expect((controller as any).registeredMethods).toEqual(['foo', 'bar']);
  });

  it('throws an error when calling an undecorated method from outside', () => {
    @Controller
    class SampleController {
      @Method()
      foo() {
        return this.privateHelper(); // permitted internally
      }

      privateHelper() {
        return 'secret';
      }
    }

    const controller = new SampleController();
    
    // Call via Method (permitted helper call inside)
    expect(controller.foo()).toBe('secret');

    // Direct call from outside (should throw)
    expect(() => (controller as any).privateHelper()).toThrow(
      'Method "privateHelper" is not decorated with @Method and cannot be accessed from outside.'
    );
  });

  it('does not wrap errors for undecorated methods', () => {
    @Controller
    class SampleController {
      privateThrower() {
        throw new Error('raw-fail');
      }
    }
    const controller = new SampleController();
    (controller as any)._internalCallDepth = 1;
    expect(() => (controller as any).privateThrower()).toThrow('raw-fail');
  });

  it('does not wrap async errors for undecorated methods', async () => {
    @Controller
    class SampleController {
      async privateAsyncThrower() {
        throw new Error('raw-async-fail');
      }
    }
    const controller = new SampleController();
    (controller as any)._internalCallDepth = 1;
    await expect((controller as any).privateAsyncThrower()).rejects.toThrow('raw-async-fail');
  });

  it('wraps errors in a common error response object', async () => {
    @Controller
    class SampleController {
      @Method()
      async failAsync() {
        throw new Error('async-failure');
      }

      @Method()
      failSync() {
        throw new Error('sync-failure');
      }
    }

    const controller = new SampleController();

    const resAsync = await controller.failAsync();
    expect(resAsync).toEqual({
      success: false,
      error: {
        message: 'async-failure',
        code: 'CONTROLLER_ERROR',
      },
    });

    const resSync = controller.failSync();
    expect(resSync).toEqual({
      success: false,
      error: {
        message: 'sync-failure',
        code: 'CONTROLLER_ERROR',
      },
    });
  });

  it('respects timeout configurations', async () => {
    @Controller
    class SampleController {
      @Method({ timeout: 50 })
      async slowMethod() {
        await new Promise((r) => setTimeout(r, 100));
        return 'ok';
      }

      @Method({ timeout: 50 })
      fastSyncMethod() {
        return 'sync-ok';
      }

      @Method({ timeout: 500 })
      async fastMethod() {
        return 'fast-ok';
      }

      @Method({ timeout: 500 })
      async fastFailMethod() {
        throw new Error('fast-fail');
      }
    }

    const controller = new SampleController();
    const res = await controller.slowMethod();
    expect(res).toEqual({
      success: false,
      error: {
        message: 'Method "slowMethod" timed out after 50ms',
        code: 'CONTROLLER_ERROR',
      },
    });

    expect(controller.fastSyncMethod()).toBe('sync-ok');
    
    const fastRes = await controller.fastMethod();
    expect(fastRes).toBe('fast-ok');

    const fastFailRes = await controller.fastFailMethod();
    expect(fastFailRes).toEqual({
      success: false,
      error: {
        message: 'fast-fail',
        code: 'CONTROLLER_ERROR',
      },
    });
  });

  it('enforces rateLimit configurations', () => {
    @Controller
    class SampleController {
      @Method({ rateLimit: { limit: 2, windowMs: 1000 } })
      callMe() {
        return 'ok';
      }
    }

    const controller = new SampleController();

    expect(controller.callMe()).toBe('ok');
    expect(controller.callMe()).toBe('ok');
    
    // Third call should fail with rate limit exceeded
    const res = controller.callMe();
    expect(res).toEqual({
      success: false,
      error: {
        message: 'Rate limit exceeded for method "callMe". Limit: 2/1000ms',
        code: 'CONTROLLER_ERROR',
      },
    });
  });

  it('runs production RequestLog without emitting logs', () => {
    class Sample {
      @ProductionRequestLog()
      doSomething() {
        return 'ok';
      }

      @ProductionRequestLog
      doSomethingElse() {
        return 'ok2';
      }
    }

    expect(new Sample().doSomething()).toBe('ok');
    expect(new Sample().doSomethingElse()).toBe('ok2');
    expect(info.mock.calls.length).toBe(0);

    const legacyDescriptor: PropertyDescriptor = {
      value: jest.fn().mockReturnValue('legacy-noop-ok'),
      configurable: true,
      writable: true,
    };
    
    const decoratedDescriptor = ProductionRequestLog({}, 'foo', legacyDescriptor);
    expect(decoratedDescriptor.value()).toBe('legacy-noop-ok');

    expect(() => {
      ProductionRequestLog({} as any, 'bar', { value: 'not-a-func' });
    }).toThrow('@RequestLog can only be applied to methods');

    expect(() => {
      const dec = ProductionRequestLog();
      dec({} as any, 'bar', { value: 'not-a-func' });
    }).toThrow('@RequestLog can only be applied to methods');
  });

  it('supports legacy experimental decorators syntax for RequestLog and Controller/Method', () => {
    const legacyDescriptor: PropertyDescriptor = {
      value: jest.fn().mockReturnValue('legacy-ok'),
      configurable: true,
      writable: true,
    };
    
    const decoratedDescriptor = RequestLog({}, 'foo', legacyDescriptor);
    expect(typeof decoratedDescriptor.value).toBe('function');
    expect(decoratedDescriptor.value()).toBe('legacy-ok');

    const bareDescriptor = RequestLog({} as any, 'foo', legacyDescriptor);
    expect(typeof bareDescriptor.value).toBe('function');

    expect(() => {
      RequestLog({} as any, 'bar', { value: 'not-a-func' });
    }).toThrow('@RequestLog can only be applied to methods');

    expect(() => {
      const dec = RequestLog();
      dec({} as any, 'bar', { value: 'not-a-func' });
    }).toThrow('@RequestLog can only be applied to methods');

    expect(() => {
      Method()({} as any, { kind: 'field', name: 'field1' } as any);
    }).toThrow('@Method can only be applied to methods');

    expect(() => {
      Controller({} as any, { kind: 'method', name: 'method1' } as any);
    }).toThrow('@Controller can only be applied to classes');
  });

  it('correctly catches and logs timeout errors when RequestLog is on top of Method', async () => {
    @Controller
    class TimeoutController {
      @RequestLog()
      @Method({ timeout: 50 })
      async slowMethod() {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'success';
      }
    }

    const controller = new TimeoutController();
    const result = await controller.slowMethod();

    expect(result).toMatchObject({
      success: false,
      error: {
        message: 'Method "slowMethod" timed out after 50ms',
        code: 'CONTROLLER_ERROR',
      },
    });

    // Verify console.info was called for the RequestLog failure
    const logCalls = info.mock.calls;
    const timeoutLog = logCalls.find((call) =>
      call[0].includes('Incoming request: TimeoutController.slowMethod')
    );
    expect(timeoutLog).toBeDefined();
    expect(timeoutLog![1]).toMatchObject({
      success: false,
      error: 'Method "slowMethod" timed out after 50ms',
    });
  });

  describe('getTabId', () => {
    it('returns existing tab ID from sessionStorage', () => {
      sessionStorage.setItem('telegenie.tabId', '5b820925');
      expect(getTabId()).toBe('5b820925');
    });

    it('generates 8-char tab ID when sessionStorage is empty', () => {
      sessionStorage.removeItem('telegenie.tabId');
      const tabId = getTabId();
      expect(tabId).toHaveLength(8);
      expect(sessionStorage.getItem('telegenie.tabId')).toBe(tabId);
    });
  });
});
