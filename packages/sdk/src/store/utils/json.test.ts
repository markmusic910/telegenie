import { stringifyJson } from './json';

describe('stringifyJson', () => {
  it('converts nested bigint values to decimal strings', () => {
    expect(stringifyJson({ id: 50n, nested: { hash: 51n } })).toBe(
      '{"id":"50","nested":{"hash":"51"}}',
    );
  });
});
