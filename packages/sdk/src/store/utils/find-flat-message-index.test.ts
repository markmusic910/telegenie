import type { FlatListItem } from './message-grouper';
import { findFlatMessageIndex } from './find-flat-message-index';

function msgItem(id: string, kind: 'message' | 'action' = 'message'): FlatListItem {
  return {
    kind,
    id,
    message: { id } as FlatListItem & { kind: 'message' } extends { message: infer M } ? M : never,
    isOwn: false,
    isFirstInGroup: true,
    isLastInGroup: true,
  } as FlatListItem;
}

describe('findFlatMessageIndex', () => {
  it('returns undefined for empty list', () => {
    expect(findFlatMessageIndex([], '1')).toBeUndefined();
  });

  it('finds a message row', () => {
    const items: FlatListItem[] = [
      { kind: 'date', id: 'd1', label: 'Today' },
      msgItem('10'),
      msgItem('11'),
    ];
    expect(findFlatMessageIndex(items, '11')).toBe(2);
  });

  it('finds album and action rows', () => {
    const items: FlatListItem[] = [
      {
        kind: 'album',
        id: '20',
        message: { id: '20' } as never,
        album: {
          albumId: '20',
          mainMessage: { id: '20' } as never,
          messages: [{ id: '20' } as never],
          hasMultipleCaptions: false,
        },
        isOwn: false,
        isFirstInGroup: true,
        isLastInGroup: true,
      },
      {
        kind: 'action',
        id: '21',
        message: { id: '21' } as never,
      },
    ];
    expect(findFlatMessageIndex(items, '20')).toBe(0);
    expect(findFlatMessageIndex(items, '21')).toBe(1);
  });

  it('finds album rows by any grouped message id', () => {
    const items: FlatListItem[] = [
      {
        kind: 'album',
        id: 'album-9',
        message: { id: '11' } as never,
        album: {
          albumId: '9',
          mainMessage: { id: '11' } as never,
          messages: [{ id: '11' } as never, { id: '12' } as never, { id: '13' } as never],
          hasMultipleCaptions: false,
        },
        isOwn: false,
        isFirstInGroup: true,
        isLastInGroup: true,
      },
    ];
    expect(findFlatMessageIndex(items, '11')).toBe(0);
    expect(findFlatMessageIndex(items, '12')).toBe(0);
    expect(findFlatMessageIndex(items, '13')).toBe(0);
  });

  it('returns undefined when message is missing', () => {
    expect(findFlatMessageIndex([msgItem('5')], '99')).toBeUndefined();
  });
});
