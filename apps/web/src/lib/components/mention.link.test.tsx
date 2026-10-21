import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import MentionLink from '@/lib/components/mention.link';

const selectDialog = jest.fn();
const selectDialogByUsername = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/contexts/sdk.context', () => ({
  useSDK: () => ({
    messageLoad: { selectDialog, selectDialogByUsername },
  }),
}));

function renderMentionLink(container: HTMLElement, props: ComponentProps<typeof MentionLink>) {
  const root: Root = createRoot(container);
  act(() => {
    root.render(<MentionLink {...props} />);
  });
  return root;
}

describe('MentionLink', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    selectDialog.mockClear();
    selectDialogByUsername.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('opens a dialog by user id', () => {
    renderMentionLink(container, { userId: '42', children: 'Alice' });

    const link = container.querySelector('a');
    act(() => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(selectDialog).toHaveBeenCalledWith('42');
    expect(selectDialogByUsername).not.toHaveBeenCalled();
  });

  it('resolves a username mention on click', async () => {
    renderMentionLink(container, { username: '@bob', children: '@bob' });

    const link = container.querySelector('a');
    await act(async () => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(selectDialogByUsername).toHaveBeenCalledWith('bob');
    expect(selectDialog).not.toHaveBeenCalled();
  });
});
