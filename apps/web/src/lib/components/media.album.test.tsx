import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { observable, runInAction } from 'mobx';
import MediaAlbum from '@/lib/components/media.album';
import type { MessageAlbum } from '@telegenie/sdk';

// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@/lib/contexts/sdk.context', () => ({
  useSDK: () => ({
    messageSend: {
      cancelUpload: jest.fn(),
    },
  }),
}));

jest.mock('@/lib/components/media.photo', () => {
  return function DummyMediaPhoto({ uploadProgress }: { uploadProgress?: number }) {
    return (
      <div data-testid="media-photo">
        {uploadProgress !== undefined ? `Photo progress: ${Math.round(uploadProgress * 100)}%` : 'Photo loaded'}
      </div>
    );
  };
});

jest.mock('@/lib/components/media.video', () => {
  return function DummyMediaVideo({ uploadProgress }: { uploadProgress?: number }) {
    return (
      <div data-testid="media-video">
        {uploadProgress !== undefined ? `Video progress: ${Math.round(uploadProgress * 100)}%` : 'Video loaded'}
      </div>
    );
  };
});

describe('MediaAlbum', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    document.body.innerHTML = '';
  });

  it('re-renders progress when uploadProgress updates on the second and third items', () => {
    const msg1 = observable({
      id: '101',
      isPhoto: true,
      isVideo: false,
      photo: { id: 'p1' },
      uploadProgress: 0.1,
      mediaDimensions: { width: 400, height: 300 },
    });
    const msg2 = observable({
      id: '102',
      isPhoto: false,
      isVideo: true,
      videoDocument: { id: 'v2' },
      uploadProgress: 0,
      mediaDimensions: { width: 400, height: 300 },
    });
    const msg3 = observable({
      id: '103',
      isPhoto: false,
      isVideo: true,
      videoDocument: { id: 'v3' },
      uploadProgress: 0,
      mediaDimensions: { width: 400, height: 300 },
    });

    const album: MessageAlbum = {
      albumId: 'grp_1',
      albumType: 'media',
      messages: [msg1 as any, msg2 as any, msg3 as any],
      mainMessage: msg1 as any,
      hasMultipleCaptions: false,
    };

    root = createRoot(container);
    act(() => {
      root?.render(<MediaAlbum album={album} />);
    });

    expect(container.textContent).toContain('Photo progress: 10%');
    expect(container.textContent).toContain('Video progress: 0%');

    // Update second item upload progress
    act(() => {
      runInAction(() => {
        msg2.uploadProgress = 0.55;
      });
    });

    expect(container.textContent).toContain('Video progress: 55%');

    // Update third item upload progress
    act(() => {
      runInAction(() => {
        msg3.uploadProgress = 0.92;
      });
    });

    expect(container.textContent).toContain('Video progress: 92%');
  });
});
