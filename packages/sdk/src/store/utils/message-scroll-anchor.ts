export type MessageScrollAnchor = {
  itemId: string;
  offsetInItem: number;
};

export type ScrollAnchorListItem = {
  id: string;
  kind: string;
};

export type ListedWindowIdentity = {
  firstId?: string;
  lastId?: string;
  length: number;
};

const STICKY_SCROLL_ANCHOR_KINDS = new Set(['date', 'unread-divider']);

export function isStickyScrollAnchorKind(kind: string): boolean {
  return STICKY_SCROLL_ANCHOR_KINDS.has(kind);
}

export function clampOffsetInItem(offset: number, itemSize: number): number {
  if (!Number.isFinite(offset) || offset < 0) return 0;
  if (!Number.isFinite(itemSize) || itemSize <= 0) return 0;
  return Math.min(offset, itemSize);
}

/** Item offset from the scroller content origin (includes current scrollTop). */
export function itemOffsetInScroller(container: HTMLElement, item: HTMLElement): number {
  return item.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
}

export function findVisibleItemIndex(
  items: Array<Pick<ScrollAnchorListItem, 'id'>>,
  container: HTMLElement,
  getItem: (id: string) => HTMLElement | null,
): number {
  if (items.length === 0) return 0;
  const top = container.scrollTop;
  for (let i = 0; i < items.length; i++) {
    const item = getItem(items[i].id);
    if (!item) continue;
    if (itemOffsetInScroller(container, item) + item.offsetHeight > top) {
      return i;
    }
  }
  return items.length - 1;
}

export function anchorScrollTop(itemOffset: number, offsetInItem: number): number {
  return Math.max(0, itemOffset + offsetInItem);
}

export function listedWindowIdentityEquals(
  prev: ListedWindowIdentity,
  next: ListedWindowIdentity,
): boolean {
  return prev.firstId === next.firstId && prev.lastId === next.lastId && prev.length === next.length;
}

/** Prefer a non-date / non-unread row at startIndex or the next sticky run. */
export function pickScrollAnchorIndex(
  items: Array<Pick<ScrollAnchorListItem, 'kind'>>,
  startIndex: number,
): number | undefined {
  if (items.length === 0) return undefined;
  if (startIndex < 0 || startIndex >= items.length) return undefined;

  let index = startIndex;
  while (index < items.length && isStickyScrollAnchorKind(items[index].kind)) {
    index += 1;
  }
  if (index < items.length) return index;
  return startIndex;
}

export function pickMessageScrollAnchor(
  items: ScrollAnchorListItem[],
  startIndex: number,
  scrollOffset: number,
  getItemOffset: (index: number) => number,
  getItemSize: (index: number) => number,
): MessageScrollAnchor | undefined {
  const index = pickScrollAnchorIndex(items, startIndex);
  if (index == null) return undefined;

  const item = items[index];
  if (!item) return undefined;

  const itemOffset = getItemOffset(index);
  const itemSize = getItemSize(index);
  return {
    itemId: item.id,
    offsetInItem: clampOffsetInItem(scrollOffset - itemOffset, itemSize),
  };
}

export function findScrollAnchorIndex(
  items: Array<Pick<ScrollAnchorListItem, 'id'>>,
  itemId: string,
): number | undefined {
  const index = items.findIndex((item) => item.id === itemId);
  return index >= 0 ? index : undefined;
}

export function messageScrollAnchorFromThread(thread?: {
  scrollAnchorItemId?: string;
  scrollAnchorOffsetInItem?: number;
}): MessageScrollAnchor | undefined {
  if (!thread?.scrollAnchorItemId) return undefined;
  return {
    itemId: thread.scrollAnchorItemId,
    offsetInItem: thread.scrollAnchorOffsetInItem ?? 0,
  };
}
