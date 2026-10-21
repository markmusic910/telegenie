import { useIntersectionObserver } from '@/lib/hooks/use-intersection-observer';
import { observable, runInAction } from 'mobx';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockThreadUI = observable({
  isScrollFrozen: false,
});

const mockGlobalStore = {
  nav: observable({
    selectedDialogId: 'chat1',
  }),
  getDialogUI: () => ({ activeThreadId: '-1' }),
  getThreadUI: () => mockThreadUI,
};

jest.mock('@telegenie/sdk', () => ({
  MAIN_THREAD_ID: '-1',
}));

jest.mock('@/lib/contexts/sdk.context', () => ({
  useStore: () => mockGlobalStore,
}));

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null;
  readonly rootMargin: string;
  readonly thresholds: ReadonlyArray<number>;
  private readonly callback: IntersectionObserverCallback;
  private observedElements = new Set<Element>();
  static instances: MockIntersectionObserver[] = [];

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.root = options?.root ?? null;
    this.rootMargin = options?.rootMargin ?? '0px';
    this.thresholds = options?.threshold ? [options.threshold].flat() : [0];
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observedElements.add(target);
  }

  unobserve(target: Element): void {
    this.observedElements.delete(target);
  }

  disconnect(): void {
    this.observedElements.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  simulateIntersect(entries: Partial<IntersectionObserverEntry>[]): void {
    this.callback(
      entries.map((e) => ({
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRatio: e.isIntersecting ? 1 : 0,
        intersectionRect: {} as DOMRectReadOnly,
        isIntersecting: Boolean(e.isIntersecting),
        isVisible: true,
        rootBounds: null,
        target: e.target ?? document.createElement('div'),
        time: Date.now(),
        ...e,
      })),
      this,
    );
  }
}

function Probe({
  rootRef,
  onIntersect,
  peerId,
  threadId,
  targetEl,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  onIntersect: (entries: { isIntersecting: boolean; target: Element }[]) => void;
  peerId?: string;
  threadId?: string;
  targetEl: HTMLElement | null;
}) {
  const { observe } = useIntersectionObserver({
    rootRef,
    onIntersect,
    peerId,
    threadId,
  });

  if (targetEl) {
    observe(targetEl);
  }

  return null;
}

describe('useIntersectionObserver', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalIO: typeof IntersectionObserver;

  beforeEach(() => {
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
    MockIntersectionObserver.instances = [];
    runInAction(() => {
      mockThreadUI.isScrollFrozen = false;
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.innerHTML = '';
    globalThis.IntersectionObserver = originalIO;
    jest.restoreAllMocks();
  });

  it('buffers intersection entries while thread is scroll-frozen and flushes when unfrozen', () => {
    const scroller = document.createElement('div');
    const target = document.createElement('div');
    const scrollerRef = { current: scroller };
    const onIntersect = jest.fn();

    const peerId = 'chat1';
    const threadId = '-1';

    act(() => {
      root.render(
        <Probe
          rootRef={scrollerRef}
          onIntersect={onIntersect}
          peerId={peerId}
          threadId={threadId}
          targetEl={target}
        />,
      );
    });

    const observer = MockIntersectionObserver.instances[0];
    expect(observer).toBeDefined();

    // Normal intersection fires callback
    act(() => {
      observer.simulateIntersect([{ isIntersecting: true, target }]);
    });
    expect(onIntersect).toHaveBeenCalledTimes(1);
    expect(onIntersect).toHaveBeenLastCalledWith([{ isIntersecting: true, target }]);

    // Freeze thread scroll via MobX observable
    act(() => {
      runInAction(() => {
        mockThreadUI.isScrollFrozen = true;
      });
    });

    // Intersections while frozen must be buffered, not executed
    act(() => {
      observer.simulateIntersect([{ isIntersecting: false, target }]);
    });
    expect(onIntersect).toHaveBeenCalledTimes(1);

    // Unfreeze thread scroll flushes the pending entries
    act(() => {
      runInAction(() => {
        mockThreadUI.isScrollFrozen = false;
      });
    });
    expect(onIntersect).toHaveBeenCalledTimes(2);
    expect(onIntersect).toHaveBeenLastCalledWith([{ isIntersecting: false, target }]);
  });
});
