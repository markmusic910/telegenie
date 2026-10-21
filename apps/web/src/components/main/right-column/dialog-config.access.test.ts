import { canConfigureDialog } from './dialog-config.access';

describe('canConfigureDialog', () => {
  it('allows a basic-group creator when adminRights is absent', () => {
    expect(canConfigureDialog({ chat: { creator: true } })).toBe(true);
  });

  it('allows a channel creator when adminRights is absent', () => {
    expect(canConfigureDialog({ channel: { creator: true } })).toBe(true);
  });

  it('allows any set admin right, including other', () => {
    expect(canConfigureDialog({ chat: { adminRights: { other: true } } })).toBe(true);
    expect(canConfigureDialog({ channel: { adminRights: { changeInfo: true } } })).toBe(true);
  });

  it('rejects a member and an empty rights object', () => {
    expect(canConfigureDialog({ chat: { creator: false } })).toBe(false);
    expect(canConfigureDialog({ chat: { adminRights: { changeInfo: false, other: false } } })).toBe(
      false,
    );
    expect(canConfigureDialog({})).toBe(false);
  });
});
