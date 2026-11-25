import {
  contactsHref,
  dialogHref,
  isChatsPathname,
  isContactsPathname,
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

  it('formats contacts paths and falls back to /contacts when empty', () => {
    expect(contactsHref('12345')).toBe('/contacts/12345');
    expect(contactsHref('-120012012')).toBe('/contacts/-120012012');
    expect(contactsHref('')).toBe('/contacts');
    expect(contactsHref(undefined)).toBe('/contacts');
    expect(contactsHref(null)).toBe('/contacts');
  });

  it('parses dialog ids from /chat/<id> and /contacts/<id> pathnames', () => {
    expect(parseDialogIdFromPathname('/chat/12345')).toBe('12345');
    expect(parseDialogIdFromPathname('/chat/-1001234567890')).toBe('-1001234567890');
    expect(parseDialogIdFromPathname('/chat/-1001234567890/extra')).toBe('-1001234567890');
    expect(parseDialogIdFromPathname('/contacts/12345')).toBe('12345');
    expect(parseDialogIdFromPathname('/contacts/-120012012')).toBe('-120012012');
    expect(parseDialogIdFromPathname('/contacts/-120012012/extra')).toBe('-120012012');
    expect(parseDialogIdFromPathname('/')).toBeUndefined();
    expect(parseDialogIdFromPathname('/chat/')).toBeUndefined();
    expect(parseDialogIdFromPathname('/contacts')).toBeUndefined();
    expect(parseDialogIdFromPathname('/contacts/')).toBeUndefined();
    expect(parseDialogIdFromPathname('/settings/profile')).toBeUndefined();
    expect(parseDialogIdFromPathname(null)).toBeUndefined();
  });

  it('identifies chats pathnames', () => {
    expect(isChatsPathname('/')).toBe(true);
    expect(isChatsPathname('/chat/123')).toBe(true);
    expect(isChatsPathname('/chat/-100999')).toBe(true);
    expect(isChatsPathname('/settings')).toBe(false);
    expect(isChatsPathname('/contacts')).toBe(false);
    expect(isChatsPathname('/contacts/-120012012')).toBe(false);
    expect(isChatsPathname('/auth')).toBe(false);
  });

  it('identifies contacts pathnames', () => {
    expect(isContactsPathname('/contacts')).toBe(true);
    expect(isContactsPathname('/contacts/')).toBe(true);
    expect(isContactsPathname('/contacts/123')).toBe(true);
    expect(isContactsPathname('/contacts/-120012012')).toBe(true);
    expect(isContactsPathname('/contact')).toBe(false);
    expect(isContactsPathname('/contacts-other')).toBe(false);
    expect(isContactsPathname('/')).toBe(false);
    expect(isContactsPathname('/chat/123')).toBe(false);
    expect(isContactsPathname('/settings')).toBe(false);
    expect(isContactsPathname(null)).toBe(false);
  });
});
