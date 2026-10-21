import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import MessageText from '@/lib/components/message.text';

const selectDialog = jest.fn();
const selectDialogByUsername = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/components/custom.emoji', () => ({
  __esModule: true,
  default: ({ fallback }: { fallback: string }) => fallback,
}));

jest.mock('@/lib/contexts/sdk.context', () => ({
  useSDK: () => ({
    messageLoad: { selectDialog, selectDialogByUsername },
    sticker: { rememberCustomEmoji: () => undefined },
  }),
}));

function renderMessageText(container: HTMLElement, props: ComponentProps<typeof MessageText>) {
  const root: Root = createRoot(container);
  act(() => {
    root.render(<MessageText {...props} />);
  });
  return root;
}

describe('MessageText', () => {
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

  it('renders MessageEntityMention as a clickable username link', () => {
    renderMessageText(container, {
      text: 'hello @alice world',
      entities: [
        {
          offset: 6,
          length: 6,
          className: 'MessageEntityMention',
        },
      ],
    });

    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.textContent).toBe('@alice');

    act(() => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(selectDialogByUsername).toHaveBeenCalledWith('alice');
  });

  it('renders MessageEntityMentionName as a clickable link that opens the user dialog', () => {
    renderMessageText(container, {
      text: 'hi Alice',
      entities: [
        {
          offset: 3,
          length: 5,
          className: 'MessageEntityMentionName',
          userId: 'user-42',
        },
      ],
    });

    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.textContent).toBe('Alice');

    act(() => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(selectDialog).toHaveBeenCalledWith('user-42');
  });

  it('resolves InputMessageEntityMentionName userId from a nested InputUser', () => {
    renderMessageText(container, {
      text: 'hi Bob',
      entities: [
        {
          offset: 3,
          length: 3,
          className: 'InputMessageEntityMentionName',
          userId: { userId: 'user-99', accessHash: '1' },
        },
      ],
    });

    const link = container.querySelector('a');
    act(() => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(selectDialog).toHaveBeenCalledWith('user-99');
  });

  it('keeps the unicode fallback until a custom emoji document is loaded', () => {
    renderMessageText(container, {
      text: '😁',
      entities: [
        {
          offset: 0,
          length: 2,
          className: 'MessageEntityCustomEmoji',
          documentId: '99',
        },
      ],
    });

    expect(container.textContent).toBe('😁');
  });
});
