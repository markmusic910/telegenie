import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { FileService } from './file.service';
import type { TransportService } from './transport.service';

type FakeClient = {
  uploadFile: jest.Mock;
  downloadFile: jest.Mock;
  iterDownload: jest.Mock;
};

function createClient(): FakeClient {
  return {
    uploadFile: jest.fn().mockImplementation(async ({ file }) =>
      new Api.InputFile({
        id: bigInt(1),
        parts: 1,
        name: (file as File).name ?? 'a.png',
        md5Checksum: '',
      }),
    ),
    downloadFile: jest.fn().mockImplementation(async () => Buffer.from('full-file-bytes')),
    iterDownload: jest.fn().mockImplementation(async function* () {
      yield Buffer.from('abcdefghij');
    }),
  };
}

function createService(
  client: FakeClient | null,
  localDb: Record<string, unknown> = {},
): FileService {
  return new FileService({
    transportService: { client, debug: false } as unknown as TransportService,
    localDb: {
      getFileRef: jest.fn(async () => undefined),
      resolveInputPeer: jest.fn(async (peerId: string) => ({ type: 'unavailable', peerId })),
      ...localDb,
    } as never,
  });
}

const asFile = (type = 'image/png', name = 'a.png') => ({ type, name }) as unknown as File;

const locationItem = {
  fileId: 'd:99',
  accessHash: '7',
  dcId: 2,
  mimeType: 'image/jpeg',
  fullSize: 15,
};

describe('FileService.uploadFiles', () => {
  it('throws when the client is missing', async () => {
    await expect(createService(null).uploadFiles([{ file: asFile() }])).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('uploads a single-item batch without workers', async () => {
    const client = createClient();
    const onProgress = jest.fn();
    const file = asFile();

    const result = await createService(client).uploadFiles([{ file, onProgress }]);

    expect(client.uploadFile).toHaveBeenCalledWith({ file, onProgress });
    expect(client.uploadFile.mock.calls[0][0].workers).toBeUndefined();
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Api.InputFile);
  });

  it('uploads multiple files concurrently', async () => {
    const client = createClient();
    const a = asFile('image/png', 'a.png');
    const b = asFile('image/jpeg', 'b.jpg');

    const result = await createService(client).uploadFiles([{ file: a }, { file: b }]);

    expect(client.uploadFile).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect((result[0] as Api.InputFile).name).toBe('a.png');
    expect((result[1] as Api.InputFile).name).toBe('b.jpg');
  });
});

describe('FileService.downloadFiles', () => {
  it('throws when the client is missing', async () => {
    await expect(createService(null).downloadFiles([locationItem])).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('throws on an invalid fileId', async () => {
    const client = createClient();
    await expect(
      createService(client).downloadFiles([{ ...locationItem, fileId: 'bad' }]),
    ).rejects.toThrow('Invalid fileId');
  });

  it('downloads a single item via client.downloadFile', async () => {
    const client = createClient();
    const signal = new AbortController().signal;

    const result = await createService(client).downloadFiles([
      {
        ...locationItem,
        signal,
        requestTimeout: 5_000,
      },
    ]);

    expect(client.downloadFile).toHaveBeenCalledTimes(1);
    const [location, opts] = client.downloadFile.mock.calls[0];
    expect(location).toBeInstanceOf(Api.InputDocumentFileLocation);
    expect(opts).toMatchObject({
      dcId: 2,
      signal,
      requestTimeout: 5_000,
    });
    expect(result).toHaveLength(1);
    expect(result[0].mimeType).toBe('image/jpeg');
    expect(result[0].fullSize).toBe(15);
    expect(Buffer.from(result[0].arrayBuffer).toString()).toBe('full-file-bytes');
  });

  it('downloads multiple items concurrently', async () => {
    const client = createClient();

    const result = await createService(client).downloadFiles([
      locationItem,
      { ...locationItem, fileId: 'p:1', mimeType: 'image/png' },
    ]);

    expect(client.downloadFile).toHaveBeenCalledTimes(2);
    expect(client.downloadFile.mock.calls[1][0]).toBeInstanceOf(Api.InputPhotoFileLocation);
    expect(result).toHaveLength(2);
    expect(result[1].mimeType).toBe('image/png');
  });

  it('refreshes expired file reference and retries downloadFile', async () => {
    const client = createClient();
    const expiredError = new Error(
      'The file reference of the media file at index 0 in the passed media array expired',
    );
    (expiredError as any).name = 'FileReferenceExpiredError';
    (expiredError as any).errorMessage = 'FILE_REFERENCE_0_EXPIRED';

    let called = 0;
    client.downloadFile.mockImplementation(async () => {
      called++;
      if (called === 1) {
        throw expiredError;
      }
      return Buffer.from('refreshed-bytes');
    });

    const refreshFileId = jest.fn().mockResolvedValue(true);
    const fakeFileRefEngine = { refreshFileId } as unknown as import('../file-ref/engine').FileRefEngine;

    const service = new FileService({
      transportService: { client, debug: false } as unknown as TransportService,
      localDb: {
        getFileRef: jest.fn(async () => undefined),
        resolveInputPeer: jest.fn(async (peerId: string) => ({ type: 'unavailable', peerId })),
      } as never,
      fileRefEngine: fakeFileRefEngine,
    });

    const result = await service.downloadFiles([
      {
        ...locationItem,
        peerId: '123',
        messageId: 456,
      },
    ]);

    expect(client.downloadFile).toHaveBeenCalledTimes(2);
    expect(refreshFileId).toHaveBeenCalledWith('d:99', {
      peerId: '123',
      messageId: 456,
    });
    expect(result).toHaveLength(1);
    expect(Buffer.from(result[0].arrayBuffer).toString()).toBe('refreshed-bytes');
  });
});

describe('FileService.downloadPeerPhotos', () => {
  const peerPhotoItem = {
    peerId: '1',
    photoId: '456',
    dcId: 2,
    mimeType: 'image/jpeg',
  };

  it('throws when the client is missing', async () => {
    await expect(createService(null).downloadPeerPhotos([peerPhotoItem])).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('throws when the peer cannot be resolved', async () => {
    const client = createClient();
    await expect(createService(client).downloadPeerPhotos([peerPhotoItem])).rejects.toThrow(
      'Failed to resolve peer 1',
    );
    expect(client.downloadFile).not.toHaveBeenCalled();
  });

  it('downloads via InputPeerPhotoFileLocation', async () => {
    const client = createClient();
    const resolveInputPeer = jest.fn(async () => ({
      type: 'user' as const,
      userId: '1',
      accessHash: '99',
    }));

    const result = await createService(client, { resolveInputPeer }).downloadPeerPhotos([
      peerPhotoItem,
    ]);

    expect(resolveInputPeer).toHaveBeenCalledWith('1');
    expect(client.downloadFile).toHaveBeenCalledTimes(1);
    const [location, opts] = client.downloadFile.mock.calls[0];
    expect(location).toBeInstanceOf(Api.InputPeerPhotoFileLocation);
    expect(location.photoId.toString()).toBe('456');
    expect(location.big).toBeUndefined();
    expect(location.peer).toBeInstanceOf(Api.InputPeerUser);
    expect(opts).toMatchObject({ dcId: 2 });
    expect(result).toHaveLength(1);
    expect(result[0].mimeType).toBe('image/jpeg');
    expect(result[0].fullSize).toBe(Buffer.from('full-file-bytes').byteLength);
    expect(Buffer.from(result[0].arrayBuffer).toString()).toBe('full-file-bytes');
  });

  it('sets big on the location when isBig is true', async () => {
    const client = createClient();
    const resolveInputPeer = jest.fn(async () => ({
      type: 'chat' as const,
      chatId: '-10',
    }));

    await createService(client, { resolveInputPeer }).downloadPeerPhotos([
      { peerId: '-10', photoId: '7', dcId: 1, isBig: true },
    ]);

    const [location] = client.downloadFile.mock.calls[0];
    expect(location).toBeInstanceOf(Api.InputPeerPhotoFileLocation);
    expect(location.big).toBe(true);
    expect(location.peer).toBeInstanceOf(Api.InputPeerChat);
  });
});

describe('FileService.getPart', () => {
  it('throws when the client is missing', async () => {
    await expect(
      createService(null).getPart({
        fileId: 'd:1',
        start: 0,
        end: 9,
        accessHash: '2',
        dcId: 2,
      }),
    ).rejects.toThrow('Client not initialized');
  });

  it('throws on an invalid fileId', async () => {
    const client = createClient();
    await expect(
      createService(client).getPart({
        fileId: 'bad',
        start: 0,
        end: 9,
        accessHash: '2',
        dcId: 2,
      }),
    ).rejects.toThrow('Invalid fileId');
  });

  it('downloads a byte range via iterDownload', async () => {
    const client = createClient();
    const result = await createService(client).getPart({
      fileId: 'd:99',
      start: 0,
      end: 4,
      accessHash: '7',
      dcId: 2,
      mimeType: 'video/mp4',
      fullSize: 100,
    });

    expect(client.iterDownload).toHaveBeenCalled();
    expect(result.mimeType).toBe('video/mp4');
    expect(result.fullSize).toBe(100);
    expect(Buffer.from(result.arrayBuffer).toString()).toBe('abcde');
  });
});
