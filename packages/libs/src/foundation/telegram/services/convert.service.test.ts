import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { ConversionService } from './convert.service';

const notifySettings = () => new Api.PeerNotifySettings({} as never);

const dialog = (channelId: number, topMessage: number) =>
  new Api.Dialog({
    peer: new Api.PeerChannel({ channelId: bigInt(channelId) }),
    topMessage,
    readInboxMaxId: 0,
    readOutboxMaxId: 0,
    unreadCount: 2,
    unreadMentionsCount: 0,
    unreadReactionsCount: 0,
    notifySettings: notifySettings(),
  } as never);

const dialogFolder = () =>
  new Api.DialogFolder({
    folder: new Api.Folder({ id: 1, title: 'Archive' } as never),
    peer: new Api.PeerUser({ userId: bigInt(7) }),
    topMessage: 3,
    unreadMutedPeersCount: 1,
    unreadUnmutedPeersCount: 2,
    unreadMutedMessagesCount: 3,
    unreadUnmutedMessagesCount: 4,
  } as never);

const message = (id: number, text = 'hello') =>
  new Api.Message({
    id,
    peerId: new Api.PeerChannel({ channelId: bigInt(9) }),
    message: text,
    date: 100,
  } as never);

describe('ConversionService.convertDialogResponse', () => {
  const service = new ConversionService();

  it('returns empty buckets when there are no dialogs', () => {
    const resp = new Api.messages.Dialogs({ dialogs: [], messages: [], chats: [], users: [] });

    expect(service.convertDialogResponse(resp)).toEqual({
      count: 0,
      users: [],
      dialogs: [],
      dialogFolders: [],
      chats: [],
      channels: [],
      forbiddenChats: [],
      forbiddenChannels: [],
      emptyChats: [],
      messages: [],
      emptyMessages: [],
      messageServices: [],
    });
  });

  it('counts the dialogs themselves for a non-sliced response', () => {
    const resp = new Api.messages.Dialogs({
      dialogs: [dialog(9, 1), dialogFolder()],
      messages: [],
      chats: [],
      users: [],
    });

    const result = service.convertDialogResponse(resp);

    expect(result.count).toBe(2);
    expect(result.dialogs).toHaveLength(1);
    expect(result.dialogFolders).toHaveLength(1);
    expect(result.dialogs[0]).toMatchObject({
      peer: { channelId: '-1000000000009' },
      topMessage: 1,
      unreadCount: 2,
    });
    expect(result.dialogFolders[0]).toMatchObject({
      folder: { id: 1, title: 'Archive' },
      peer: { userId: '7' },
      unreadMutedPeersCount: 1,
    });
  });

  it('uses the reported total for a sliced response', () => {
    const resp = new Api.messages.DialogsSlice({
      count: 350,
      dialogs: [dialog(9, 1)],
      messages: [],
      chats: [],
      users: [],
    });

    expect(service.convertDialogResponse(resp).count).toBe(350);
  });

  it('defaults a missing slice count to zero', () => {
    const resp = new Api.messages.DialogsSlice({
      dialogs: [dialog(9, 1)],
      messages: [],
      chats: [],
      users: [],
    } as never);

    expect(service.convertDialogResponse(resp).count).toBe(0);
  });

  it('splits chats, users and messages by concrete type', () => {
    const resp = new Api.messages.Dialogs({
      dialogs: [dialog(9, 1)],
      messages: [
        message(1),
        new Api.MessageEmpty({ id: 2 } as never),
        new Api.MessageService({
          id: 3,
          peerId: new Api.PeerChannel({ channelId: bigInt(9) }),
          date: 100,
          action: new Api.MessageActionChatCreate({ title: 'New', users: [] }),
        } as never),
      ],
      chats: [
        new Api.Chat({
          id: bigInt(5),
          title: 'Group',
          participantsCount: 1,
          date: 1,
          version: 1,
        } as never),
        new Api.Channel({ id: bigInt(9), accessHash: bigInt(1), title: 'News' } as never),
        new Api.ChatForbidden({ id: bigInt(6), title: 'Hidden' }),
        new Api.ChannelForbidden({ id: bigInt(7), title: 'Hidden' } as never),
        new Api.ChatEmpty({ id: bigInt(8) }),
      ],
      users: [
        new Api.User({ id: bigInt(42), accessHash: bigInt(2), firstName: 'Ada' } as never),
        new Api.UserEmpty({ id: bigInt(43) }),
      ],
    });

    const result = service.convertDialogResponse(resp);

    expect(result.chats).toHaveLength(1);
    expect(result.channels).toHaveLength(1);
    expect(result.forbiddenChats).toHaveLength(1);
    expect(result.forbiddenChannels).toHaveLength(1);
    expect(result.emptyChats).toHaveLength(1);
    expect(result.messages).toHaveLength(1);
    expect(result.emptyMessages).toHaveLength(1);
    expect(result.messageServices).toHaveLength(1);
    expect(result.users.map((user) => user.id)).toEqual(['42', '43']);
  });
});

describe('ConversionService logging', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts without a client', () => {
    expect(new ConversionService().client).toBeNull();
  });

  it('prefixes debug output and stays silent otherwise', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});

    (
      new ConversionService({ debug: true }) as never as { log: (...args: unknown[]) => void }
    ).log('hello');
    expect(info).toHaveBeenCalledWith('[ConversionService]', 'hello');

    info.mockClear();
    (new ConversionService() as never as { log: (...args: unknown[]) => void }).log('hello');
    expect(info).not.toHaveBeenCalled();
  });
});
