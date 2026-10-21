import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import MediaVideo from '@/lib/components/media.video';
import type { Document, Photo } from '@telegenie/libs/foundation/telegram/types/file';

// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@telegenie/sdk', () => ({
  buildMediaUrl: jest.fn(() => 'http://test/cover.jpg'),
  buildProgressiveUrl: jest.fn(() => 'http://test/stream.mp4'),
}));

jest.mock('@/lib/hooks/use-intersection-observer', () => ({
  useCanLoadMedia: () => ({ ref: { current: null }, canLoad: true }),
}));

beforeAll(() => {
  HTMLMediaElement.prototype.play = jest.fn().mockImplementation(() => Promise.resolve());
});

let currentRoot: Root | null = null;

function renderMediaVideo(
  container: HTMLElement,
  props: ComponentProps<typeof MediaVideo>,
) {
  if (currentRoot) {
    act(() => {
      currentRoot?.unmount();
    });
  }
  currentRoot = createRoot(container);
  act(() => {
    currentRoot?.render(<MediaVideo {...props} />);
  });
  return currentRoot;
}

describe('MediaVideo', () => {
  let container: HTMLDivElement;

  const mockShortVideoDoc: Document = {
    id: '12345',
    accessHash: 'abc',
    dcId: 2,
    mimeType: 'video/mp4',
    size: 50000,
    attributes: [
      {
        w: 640,
        h: 360,
        duration: 10, // < 30s: normally auto-plays
      } as any,
    ],
  };

  const mockVideoCover: Photo = {
    id: '999',
    accessHash: 'cover-hash',
    dcId: 2,
    date: 123456,
    sizes: [],
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
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

  it('auto-plays short video without cover', () => {
    renderMediaVideo(container, {
      document: mockShortVideoDoc,
    });

    const videoEl = container.querySelector('video');
    expect(videoEl).not.toBeNull();
    expect(videoEl?.hasAttribute('autoplay')).toBe(true);
  });

  it('does NOT auto-play when videoCover is provided, showing cover and play button instead', () => {
    renderMediaVideo(container, {
      document: mockShortVideoDoc,
      videoCover: mockVideoCover,
    });

    // video element should not be rendered before play click
    const videoEl = container.querySelector('video');
    expect(videoEl).toBeNull();

    // Cover image should be rendered
    const imgEl = container.querySelector('img[alt="Video cover"]');
    expect(imgEl).not.toBeNull();
    expect(imgEl?.getAttribute('src')).toBe('http://test/cover.jpg');

    // Play button should be rendered
    const playButton = container.querySelector('button[aria-label="Play video"]');
    expect(playButton).not.toBeNull();
  });
});
