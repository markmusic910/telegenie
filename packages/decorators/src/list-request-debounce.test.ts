import { Controller } from './controller';
import { ListRequestDebounce } from './list-request-debounce';
import { Method } from './method';

describe('ListRequestDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('batches one-argument calls and passes merged keys to the original method', async () => {
    const calls: unknown[][] = [];

    @Controller
    class SampleController {
      @ListRequestDebounce({ delay: 100 })
      @Method()
      async fetchItems(id: string | string[]): Promise<string | Map<string, string>> {
        calls.push([id]);
        if (Array.isArray(id)) {
          return new Map(id.map((entry) => [entry, `value-${entry}`]));
        }
        return `value-${id}`;
      }
    }

    const controller = new SampleController();
    const first = controller.fetchItems('a');
    const second = controller.fetchItems('b');

    jest.advanceTimersByTime(100);

    await expect(first).resolves.toBe('value-a');
    await expect(second).resolves.toBe('value-b');
    expect(calls).toEqual([[['a', 'b']]]);
  });

  it('batches two-argument calls by first key and merges second arrays', async () => {
    const calls: unknown[][] = [];

    @Controller
    class SampleController {
      @ListRequestDebounce({ delay: 100, concurrency: 2 })
      @Method()
      async fetchByPeer(
        peerId: string,
        ids: string[],
      ): Promise<Array<{ id: string; peerId: string }>> {
        calls.push([peerId, ids]);
        return ids.map((id) => ({ id, peerId }));
      }
    }

    const controller = new SampleController();
    const p1a = controller.fetchByPeer('peer-1', ['1']);
    const p1b = controller.fetchByPeer('peer-1', ['2']);
    const p2 = controller.fetchByPeer('peer-2', ['3']);

    jest.advanceTimersByTime(100);

    await expect(p1a).resolves.toEqual([{ id: '1', peerId: 'peer-1' }]);
    await expect(p1b).resolves.toEqual([{ id: '2', peerId: 'peer-1' }]);
    await expect(p2).resolves.toEqual([{ id: '3', peerId: 'peer-2' }]);

    expect(calls).toEqual(
      expect.arrayContaining([
        ['peer-1', ['1', '2']],
        ['peer-2', ['3']],
      ]),
    );
    expect(calls).toHaveLength(2);
  });

  it('deduplicates merged ids for the same first argument', async () => {
    const calls: unknown[][] = [];

    @Controller
    class SampleController {
      @ListRequestDebounce({ delay: 50 })
      @Method()
      async fetchByPeer(peerId: string, ids: string[]): Promise<string[]> {
        calls.push([peerId, ids]);
        return ids;
      }
    }

    const controller = new SampleController();
    const first = controller.fetchByPeer('peer-1', ['1', '2']);
    const second = controller.fetchByPeer('peer-1', ['2', '3']);

    jest.advanceTimersByTime(50);

    await expect(first).resolves.toEqual(['1', '2']);
    await expect(second).resolves.toEqual(['2', '3']);
    expect(calls).toEqual([['peer-1', ['1', '2', '3']]]);
  });

  it('throws when argument types are unsupported', async () => {
    @Controller
    class SampleController {
      @ListRequestDebounce({ delay: 50 })
      @Method()
      async fetchItems(id: string) {
        return id;
      }
    }

    const controller = new SampleController();
    const result = await controller.fetchItems({ bad: true } as never);
    expect(result).toEqual({
      success: false,
      error: {
        code: 'CONTROLLER_ERROR',
        message: expect.stringContaining('@ListRequestDebounce: invalid arguments'),
      },
    });
  });

  it('throws when mixing one- and two-argument call modes', async () => {
    @Controller
    class SampleController {
      @ListRequestDebounce({ delay: 50 })
      @Method()
      async flexible(first: string, second?: string[]) {
        return second ?? first;
      }
    }

    const controller = new SampleController();
    void controller.flexible('only-one');
    const result = await controller.flexible('peer', ['1']);
    expect(result).toEqual({
      success: false,
      error: {
        code: 'CONTROLLER_ERROR',
        message: expect.stringContaining('cannot mix one- and two-argument calls'),
      },
    });
  });
});
