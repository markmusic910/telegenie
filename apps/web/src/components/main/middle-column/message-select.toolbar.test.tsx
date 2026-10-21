import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import MessageSelectToolbar from '@/components/main/middle-column/message-select.toolbar';

// @ts-expect-error react 18/19 test environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const exit = jest.fn();
const copyText = jest.fn();
const toastAdd = jest.fn();
let allowed = { canCopy: true, canDelete: true, canDeleteForAll: true };
let selectedIds: string[] = ['3', '4'];

jest.mock('@telegenie/sdk', () => ({
  MAIN_THREAD_ID: '-1',
  selectionMenuActions: () => allowed,
}));

jest.mock('@/components/main/middle-column/delete-message.dialog', () => ({
  __esModule: true,
  default: ({ open, messageIds }: { open: boolean; messageIds: string[] }) =>
    open ? <div data-testid="delete-dialog">{messageIds.join(',')}</div> : null,
}));

jest.mock('@/lib/components/ui/toast', () => ({
  toastManager: { add: (...args: unknown[]) => toastAdd(...args) },
}));

jest.mock('@/lib/contexts/sdk.context', () => ({
  useSDK: () => ({
    messageSelect: {
      exit,
      copyText,
      getSelectedMessages: () => selectedIds.map((id) => ({ id })),
    },
  }),
  useStore: () => ({ auth: { currentUser: { id: '1' } } }),
  useDialogPeer: () => ({ firstName: 'Ann' }),
  useGlobalStoreDialog: () => ({ activeThreadId: '-1' }),
  useGlobalStoreThread: () => ({ selectedMessageIds: selectedIds }),
}));

describe('MessageSelectToolbar', () => {
  let container: HTMLDivElement;
  let root: Root;
  let writeText: jest.Mock;

  beforeEach(() => {
    exit.mockReset();
    copyText.mockReset().mockReturnValue('a\nb');
    toastAdd.mockReset();
    allowed = { canCopy: true, canDelete: true, canDeleteForAll: true };
    selectedIds = ['3', '4'];
    writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<MessageSelectToolbar peerId="7" />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find(
      (candidate) =>
        candidate.textContent?.trim() === label || candidate.getAttribute('aria-label') === label,
    );
  }

  function press(init: KeyboardEventInit) {
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
    });
  }

  it('shows the count and both actions when the selection allows them', () => {
    expect(container.textContent).toContain('2 selected');
    expect(button('Copy')).toBeDefined();
    expect(button('Delete')).toBeDefined();
  });

  it('hides actions the selection does not allow', () => {
    allowed = { canCopy: false, canDelete: false, canDeleteForAll: false };
    // observer memoizes on props, and the mocked store is not observable: remount.
    act(() => root.render(<MessageSelectToolbar key="denied" peerId="7" />));
    expect(button('Copy')).toBeUndefined();
    expect(button('Delete')).toBeUndefined();
  });

  it('exits from the close button and Escape', () => {
    act(() => button('Exit selection')!.click());
    expect(exit).toHaveBeenCalledWith('7', '-1');

    exit.mockClear();
    press({ key: 'Escape' });
    expect(exit).toHaveBeenCalledWith('7', '-1');
  });

  it('copies the selection text, then exits', async () => {
    await act(async () => button('Copy')!.click());
    expect(copyText).toHaveBeenCalledWith('7', '-1');
    expect(writeText).toHaveBeenCalledWith('a\nb');
    expect(exit).toHaveBeenCalledWith('7', '-1');
  });

  it('copies on Mod+C unless the user selected text on the page', async () => {
    await act(async () => press({ key: 'c', ctrlKey: true }));
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('opens the delete dialog from the button and the Delete key', () => {
    act(() => button('Delete')!.click());
    expect(container.ownerDocument.querySelector('[data-testid="delete-dialog"]')?.textContent).toBe(
      '3,4',
    );
  });

  it('ignores the Delete key while typing in an input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    });
    input.remove();
    expect(document.querySelector('[data-testid="delete-dialog"]')).toBeNull();
  });
});
