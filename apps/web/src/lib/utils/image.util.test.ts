import { convertCoverToJpeg } from './image.util';

describe('convertCoverToJpeg', () => {
  it('returns original file if URL.createObjectURL is not available', async () => {
    const file = new File(['dummy content'], 'test.png', { type: 'image/png' });
    const result = await convertCoverToJpeg(file);
    expect(result).toBe(file);
  });

  it('converts to jpeg when canvas and URL.createObjectURL are available', async () => {
    const file = new File(['dummy content'], 'test.png', { type: 'image/png' });

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = jest.fn();

    const mockBlob = new Blob(['mock-jpeg'], { type: 'image/jpeg' });
    const mockCtx = {
      drawImage: jest.fn(),
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => mockCtx),
      toBlob: jest.fn((cb: (blob: Blob | null) => void) => cb(mockBlob)),
    };
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        if (tag === 'canvas') return mockCanvas as any;
        return document.createElement(tag);
      });

    const imgSpy = jest.spyOn(global, 'Image').mockImplementation(() => {
      const imgInstance: any = {};
      setTimeout(() => {
        imgInstance.naturalWidth = 800;
        imgInstance.naturalHeight = 600;
        imgInstance.onload?.();
      }, 0);
      return imgInstance;
    });

    try {
      const result = await convertCoverToJpeg(file);
      expect(result).toBeInstanceOf(File);
      expect(result.type).toBe('image/jpeg');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      createElementSpy.mockRestore();
      imgSpy.mockRestore();
    }
  });
});
