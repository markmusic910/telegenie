import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import ChatPickerDialog from '@/lib/components/chat-picker.dialog';

// @ts-expect-error react 18/19 test environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const peers = new Map<string, { display: { name: string }; username?: string }>([
  ['1', { display: { name: 'Teleproto Chat' } }],
  ['2', { display: { name: 'xChange.me' }, username: 'xchange_me' }],
]);

jest.mock('@telegenie/sdk', () => ({
  fallbackPeerDisplay: (id: string) => ({ name: id }),
  peerProfileDisplay: (peer: { display: { name: string } }) => peer.display,
}));

jest.mock('@/lib/components/peer.avatar', () => ({
  __esModule: true,
  default: () => <div data-testid="peer-avatar" />,
}));

jest.mock('@/lib/contexts/sdk.context', () => ({
  useDialogPeer: (peerId: string) => peers.get(peerId),
  useStore: (name: string) => {
    if (name === 'global') {
      return {
        auth: { currentUser: { id: '99' } },
        nav: { sortedDialogIds: ['1', '2'], sortedDialogIdsWithArchived: ['1', '2'] },
      };
    }
    return {
      getAllData: () =>
        new Map([
          ['1', { peerId: '1', isFolder: false }],
          ['2', { peerId: '2', isFolder: false }],
        ]),
    };
  },
}));

describe('ChatPickerDialog search input', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('retains typed search text and filters chats when default array props are omitted', () => {
    act(() => {
      root.render(
        <ChatPickerDialog
          open
          onOpenChange={jest.fn()}
          title="Forward to"
          mode="single"
          includeSavedMessages={false}
        />,
      );
    });

    const input = document.body.querySelector('input[aria-label="Search chats"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(document.body.textContent).toContain('Teleproto Chat');
    expect(document.body.textContent).toContain('xChange.me');

    const nativeValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;

    act(() => {
      nativeValueSetter?.call(input, 'xchange');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(input.value).toBe('xchange');
    expect(document.body.textContent).toContain('xChange.me');
    expect(document.body.textContent).not.toContain('Teleproto Chat');
  });
});
