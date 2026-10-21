import {
  anchorScrollTop,
  clampOffsetInItem,
  findScrollAnchorIndex,
  findVisibleItemIndex,
  listedWindowIdentityEquals,
  messageScrollAnchorFromThread,
  pickMessageScrollAnchor,
  pickScrollAnchorIndex,
} from './message-scroll-anchor';

const items = [
  { id: 'date-1', kind: 'date' },
  { id: 'unread-divider', kind: 'unread-divider' },
  { id: '10', kind: 'message' },
  { id: '11', kind: 'message' },
];

describe('message-scroll-anchor', () => {
  it('skips date and unread rows at startIndex or the next sticky run', () => {
    expect(pickScrollAnchorIndex(items, 0)).toBe(2);
    expect(pickScrollAnchorIndex(items, 1)).toBe(2);
    expect(pickScrollAnchorIndex(items, 2)).toBe(2);
  });

  it('falls back to the sticky row when nothing else remains', () => {
    expect(pickScrollAnchorIndex([{ id: 'date-1', kind: 'date' }], 0)).toBe(0);
  });

  it('clamps offsetInItem to the item size', () => {
    expect(clampOffsetInItem(-8, 40)).toBe(0);
    expect(clampOffsetInItem(12, 40)).toBe(12);
    expect(clampOffsetInItem(80, 40)).toBe(40);
    expect(clampOffsetInItem(8, 0)).toBe(0);
  });

  it('computes scrollTop from item offset plus offset in item', () => {
    expect(anchorScrollTop(200, 16)).toBe(216);
    expect(anchorScrollTop(-4, 16)).toBe(12);
  });

  it('finds the first item that crosses the current scrollTop', () => {
    const contentOffsets = [0, 40, 160];
    const sizes = [40, 120, 80];
    const fakeItems = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const containerTop = 100;
    const scrollTop = 50;
    const container = {
      scrollTop,
      getBoundingClientRect: () => ({ top: containerTop }),
    } as HTMLElement;
    expect(
      findVisibleItemIndex(fakeItems, container, (id) => {
        const index = fakeItems.findIndex((item) => item.id === id);
        return {
          getBoundingClientRect: () => ({ top: containerTop - scrollTop + contentOffsets[index] }),
          offsetHeight: sizes[index],
        } as HTMLElement;
      }),
    ).toBe(1);
  });

  it('picks an anchor from scroller-style offsets', () => {
    const offsets = [0, 24, 40, 160];
    const sizes = [24, 16, 120, 80];
    expect(
      pickMessageScrollAnchor(
        items,
        0,
        48,
        (index) => offsets[index],
        (index) => sizes[index],
      ),
    ).toEqual({ itemId: '10', offsetInItem: 8 });
  });

  it('finds a saved item id and detects listed-window identity changes', () => {
    expect(messageScrollAnchorFromThread({})).toBeUndefined();
    expect(
      messageScrollAnchorFromThread({
        scrollAnchorItemId: '10',
        scrollAnchorOffsetInItem: 18,
      }),
    ).toEqual({ itemId: '10', offsetInItem: 18 });
    expect(findScrollAnchorIndex(items, '10')).toBe(2);
    expect(findScrollAnchorIndex(items, 'missing')).toBeUndefined();
    expect(
      listedWindowIdentityEquals(
        { firstId: 'a', lastId: 'z', length: 3 },
        { firstId: 'a', lastId: 'z', length: 3 },
      ),
    ).toBe(true);
    expect(
      listedWindowIdentityEquals(
        { firstId: 'a', lastId: 'z', length: 3 },
        { firstId: 'b', lastId: 'z', length: 3 },
      ),
    ).toBe(false);
  });
});
