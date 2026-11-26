import type { DialogProfileSearchTab, Message } from '@telegenie/sdk';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import DialogInfoTabContent from '@/components/main/middle-column/dialog-info/dialog-info.tab.content';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

if (typeof globalThis.DOMRect === 'undefined') {
  // Minimal DOMRect polyfill for jsdom (@base-ui/react context-menu positioning)
  (globalThis as unknown as { DOMRect: unknown }).DOMRect = {
    fromRect: ({ x = 0, y = 0, width = 0, height = 0 } = {}) => ({
      x,
      y,
      width,
      height,
      top: y,
      left: x,
      right: x + width,
      bottom: y + height,
      toJSON: () => ({}),
    }),
  };
}

const popMock = jest.fn();
const focusMessageMock = jest.fn(() => Promise.resolve());
const getMessagesByIdsMock = jest.fn(() => Promise.resolve([]));
const messageMap = new Map<string, Message>();

jest.mock('@telegenie/sdk', () => ({
  buildMediaUrl: ({ fileId }: { fileId: string }) => `/media/?fileId=${fileId}`,
  buildProgressiveUrl: ({ fileId }: { fileId: string }) => `/progressive/?fileId=${fileId}`,
}));

jest.mock('@/lib/contexts/sdk.context', () => ({
  useSDK: () => ({
    getMessageStore: () => ({
      get: (id: string) => messageMap.get(id),
    }),
    dialogInfo: { pop: popMock },
    messageLoad: {
      focusMessage: focusMessageMock,
      getMessagesByIds: getMessagesByIdsMock,
    },
  }),
}));

jest.mock('@/components/main/middle-column/forward-recipient.dialog', () => ({
  __esModule: true,
  default: ({ open, messageId }: { open: boolean; messageId: string }) =>
    open ? <div data-testid="forward-dialog">forward:{messageId}</div> : null,
}));

jest.mock('@/lib/components/media.photo', () => ({
  __esModule: true,
  default: () => <div data-testid="media-photo" />,
}));

jest.mock('@/lib/components/media.video', () => ({
  __esModule: true,
  default: () => <div data-testid="media-video" />,
}));

jest.mock('@/lib/components/media.document', () => ({
  __esModule: true,
  default: () => <div data-testid="media-document" />,
}));

jest.mock('@/lib/components/media.voice', () => ({
  __esModule: true,
  default: () => <div data-testid="media-voice" />,
}));

jest.mock('@/lib/components/media.webpage', () => ({
  __esModule: true,
  default: () => <div data-testid="media-webpage" />,
}));

function makeMessage(id: string, overrides: Record<string, unknown>): Message {
  return {
    id,
    date: 1_700_000_000,
    isEmpty: false,
    isVideo: false,
    isGif: false,
    hasSpoiler: false,
    mediaFileSize: 2048,
    ...overrides,
  } as unknown as Message;
}

describe('DialogInfoTabContent right-click context menu', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    popMock.mockClear();
    focusMessageMock.mockClear();
    getMessagesByIdsMock.mockClear();
    messageMap.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const cases: Array<{ tab: DialogProfileSearchTab; message: Message }> = [
    {
      tab: 'media',
      message: makeMessage('11', { photo: { id: 'p1', accessHash: 'a', dcId: 2 } }),
    },
    {
      tab: 'gifs',
      message: makeMessage('12', {
        isVideo: true,
        isGif: true,
        videoDocument: { id: 'g1', accessHash: 'a', dcId: 2, mimeType: 'video/mp4', size: 100 },
      }),
    },
    {
      tab: 'files',
      message: makeMessage('13', {
        fileDocument: { id: 'f1', accessHash: 'a', dcId: 2, mimeType: 'application/pdf', size: 100 },
      }),
    },
    {
      tab: 'links',
      message: makeMessage('14', { message: 'https://example.com' }),
    },
    {
      tab: 'voice',
      message: makeMessage('15', {
        voiceDocument: { id: 'v1', accessHash: 'a', dcId: 2, mimeType: 'audio/ogg', size: 100 },
        voiceDuration: 5,
      }),
    },
  ];

  it.each(cases)('supports Show Message and Forward on right-click in "$tab" tab', ({ tab, message }) => {
    messageMap.set(String(message.id), message);

    act(() => {
      root.render(
        <DialogInfoTabContent
          peerId="-1001"
          tab={tab}
          messageIds={[String(message.id)]}
          loading={false}
          hasMore={false}
          onLoadMore={jest.fn()}
        />,
      );
    });

    const trigger = container.querySelector('[data-slot="context-menu-trigger"]') as HTMLElement;
    expect(trigger).not.toBeNull();

    act(() => {
      trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });

    const items = Array.from(document.body.querySelectorAll('[data-slot="context-menu-item"]'));
    const showMessageItem = items.find((el) => el.textContent?.includes('Show Message')) as HTMLElement;
    const forwardItem = items.find((el) => el.textContent?.includes('Forward')) as HTMLElement;
    expect(showMessageItem).toBeDefined();
    expect(forwardItem).toBeDefined();

    act(() => {
      showMessageItem.click();
    });
    expect(popMock).toHaveBeenCalledTimes(1);
    expect(focusMessageMock).toHaveBeenCalledWith('-1001', { messageId: String(message.id) });

    act(() => {
      trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });
    const forwardItemAgain = Array.from(
      document.body.querySelectorAll('[data-slot="context-menu-item"]'),
    ).find((el) => el.textContent?.includes('Forward')) as HTMLElement;
    act(() => {
      forwardItemAgain.click();
    });
    expect(document.body.querySelector('[data-testid="forward-dialog"]')?.textContent).toBe(
      `forward:${message.id}`,
    );
  });
});
