import { createMessageListScrollerStore } from '@/lib/hooks/message-list/message-list-scroller.store';
import { useMessageListHistory } from '@/lib/hooks/message-list/use-history';
import { observable } from 'mobx';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockSlideListedWindow = jest.fn().mockResolvedValue(undefined);

const mockThreadUI = observable({
  listedIds: ['10', '20', '30'],
  isLoadingHistory: false,
  isScrollFrozen: false,
  hasMoreOlder: true,
  hasMoreNewer: true,
  listedFollowsNewest: false,
  flatItems: [],
});

const mockGlobalStore = {
  nav: observable({
    selectedDialogId: 'chat-1',
  }),
  getDialogUI: () => ({ activeThreadId: '-1' }),
  getThreadUI: () => mockThreadUI,
};

jest.mock('@telegenie/sdk', () => ({
  MAIN_THREAD_ID: '-1',
  anchorScrollTop: jest.fn(() => 0),
  findVisibleItemIndex: jest.fn(() => 0),
  itemOffsetInScroller: jest.fn(() => 0),
  pickMessageScrollAnchor: jest.fn(() => undefined),
}));

jest.mock('@/lib/contexts/sdk.context', () => ({
  useSDK: () => ({
    messageLoad: {
      slideListedWindow: mockSlideListedWindow,
    },
  }),
  useStore: () => mockGlobalStore,
  useGlobalStoreDialog: () => ({ activeThreadId: '-1' }),
  useGlobalStoreThread: () => mockThreadUI,
}));

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null;
  readonly rootMargin: string;
  readonly thresholds: ReadonlyArray<number>;
  private readonly callback: IntersectionObserverCallback;
  observedElements = new Set<Element>();
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

function TestComponent({
  scrollerRef,
  scroller,
  peerId,
  renderTriggers,
}: {
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  scroller: ReturnType<typeof createMessageListScrollerStore>;
  peerId: string;
  renderTriggers: boolean;
}) {
  const [rootNode, setRootNode] = useState<HTMLDivElement | null>(null);
  const bindScroller = (node: HTMLDivElement | null) => {
    scrollerRef.current = node;
    setRootNode(node);
  };

  const { backwardsTriggerRef, forwardsTriggerRef, hasHistoryTriggers } = useMessageListHistory({
    scroller,
    scrollerRef,
    root: rootNode,
    peerId,
  });

  return (
    <div ref={bindScroller}>
      {renderTriggers && hasHistoryTriggers && (
        <div ref={backwardsTriggerRef} className="backwards-trigger" />
      )}
      <div>Messages</div>
      {renderTriggers && hasHistoryTriggers && (
        <div ref={forwardsTriggerRef} className="forwards-trigger" />
      )}
    </div>
  );
}

describe('useMessageListHistory', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalIO: typeof IntersectionObserver;

  beforeEach(() => {
    mockSlideListedWindow.mockClear();
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
    MockIntersectionObserver.instances = [];
    mockThreadUI.isLoadingHistory = false;
    mockThreadUI.isScrollFrozen = false;
    mockThreadUI.hasMoreOlder = true;
    mockThreadUI.hasMoreNewer = true;
    mockThreadUI.listedFollowsNewest = false;

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
  });

  it('observes triggers and triggers slide when triggers mount after initial loading', async () => {
    const scrollerDiv = document.createElement('div');
    const scrollerRef = { current: scrollerDiv };
    const scroller = createMessageListScrollerStore();
    scroller.attach(scrollerDiv);

    // Initial render: initial loading (renderTriggers = false)
    act(() => {
      root.render(
        <TestComponent
          scrollerRef={scrollerRef}
          scroller={scroller}
          peerId="chat-1"
          renderTriggers={false}
        />,
      );
    });

    const observer = MockIntersectionObserver.instances.at(-1)!;
    expect(observer).toBeDefined();
    expect(observer.observedElements.size).toBe(0);

    // Hydration finished: renderTriggers = true
    act(() => {
      root.render(
        <TestComponent
          scrollerRef={scrollerRef}
          scroller={scroller}
          peerId="chat-1"
          renderTriggers={true}
        />,
      );
    });

    const activeObserver = MockIntersectionObserver.instances.at(-1)!;
    expect(activeObserver.observedElements.size).toBe(2);
    const elements = Array.from(activeObserver.observedElements);
    const backwardsEl = elements.find((el) => el.classList.contains('backwards-trigger'));
    const forwardsEl = elements.find((el) => el.classList.contains('forwards-trigger'));
    expect(backwardsEl).toBeDefined();
    expect(forwardsEl).toBeDefined();

    // Intersecting backwards trigger triggers load older
    await act(async () => {
      activeObserver.simulateIntersect([{ target: backwardsEl!, isIntersecting: true }]);
    });

    expect(mockSlideListedWindow).toHaveBeenCalledWith('chat-1', 'older', '-1', { preload: true });

    // Intersecting forwards trigger triggers load newer (backwards trigger has left view)
    mockSlideListedWindow.mockClear();
    await act(async () => {
      activeObserver.simulateIntersect([
        { target: backwardsEl!, isIntersecting: false },
        { target: forwardsEl!, isIntersecting: true },
      ]);
    });

    expect(mockSlideListedWindow).toHaveBeenCalledWith('chat-1', 'newer', '-1', { preload: true });
  });

  it('triggers slide on scroll when trigger was already intersecting', () => {
    const scrollerDiv = document.createElement('div');
    const scrollerRef = { current: scrollerDiv };
    const scroller = createMessageListScrollerStore();
    scroller.attach(scrollerDiv);

    // Simulate thread is initially loading history when intersection fires
    mockThreadUI.isLoadingHistory = true;

    act(() => {
      root.render(
        <TestComponent
          scrollerRef={scrollerRef}
          scroller={scroller}
          peerId="chat-1"
          renderTriggers={true}
        />,
      );
    });

    const observer = MockIntersectionObserver.instances.at(-1)!;
    const elements = Array.from(observer.observedElements);
    const backwardsEl = elements.find((el) => el.classList.contains('backwards-trigger'))!;

    // Intersection arrives while loading -> skipped
    act(() => {
      observer.simulateIntersect([{ target: backwardsEl, isIntersecting: true }]);
    });
    expect(mockSlideListedWindow).not.toHaveBeenCalled();

    // Now loading finishes, user scrolls -> checkPendingSlide triggers slide
    mockThreadUI.isLoadingHistory = false;
    act(() => {
      scrollerDiv.dispatchEvent(new Event('scroll'));
    });

    expect(mockSlideListedWindow).toHaveBeenCalledWith('chat-1', 'older', '-1', { preload: true });
  });
});
