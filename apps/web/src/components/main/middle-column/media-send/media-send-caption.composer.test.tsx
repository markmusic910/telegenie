import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// @ts-expect-error react 18/19 test environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@telegenie/sdk', () => ({
  buildMediaUrl: jest.fn(),
}));

jest.mock('@/lib/contexts/sdk.context', () => ({
  useSDK: () => ({
    sticker: {
      rememberCustomEmoji: jest.fn(),
    },
  }),
}));

jest.mock('../message.sticker-picker', () => {
  return function DummyMessageStickerPicker() {
    return <div data-testid="dummy-sticker-picker" />;
  };
});

jest.mock('../message-composer/composer-emoji.mirror', () => {
  return function DummyComposerEmojiMirror() {
    return <div data-testid="dummy-emoji-mirror" />;
  };
});

import MediaSendCaptionComposer, {
  type MediaSendCaptionComposerProps,
} from './media-send-caption.composer';

describe('MediaSendCaptionComposer', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  const renderComponent = (props: Partial<MediaSendCaptionComposerProps> = {}) => {
    const defaultProps: MediaSendCaptionComposerProps = {
      peerId: 'user_123',
      caption: '',
      onCaptionChange: jest.fn(),
      entities: [],
      onEntitiesChange: jest.fn(),
      invertMedia: false,
      hasAnySpoiler: false,
      allSpoilers: false,
      hasAnyCover: false,
      onSend: jest.fn(),
      ...props,
    };

    const root: Root = createRoot(container);
    act(() => {
      root.render(<MediaSendCaptionComposer {...defaultProps} />);
    });
    return { root, defaultProps };
  };

  it('renders textarea and send button', () => {
    renderComponent({ caption: 'Test caption' });
    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    expect(textarea?.value).toBe('Test caption');

    const sendBtn = container.querySelector('button[aria-label="Send"]');
    expect(sendBtn).not.toBeNull();
  });

  it('calls onSend when send button is clicked', () => {
    const onSend = jest.fn();
    renderComponent({ onSend });

    const sendBtn = container.querySelector('button[aria-label="Send"]') as HTMLButtonElement;
    expect(sendBtn).not.toBeNull();
    act(() => {
      sendBtn.click();
    });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('displays status pills for spoiler, cover, and invertMedia', () => {
    renderComponent({
      invertMedia: true,
      hasAnySpoiler: true,
      allSpoilers: true,
      hasAnyCover: true,
    });

    expect(container.textContent).toContain('Caption on top');
    expect(container.textContent).toContain('All Spoilers');
    expect(container.textContent).toContain('Custom cover');
  });

  it('renders emoji trigger wrapper with z-30 so it remains clickable over textarea', () => {
    renderComponent({
      caption: 'Hello 🌟',
      entities: [
        {
          className: 'MessageEntityCustomEmoji',
          _: 'messageEntityCustomEmoji',
          offset: 6,
          length: 2,
          documentId: '123',
        },
      ],
    });

    const emojiBtn = container.querySelector('button[aria-label="Emoji"]');
    expect(emojiBtn).not.toBeNull();
    const wrapper = emojiBtn?.closest('.z-30');
    expect(wrapper).not.toBeNull();
  });
});
