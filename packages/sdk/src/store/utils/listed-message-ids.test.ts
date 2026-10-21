import {
  findClosestIndex,
  getViewportSlice,
  listedIdsFromMessages,
  listedWindowMatchesScrollAnchor,
  mergeListedIds,
  removeListedIds,
  sortMessageIds,
} from './listed-message-ids';

describe('listed-message-ids', () => {
  it('sorts unique numeric ids', () => {
    expect(sortMessageIds(['20', '3', '20', '9'])).toEqual(['3', '9', '20']);
  });

  it('drops empty and other-peer messages from a history page', () => {
    expect(
      listedIdsFromMessages(
        [
          { id: '1', date: 1, peerId: '7' },
          { id: '2', date: 1, peerId: '7', isEmpty: true },
          { id: '3', date: 0, peerId: '7' },
          { id: '4', date: 1, peerId: '99' },
          { id: '5', date: 1, peerId: '7' },
        ],
        '7',
      ),
    ).toEqual(['1', '5']);
  });

  it('merges and removes without duplicating', () => {
    expect(mergeListedIds(['10', '11'], ['9', '11', '12'])).toEqual(['9', '10', '11', '12']);
    expect(removeListedIds(['9', '10', '11'], ['10'])).toEqual(['9', '11']);
  });

  describe('findClosestIndex', () => {
    const ids = ['10', '20', '30', '40', '50'];

    it('returns exact match index', () => {
      expect(findClosestIndex(ids, '10')).toBe(0);
      expect(findClosestIndex(ids, '30')).toBe(2);
      expect(findClosestIndex(ids, '50')).toBe(4);
    });

    it('returns closest preceding index when id is between elements', () => {
      expect(findClosestIndex(ids, '25')).toBe(1);
      expect(findClosestIndex(ids, '45')).toBe(3);
    });

    it('clamps to bounds when id is outside the range', () => {
      expect(findClosestIndex(ids, '5')).toBe(0);
      expect(findClosestIndex(ids, '99')).toBe(4);
    });

    it('returns -1 for empty array', () => {
      expect(findClosestIndex([], '10')).toBe(-1);
    });
  });

  describe('getViewportSlice', () => {
    const ids = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

    it('forwards (sliding newer) preserves older buffer and advances through new items', () => {
      // Sliding newer from edge '4' with sliceSize 3:
      // index of 4 is 3. indexForDirection = 4.
      // from = 4 - 3 = 1 (id '2'). to = 4 + 3 - 1 = 6 (id '7').
      // Result: ['2', '3', '4', '5', '6', '7'] (preserves 3 buffer items, 3 newer items)
      const result = getViewportSlice(ids, '4', 'forwards', 3);
      expect(result.newViewportIds).toEqual(['2', '3', '4', '5', '6', '7']);
      expect(result.areSomeLocal).toBe(true);
      expect(result.areAllLocal).toBe(true);
    });

    it('backwards (sliding older) preserves prepended items and newer buffer', () => {
      // Sliding older from edge '7' with sliceSize 3:
      // index of 7 is 6. indexForDirection = 6.
      // from = 6 - 3 = 3 (id '4'). to = 6 + 3 - 1 = 8 (id '9').
      // Result: ['4', '5', '6', '7', '8', '9'] (preserves 3 prepended items, 3 buffer items)
      const result = getViewportSlice(ids, '7', 'backwards', 3);
      expect(result.newViewportIds).toEqual(['4', '5', '6', '7', '8', '9']);
      expect(result.areSomeLocal).toBe(true);
      expect(result.areAllLocal).toBe(true);
    });

    it('around centers viewport on the anchor message', () => {
      // Around '5' with sliceSize 4 (half size 2):
      // index of 5 is 4. indexForDirection = 5.
      // from = 5 - 2 = 3 (id '4'). to = 5 + 2 - 1 = 6 (id '7').
      // Result: ['4', '5', '6', '7']
      const result = getViewportSlice(ids, '5', 'around', 4);
      expect(result.newViewportIds).toEqual(['4', '5', '6', '7']);
      expect(result.areSomeLocal).toBe(true);
      expect(result.areAllLocal).toBe(true);
    });

    it('around without offsetId takes newest slice', () => {
      const result = getViewportSlice(ids, undefined, 'around', 4);
      expect(result.newViewportIds).toEqual(['7', '8', '9', '10']);
    });

    it('keeps all items when total length is within targetLimit', () => {
      const smallIds = ['1', '2', '3', '4'];
      const result = getViewportSlice(smallIds, '4', 'forwards', 3);
      expect(result.newViewportIds).toEqual(['1', '2', '3', '4']);
    });

    it('forwards near bottom (latest message) shifts window backwards to preserve older buffer', () => {
      // Offset at '9' (near bottom): instead of shrinking, shifts backwards to keep 6 items: ['5', '6', '7', '8', '9', '10']
      const result = getViewportSlice(ids, '9', 'forwards', 3);
      expect(result.newViewportIds).toEqual(['5', '6', '7', '8', '9', '10']);
    });

    it('backwards near top (oldest message) preserves available items without exceeding forward buffer', () => {
      // Offset at '2' with sliceSize 3: keeps prepended items ('1') and 3 buffer items ('2', '3', '4')
      const result = getViewportSlice(ids, '2', 'backwards', 3);
      expect(result.newViewportIds).toEqual(['1', '2', '3', '4']);
    });

    it('handles DOM anchor prefixes like msg- and action-', () => {
      const result = getViewportSlice(ids, 'msg-5', 'around', 4);
      expect(result.newViewportIds).toEqual(['4', '5', '6', '7']);
    });
  });

  it('rejects scroll restore across a replaced listed window', () => {
    expect(listedWindowMatchesScrollAnchor(['40', '42'], '990', '1000')).toBe(false);
    expect(listedWindowMatchesScrollAnchor(['990', '1000'], '990', '1000')).toBe(true);
  });
});
