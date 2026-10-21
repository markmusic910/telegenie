import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import PeerAvatar from './peer.avatar';

// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@telegenie/sdk', () => ({
  peerColorIndex: () => 0,
  buildPeerAvatarUrl: () => 'https://example.com/avatar.jpg',
}));

describe('PeerAvatar', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
    root = null;
  });

  it('renders initials for active user', () => {
    act(() => {
      root?.render(
        <PeerAvatar
          peerId="123"
          display={{
            name: 'John Doe',
            initials: 'JD',
            isVerified: false,
            isSavedMessages: false,
          }}
        />,
      );
    });

    expect(container.textContent).toContain('JD');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders Ghost icon for deleted account and does not render initials', () => {
    act(() => {
      root?.render(
        <PeerAvatar
          peerId="8040940803"
          display={{
            name: 'Deleted Account',
            initials: '',
            isVerified: false,
            isSavedMessages: false,
            isDeleted: true,
          }}
        />,
      );
    });

    expect(container.textContent).toBe('');
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.classList.contains('lucide-ghost')).toBe(true);
  });

  it('renders Bookmark icon for Saved Messages', () => {
    act(() => {
      root?.render(
        <PeerAvatar
          peerId="123"
          display={{
            name: 'Saved Messages',
            initials: 'S',
            isVerified: false,
            isSavedMessages: true,
          }}
        />,
      );
    });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.classList.contains('lucide-bookmark')).toBe(true);
  });
});
