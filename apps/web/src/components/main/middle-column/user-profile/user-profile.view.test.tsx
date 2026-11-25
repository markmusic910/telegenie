import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import UserProfileView from './user-profile.view';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const pushMock = jest.fn();
const openProfileMock = jest.fn();
const popProfileMock = jest.fn();
const closeProfileMock = jest.fn();
const resolveUsernameMock = jest.fn();
const addContactMock = jest.fn(() => Promise.resolve());
const setBlockedMock = jest.fn(() => Promise.resolve());
const selectDialogMock = jest.fn(() => Promise.resolve());
const getChannelsByIdsMock = jest.fn(() => Promise.resolve([]));
const getMessagesByIdsMock = jest.fn(() => Promise.resolve([]));

let mockStores: Record<string, Record<string, unknown>> = {};
let mockChannelMessages: Record<string, unknown> = {};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@telegenie/libs/foundation/telegram/helpers', () => ({
  getEntityTypeById: (id: string) =>
    id.startsWith('-1000000') ? 'channel' : id.startsWith('-') ? 'chat' : 'user',
  markedChannelIdFromMtp: (id: string) => String(-1_000_000_000_000 - Number(id)),
}));

jest.mock('@telegenie/sdk', () => ({
  SERVICE_NOTIFICATIONS_USER_ID: '777000',
  Dialog: {
    peerKindFromId: (id: string) =>
      id.startsWith('-1000000') ? 'channel' : id.startsWith('-') ? 'chat' : 'user',
  },
  fallbackPeerDisplay: (id: string) => ({
    name: id,
    initials: id.slice(0, 2),
    isVerified: false,
    isSavedMessages: false,
  }),
  peerProfileDisplay: (peer: {
    firstName?: string;
    lastName?: string;
    title?: string;
    verified?: boolean;
    deleted?: boolean;
  }) => {
    const name =
      peer.title ?? [peer.firstName, peer.lastName].filter(Boolean).join(' ') ?? 'Unknown';
    return {
      name,
      initials: name.slice(0, 2).toUpperCase(),
      isVerified: Boolean(peer.verified),
      isSavedMessages: false,
      isDeleted: Boolean(peer.deleted),
    };
  },
  collectAlbumPreview: () => undefined,
  formatDialogPreviewText: (msg: { message?: string }) => msg.message ?? '',
  albumPreviewPlaceholder: () => 'Media',
  replaceSelfMentionsInText: (text: string) => text,
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@/lib/components/peer.avatar', () => ({
  __esModule: true,
  default: ({ peerId, isBig }: { peerId: string; isBig?: boolean }) => (
    <div data-testid={`avatar-${peerId}`} data-big={isBig ? '1' : '0'} />
  ),
}));

jest.mock('@/lib/contexts/sdk.context', () => ({
  useSDK: () => ({
    user: {
      openProfile: openProfileMock,
      popProfile: popProfileMock,
      closeProfile: closeProfileMock,
      resolveUsername: resolveUsernameMock,
      addContact: addContactMock,
      setBlocked: setBlockedMock,
      getUsersByIds: jest.fn(() => Promise.resolve([])),
      getFullUsers: jest.fn(() => Promise.resolve([])),
      deleteContact: jest.fn(() => Promise.resolve()),
      setMuted: jest.fn(() => Promise.resolve({ muteUntil: 0 })),
    },
    channel: {
      getChannelsByIds: getChannelsByIdsMock,
    },
    messageLoad: {
      selectDialog: selectDialogMock,
      getMessagesByIds: getMessagesByIdsMock,
    },
    encryptedChat: {
      create: jest.fn(() => Promise.resolve({})),
    },
  }),
  useStoreEntities: (store: string, id?: string | null) =>
    id ? (mockStores[store]?.[id] ?? null) : null,
  useMessage: (peerId?: string | null, msgId?: string | null) =>
    peerId && msgId ? (mockChannelMessages[`${peerId}:${msgId}`] ?? null) : null,
}));

describe('UserProfileView', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStores = {
      user: {
        '208589966': {
          id: '208589966',
          firstName: 'Poolitzer',
          lastName: 'X',
          username: 'Poolitzer',
          contact: false,
          bot: false,
          verified: false,
          status: { className: 'UserStatusOnline', expires: 9999999999 },
          photo: { photoId: '55', dcId: 2 },
        },
      },
      userFull: {
        '208589966': {
          id: '208589966',
          about: 'Hey @MinorDeity, my website is at https://poolitzer.eu #Poolinus',
          blocked: false,
          phoneCallsAvailable: true,
          personalChannelId: '10',
          personalChannelMessage: 28,
          notifySettings: { muteUntil: 0 },
          settings: {},
        },
      },
      channel: {
        '-1000000000010': {
          id: '-1000000000010',
          title: 'Pool talks',
          broadcast: true,
          participantsCount: 162,
        },
      },
      dialog: {},
    };
    mockChannelMessages = {
      '-1000000000010:28': {
        id: '28',
        peerId: '-1000000000010',
        date: 1781654400,
        message: 'https://poolitzer.eu/blog/weekly/28/ One more, not a lot happening this week',
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

  it('renders official desktop user profile sections, big avatar, personal channel, and peer ID', () => {
    act(() => {
      root?.render(<UserProfileView peerId="208589966" />);
    });

    expect(container.textContent).toContain('Info');
    expect(container.textContent).toContain('Poolitzer X');
    expect(container.textContent).toContain('online');
    expect(container.textContent).toContain('@Poolitzer');
    expect(container.textContent).toContain('208589966');
    expect(container.textContent).toContain('162 SUBSCRIBERS');
    expect(container.textContent).toContain('Pool talks');
    expect(container.textContent).toContain('One more, not a lot happening this week');
    expect(container.textContent).toContain('Add Contact');
    expect(container.textContent).toContain('Block User');

    const heroAvatar = container.querySelector('[data-testid="avatar-208589966"]');
    expect(heroAvatar?.getAttribute('data-big')).toBe('1');
  });

  it('pops profile on Back click and opens 1:1 chat on Message tile click', () => {
    act(() => {
      root?.render(<UserProfileView peerId="208589966" />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const backBtn = buttons.find((btn) => btn.textContent?.includes('Back'));
    const messageBtn = buttons.find((btn) => btn.textContent?.trim() === 'Message');

    act(() => {
      backBtn?.click();
    });
    expect(popProfileMock).toHaveBeenCalledTimes(1);

    act(() => {
      messageBtn?.click();
    });
    expect(closeProfileMock).toHaveBeenCalledTimes(1);
    expect(selectDialogMock).toHaveBeenCalledWith('208589966');
    expect(pushMock).toHaveBeenCalledWith('/chat/208589966');
  });

  it('navigates to the personal channel when clicking the personal channel card', () => {
    act(() => {
      root?.render(<UserProfileView peerId="208589966" />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const channelCardBtn = buttons.find((btn) => btn.textContent?.includes('Pool talks'));
    expect(channelCardBtn).toBeDefined();

    act(() => {
      channelCardBtn?.click();
    });

    expect(closeProfileMock).toHaveBeenCalledTimes(1);
    expect(selectDialogMock).toHaveBeenCalledWith('-1000000000010');
    expect(pushMock).toHaveBeenCalledWith('/chat/-1000000000010');
  });

  it('stacks user profile when bio @mention resolves to a user, or opens chat when it resolves to a channel', async () => {
    act(() => {
      root?.render(<UserProfileView peerId="208589966" />);
    });

    const mentionBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === '@MinorDeity',
    );
    expect(mentionBtn).toBeDefined();

    // Case 1: resolves to a user -> pushes onto profile stack
    resolveUsernameMock.mockResolvedValueOnce('987654');
    await act(async () => {
      mentionBtn?.click();
    });
    expect(resolveUsernameMock).toHaveBeenCalledWith('MinorDeity');
    expect(openProfileMock).toHaveBeenCalledWith('987654');
    expect(closeProfileMock).not.toHaveBeenCalled();

    // Case 2: resolves to a channel -> closes profile and opens channel chat
    resolveUsernameMock.mockResolvedValueOnce('-1000000000555');
    await act(async () => {
      mentionBtn?.click();
    });
    expect(closeProfileMock).toHaveBeenCalledTimes(1);
    expect(selectDialogMock).toHaveBeenCalledWith('-1000000000555');
  });
});
