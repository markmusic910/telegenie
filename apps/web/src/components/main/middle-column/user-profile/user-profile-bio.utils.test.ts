import { parseBioSegments } from './user-profile-bio.utils';

describe('parseBioSegments', () => {
  it('parses mentions, URLs, and hashtags from plain bio text', () => {
    const bio = 'Hey @MinorDeity, my website is at https://poolitzer.eu #Poolinus';
    expect(parseBioSegments(bio)).toEqual([
      { kind: 'text', value: 'Hey ' },
      { kind: 'mention', value: '@MinorDeity', username: 'MinorDeity' },
      { kind: 'text', value: ', my website is at ' },
      { kind: 'url', value: 'https://poolitzer.eu', href: 'https://poolitzer.eu' },
      { kind: 'text', value: ' ' },
      { kind: 'hashtag', value: '#Poolinus', tag: 'Poolinus' },
    ]);
  });

  it('strips trailing punctuation from bare URLs and preserves balanced parens', () => {
    const bio = 'Read poolitzer.eu/blog/weekly/28, or https://en.wikipedia.org/wiki/Rust_(language).';
    expect(parseBioSegments(bio)).toEqual([
      { kind: 'text', value: 'Read ' },
      {
        kind: 'url',
        value: 'poolitzer.eu/blog/weekly/28',
        href: 'https://poolitzer.eu/blog/weekly/28',
      },
      { kind: 'text', value: ', or ' },
      {
        kind: 'url',
        value: 'https://en.wikipedia.org/wiki/Rust_(language)',
        href: 'https://en.wikipedia.org/wiki/Rust_(language)',
      },
      { kind: 'text', value: '.' },
    ]);
  });

  it('does not treat email domains as @mentions', () => {
    const segments = parseBioSegments('Email me at dev@example.org anytime');
    expect(segments.some((s) => s.kind === 'mention')).toBe(false);
  });
});
