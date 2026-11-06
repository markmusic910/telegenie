import {
  USER_IDENTITY_STORAGE_KEY,
  getUserIdentity,
  getUserMdTemplate,
  saveUserIdentity,
} from './genie-user-identity.storage';

describe('genie-user-identity.storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty string if user identity has not been set', () => {
    expect(getUserIdentity()).toBe('');
  });

  it('saves and retrieves user identity from localStorage', () => {
    const content = '# USER.md\n- **Name:** Alex';
    saveUserIdentity(content);
    expect(getUserIdentity()).toBe(content);
    expect(localStorage.getItem(USER_IDENTITY_STORAGE_KEY)).toBe(content);
  });

  it('generates a clean USER.md template pre-filled with name if provided', () => {
    const template = getUserMdTemplate('Alice Smith');
    expect(template).toContain('# USER.md — Human Profile');
    expect(template).toContain('- **Name:** Alice Smith');
    expect(template).toContain('## Communication Preferences');
    expect(template).toContain('## Background & Working Style');
  });

  it('generates a blank name placeholder if name is omitted', () => {
    const template = getUserMdTemplate();
    expect(template).toContain('- **Name:** \n');
  });
});

