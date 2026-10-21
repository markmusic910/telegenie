import { createMessageListScrollerStore } from './message-list-scroller.store';

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe() {}

  disconnect() {}

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function createScrollerFixture() {
  const root = document.createElement('div');
  Object.defineProperties(root, {
    scrollTop: { value: 0, writable: true, configurable: true },
    scrollHeight: { value: 1000, writable: true, configurable: true },
    clientHeight: { value: 400, writable: true, configurable: true },
  });

  const content = document.createElement('div');
  root.appendChild(content);
  document.body.appendChild(root);

  return { root, content };
}

describe('message-list-scroller.store', () => {
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    MockResizeObserver.instances = [];
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    globalThis.ResizeObserver = originalResizeObserver;
  });

  it('measures metrics on attach and updates them on scroll', () => {
    const { root } = createScrollerFixture();
    const store = createMessageListScrollerStore();
    const detach = store.attach(root);

    expect(store.getMetrics()).toEqual({
      scrollOffset: 0,
      distanceFromBottom: 600,
    });

    root.scrollTop = 100;
    root.dispatchEvent(new Event('scroll'));

    expect(store.getMetrics()).toEqual({
      scrollOffset: 100,
      distanceFromBottom: 500,
    });

    detach();
  });

  it('notifies scroll subscribers once per scroll and metrics subscribers on scroll', () => {
    const { root } = createScrollerFixture();
    const store = createMessageListScrollerStore();
    const scrollCalls: number[] = [];
    const metricsCalls: number[] = [];

    store.subscribe('scroll', () => {
      scrollCalls.push(store.getMetrics().scrollOffset);
    });
    store.subscribeMetrics(() => {
      metricsCalls.push(store.getMetrics().scrollOffset);
    });
    store.attach(root);

    root.scrollTop = 50;
    root.dispatchEvent(new Event('scroll'));
    root.scrollTop = 120;
    root.dispatchEvent(new Event('scroll'));

    expect(scrollCalls).toEqual([50, 120]);
    expect(metricsCalls).toEqual([50, 120]);
  });

  it('notifies resize subscribers when ResizeObserver fires', () => {
    const { root } = createScrollerFixture();
    const store = createMessageListScrollerStore();
    const resizeCalls: number[] = [];

    store.subscribe('resize', () => {
      resizeCalls.push(store.getMetrics().scrollOffset);
    });
    store.attach(root);

    MockResizeObserver.instances[0]?.trigger();

    expect(resizeCalls).toEqual([0]);
  });

  it('invokes all subscribers and skips unsubscribed ones', () => {
    const { root } = createScrollerFixture();
    const store = createMessageListScrollerStore();
    const first = jest.fn();
    const second = jest.fn();

    const unsubscribeFirst = store.subscribe('scroll', first);
    store.subscribe('scroll', second);
    store.attach(root);

    root.scrollTop = 10;
    root.dispatchEvent(new Event('scroll'));
    unsubscribeFirst();

    root.scrollTop = 20;
    root.dispatchEvent(new Event('scroll'));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('allows re-attach after detach without duplicate native listeners', () => {
    const { root } = createScrollerFixture();
    const store = createMessageListScrollerStore();
    const addSpy = jest.spyOn(root, 'addEventListener');

    const detachFirst = store.attach(root);
    expect(addSpy).toHaveBeenCalledTimes(1);
    detachFirst();

    const detachSecond = store.attach(root);
    expect(addSpy).toHaveBeenCalledTimes(2);
    detachSecond();
  });

  it('throws when attach is called while already attached', () => {
    const { root } = createScrollerFixture();
    const store = createMessageListScrollerStore();
    store.attach(root);

    expect(() => store.attach(root)).toThrow('MessageListScrollerStore is already attached');
  });
});
