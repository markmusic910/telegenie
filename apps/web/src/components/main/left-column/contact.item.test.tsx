import { act } from 'react';
import { createRoot } from 'react-dom/client';

import ContactItem from './contact.item';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const pushMock = jest.fn();
const selectDialogMock = jest.fn(() => Promise.resolve());
let mockSelectedDialogId: string | undefined;
let mockUsers: Record<string, unknown> = {};

jest.mock('@telegenie/sdk', () => ({
  fallbackPeerDisplay: (id: string) => ({ name: id, initials: id.slice(0, 2) }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@/lib/components/peer.avatar', () => ({
  __esModule: true,
  default: ({ peerId }: { peerId: string }) => <div data-testid={`avatar-${peerId}`} />,
}));

jest.mock('@/lib/contexts/sdk.context', () => ({
  useSDK: () => ({
    messageLoad: { selectDialog: selectDialogMock },
  }),
  useStore: () => ({
    nav: {
      get selectedDialogId() {
        return mockSelectedDialogId;
      },
    },
  }),
  useStoreEntities: (_store: string, id: string) => mockUsers[id] ?? null,
}));

describe('ContactItem', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    pushMock.mockClear();
    selectDialogMock.mockClear();
    mockSelectedDialogId = undefined;
    mockUsers = {
      '1001': {
        id: '1001',
        display: {
          name: 'Alice Wonderland',
          initials: 'AW',
          isVerified: true,
        },
        status: { className: 'UserStatusOnline', expires: 9999999999 },
      },
      '1002': {
        id: '1002',
        display: {
          name: 'Bob Builder',
          initials: 'BB',
          isVerified: false,
        },
        status: { className: 'UserStatusRecently' },
      },
    };
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders contact name, avatar, and status subtitle', () => {
    const root = createRoot(container);
    act(() => {
      root.render(<ContactItem contactId="1001" />);
    });

    expect(container.textContent).toContain('Alice Wonderland');
    expect(container.textContent).toContain('online');
    expect(container.querySelector('[data-testid="avatar-1001"]')).not.toBeNull();
  });

  it('marks the item as selected when selectedDialogId matches contactId', () => {
    mockSelectedDialogId = '1002';
    const root = createRoot(container);
    act(() => {
      root.render(<ContactItem contactId="1002" />);
    });

    const button = container.querySelector('#contact-item-1002');
    expect(button).not.toBeNull();
    expect(button?.className).toContain('bg-accent');
    expect(container.textContent).toContain('last seen recently');
  });

  it('selects the dialog and navigates to /contacts/<contactId> on click', () => {
    const root = createRoot(container);
    act(() => {
      root.render(<ContactItem contactId="1001" />);
    });

    const button = container.querySelector('#contact-item-1001') as HTMLButtonElement;
    act(() => {
      button.click();
    });

    expect(selectDialogMock).toHaveBeenCalledWith('1001');
    expect(pushMock).toHaveBeenCalledWith('/contacts/1001');
  });
});
