import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import CustomEmojiCell from '@/lib/components/custom-emoji.cell';
import type { ObserveFn } from '@/lib/hooks/use-intersection-observer';
import type { Document } from '@telegenie/sdk';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const retainCustomEmoji = jest.fn(() => ({
  release: jest.fn(),
  subscribe: () => () => undefined,
  getBitmap: () => null,
}));

jest.mock('@/lib/rlottie/rlottie-pool', () => ({
  retainCustomEmoji: (...args: unknown[]) => retainCustomEmoji(...args),
}));

jest.mock('@telegenie/sdk', () => ({
  buildMediaUrl: (params: { fileId: string }) => `/media/?fileId=${params.fileId}`,
}));

const sampleDocument: Document = {
  id: '12345',
  accessHash: '67890',
  fileReference: '',
  date: 1000,
  mimeType: 'application/x-tgsticker',
  size: '15000',
  dcId: 2,
  attributes: [],
  thumbs: [{ bytes: 'data:image/webp;base64,thumb' }] as Document['thumbs'],
};

function renderCell(container: HTMLElement, props: ComponentProps<typeof CustomEmojiCell>) {
  const root: Root = createRoot(container);
  act(() => {
    root.render(<CustomEmojiCell {...props} />);
  });
  return root;
}

describe('CustomEmojiCell', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    retainCustomEmoji.mockReset();
    retainCustomEmoji.mockImplementation(() => ({
      release: jest.fn(),
      subscribe: () => () => undefined,
      getBitmap: () => null,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('shows the thumb and does not fetch media until the play observer intersects', () => {
    let onIntersecting: ((isIntersecting: boolean) => void) | undefined;
    const observe: ObserveFn = (_element, callback) => {
      onIntersecting = callback;
      return () => undefined;
    };

    renderCell(container, {
      document: sampleDocument,
      size: 32,
      observe,
    });

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'data:image/webp;base64,thumb',
    );
    expect(container.innerHTML).not.toContain('/media/');
    expect(retainCustomEmoji).not.toHaveBeenCalled();

    act(() => {
      onIntersecting?.(true);
    });

    expect(retainCustomEmoji).toHaveBeenCalledTimes(1);
    expect(retainCustomEmoji.mock.calls[0]?.[0]).toMatchObject({
      documentId: '12345',
      src: '/media/?fileId=d:12345',
      size: 32,
    });
  });

  it('draws a Telegram path thumb when the cover only has raw type-j bytes', () => {
    const pathDocument: Document = {
      ...sampleDocument,
      attributes: [{ w: 512, h: 512 }],
      thumbs: [
        { type: 'j', bytes: btoa(String.fromCharCode(192)) },
        { type: 'm', w: 128, h: 128, size: 5918 },
      ] as Document['thumbs'],
    };

    renderCell(container, { document: pathDocument, size: 28 });

    const src = container.querySelector('img')?.getAttribute('src') ?? '';
    expect(src.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    const svg = decodeURIComponent(src.slice('data:image/svg+xml;utf8,'.length));
    expect(svg).toContain('viewBox="0 0 512 512"');
    expect(svg).toContain('d="MAz"');
  });

  it('hides the thumb after the first animation frame and shows it again when playback stops', () => {
    let onIntersecting: ((isIntersecting: boolean) => void) | undefined;
    let listener: (() => void) | undefined;
    let bitmap: object | null = null;
    const observe: ObserveFn = (_element, callback) => {
      onIntersecting = callback;
      return () => undefined;
    };
    retainCustomEmoji.mockImplementation(() => ({
      release: jest.fn(),
      subscribe: (next: () => void) => {
        listener = next;
        return () => undefined;
      },
      getBitmap: () => bitmap,
    }));
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: jest.fn(),
    } as unknown as CanvasRenderingContext2D);

    renderCell(container, {
      document: sampleDocument,
      size: 32,
      observe,
    });

    expect(container.querySelector('img')?.className).not.toContain('animate-pulse');

    act(() => {
      onIntersecting?.(true);
    });
    const thumb = container.querySelector('img');
    expect(thumb).not.toBeNull();
    expect(thumb?.className).toContain('animate-pulse');

    act(() => {
      bitmap = {};
      listener?.();
    });
    expect(container.querySelector('img')?.hidden).toBe(true);
    expect(container.querySelector('img')?.className).not.toContain('animate-pulse');

    act(() => {
      onIntersecting?.(false);
    });
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'data:image/webp;base64,thumb',
    );
  });
});
