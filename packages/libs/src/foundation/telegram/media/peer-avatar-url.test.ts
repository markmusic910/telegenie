import { buildPeerAvatarUrl, parsePeerAvatarUrl } from './peer-avatar-url';

describe('peer-avatar-url', () => {
  it('round-trips peerId, photoId, and dcId', () => {
    const url = buildPeerAvatarUrl({ peerId: '1', photoId: '456', dcId: 2 });
    expect(url.startsWith('/avatar/?')).toBe(true);
    expect(parsePeerAvatarUrl(url)).toEqual({
      peerId: '1',
      photoId: '456',
      dcId: 2,
      mimeType: 'image/jpeg',
      isBig: undefined,
    });
  });

  it('includes big=1 when isBig is set', () => {
    const url = buildPeerAvatarUrl({ peerId: '-10', photoId: '7', dcId: 1, isBig: true });
    expect(url).toContain('big=1');
    expect(parsePeerAvatarUrl(url)?.isBig).toBe(true);
  });

  it('returns undefined when required params are missing', () => {
    expect(parsePeerAvatarUrl('/avatar/?peerId=1')).toBeUndefined();
    expect(parsePeerAvatarUrl('/avatar/?peerId=1&photoId=2&dcId=x')).toBeUndefined();
  });

  it('defaults mimeType when omitted', () => {
    expect(parsePeerAvatarUrl('/avatar/?peerId=1&photoId=2&dcId=3')).toMatchObject({
      mimeType: 'image/jpeg',
    });
  });

  it('parses an absolute URL', () => {
    const url = 'https://example.com/avatar/?peerId=9&photoId=8&dcId=3&mimeType=image%2Fpng';
    expect(parsePeerAvatarUrl(url)).toEqual({
      peerId: '9',
      photoId: '8',
      dcId: 3,
      mimeType: 'image/png',
      isBig: undefined,
    });
  });
});
