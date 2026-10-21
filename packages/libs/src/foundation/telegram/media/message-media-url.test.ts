import {
  buildDownloadUrl,
  buildMediaUrl,
  buildProgressiveUrl,
} from './message-media-url';

describe('message-media-url', () => {
  it('builds /media/ URL with required and optional query params', () => {
    const url = buildMediaUrl({
      fileId: 'p:123456789',
      accessHash: '987654321',
      dcId: 2,
      mimeType: 'image/jpeg',
      fileSize: 45000,
      thumbSize: 'y',
      peerId: '-100123456',
      messageId: 789,
    });

    expect(url).toContain('/media/?');
    const parsed = new URL(url, 'http://localhost');
    expect(parsed.pathname).toBe('/media/');
    expect(parsed.searchParams.get('fileId')).toBe('p:123456789');
    expect(parsed.searchParams.get('accessHash')).toBe('987654321');
    expect(parsed.searchParams.get('dcId')).toBe('2');
    expect(parsed.searchParams.get('mimeType')).toBe('image/jpeg');
    expect(parsed.searchParams.get('fileSize')).toBe('45000');
    expect(parsed.searchParams.get('thumbSize')).toBe('y');
    expect(parsed.searchParams.get('peerId')).toBe('-100123456');
    expect(parsed.searchParams.get('messageId')).toBe('789');
  });

  it('builds /progressive/ URL for streaming media', () => {
    const url = buildProgressiveUrl({
      fileId: 'd:998877',
      accessHash: '112233',
      dcId: 4,
      mimeType: 'video/mp4',
      fileSize: 10485760,
    });

    expect(url).toContain('/progressive/?');
    const parsed = new URL(url, 'http://localhost');
    expect(parsed.pathname).toBe('/progressive/');
    expect(parsed.searchParams.get('fileId')).toBe('d:998877');
    expect(parsed.searchParams.get('accessHash')).toBe('112233');
    expect(parsed.searchParams.get('dcId')).toBe('4');
    expect(parsed.searchParams.get('mimeType')).toBe('video/mp4');
    expect(parsed.searchParams.get('fileSize')).toBe('10485760');
  });

  it('builds /download/ URL with encoded filename', () => {
    const url = buildDownloadUrl({
      fileId: 'd:554433',
      accessHash: '778899',
      dcId: 1,
      mimeType: 'application/pdf',
      fileSize: 2048,
      filename: 'My Document (Final).pdf',
    });

    expect(url).toContain('/download/?');
    const parsed = new URL(url, 'http://localhost');
    expect(parsed.pathname).toBe('/download/');
    expect(parsed.searchParams.get('fileId')).toBe('d:554433');
    expect(parsed.searchParams.get('filename')).toBe(
      encodeURIComponent('My Document (Final).pdf'),
    );
  });
});
