import {
  dialogHref,
  isChatsPathname,
  parseDialogIdFromPathname,
} from './dialog-url';

describe('dialog-url', () => {
  it('formats dialog paths and falls back to / when empty', () => {
    expect(dialogHref('12345')).toBe('/chat/12345');
    expect(dialogHref('-1001234567890')).toBe('/chat/-1001234567890');
    expect(dialogHref('')).toBe('/');
    expect(dialogHref(undefined)).toBe('/');
    expect(dialogHref(null)).toBe('/');
  });

  it('parses dialog ids from /chat/<id> pathnames', () => {
    expect(parseDialogIdFromPathname('/chat/12345')).toBe('12345');
    expect(parseDialogIdFromPathname('/chat/-1001234567890')).toBe('-1001234567890');
    expect(parseDialogIdFromPathname('/chat/-1001234567890/extra')).toBe('-1001234567890');
    expect(parseDialogIdFromPathname('/')).toBeUndefined();
    expect(parseDialogIdFromPathname('/chat/')).toBeUndefined();
    expect(parseDialogIdFromPathname('/settings/profile')).toBeUndefined();
    expect(parseDialogIdFromPathname(null)).toBeUndefined();
  });

  it('identifies chats pathnames', () => {
    expect(isChatsPathname('/')).toBe(true);
    expect(isChatsPathname('/chat/123')).toBe(true);
    expect(isChatsPathname('/chat/-100999')).toBe(true);
    expect(isChatsPathname('/settings')).toBe(false);
    expect(isChatsPathname('/contacts')).toBe(false);
    expect(isChatsPathname('/auth')).toBe(false);
  });
});
