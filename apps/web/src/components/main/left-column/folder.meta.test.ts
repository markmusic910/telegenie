jest.mock('@telegenie/sdk', () => ({
  ALL_CHATS_FOLDER_ID: '0',
  isUnreadFolder: () => false,
}));

import {
  extractControllerError,
  FOLDER_COLORS,
  formatFolderErrorMessage,
  getFolderColor,
} from './folder.meta';

describe('folder.meta helpers', () => {
  it('resolves all 7 Telegram folder colors by index', () => {
    expect(FOLDER_COLORS).toHaveLength(7);
    for (let i = 0; i < 7; i += 1) {
      expect(getFolderColor(i)?.id).toBe(i);
    }
    expect(getFolderColor(undefined)).toBeUndefined();
    expect(getFolderColor(99)).toBeUndefined();
  });

  it('extracts errors from both Error instances and SDK controller envelopes', () => {
    expect(extractControllerError(new Error('BOOM'))).toBe('BOOM');
    expect(
      extractControllerError({ success: false, error: { message: 'PREMIUM_ACCOUNT_REQUIRED' } }),
    ).toBe('PREMIUM_ACCOUNT_REQUIRED');
    expect(extractControllerError({ success: true })).toBeUndefined();
    expect(extractControllerError(undefined)).toBeUndefined();
  });

  it('formats Telegram folder RPC errors into user-friendly messages', () => {
    expect(formatFolderErrorMessage('400: PREMIUM_ACCOUNT_REQUIRED')).toBe(
      'This feature requires Telegram Premium.',
    );
    expect(formatFolderErrorMessage('DIALOG_FILTERS_TOO_MUCH')).toBe(
      'You have reached the maximum number of folders for your account.',
    );
    expect(formatFolderErrorMessage('FILTER_INCLUDE_EMPTY')).toBe(
      'Please include at least one chat or chat type.',
    );
    expect(formatFolderErrorMessage('FILTER_TITLE_EMPTY')).toBe('Please enter a folder name.');
    expect(formatFolderErrorMessage('CHATLIST_EXCLUDE_INVALID')).toBe(
      'Shared folders cannot have excluded chats.',
    );
  });
});
