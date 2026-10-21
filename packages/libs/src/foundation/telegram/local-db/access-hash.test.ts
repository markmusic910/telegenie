import {
  deriveChannelMinAccessHash,
  deriveUserMinAccessHash,
  mergeAccessHashFields,
  shouldApplyAccessHash,
} from './access-hash';

describe('access-hash', () => {
  it('derives user min access hash when min and phone unset', () => {
    expect(deriveUserMinAccessHash({ min: true, accessHash: '1' })).toBe(true);
  });

  it('derives user min access hash when min and phone non-empty', () => {
    expect(deriveUserMinAccessHash({ min: true, accessHash: '1', phone: '123' })).toBe(true);
  });

  it('does not treat empty phone as min access hash', () => {
    expect(deriveUserMinAccessHash({ min: true, accessHash: '1', phone: '' })).toBe(false);
  });

  it('returns false when user has no access hash', () => {
    expect(deriveUserMinAccessHash({ min: true })).toBe(false);
  });

  it('returns false when user is not min', () => {
    expect(deriveUserMinAccessHash({ min: false, accessHash: '1' })).toBe(false);
  });

  it('derives channel min access hash when min and hash present', () => {
    expect(deriveChannelMinAccessHash({ min: true, accessHash: '1' })).toBe(true);
  });

  it('returns false for channel without access hash or min', () => {
    expect(deriveChannelMinAccessHash({ min: true })).toBe(false);
    expect(deriveChannelMinAccessHash({ min: false, accessHash: '1' })).toBe(false);
  });

  it('never applies min hash over full local hash', () => {
    expect(
      shouldApplyAccessHash({
        incomingHash: 'min',
        incomingMinAccessHash: true,
        localHash: 'full',
        localMinAccessHash: false,
      }),
    ).toBe(false);
  });

  it('applies when incoming has no hash → false', () => {
    expect(
      shouldApplyAccessHash({
        incomingMinAccessHash: false,
        localHash: 'full',
        localMinAccessHash: false,
      }),
    ).toBe(false);
  });

  it('applies min hash when local has none', () => {
    expect(
      shouldApplyAccessHash({
        incomingHash: 'min',
        incomingMinAccessHash: true,
        localMinAccessHash: false,
      }),
    ).toBe(true);
  });

  it('applies min hash over min local', () => {
    expect(
      shouldApplyAccessHash({
        incomingHash: 'min2',
        incomingMinAccessHash: true,
        localHash: 'min1',
        localMinAccessHash: true,
      }),
    ).toBe(true);
  });

  it('applies full hash over min local', () => {
    const merged = mergeAccessHashFields({
      incomingHash: 'full',
      incomingMinAccessHash: false,
      localHash: 'min',
      localMinAccessHash: true,
    });
    expect(merged).toEqual({ accessHash: 'full', minAccessHash: false });
  });

  it('keeps local hash when min should not apply', () => {
    const merged = mergeAccessHashFields({
      incomingHash: 'min',
      incomingMinAccessHash: true,
      localHash: 'full',
      localMinAccessHash: false,
    });
    expect(merged).toEqual({ accessHash: 'full', minAccessHash: false });
  });

  it('returns minAccessHash false when keeping empty local hash', () => {
    const merged = mergeAccessHashFields({
      incomingMinAccessHash: true,
      localMinAccessHash: true,
    });
    expect(merged).toEqual({ accessHash: undefined, minAccessHash: false });
  });
});
