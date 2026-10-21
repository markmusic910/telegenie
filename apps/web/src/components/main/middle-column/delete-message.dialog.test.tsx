import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import DeleteMessageDialog from '@/components/main/middle-column/delete-message.dialog';

// @ts-expect-error react 18/19 test environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const deleteMessages = jest.fn();

jest.mock('@/lib/contexts/sdk.context', () => ({
  useSDK: () => ({ messageSend: { deleteMessages } }),
}));

describe('DeleteMessageDialog', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    deleteMessages.mockReset().mockResolvedValue({ ok: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(props: Partial<React.ComponentProps<typeof DeleteMessageDialog>> = {}) {
    const onOpenChange = jest.fn();
    const onDeleted = jest.fn();
    act(() => {
      root.render(
        <DeleteMessageDialog
          open
          onOpenChange={onOpenChange}
          peerId="7"
          messageIds={['3', '4']}
          allowForAll
          onDeleted={onDeleted}
          {...props}
        />,
      );
    });
    return { onOpenChange, onDeleted };
  }

  function deleteButton(): HTMLButtonElement {
    const button = Array.from(document.body.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === 'Delete',
    );
    if (!button) throw new Error('Delete button not found');
    return button;
  }

  it('names the count and deletes every selected id', async () => {
    const { onOpenChange, onDeleted } = render();
    expect(document.body.textContent).toContain('Delete 2 messages?');

    await act(async () => {
      deleteButton().click();
    });

    expect(deleteMessages).toHaveBeenCalledWith('7', [3, 4], { revoke: true });
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the single-message title and wording', () => {
    render({ messageIds: ['3'] });
    expect(document.body.textContent).toContain('Delete message?');
  });

  it('does not report success when the delete fails', async () => {
    deleteMessages.mockResolvedValue({ ok: false });
    const { onOpenChange, onDeleted } = render({ allowForAll: false });

    await act(async () => {
      deleteButton().click();
    });

    expect(deleteMessages).toHaveBeenCalledWith('7', [3, 4], { revoke: false });
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
