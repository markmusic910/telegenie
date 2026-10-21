import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import CustomEmoji from '@/lib/components/custom.emoji';
import { SINGLE_CUSTOM_EMOJI_SIZE } from '@/lib/utils/emoji.grapheme';
import CustomEmojiSurface from '@/lib/components/custom-emoji.surface';
import type { ObserveFn } from '@/lib/hooks/use-intersection-observer';
import type { Document } from '@telegenie/sdk';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const retainCustomEmoji = jest.fn(() => ({
  release: jest.fn(),
  subscribe: () => () => undefined,
  getBitmap: () => null,
}));

const sampleDocument: Document = {
  id: '99',
  accessHash: '1',
  fileReference: '',
  date: 1,
  mimeType: 'application/x-tgsticker',
  size: '10',
  dcId: 2,
  attributes: [],
  thumbs: [{ bytes: 'data:image/webp;base64,bubble' }] as Document['thumbs'],
};

jest.mock('@/lib/rlottie/rlottie-pool', () => ({
  retainCustomEmoji: (...args: unknown[]) => retainCustomEmoji(...args),
}));

jest.mock('@telegenie/sdk', () => ({
  buildMediaUrl: (params: { fileId: string }) => `/media/?fileId=${params.fileId}`,
}));

jest.mock('@/lib/contexts/sdk.context', () => ({
  useStoreEntities: (_name: string, id: string | null | undefined) =>
    id === '99' ? sampleDocument : null,
}));

describe('CustomEmoji in a message bubble', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    retainCustomEmoji.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not start playback until the bubble intersects the list', () => {
    let onIntersecting: ((isIntersecting: boolean) => void) | undefined;
    const observe: ObserveFn = (_element, callback) => {
      onIntersecting = callback;
      return () => undefined;
    };
    const root: Root = createRoot(container);
    act(() => {
      root.render(
        <CustomEmojiSurface>
          <CustomEmoji
            documentId="99"
            fallback="😁"
            observeIntersectionForPlaying={observe}
          />
        </CustomEmojiSurface>,
      );
    });

    expect(container.textContent).not.toContain('😁');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/webp;base64,bubble');
    expect(container.innerHTML).not.toContain('/media/');
    expect(retainCustomEmoji).not.toHaveBeenCalled();

    act(() => {
      onIntersecting?.(true);
    });

    expect(retainCustomEmoji).toHaveBeenCalledTimes(1);
    expect(retainCustomEmoji.mock.calls[0]?.[0]).toMatchObject({
      documentId: '99',
      size: 20,
    });
  });

  it('renders one emoji-only custom emoji at 7rem', () => {
    const root: Root = createRoot(container);
    act(() => {
      root.render(
        <CustomEmojiSurface>
          <CustomEmoji documentId="99" fallback="😁" size={SINGLE_CUSTOM_EMOJI_SIZE} />
        </CustomEmojiSurface>,
      );
    });

    const box = container.querySelector('[role="img"]');
    expect(box).toBeInstanceOf(HTMLElement);
    expect((box as HTMLElement).style.width).toBe('112px');
    expect((box as HTMLElement).style.height).toBe('112px');
  });

  it('keeps the unicode fallback in the same box until the document loads', () => {
    const root: Root = createRoot(container);
    act(() => {
      root.render(<CustomEmoji documentId="missing" fallback="😁" size={SINGLE_CUSTOM_EMOJI_SIZE} />);
    });

    const box = container.querySelector('span');
    expect(box?.textContent).toBe('😁');
    expect(box?.style.width).toBe('112px');
    expect(box?.style.height).toBe('112px');
  });
});
