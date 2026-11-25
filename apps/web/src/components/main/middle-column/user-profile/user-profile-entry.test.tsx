import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import MessagesContainer from '@/components/main/middle-column/messages.container';
import MessageItem from '@/lib/components/message.item';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const openProfileMock = jest.fn();
const onToggleConfigMock = jest.fn();

let mockSelectedDialogId: string | undefined = '208589966';
let mockActiveProfilePeerId: string | undefined = undefined;
let mockPeers: Record<string, Record<string, unknown>> = {};
let mockDialogs: Record<string, Record<string, unknown>> = {};

jest.mock('@telegenie/libs/foundation/telegram/helpers', () => ({
  isPaidReaction: () => false,
  reactionKey: () => 'r',
  reactionsEqual: () => false,
}));

jest.mock('@telegenie/sdk', () => ({
  MAIN_THREAD_ID: '-1',
  SERVICE_NOTIFICATIONS_USER_ID: '777000',
  Dialog: {
    peerKindFromId: (id: string) =>
      id.startsWith('-1000') ? 'channel' : id.startsWith('-') ? 'chat' : 'user',
  },
  fallbackPeerDisplay: (id: string) => ({
    name: `Peer ${id}`,
    initials: 'P',
    isVerified: false,
    isSavedMessages: false,
  }),
  initialsFromName: (name: string) => name.slice(0, 2).toUpperCase(),
  peerColorIndex: () => 0,
}));

jest.mock('@/components/main/middle-column/message.list', () => ({
  __esModule: true,
  default: () => <div data-testid="message-list" />,
}));

jest.mock('@/components/main/middle-column/message-composer/message.composer', () => ({
  __esModule: true,
  default: () => <div data-testid="message-composer" />,
}));

jest.mock('@/components/main/middle-column/pinned-message.bar', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/main/middle-column/pinned-message.list', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/main/middle-column/user-profile/user-profile.view', () => ({
  __esModule: true,
  default: ({ peerId }: { peerId: string }) => <div data-testid={`profile-overlay-${peerId}`} />,
}));

jest.mock('@/lib/components/peer.avatar', () => ({
  __esModule: true,
  default: ({ peerId }: { peerId: string }) => <div data-testid={`avatar-${peerId}`} />,
}));

jest.mock('@/lib/components/message.context-menu', () => ({
  __esModule: true,
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

jest.mock('@/lib/components/custom-emoji.surface', () => ({
  __esModule: true,
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

jest.mock('@/lib/components/message.forward', () => ({ __esModule: true, default: () => null }));
jest.mock('@/lib/components/message.reply', () => ({ __esModule: true, default: () => null }));
jest.mock('@/lib/components/message.reactions', () => ({ __esModule: true, default: () => null }));
jest.mock('@/lib/components/message-media.caption', () => ({
  __esModule: true,
  default: () => <span>Hello group</span>,
}));
jest.mock('@/lib/components/message.meta', () => ({ __esModule: true, default: () => null }));

jest.mock('@/lib/contexts/sdk.context', () => ({
  useSDK: () => ({
    user: {
      openProfile: openProfileMock,
    },
    messageLoad: {
      loadPinnedMessages: jest.fn(),
      closePinnedView: jest.fn(),
    },
    messageSelect: {
      enter: jest.fn(),
    },
    messageRead: {
      markMediaRead: jest.fn(),
    },
    messageSend: {
      cancelUpload: jest.fn(),
    },
  }),
  useStore: () => ({
    nav: {
      get selectedDialogId() {
        return mockSelectedDialogId;
      },
      get activeProfilePeerId() {
        return mockActiveProfilePeerId;
      },
    },
  }),
  useStoreEntities: (store: string, id?: string | null) => {
    if (!id) return null;
    if (store === 'dialog') return mockDialogs[id] ?? null;
    return null;
  },
  useDialogPeer: (id?: string | null) => (id ? (mockPeers[id] ?? null) : null),
  useGlobalStoreDialog: () => ({
    isPinnedViewOpen: false,
    activeThreadId: '-1',
    pinnedMessageIds: [],
    pinnedMessagesCount: 0,
  }),
  useGlobalStoreThread: () => ({
    isSelectMode: false,
    listedIds: ['1'],
  }),
}));

describe('User Profile entry points', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveProfilePeerId = undefined;
    mockSelectedDialogId = '208589966';
    mockDialogs = {
      '208589966': { peerId: '208589966', peerKind: 'user' },
      '1': { peerId: '1', peerKind: 'user' },
      '-100123': { peerId: '-100123', peerKind: 'channel' },
    };
    mockPeers = {
      '208589966': {
        id: '208589966',
        self: false,
        deleted: false,
        status: { className: 'UserStatusRecently' },
        display: {
          name: '李方阳',
          initials: '李',
          isVerified: false,
          isSavedMessages: false,
        },
      },
      '1': {
        id: '1',
        self: true,
        display: {
          name: 'Saved Messages',
          initials: 'SM',
          isVerified: false,
          isSavedMessages: true,
        },
      },
      '-100123': {
        id: '-100123',
        broadcast: true,
        participantsCount: 500,
        display: {
          name: 'Dev Channel',
          initials: 'DC',
          isVerified: false,
          isSavedMessages: false,
        },
      },
    };

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

  it('opens user profile when clicking user dialog header, skips Saved Messages, and toggles config on channels', () => {
    act(() => {
      root?.render(<MessagesContainer onToggleConfig={onToggleConfigMock} />);
    });

    const userHeaderBtn = container.querySelector('button[title="View user profile"]') as HTMLButtonElement;
    expect(userHeaderBtn).not.toBeNull();
    act(() => {
      userHeaderBtn.click();
    });
    expect(openProfileMock).toHaveBeenCalledWith('208589966');
    expect(onToggleConfigMock).not.toHaveBeenCalled();

    // Saved Messages header should be disabled and not open user profile
    openProfileMock.mockClear();
    mockSelectedDialogId = '1';
    act(() => {
      root?.render(<MessagesContainer key="saved" onToggleConfig={onToggleConfigMock} />);
    });
    const savedHeaderBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Saved Messages'),
    );
    expect(savedHeaderBtn?.disabled).toBe(true);
    act(() => {
      savedHeaderBtn?.click();
    });
    expect(openProfileMock).not.toHaveBeenCalled();

    // Channel header toggles right-column config
    mockSelectedDialogId = '-100123';
    act(() => {
      root?.render(<MessagesContainer key="channel" onToggleConfig={onToggleConfigMock} />);
    });
    const channelHeaderBtn = container.querySelector('button[title="View dialog info"]') as HTMLButtonElement;
    act(() => {
      channelHeaderBtn.click();
    });
    expect(onToggleConfigMock).toHaveBeenCalledTimes(1);
  });

  it('opens member user profile when clicking sender avatar or sender name in a group/channel message', () => {
    const fakeMessage = {
      id: '101',
      kind: 'message',
      peerId: '-100123',
      date: 1700000000,
      message: 'Hello group',
      outgoingStatus: () => undefined,
    } as never;

    act(() => {
      root?.render(
        <MessageItem
          peerId="-100123"
          message={fakeMessage}
          isOwn={false}
          isFirstInGroup={true}
          isLastInGroup={true}
          showAvatar={true}
          showSenderName={true}
          senderName="李方阳"
          senderPeerId="208589966"
        />,
      );
    });

    const avatarBtn = container.querySelector(
      'button[aria-label="View 李方阳 profile"]',
    ) as HTMLButtonElement;
    expect(avatarBtn).not.toBeNull();
    act(() => {
      avatarBtn.click();
    });
    expect(openProfileMock).toHaveBeenCalledWith('208589966');

    openProfileMock.mockClear();
    const senderNameBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === '李方阳',
    );
    expect(senderNameBtn).toBeDefined();
    act(() => {
      senderNameBtn?.click();
    });
    expect(openProfileMock).toHaveBeenCalledWith('208589966');
  });
});
