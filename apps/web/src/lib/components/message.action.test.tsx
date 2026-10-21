import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import MessageAction from '@/lib/components/message.action';
import { Message } from '@telegenie/sdk';

// @ts-expect-error react 18/19 test environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@telegenie/sdk', () => ({
  peerActionName: (peer: any) => {
    if (!peer) return 'Unknown';
    if (peer.firstName || peer.lastName) {
      return [peer.firstName, peer.lastName].filter(Boolean).join(' ');
    }
    return peer.title ?? peer.username ?? 'Unknown';
  },
  Message: class MockMessage {
    id: string;
    peerId: string;
    fromId?: string;
    out?: boolean;
    date: number;
    kind: string;
    message?: string;
    media?: any;
    action?: any;
    replyTo?: any;
    isEmpty: boolean;
    constructor(props: any) {
      this.id = props.id;
      this.peerId = props.peerId;
      this.fromId = props.fromId;
      this.out = props.out;
      this.date = props.date;
      this.kind = props.kind;
      this.message = props.message;
      this.media = props.media;
      this.action = props.action;
      this.replyTo = props.replyTo;
      this.isEmpty = props.isEmpty ?? false;
    }
    get isPinMessage() {
      return (
        Boolean(this.action?.isPin) ||
        this.action?.type === 'pinMessage' ||
        (this.kind === 'service' && this.replyTo?.replyToMsgId != null)
      );
    }
    get replyToMessageId() {
      return this.replyTo?.replyToMsgId != null ? String(this.replyTo.replyToMsgId) : null;
    }
    get replyTargetPeerId() {
      return this.peerId;
    }
    get isDocument() {
      return Boolean(this.media && 'document' in this.media && !this.isPhoto && !this.isVideo);
    }
    get isPhoto() {
      return Boolean(this.media && 'photo' in this.media);
    }
    get isVideo() {
      return Boolean(this.media && 'video' in this.media);
    }
    get isBoostMessage() {
      return (
        Boolean(this.action?.boosts) ||
        this.action?.type === 'boostApply' ||
        (this.kind === 'service' && Boolean(this.action && 'boosts' in this.action))
      );
    }
    get boostCount() {
      return typeof this.action?.boosts === 'number' ? this.action.boosts : 1;
    }
  },
}));

const focusMessage = jest.fn();
const getMessagesByIds = jest.fn().mockResolvedValue([]);

const mockStore: Record<string, Message> = {};
const mockPeers: Record<string, any> = {
  '100': { firstName: 'Daniel', lastName: 'Mike' },
  '200': { firstName: '🌑' },
  '-100123': { title: 'Test Channel', broadcast: true },
};

jest.mock('@/lib/contexts/sdk.context', () => ({
  useSDK: () => ({
    message: { focusMessage, getMessagesByIds },
  }),
  useDialogPeer: (peerId: string | null | undefined) => (peerId ? mockPeers[peerId] ?? null : null),
  useStoreEntities: () => [],
  useMessage: (peerId: string | null, messageId: string | null) =>
    peerId && messageId ? mockStore[`${peerId}:${messageId}`] ?? null : null,
}));

jest.mock('@/lib/hooks/use-focus-message', () => ({
  useFocusMessage: () => focusMessage,
}));

jest.mock('@/lib/hooks/use-copy-message-id', () => ({
  useCopyMessageId: () => jest.fn(),
}));

function renderAction(container: HTMLElement, props: ComponentProps<typeof MessageAction>) {
  const root: Root = createRoot(container);
  act(() => {
    root.render(<MessageAction {...props} />);
  });
  return root;
}

describe('MessageAction', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    focusMessage.mockClear();
    getMessagesByIds.mockClear();
    for (const key of Object.keys(mockStore)) {
      delete mockStore[key];
    }
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders pinned plain text message matching official client: Daniel Mike pinned "4"', () => {
    mockStore['7:10'] = new Message({
      id: '10',
      peerId: '7',
      date: 1000,
      kind: 'message',
      message: '4',
      isEmpty: false,
    } as any);

    const serviceMsg = new Message({
      id: '20',
      peerId: '7',
      fromId: '100',
      date: 1001,
      kind: 'service',
      action: { type: 'pinMessage', isPin: true },
      replyTo: { replyToMsgId: 10 },
      isEmpty: false,
    } as any);

    renderAction(container, { message: serviceMsg });

    expect(container.textContent).toContain('Daniel Mike pinned "4"');
  });

  it('renders pinned plain text message matching official client: Daniel Mike pinned "6.6"', () => {
    mockStore['7:11'] = new Message({
      id: '11',
      peerId: '7',
      date: 1000,
      kind: 'message',
      message: '6.6',
      isEmpty: false,
    } as any);

    const serviceMsg = new Message({
      id: '21',
      peerId: '7',
      fromId: '100',
      date: 1001,
      kind: 'service',
      action: { type: 'pinMessage', isPin: true },
      replyTo: { replyToMsgId: 11 },
      isEmpty: false,
    } as any);

    renderAction(container, { message: serviceMsg });

    expect(container.textContent).toContain('Daniel Mike pinned "6.6"');
  });

  it('renders pinned document message with paperclip icon: Daniel Mike pinned "📎 test download progress"', () => {
    mockStore['7:12'] = new Message({
      id: '12',
      peerId: '7',
      date: 1000,
      kind: 'message',
      message: 'test download progress',
      isEmpty: false,
      media: {
        document: {
          id: 'doc-1',
          accessHash: '123',
          fileReference: '',
          date: 1000,
          mimeType: 'application/octet-stream',
          size: '1024',
          dcId: 2,
          attributes: [{ fileName: 'test.zip' }],
        },
      },
    } as any);

    const serviceMsg = new Message({
      id: '22',
      peerId: '7',
      fromId: '100',
      date: 1001,
      kind: 'service',
      action: { type: 'pinMessage', isPin: true },
      replyTo: { replyToMsgId: 12 },
      isEmpty: false,
    } as any);

    renderAction(container, { message: serviceMsg });

    expect(container.textContent).toContain('Daniel Mike pinned "📎 test download progress"');
  });

  it('navigates to the pinned message when clicked', () => {
    mockStore['7:10'] = new Message({
      id: '10',
      peerId: '7',
      date: 1000,
      kind: 'message',
      message: '4',
      isEmpty: false,
    } as any);

    const serviceMsg = new Message({
      id: '20',
      peerId: '7',
      fromId: '100',
      date: 1001,
      kind: 'service',
      action: { type: 'pinMessage', isPin: true },
      replyTo: { replyToMsgId: 10 },
      isEmpty: false,
    } as any);

    renderAction(container, { message: serviceMsg });

    const button = container.querySelector('[role="button"]');
    expect(button).not.toBeNull();

    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(focusMessage).toHaveBeenCalledWith({
      peerId: '7',
      messageId: '10',
    });
  });

  it('renders "You pinned ..." when outgoing', () => {
    mockStore['7:10'] = new Message({
      id: '10',
      peerId: '7',
      date: 1000,
      kind: 'message',
      message: 'Hello',
      isEmpty: false,
    } as any);

    const serviceMsg = new Message({
      id: '20',
      peerId: '7',
      fromId: '100',
      out: true,
      date: 1001,
      kind: 'service',
      action: { type: 'pinMessage', isPin: true },
      replyTo: { replyToMsgId: 10 },
      isEmpty: false,
    } as any);

    renderAction(container, { message: serviceMsg });

    expect(container.textContent).toContain('You pinned "Hello"');
  });

  it('renders boost service messages matching screenshot: 🌑 boosted the group 3 times', () => {
    const serviceMsg = new Message({
      id: '30',
      peerId: '7',
      fromId: '200',
      date: 1001,
      kind: 'service',
      action: { type: 'boostApply', boosts: 3 },
      isEmpty: false,
    } as any);

    renderAction(container, { message: serviceMsg });

    expect(container.textContent).toBe('🌑 boosted the group 3 times');
  });

  it('renders boost service messages matching screenshot: 🌑 boosted the group 7 times', () => {
    const serviceMsg = new Message({
      id: '31',
      peerId: '7',
      fromId: '200',
      date: 1001,
      kind: 'service',
      action: { type: 'boostApply', boosts: 7 },
      isEmpty: false,
    } as any);

    renderAction(container, { message: serviceMsg });

    expect(container.textContent).toBe('🌑 boosted the group 7 times');
  });

  it('renders boost service messages matching screenshot: 🌑 boosted the group 4 times', () => {
    const serviceMsg = new Message({
      id: '32',
      peerId: '7',
      fromId: '200',
      date: 1001,
      kind: 'service',
      action: { type: 'boostApply', boosts: 4 },
      isEmpty: false,
    } as any);

    renderAction(container, { message: serviceMsg });

    expect(container.textContent).toBe('🌑 boosted the group 4 times');
  });

  it('renders single boost: 🌑 boosted the group', () => {
    const serviceMsg = new Message({
      id: '33',
      peerId: '7',
      fromId: '200',
      date: 1001,
      kind: 'service',
      action: { type: 'boostApply', boosts: 1 },
      isEmpty: false,
    } as any);

    renderAction(container, { message: serviceMsg });

    expect(container.textContent).toBe('🌑 boosted the group');
  });

  it('renders outgoing boost: You boosted the group 3 times', () => {
    const serviceMsg = new Message({
      id: '34',
      peerId: '7',
      fromId: '200',
      out: true,
      date: 1001,
      kind: 'service',
      action: { type: 'boostApply', boosts: 3 },
      isEmpty: false,
    } as any);

    renderAction(container, { message: serviceMsg });

    expect(container.textContent).toBe('You boosted the group 3 times');
  });

  it('renders channel boost: 🌑 boosted the channel 4 times', () => {
    const serviceMsg = new Message({
      id: '35',
      peerId: '-100123',
      fromId: '200',
      date: 1001,
      kind: 'service',
      action: { type: 'boostApply', boosts: 4 },
      isEmpty: false,
    } as any);

    renderAction(container, { message: serviceMsg });

    expect(container.textContent).toBe('🌑 boosted the channel 4 times');
  });
});
