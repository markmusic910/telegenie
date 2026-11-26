import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import MessageComposer from '@/components/main/middle-column/message-composer/message.composer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toastErrorMock = jest.fn();
const forwardStagedMock = jest.fn();
const sendTextMock = jest.fn();
const clearForwardMock = jest.fn();

jest.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

jest.mock('@telegenie/sdk', () => ({
  buildMediaUrl: ({ fileId }: { fileId: string }) => `/media/?fileId=${fileId}`,
  Channel: class {},
  Chat: class {},
  Dialog: { peerKindFromId: () => 'user' },
  MAIN_THREAD_ID: 'main',
  SERVICE_NOTIFICATIONS_USER_ID: '777000',
}));

const forwardedPhotoMessage = {
  id: '42',
  summaryText: 'Photo',
  photo: { id: 'p99', accessHash: 'ah99', dcId: 2 },
  previewThumbDataUri: 'data:image/jpeg;base64,thumb',
};

const mockThread = {
  forwarding: { fromPeerId: '-1001', messageId: '42', dropAuthor: false },
  draft: undefined,
  editingId: undefined,
  replyingToId: undefined,
};

jest.mock('@/lib/contexts/sdk.context', () => ({
  useSDK: () => ({
    agent: { registerTool: () => () => {} },
    messageDraft: {
      adoptDialogDraft: jest.fn(),
      setDraft: jest.fn(),
      clearForward: clearForwardMock,
      setForwardDropAuthor: jest.fn(),
    },
    messageSend: {
      sendText: sendTextMock,
      forwardStaged: forwardStagedMock,
    },
    sticker: { rememberCustomEmoji: jest.fn() },
  }),
  useGlobalStoreThread: () => mockThread,
  useMessage: (_peerId?: string, messageId?: string) =>
    messageId === '42' ? forwardedPhotoMessage : null,
  useStoreEntities: () => null,
}));

jest.mock('@/components/main/middle-column/message-composer/composer-attach.menu', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/main/middle-column/message-composer/use-composer-mentions', () => ({
  useComposerMentions: () => ({
    isOpen: false,
    users: [],
    selectedIndex: 0,
    handleKeyDown: () => false,
    syncSelection: jest.fn(),
    selectUser: jest.fn(),
    setSelectedIndex: jest.fn(),
    dismiss: jest.fn(),
  }),
}));

jest.mock('@/components/main/middle-column/message.sticker-picker', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/main/middle-column/media-send/media-send.dialog', () => ({
  __esModule: true,
  default: () => null,
}));

describe('MessageComposer staged forward', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    toastErrorMock.mockReset();
    forwardStagedMock.mockReset();
    sendTextMock.mockReset();
    clearForwardMock.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders an image preview for a forwarded photo and forwards with empty text', async () => {
    forwardStagedMock.mockResolvedValue({ ok: true, messageId: 42 });

    act(() => {
      root.render(<MessageComposer peerId="123" />);
    });

    const thumb = container.querySelector('[data-testid="forward-preview-thumb"]') as HTMLImageElement;
    expect(thumb).not.toBeNull();
    expect(thumb.getAttribute('src')).toBe('/media/?fileId=p:p99');

    const sendBtn = container.querySelector('button[aria-label="Send"]') as HTMLButtonElement;
    expect(sendBtn).not.toBeNull();
    expect(sendBtn.getAttribute('aria-disabled')).toBeNull();

    await act(async () => {
      sendBtn.click();
    });

    expect(sendTextMock).not.toHaveBeenCalled();
    expect(forwardStagedMock).toHaveBeenCalledWith('123');
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('shows a persistent global error toast when forwarding fails', async () => {
    forwardStagedMock.mockResolvedValue({
      ok: false,
      error: 'Forwarding is restricted in this chat.',
    });

    act(() => {
      root.render(<MessageComposer peerId="123" />);
    });

    const sendBtn = container.querySelector('button[aria-label="Send"]') as HTMLButtonElement;
    await act(async () => {
      sendBtn.click();
    });

    expect(toastErrorMock).toHaveBeenCalledWith('Forwarding is restricted in this chat.', {
      duration: Infinity,
    });
  });
});
