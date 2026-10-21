import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import MessageMediaCaption from '@/lib/components/message-media.caption';

// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockGet = jest.fn();
const mockGlobalStore = {
  nav: {
    selectedDialogId: '123',
  },
};
const mockMessageStore = {
  getAllData: jest.fn(() => new Map()),
};
const mockSDK = {
  getMessageStore: jest.fn(() => mockMessageStore),
};

jest.mock('@/lib/contexts/sdk.context', () => ({
  useSDK: () => mockSDK,
  useStore: (name: string) => {
    if (name === 'global') return mockGlobalStore;
    return {};
  },
  useMessage: (peerId: string, messageId: string) => mockGet(peerId, messageId),
}));

jest.mock('@/lib/components/message.text', () => ({
  __esModule: true,
  default: ({ text }: { text: string }) => <span data-testid="message-text">{text}</span>,
}));

let currentRoot: Root | null = null;

function renderCaption(
  container: HTMLElement,
  props: ComponentProps<typeof MessageMediaCaption>,
) {
  if (currentRoot) {
    act(() => {
      currentRoot?.unmount();
    });
  }
  currentRoot = createRoot(container);
  act(() => {
    currentRoot?.render(<MessageMediaCaption {...props} />);
  });
  return currentRoot;
}

describe('MessageMediaCaption', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mockGet.mockReset();
  });

  afterEach(() => {
    if (currentRoot) {
      act(() => {
        currentRoot?.unmount();
      });
      currentRoot = null;
    }
    document.body.innerHTML = '';
  });

  it('renders nothing when message is not found or has no text', () => {
    mockGet.mockReturnValue(null);
    renderCaption(container, { messageId: '1' });
    expect(container.innerHTML).toBe('');

    mockGet.mockReturnValue({
      id: 1,
      message: '',
      out: false,
    });
    renderCaption(container, { messageId: '1' });
    expect(container.innerHTML).toBe('');
  });

  it('renders caption text from store using selectedDialogId when peerId is omitted', () => {
    mockGet.mockReturnValue({
      id: 1,
      message: 'Hello caption',
      out: false,
    });

    renderCaption(container, { messageId: '1' });
    expect(mockGet).toHaveBeenCalledWith('123', '1');
    expect(container.textContent).toContain('Hello caption');
  });

  it('renders caption with invertedMedia styles when message has invertMedia true', () => {
    mockGet.mockReturnValue({
      id: 2,
      message: 'Top caption',
      out: true,
      isPhoto: true,
      invertMedia: true,
    });

    renderCaption(container, { messageId: '2', peerId: '456' });
    expect(mockGet).toHaveBeenCalledWith('456', '2');
    expect(container.textContent).toContain('Top caption');
  });

  it('resolves caption from grouped messages in store when album prop is omitted', () => {
    const msg1 = {
      id: 10,
      groupedId: 'grp-99',
      isInAlbum: true,
      message: '',
      out: false,
    };
    const msg2 = {
      id: 11,
      groupedId: 'grp-99',
      isInAlbum: true,
      message: 'Album caption from store',
      out: false,
    };
    const messageMap = new Map([
      ['10', msg1],
      ['11', msg2],
    ]);
    mockMessageStore.getAllData.mockReturnValue(messageMap);
    mockGet.mockReturnValue(msg1);

    renderCaption(container, { messageId: '10', peerId: '123' });
    expect(container.textContent).toContain('Album caption from store');
  });
});
