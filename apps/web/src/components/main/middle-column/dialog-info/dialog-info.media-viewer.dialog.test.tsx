import type { Message } from '@telegenie/sdk';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import DialogInfoMediaViewerDialog from '@/components/main/middle-column/dialog-info/dialog-info.media-viewer.dialog';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@telegenie/sdk', () => ({
  buildMediaUrl: ({ fileId }: { fileId: string }) => `/media/?fileId=${fileId}`,
  buildProgressiveUrl: ({ fileId }: { fileId: string }) => `/progressive/?fileId=${fileId}`,
}));

const photoMessage = {
  id: '101',
  isVideo: false,
  isGif: false,
  hasSpoiler: false,
  photo: { id: 'p1', accessHash: 'ah1', dcId: 2 },
  previewThumbDataUri: 'data:image/jpeg;base64,thumb',
} as unknown as Message;

const videoMessage = {
  id: '102',
  isVideo: true,
  isGif: false,
  hasSpoiler: false,
  videoDocument: {
    id: 'd1',
    accessHash: 'ah2',
    dcId: 2,
    mimeType: 'video/mp4',
    size: 1024,
  },
  previewThumbDataUri: 'data:image/jpeg;base64,vthumb',
} as unknown as Message;

describe('DialogInfoMediaViewerDialog', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(message: Message) {
    const onOpenChange = jest.fn();
    act(() => {
      root.render(
        <DialogInfoMediaViewerDialog
          peerId="-1001"
          message={message}
          open
          onOpenChange={onOpenChange}
        />,
      );
    });
    return { onOpenChange };
  }

  it('closes when clicking the mask area for an image, but not when clicking the image itself', () => {
    const { onOpenChange } = render(photoMessage);
    const img = document.body.querySelector('img');
    const mask = document.body.querySelector('[data-testid="media-viewer-mask"]') as HTMLElement;
    expect(img).not.toBeNull();
    expect(mask).not.toBeNull();

    act(() => {
      img!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onOpenChange).not.toHaveBeenCalled();

    act(() => {
      mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes when clicking the mask area for a video, but not when clicking the video itself', () => {
    const { onOpenChange } = render(videoMessage);
    const video = document.body.querySelector('video');
    const mask = document.body.querySelector('[data-testid="media-viewer-mask"]') as HTMLElement;
    expect(video).not.toBeNull();
    expect(mask).not.toBeNull();

    act(() => {
      video!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onOpenChange).not.toHaveBeenCalled();

    act(() => {
      mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows a loading indicator before the video can play and hides it on canplay', () => {
    render(videoMessage);
    const video = document.body.querySelector('video')!;
    expect(document.body.querySelector('[role="status"][aria-label="Loading video"]')).not.toBeNull();

    act(() => {
      video.dispatchEvent(new Event('canplay'));
    });
    expect(document.body.querySelector('[role="status"][aria-label="Loading video"]')).toBeNull();

    act(() => {
      video.dispatchEvent(new Event('waiting'));
    });
    expect(document.body.querySelector('[role="status"][aria-label="Loading video"]')).not.toBeNull();

    act(() => {
      video.dispatchEvent(new Event('playing'));
    });
    expect(document.body.querySelector('[role="status"][aria-label="Loading video"]')).toBeNull();
  });
});
