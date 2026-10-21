export type ScrollerMetrics = {
  scrollOffset: number;
  distanceFromBottom: number;
};

export type ScrollerEvent = 'scroll' | 'resize';

export type MessageListScrollerStore = {
  getMetrics: () => ScrollerMetrics;
  subscribeMetrics: (listener: () => void) => () => void;
  subscribe: (event: ScrollerEvent, listener: () => void) => () => void;
  attach: (root: HTMLElement) => () => void;
};

function measure(root: HTMLElement): ScrollerMetrics {
  return {
    scrollOffset: root.scrollTop,
    distanceFromBottom: root.scrollHeight - root.scrollTop - root.clientHeight,
  };
}

export function createMessageListScrollerStore(): MessageListScrollerStore {
  let root: HTMLElement | null = null;
  let metrics: ScrollerMetrics = { scrollOffset: 0, distanceFromBottom: 0 };
  const metricListeners = new Set<() => void>();
  const scrollListeners = new Set<() => void>();
  const resizeListeners = new Set<() => void>();
  let resizeObserver: ResizeObserver | null = null;

  const notifyMetrics = () => {
    for (const listener of metricListeners) {
      listener();
    }
  };

  const notifyScroll = () => {
    for (const listener of scrollListeners) {
      listener();
    }
  };

  const notifyResize = () => {
    for (const listener of resizeListeners) {
      listener();
    }
  };

  const refreshMetrics = () => {
    if (!root) return;
    metrics = measure(root);
  };

  const onScroll = () => {
    refreshMetrics();
    notifyMetrics();
    notifyScroll();
  };

  const onResize = () => {
    refreshMetrics();
    notifyMetrics();
    notifyResize();
  };

  return {
    getMetrics: () => metrics,

    subscribeMetrics(listener) {
      metricListeners.add(listener);
      return () => {
        metricListeners.delete(listener);
      };
    },

    subscribe(event, listener) {
      const listeners = event === 'scroll' ? scrollListeners : resizeListeners;
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    attach(element) {
      if (root) {
        throw new Error('MessageListScrollerStore is already attached');
      }

      root = element;
      metrics = measure(root);
      root.addEventListener('scroll', onScroll, { passive: true });

      const content = root.firstElementChild;
      if (content instanceof HTMLElement) {
        resizeObserver = new ResizeObserver(onResize);
        resizeObserver.observe(content);
      }

      return () => {
        root?.removeEventListener('scroll', onScroll);
        resizeObserver?.disconnect();
        resizeObserver = null;
        root = null;
      };
    },
  };
}
