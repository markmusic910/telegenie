import { FuncLog, MUTED } from './func-log';
import { FuncLog as ProductionFuncLog } from './func-log.noop';

describe('FuncLog decorator', () => {
  let info: jest.SpyInstance;

  beforeEach(() => {
    info = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    info.mockRestore();
  });

  it('logs arguments and the return value (@FuncLog())', () => {
    class Sample {
      @FuncLog()
      greet(name: string) {
        return `hi ${name}`;
      }
    }

    expect(new Sample().greet('Ada')).toBe('hi Ada');
    expect(info.mock.calls).toEqual([
      ['[Log] call Sample.greet', ['Ada']],
      ['[Log] return Sample.greet', 'hi Ada'],
    ]);
  });

  it('supports bare @FuncLog without options', () => {
    class Sample {
      @FuncLog
      add(a: number, b: number) {
        return a + b;
      }
    }

    expect(new Sample().add(1, 2)).toBe(3);
    expect(info.mock.calls).toEqual([
      ['[Log] call Sample.add', [1, 2]],
      ['[Log] return Sample.add', 3],
    ]);
  });

  it('mutes all arguments', () => {
    class Sample {
      @FuncLog({ muteArgs: true })
      secret(password: string) {
        return password.length;
      }
    }

    expect(new Sample().secret('hunter2')).toBe(7);
    expect(info.mock.calls).toEqual([
      ['[Log] call Sample.secret'],
      ['[Log] return Sample.secret', 7],
    ]);
  });

  it('mutes selected argument indexes', () => {
    class Sample {
      @FuncLog({ muteArgs: [1] })
      login(user: string, _password: string) {
        return `${user}:ok`;
      }
    }

    expect(new Sample().login('ada', 'hunter2')).toBe('ada:ok');
    expect(info.mock.calls).toEqual([
      ['[Log] call Sample.login', ['ada', MUTED]],
      ['[Log] return Sample.login', 'ada:ok'],
    ]);
  });

  it('leaves arguments unchanged when muteArgs is an empty list', () => {
    class Sample {
      @FuncLog({ muteArgs: [] })
      echo(value: string) {
        return value;
      }
    }

    expect(new Sample().echo('ok')).toBe('ok');
    expect(info.mock.calls[0]).toEqual(['[Log] call Sample.echo', ['ok']]);
  });

  it('mutes the return value', () => {
    class Sample {
      @FuncLog({ muteReturn: true })
      token() {
        return 'secret-token';
      }
    }

    expect(new Sample().token()).toBe('secret-token');
    expect(info.mock.calls).toEqual([['[Log] call Sample.token', []]]);
  });

  it('logs async resolution after the promise settles', async () => {
    class Sample {
      @FuncLog()
      async delay(val: string) {
        return val;
      }
    }

    await expect(new Sample().delay('res')).resolves.toBe('res');
    expect(info.mock.calls).toEqual([
      ['[Log] call Sample.delay', ['res']],
      ['[Log] return Sample.delay', 'res'],
    ]);
  });

  it('logs async rejection and rethrows', async () => {
    class Sample {
      @FuncLog()
      async fail() {
        throw new Error('fail');
      }
    }

    await expect(new Sample().fail()).rejects.toThrow('fail');
    expect(info.mock.calls).toEqual([
      ['[Log] call Sample.fail', []],
      ['[Log] throw Sample.fail', new Error('fail')],
    ]);
  });

  it('logs sync throws and rethrows', () => {
    class Sample {
      @FuncLog()
      fail() {
        throw new Error('sync-fail');
      }
    }

    expect(() => new Sample().fail()).toThrow('sync-fail');
    expect(info.mock.calls).toEqual([
      ['[Log] call Sample.fail', []],
      ['[Log] throw Sample.fail', new Error('sync-fail')],
    ]);
  });

  it('supports legacy experimental decorators syntax', () => {
    const legacyDescriptor: PropertyDescriptor = {
      value: jest.fn().mockReturnValue('legacy-ok'),
      configurable: true,
      writable: true,
    };
    
    const decoratedDescriptor = FuncLog({}, 'foo', legacyDescriptor);
    expect(typeof decoratedDescriptor.value).toBe('function');
    expect(decoratedDescriptor.value()).toBe('legacy-ok');

    expect(() => {
      FuncLog({} as any, 'bar', { value: 'not-a-func' });
    }).toThrow('@FuncLog can only be applied to methods');
  });
});

describe('FuncLog decorator in production', () => {
  let info: jest.SpyInstance;

  beforeEach(() => {
    info = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    info.mockRestore();
  });

  it('does not log arguments or the return value', () => {
    class Sample {
      @ProductionFuncLog()
      greet(name: string) {
        return `hi ${name}`;
      }
    }

    expect(new Sample().greet('Ada')).toBe('hi Ada');
    expect(info.mock.calls).toEqual([]);
  });

  it('supports bare decorator and legacy syntax in production', () => {
    class Sample {
      @ProductionFuncLog
      greet(name: string) {
        return `hi ${name}`;
      }
    }

    expect(new Sample().greet('Ada')).toBe('hi Ada');

    const legacyDescriptor: PropertyDescriptor = {
      value: jest.fn().mockReturnValue('legacy-ok'),
      configurable: true,
      writable: true,
    };
    
    const decoratedDescriptor = ProductionFuncLog({}, 'foo', legacyDescriptor);
    expect(decoratedDescriptor.value()).toBe('legacy-ok');

    expect(() => {
      ProductionFuncLog({} as any, 'bar', { value: 'not-a-func' });
    }).toThrow('@FuncLog can only be applied to methods');
  });
});
