import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import MediaSticker from '@/lib/components/media.sticker';
import type { Document } from '@telegenie/sdk';

// @ts-expect-error react 18/19 test environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@telegenie/sdk', () => ({
  buildMediaUrl: (params: { fileId: string; mimeType?: string }) => {
    const search = new URLSearchParams({ fileId: params.fileId });
    if (params.mimeType) search.set('mimeType', params.mimeType);
    return `/media/?${search.toString()}`;
  },
}));

jest.mock('@/lib/hooks/use-intersection-observer', () => ({
  useCanLoadMedia: () => ({
    ref: { current: null },
    canLoad: true,
  }),
}));

jest.mock('@/lib/components/media.sticker.animated', () => ({
  __esModule: true,
  default: ({ src }: { src: string }) => <div data-sticker="animated" data-src={src} />,
}));

function renderMediaSticker(container: HTMLElement, props: ComponentProps<typeof MediaSticker>) {
  const root: Root = createRoot(container);
  act(() => {
    root.render(<MediaSticker {...props} />);
  });
  return root;
}

describe('MediaSticker', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const sampleDocument: Document = {
    id: '12345',
    accessHash: '67890',
    fileReference: '',
    date: 1000,
    mimeType: 'image/webp',
    size: '15000',
    dcId: 2,
    attributes: [{ w: 512, h: 512 }],
  };

  it('renders static sticker image with aspect ratio and max 192px dimensions', () => {
    renderMediaSticker(container, {
      document: sampleDocument,
      emoji: '👍',
    });

    const wrapper = container.querySelector('[role="img"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute('aria-label')).toBe('👍 sticker');
    expect(wrapper?.getAttribute('title')).toBe('👍');

    const img = container.querySelector('img[alt="👍"]');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain('/media/?fileId=d%3A12345');
    expect(img?.getAttribute('width')).toBe('192');
    expect(img?.getAttribute('height')).toBe('192');
    expect(container.querySelector('[data-slot="skeleton"]')?.textContent).toBe('');
  });

  it('renders video sticker from the full media file', () => {
    const videoDoc: Document = {
      ...sampleDocument,
      mimeType: 'video/webm',
    };

    renderMediaSticker(container, {
      document: videoDoc,
      isVideo: true,
      emoji: '🔥',
    });

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toContain('/media/?fileId=d%3A12345');
    expect(video?.getAttribute('src')).toContain('mimeType=video%2Fwebm');
    expect(video?.hasAttribute('autoplay')).toBe(true);
    expect(video?.hasAttribute('loop')).toBe(true);
    expect(container.querySelector('img[alt="🔥"]')).toBeNull();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it('renders animated tgs stickers with the lottie player instead of an image', () => {
    const tgsDoc: Document = {
      ...sampleDocument,
      mimeType: 'application/x-tgsticker',
    };

    renderMediaSticker(container, {
      document: tgsDoc,
      isAnimated: true,
      emoji: '🦆',
    });

    const animated = container.querySelector('[data-sticker="animated"]');
    expect(animated).not.toBeNull();
    expect(animated?.getAttribute('data-src')).toContain('/media/?fileId=d%3A12345');
    expect(animated?.getAttribute('data-src')).toContain('mimeType=application%2Fx-tgsticker');
    expect(container.querySelector('img[alt="🦆"]')).toBeNull();
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('[data-slot="skeleton"]')?.textContent).toBe('');
  });

  it('renders blurred low-res thumbnail when placeholder is provided', () => {
    const thumbUri = 'data:image/jpeg;base64,/9j/thumbdata';
    renderMediaSticker(container, {
      document: sampleDocument,
      previewThumbDataUri: thumbUri,
    });

    const thumbImg = container.querySelector('img[aria-hidden="true"]');
    expect(thumbImg).not.toBeNull();
    expect(thumbImg?.getAttribute('src')).toBe(thumbUri);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
  });

  it('calls onClick callback when clicked', () => {
    const onClick = jest.fn();
    renderMediaSticker(container, {
      document: sampleDocument,
      onClick,
    });

    const wrapper = container.querySelector('[role="img"]');
    act(() => {
      wrapper?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
