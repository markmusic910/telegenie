import {
  buildPeerDisplay,
  fallbackPeerDisplay,
  peerActionName,
  peerProfileDisplay,
} from './peer-display';

describe('peer-display', () => {
  describe('buildPeerDisplay & peerProfileDisplay', () => {
    it('formats a regular user with first and last name', () => {
      const display = buildPeerDisplay({
        id: '123',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(display.name).toBe('John Doe');
      expect(display.initials).toBe('JD');
      expect(display.isDeleted).toBeUndefined();
    });

    it('formats a self user as Saved Messages unless deleted', () => {
      const display = buildPeerDisplay({
        id: '123',
        self: true,
        firstName: 'Me',
      });
      expect(display.name).toBe('Saved Messages');
      expect(display.isSavedMessages).toBe(true);
      expect(display.initials).toBe('S');
    });

    it('formats a deleted user correctly', () => {
      const display = buildPeerDisplay({
        id: '8040940803',
        deleted: true,
      });
      expect(display.name).toBe('Deleted Account');
      expect(display.isDeleted).toBe(true);
      expect(display.initials).toBe('');
      expect(display.senderLabel).toBe('Deleted Account');
    });

    it('formats a deleted user even if firstName is empty or id is passed', () => {
      const profile = peerProfileDisplay({
        id: '8040940803',
        deleted: true,
        firstName: '',
      });
      expect(profile.name).toBe('Deleted Account');
      expect(profile.isDeleted).toBe(true);
      expect(profile.initials).toBe('');
    });
  });

  describe('peerActionName', () => {
    it('returns Deleted Account for deleted peer', () => {
      expect(peerActionName({ id: '8040940803', deleted: true })).toBe('Deleted Account');
    });

    it('returns fullName for normal user', () => {
      expect(peerActionName({ id: '123', firstName: 'Alice', lastName: 'Smith' })).toBe('Alice Smith');
    });

    it('returns undefined for missing peer', () => {
      expect(peerActionName(null)).toBeUndefined();
    });
  });

  describe('fallbackPeerDisplay', () => {
    it('returns fallback initials for unknown peer ID', () => {
      const fallback = fallbackPeerDisplay('12345');
      expect(fallback.name).toBe('12345');
      expect(fallback.initials).toBe('12');
      expect(fallback.isDeleted).toBeUndefined();
    });
  });
});
