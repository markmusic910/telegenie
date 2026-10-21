import generateUniqueId, { generateUniqueNumberId } from './generateUniqueId';

describe('generateUniqueId', () => {
  it('returns a non-empty string combining time and random parts', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const id = generateUniqueId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(4);
    expect(id).toContain((1_700_000_000_000).toString(36));
  });
});

describe('generateUniqueNumberId', () => {
  it('returns a number derived from timestamp and random', () => {
    jest.spyOn(Date, 'now').mockReturnValue(123_456_789);
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(generateUniqueNumberId()).toBe(23_456_789 + 500);
  });
});
