import { Message } from '../entity/models/message.model';
import { buildFlatMessageItems } from './message-grouper';

function makeMsg(params: {
  id: string;
  date: number;
  message?: string;
  groupedId?: string;
  isPhoto?: boolean;
  isVideo?: boolean;
  isDocument?: boolean;
  fileName?: string;
  out?: boolean;
  fromId?: string;
  peerId?: string;
}): Message {
  return new Message({
    kind: 'message',
    isEmpty: false,
    id: params.id,
    date: params.date,
    message: params.message ?? '',
    groupedId: params.groupedId,
    out: params.out ?? false,
    fromId: params.fromId ?? 'user-1',
    peerId: params.peerId ?? 'chat-1',
    peerType: 'group',
    media: params.isPhoto
      ? {
          photo: {
            id: `photo-${params.id}`,
            accessHash: '123',
            fileReference: '',
            date: params.date,
            sizes: [{ type: 'y', w: 800, h: 600, size: 40000 }],
            dcId: 2,
          },
        }
      : params.isVideo
        ? {
            document: {
              id: `video-${params.id}`,
              accessHash: '456',
              fileReference: '',
              date: params.date,
              mimeType: 'video/mp4',
              size: '5000000',
              dcId: 2,
              attributes: [{ w: 1280, h: 720, duration: 12, roundMessage: false }],
            },
          }
        : params.isDocument
          ? {
              document: {
                id: `doc-${params.id}`,
                accessHash: '789',
                fileReference: '',
                date: params.date,
                mimeType: 'application/x-sh',
                size: '27000',
                dcId: 2,
                attributes: [{ fileName: params.fileName ?? `file-${params.id}.sh` }],
              },
            }
          : undefined,
  });
}

describe('message-grouper with albums', () => {
  it('aggregates consecutive media messages with same groupedId into a single album item', () => {
    const messages = [
      makeMsg({ id: '1', date: 1000, message: 'hello' }),
      makeMsg({ id: '2', date: 1001, groupedId: 'album-99', isPhoto: true }),
      makeMsg({
        id: '3',
        date: 1002,
        groupedId: 'album-99',
        isPhoto: true,
        message: 'album caption',
      }),
      makeMsg({ id: '4', date: 1003, groupedId: 'album-99', isVideo: true }),
      makeMsg({ id: '5', date: 1004, message: 'after album' }),
    ];

    const flatItems = buildFlatMessageItems(messages, false);
    // [date, msg-1, album-album-99, msg-5]
    expect(flatItems.map((item) => item.kind)).toEqual(['date', 'message', 'album', 'message']);

    const albumItem = flatItems.find((item) => item.kind === 'album');
    expect(albumItem).toBeDefined();
    if (albumItem && albumItem.kind === 'album') {
      expect(albumItem.album.albumId).toBe('album-99');
      expect(albumItem.album.albumType).toBe('media');
      expect(albumItem.album.messages).toHaveLength(3);
      expect(albumItem.album.captionMessage?.message).toBe('album caption');
      expect(albumItem.album.hasMultipleCaptions).toBe(false);
      expect(albumItem.message.id).toBe('2');
    }
  });

  it('aggregates consecutive document messages with same groupedId into a stack file group', () => {
    const messages = [
      makeMsg({ id: '1', date: 1000, message: 'before files' }),
      makeMsg({
        id: '2',
        date: 1001,
        groupedId: 'file-group-1',
        isDocument: true,
        fileName: 'metacomp-prod-test.sh',
      }),
      makeMsg({
        id: '3',
        date: 1002,
        groupedId: 'file-group-1',
        isDocument: true,
        fileName: 'test.sh',
        message: 'stack files, not album',
      }),
      makeMsg({ id: '4', date: 1003, message: 'after files' }),
    ];

    const flatItems = buildFlatMessageItems(messages, false);
    expect(flatItems.map((item) => item.kind)).toEqual(['date', 'message', 'album', 'message']);

    const fileGroupItem = flatItems.find((item) => item.kind === 'album');
    expect(fileGroupItem).toBeDefined();
    if (fileGroupItem && fileGroupItem.kind === 'album') {
      expect(fileGroupItem.album.albumId).toBe('file-group-1');
      expect(fileGroupItem.album.albumType).toBe('files');
      expect(fileGroupItem.album.messages).toHaveLength(2);
      expect(fileGroupItem.album.captionMessage?.message).toBe('stack files, not album');
      expect(fileGroupItem.album.hasMultipleCaptions).toBe(false);
      expect(fileGroupItem.message.id).toBe('2');
    }
  });

  it('keeps distinct groupedIds separate', () => {
    const messages = [
      makeMsg({ id: '1', date: 1000, groupedId: 'album-A', isPhoto: true }),
      makeMsg({ id: '2', date: 1001, groupedId: 'album-A', isPhoto: true }),
      makeMsg({ id: '3', date: 1002, groupedId: 'album-B', isPhoto: true }),
      makeMsg({ id: '4', date: 1003, groupedId: 'album-B', isPhoto: true }),
    ];

    const flatItems = buildFlatMessageItems(messages, false);
    expect(flatItems.map((item) => item.kind)).toEqual(['date', 'album', 'album']);
  });
});

describe('buildFlatMessageItems unread divider', () => {
  it('inserts divider before the target message', () => {
    const messages = [
      makeMsg({ id: '1', date: 1000, message: 'read' }),
      makeMsg({ id: '2', date: 1001, message: 'unread' }),
      makeMsg({ id: '3', date: 1002, message: 'also unread' }),
    ];

    const flatItems = buildFlatMessageItems(messages, false, { unreadDividerBeforeId: '2' });

    expect(flatItems.map((item) => item.kind)).toEqual([
      'date',
      'message',
      'unread-divider',
      'message',
      'message',
    ]);
  });

  it('inserts divider before album when target is album main id', () => {
    const messages = [
      makeMsg({ id: '1', date: 1000, message: 'read' }),
      makeMsg({ id: '2', date: 1001, groupedId: 'album-1', isPhoto: true }),
      makeMsg({ id: '3', date: 1002, groupedId: 'album-1', isPhoto: true }),
    ];

    const flatItems = buildFlatMessageItems(messages, false, { unreadDividerBeforeId: '2' });

    expect(flatItems.map((item) => item.kind)).toEqual([
      'date',
      'message',
      'unread-divider',
      'album',
    ]);
  });

  it('omits divider when id is missing or undefined', () => {
    const messages = [makeMsg({ id: '1', date: 1000, message: 'only' })];

    expect(buildFlatMessageItems(messages, false).map((item) => item.kind)).toEqual([
      'date',
      'message',
    ]);
    expect(
      buildFlatMessageItems(messages, false, { unreadDividerBeforeId: '99' }).map(
        (item) => item.kind,
      ),
    ).toEqual(['date', 'message']);
  });
});
