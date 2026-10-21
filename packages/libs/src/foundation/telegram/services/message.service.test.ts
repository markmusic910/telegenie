// A real uuid contains dashes, which `bigint(uuid, 36)` cannot parse.
jest.mock('uuid', () => ({ v4: () => 'abcdef0123456789' }));

import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { FileService } from './file.service';
import {
  MessageService,
  messageRandomId,
  resolveHistoryRequestParams,
} from './message.service';
import type { TransportService } from './transport.service';

type FakeClient = {
  invoke: jest.Mock;
  uploadFile: jest.Mock;
};

function createClient(): FakeClient {
  return {
    invoke: jest.fn(),
    uploadFile: jest.fn().mockImplementation(async ({ onProgress }) => {
      onProgress?.(1);
      return new Api.InputFile({ id: bigInt(1), parts: 1, name: 'a.png', md5Checksum: '' });
    }),
  };
}

function createService(
  client: FakeClient | null,
  localDb?: Record<string, jest.Mock>,
  onMessageViews?: (peerId: string, patches: { id: number; views?: number; forwards?: number }[]) => void,
): MessageService {
  const transportService = { client, debug: false } as unknown as TransportService;
  return new MessageService({
    transportService,
    fileService: new FileService({
      transportService,
      localDb: { getFileRef: jest.fn(async () => undefined) } as never,
    }),
    localDb: localDb as never,
    onMessageViews,
  });
}

const CHAT_ID = '-1000000000009';
const USER_ID = '7';
const EMPTY_BY_IDS = { messages: [], messageServices: [], emptyMessages: [] };
const EMPTY_LOAD_HISTORY = {
  messages: [],
  messageServices: [],
  users: [],
  chats: [],
  channels: [],
  emptyMessages: [],
};

const message = (id: number, text = 'hello') =>
  new Api.Message({
    id,
    peerId: new Api.PeerChannel({ channelId: bigInt(9) }),
    message: text,
    date: 1_700_000_000,
  } as never);

const supergroupChannel = () =>
  new Api.Channel({
    id: bigInt(9),
    accessHash: bigInt(123),
    title: 'Test supergroup',
    megagroup: true,
  } as never);

const asFile = (type: string, name = 'file') => ({ type, name }) as unknown as File;

describe('MessageService.getMessages', () => {
  it('throws when the client is missing', async () => {
    await expect(createService(null).getMessages(CHAT_ID)).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('returns an empty page for MessagesNotModified', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(new Api.messages.MessagesNotModified({ count: 3 }));

    await expect(createService(client).getMessages(CHAT_ID)).resolves.toEqual([[], 0]);
  });

  it('returns an empty page for an empty response', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(undefined);

    await expect(createService(client).getMessages(CHAT_ID)).resolves.toEqual([[], 0]);
  });

  it('falls back to the message count when the response has none', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.messages.Messages({ messages: [message(1), message(2)], topics: [], chats: [], users: [] }),
    );

    const [messages, count] = await createService(client).getMessages(CHAT_ID);

    expect(messages.map((item) => item.id)).toEqual([1, 2]);
    expect(count).toBe(2);
    expect(client.invoke.mock.calls[0][0]).toBeInstanceOf(Api.messages.GetHistory);
  });

  it('uses the reported total for sliced responses', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.messages.ChannelMessages({
        pts: 1,
        count: 250,
        messages: [message(1)],
        topics: [],
        chats: [],
        users: [],
      } as never),
    );

    const [messages, count] = await createService(client).getMessages(CHAT_ID);

    expect(messages).toHaveLength(1);
    expect(count).toBe(250);
  });

  it('skips MessageEmpty rows instead of throwing Invalid peer', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.messages.Messages({
        messages: [new Api.MessageEmpty({ id: 1 }), message(2)],
        topics: [],
        chats: [],
        users: [],
      }),
    );

    const [messages, count] = await createService(client).getMessages(CHAT_ID);

    expect(messages.map((item) => item.id)).toEqual([2]);
    expect(count).toBe(2);
  });
});

describe('MessageService.getMessagesByIds', () => {
  it('throws when the client is missing', async () => {
    await expect(createService(null).getMessagesByIds(USER_ID, [1])).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('returns an empty list for MessagesNotModified', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(new Api.messages.MessagesNotModified({ count: 0 }));

    await expect(createService(client).getMessagesByIds(USER_ID, [1])).resolves.toEqual(
      EMPTY_BY_IDS,
    );
  });

  it('returns an empty list for an empty response', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(null);

    await expect(createService(client).getMessagesByIds(USER_ID, [1])).resolves.toEqual(
      EMPTY_BY_IDS,
    );
  });

  it('returns empty without invoking when no ids are given', async () => {
    const client = createClient();

    await expect(createService(client).getMessagesByIds(USER_ID, [])).resolves.toEqual(
      EMPTY_BY_IDS,
    );
    expect(client.invoke).not.toHaveBeenCalled();
  });

  it('skips MessageEmpty rows instead of throwing Invalid peer', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.messages.Messages({
        messages: [new Api.MessageEmpty({ id: 18930 }), message(7, 'seven')],
        topics: [],
        chats: [],
        users: [],
      }),
    );

    const result = await createService(client).getMessagesByIds(USER_ID, [18930, 7]);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toMatchObject({ id: 7, message: 'seven' });
    expect(result.messageServices).toEqual([]);
    expect(result.emptyMessages).toEqual([{ id: 18930, peerId: undefined }]);
    expect(client.invoke.mock.calls[0][0]).toBeInstanceOf(Api.messages.GetMessages);
  });

  it('extends coverage ranges from the requested ids including empties', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.messages.Messages({
        messages: [new Api.MessageEmpty({ id: 18930 }), message(7, 'seven')],
        topics: [],
        chats: [],
        users: [],
      }),
    );
    const localDb = {
      extendRangesFromFetchedIds: jest.fn(),
    };

    await createService(client, localDb).getMessagesByIds(USER_ID, [18930, 7]);

    expect(localDb.extendRangesFromFetchedIds).toHaveBeenCalledWith('common', [18930, 7]);
  });

  it('returns service messages separately', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.messages.Messages({
        messages: [
          new Api.MessageService({
            id: 3,
            peerId: new Api.PeerUser({ userId: bigInt(7) }),
            date: 1,
            action: new Api.MessageActionPinMessage(),
          } as never),
        ],
        topics: [],
        chats: [],
        users: [],
      }),
    );

    const result = await createService(client).getMessagesByIds(USER_ID, [3]);

    expect(result.messages).toEqual([]);
    expect(result.messageServices).toHaveLength(1);
    expect(result.messageServices[0].id).toBe(3);
  });

  it('uses channels.getMessages for a channel peer', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.messages.Messages({ messages: [message(7, 'seven')], topics: [], chats: [], users: [] }),
    );
    const localDb = {
      resolveInputPeer: jest.fn().mockResolvedValue({
        type: 'channel',
        channelId: CHAT_ID,
        accessHash: '1',
      }),
    };

    const result = await createService(client, localDb).getMessagesByIds(CHAT_ID, [7]);

    expect(result.messages).toHaveLength(1);
    const request = client.invoke.mock.calls[0][0];
    expect(request).toBeInstanceOf(Api.channels.GetMessages);
  });

  it('does not call Telegram when a channel cannot be resolved', async () => {
    const client = createClient();
    const localDb = {
      resolveInputPeer: jest.fn().mockResolvedValue({ type: 'unavailable', peerId: CHAT_ID }),
    };

    await expect(createService(client, localDb).getMessagesByIds(CHAT_ID, [7])).resolves.toEqual(
      EMPTY_BY_IDS,
    );
    expect(client.invoke).not.toHaveBeenCalled();
  });

  it('returns empty when channels.getMessages reports MESSAGE_IDS_EMPTY', async () => {
    const client = createClient();
    client.invoke.mockRejectedValue({ errorMessage: 'MESSAGE_IDS_EMPTY' });
    const localDb = {
      resolveInputPeer: jest.fn().mockResolvedValue({
        type: 'channel',
        channelId: CHAT_ID,
        accessHash: '1',
      }),
    };

    await expect(createService(client, localDb).getMessagesByIds(CHAT_ID, [7])).resolves.toEqual(
      EMPTY_BY_IDS,
    );
  });
});

describe('resolveHistoryRequestParams', () => {
  it('maps around direction', () => {
    expect(resolveHistoryRequestParams('around', 100, 50)).toEqual({
      offsetId: 100,
      addOffset: -26,
      sliceSize: 50,
    });
  });

  it('maps backwards direction with offset', () => {
    expect(resolveHistoryRequestParams('backwards', 10, 50)).toEqual({
      offsetId: 10,
      addOffset: -1,
      sliceSize: 51,
    });
  });

  it('maps forwards direction with offset', () => {
    expect(resolveHistoryRequestParams('forwards', 200, 50)).toEqual({
      offsetId: 200,
      addOffset: -51,
      sliceSize: 51,
    });
  });

  it('clamps sliceSize to the getHistory max of 100', () => {
    expect(resolveHistoryRequestParams('backwards', 10, 100)).toEqual({
      offsetId: 10,
      addOffset: -1,
      sliceSize: 100,
    });
    expect(resolveHistoryRequestParams('forwards', 200, 100).sliceSize).toBe(100);
  });
});

describe('MessageService.loadHistory', () => {
  it('throws when the client is missing', async () => {
    await expect(
      createService(null).loadHistory(CHAT_ID, { direction: 'around' }),
    ).rejects.toThrow('Client not initialized');
  });

  it('returns an empty page for MessagesNotModified', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(new Api.messages.MessagesNotModified({ count: 0 }));

    await expect(
      createService(client).loadHistory(CHAT_ID, { direction: 'backwards', offsetId: 5 }),
    ).resolves.toEqual(EMPTY_LOAD_HISTORY);
  });

  it('returns an empty page for an empty response', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(undefined);

    await expect(
      createService(client).loadHistory(CHAT_ID, { direction: 'around' }),
    ).resolves.toEqual(EMPTY_LOAD_HISTORY);
  });

  it('passes offset params for backwards history', async () => {
    const client = createClient();
    client.invoke.mockResolvedValueOnce(
      new Api.messages.Messages({
        messages: [message(3)],
        topics: [],
        chats: [supergroupChannel()],
        users: [],
      }),
    );

    const result = await createService(client).loadHistory(CHAT_ID, {
      direction: 'backwards',
      offsetId: 10,
      limit: 50,
    });

    expect(result.messages.map((item) => item.id)).toEqual([3]);
    const request = client.invoke.mock.calls[0][0] as Api.messages.GetHistory;
    expect(request).toBeInstanceOf(Api.messages.GetHistory);
    expect(request.offsetId).toBe(10);
    expect(request.addOffset).toBe(-1);
    expect(request.limit).toBe(51);
  });

  it('returns service messages separately from regular messages', async () => {
    const client = createClient();
    client.invoke
      .mockResolvedValueOnce(
        new Api.messages.Messages({
          messages: [
            new Api.MessageService({
              id: 3,
              peerId: new Api.PeerChat({ chatId: bigInt(1) }),
              fromId: new Api.PeerUser({ userId: bigInt(42) }),
              date: 1,
              action: new Api.MessageActionChatJoinedByLink({ inviterId: bigInt(99) }),
            } as never),
            message(4, 'hello'),
          ],
          topics: [],
          chats: [supergroupChannel()],
          users: [
            new Api.User({
              id: bigInt(42),
              firstName: 'Daniel',
              lastName: 'Mike',
            } as never),
          ],
        }),
      );

    const result = await createService(client).loadHistory(CHAT_ID, { direction: 'around' });

    expect(result.messages.map((item) => item.id)).toEqual([4]);
    expect(result.messageServices).toHaveLength(1);
    expect(result.messageServices[0]).toMatchObject({ id: 3 });
    expect(result.users).toHaveLength(1);
    expect(result.users[0]).toMatchObject({ id: '42', firstName: 'Daniel', lastName: 'Mike' });
  });

  it('tolerates getMessagesViews responses without a views array', async () => {
    const client = createClient();
    client.invoke
      .mockResolvedValueOnce(
        new Api.messages.Messages({
          messages: [message(4, 'hello')],
          topics: [],
          chats: [supergroupChannel()],
          users: [],
        }),
      )
      .mockResolvedValueOnce(
        new Api.messages.MessageViews({ views: undefined as never, chats: [], users: [] }),
      );

    const result = await createService(client).loadHistory(CHAT_ID, { direction: 'around' });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toMatchObject({ id: 4, message: 'hello' });
  });

  it('does not wait for getMessagesViews before returning history', async () => {
    const client = createClient();
    client.invoke.mockImplementation(async (request: unknown) => {
      if (request instanceof Api.messages.GetHistory) {
        return new Api.messages.Messages({
          messages: [message(4, 'hello')],
          topics: [],
          chats: [supergroupChannel()],
          users: [],
        });
      }
      if (request instanceof Api.messages.GetMessagesViews) {
        return new Promise(() => undefined);
      }
      return undefined;
    });

    const result = await createService(client).loadHistory(CHAT_ID, { direction: 'around' });

    expect(result.messages[0]).toMatchObject({ id: 4, message: 'hello' });
    expect(
      client.invoke.mock.calls.some(([request]) => request instanceof Api.messages.GetMessagesViews),
    ).toBe(false);
  });

  it('debounces getMessagesViews while history loads rapidly', async () => {
    jest.useFakeTimers();
    try {
      const client = createClient();
      const onMessageViews = jest.fn();
      client.invoke.mockImplementation(async (request: unknown) => {
        if (request instanceof Api.messages.GetHistory) {
          const offsetId = request.offsetId ?? 4;
          return new Api.messages.Messages({
            messages: [message(offsetId, `m${offsetId}`)],
            topics: [],
            chats: [supergroupChannel()],
            users: [],
          });
        }
        if (request instanceof Api.messages.GetMessagesViews) {
          return new Api.messages.MessageViews({
            views: request.id.map((id) => new Api.MessageViews({ views: id })),
            chats: [],
            users: [],
          });
        }
        return undefined;
      });

      const service = createService(client, undefined, onMessageViews);
      const [firstResult, secondResult] = await Promise.all([
        service.loadHistory(CHAT_ID, { direction: 'around', offsetId: 4 }),
        service.loadHistory(CHAT_ID, { direction: 'around', offsetId: 8 }),
      ]);

      expect(firstResult.messages[0]).toMatchObject({ id: 4, views: undefined });
      expect(secondResult.messages[0]).toMatchObject({ id: 8, views: undefined });

      await jest.runAllTimersAsync();

      const viewsCalls = client.invoke.mock.calls.filter(
        ([request]) => request instanceof Api.messages.GetMessagesViews,
      );
      expect(viewsCalls).toHaveLength(1);
      expect((viewsCalls[0][0] as Api.messages.GetMessagesViews).id).toEqual([4, 8]);
      expect(onMessageViews).toHaveBeenCalledWith(CHAT_ID, [
        { id: 4, views: 4 },
        { id: 8, views: 8 },
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('extends a channel range span from the fetched history page', async () => {
    const client = createClient();
    client.invoke.mockResolvedValueOnce(
      new Api.messages.Messages({
        messages: [message(25, 'a'), message(75, 'b')],
        topics: [],
        chats: [supergroupChannel()],
        users: [],
      }),
    );
    const localDb = {
      putUsers: jest.fn(),
      putChats: jest.fn(),
      putChannels: jest.fn(),
      extendRangesFromSpan: jest.fn(),
    };

    await createService(client, localDb).loadHistory(CHAT_ID, {
      direction: 'around',
      offsetId: 50,
    });

    expect(localDb.extendRangesFromSpan).toHaveBeenCalledWith(CHAT_ID, 25, 75);
  });
});

describe('MessageService.markMessageListRead', () => {
  it('throws when the client is missing', async () => {
    await expect(createService(null).markMessageListRead(USER_ID, 5)).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('calls messages.readHistory for a user peer', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(new Api.messages.AffectedMessages({ pts: 1, ptsCount: 1 }));
    const localDb = {
      resolveInputPeer: jest.fn().mockResolvedValue({
        type: 'user',
        userId: USER_ID,
        accessHash: '1',
      }),
    };

    await createService(client, localDb).markMessageListRead(USER_ID, 42);

    const request = client.invoke.mock.calls[0][0];
    expect(request).toBeInstanceOf(Api.messages.ReadHistory);
    expect((request as Api.messages.ReadHistory).maxId).toBe(42);
  });

  it('calls channels.readHistory for a channel peer', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(true);
    const localDb = {
      resolveInputPeer: jest.fn().mockResolvedValue({
        type: 'channel',
        channelId: CHAT_ID,
        accessHash: '1',
      }),
    };

    await createService(client, localDb).markMessageListRead(CHAT_ID, 99);

    const request = client.invoke.mock.calls[0][0];
    expect(request).toBeInstanceOf(Api.channels.ReadHistory);
    expect((request as Api.channels.ReadHistory).maxId).toBe(99);
  });
});

describe('MessageService.markMentionsRead', () => {
  it('throws when the client is missing', async () => {
    await expect(createService(null).markMentionsRead(USER_ID, [1])).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('calls messages.readMessageContents for a user peer', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(new Api.messages.AffectedMessages({ pts: 1, ptsCount: 1 }));
    await createService(client).markMentionsRead(USER_ID, [10, 11]);

    const request = client.invoke.mock.calls[0][0];
    expect(request).toBeInstanceOf(Api.messages.ReadMessageContents);
    expect((request as Api.messages.ReadMessageContents).id).toEqual([10, 11]);
  });

  it('calls channels.readMessageContents for a channel peer', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(true);
    const localDb = {
      resolveInputPeer: jest.fn().mockResolvedValue({
        type: 'channel',
        channelId: CHAT_ID,
        accessHash: '1',
      }),
    };

    await createService(client, localDb).markMentionsRead(CHAT_ID, [5]);

    const request = client.invoke.mock.calls[0][0];
    expect(request).toBeInstanceOf(Api.channels.ReadMessageContents);
  });
});

describe('MessageService.getUnreadMentions', () => {
  it('returns message ids from the response', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.messages.Messages({
        messages: [
          new Api.Message({
            id: 15,
            peerId: new Api.PeerUser({ userId: bigInt(USER_ID) }),
            date: 1,
            message: '@you',
            mentioned: true,
            mediaUnread: true,
          }),
        ],
        topics: [],
        chats: [],
        users: [],
      }),
    );
    const localDb = {
      resolveInputPeer: jest.fn().mockResolvedValue({
        type: 'user',
        userId: USER_ID,
        accessHash: '1',
      }),
    };

    const result = await createService(client, localDb).getUnreadMentions(USER_ID);
    expect(result.messageIds).toEqual(['15']);
  });
});

describe('MessageService.readAllMentions', () => {
  it('recurses while affected history reports an offset', async () => {
    const client = createClient();
    client.invoke
      .mockResolvedValueOnce(new Api.messages.AffectedHistory({ pts: 1, ptsCount: 1, offset: 9 }))
      .mockResolvedValueOnce(new Api.messages.AffectedHistory({ pts: 2, ptsCount: 1, offset: 0 }));
    const localDb = {
      resolveInputPeer: jest.fn().mockResolvedValue({
        type: 'user',
        userId: USER_ID,
        accessHash: '1',
      }),
    };

    await createService(client, localDb).readAllMentions(USER_ID);
    expect(client.invoke).toHaveBeenCalledTimes(2);
  });
});

describe('messageRandomId', () => {
  it('parses a dashed uuid into a positive int64-sized id', () => {
    const id = messageRandomId('550e8400-e29b-41d4-a716-446655440000');
    expect(id.greater(0)).toBe(true);
    expect(id.bitLength().lesserOrEquals(60)).toBe(true);
  });
});

describe('MessageService.sendMessage', () => {
  const peer = new Api.InputPeerChannel({ channelId: bigInt(9), accessHash: bigInt(1) });

  it('throws when the client is missing', async () => {
    await expect(createService(null).sendMessage(peer, 'hi')).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('rebuilds the outgoing message from UpdateShortSentMessage', async () => {
    const client = createClient();
    const process = jest.fn().mockResolvedValue(undefined);
    client.invoke.mockResolvedValue(
      new Api.UpdateShortSentMessage({ id: 55, pts: 1, ptsCount: 1, date: 1, out: true }),
    );
    const service = new MessageService({
      transportService: { client, debug: false } as unknown as TransportService,
      fileService: new FileService({
        transportService: { client, debug: false } as unknown as TransportService,
        localDb: { getFileRef: jest.fn(async () => undefined) } as never,
      }),
      updateManager: { process } as never,
    });
    const peer = new Api.InputPeerUser({ userId: bigInt(7), accessHash: bigInt(1) });

    await expect(service.sendMessage(peer, 'hello', undefined, 12)).resolves.toBe(55);
    const update = process.mock.calls[0][0] as Api.UpdateNewMessage;
    expect(update).toBeInstanceOf(Api.UpdateNewMessage);
    expect(update.message).toBeInstanceOf(Api.Message);
    expect((update.message as Api.Message).message).toBe('hello');
    const replyTo = (update.message as Api.Message).replyTo;
    expect(replyTo).toBeInstanceOf(Api.MessageReplyHeader);
    expect((replyTo as Api.MessageReplyHeader).replyToMsgId).toBe(12);
    expect(process.mock.calls[0][1]).toBe('rpc');
  });

  it('reads the id from UpdateShortSentMessage', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.UpdateShortSentMessage({ id: 55, pts: 1, ptsCount: 1, date: 1 } as never),
    );

    await expect(createService(client).sendMessage(peer, 'hi')).resolves.toBe(55);
    const request = client.invoke.mock.calls[0][0] as Api.messages.SendMessage;
    expect(request).toBeInstanceOf(Api.messages.SendMessage);
    expect(request.replyTo).toBeUndefined();
    expect(request.clearDraft).toBe(true);
  });

  it('includes replyTo when a reply id is set', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.UpdateShortSentMessage({ id: 56, pts: 1, ptsCount: 1, date: 1 } as never),
    );

    await expect(createService(client).sendMessage(peer, 'hi', undefined, 12)).resolves.toBe(56);
    const request = client.invoke.mock.calls[0][0] as Api.messages.SendMessage;
    expect(request.replyTo).toBeInstanceOf(Api.InputReplyToMessage);
    expect((request.replyTo as Api.InputReplyToMessage).replyToMsgId).toBe(12);
  });

  it('attaches a custom emoji entity', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.UpdateShortSentMessage({ id: 57, pts: 1, ptsCount: 1, date: 1 } as never),
    );

    await expect(
      createService(client).sendMessage(peer, '😁', undefined, undefined, [
        { offset: 0, length: 2, documentId: '99' },
      ]),
    ).resolves.toBe(57);
    const request = client.invoke.mock.calls[0][0] as Api.messages.SendMessage;
    const entity = request.entities?.[0];
    expect(entity).toBeInstanceOf(Api.MessageEntityCustomEmoji);
    expect(String((entity as Api.MessageEntityCustomEmoji).documentId)).toBe('99');
    expect((entity as Api.MessageEntityCustomEmoji).length).toBe(2);
  });

  it('reads the id from UpdateNewMessage when UpdateMessageID is absent', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.Updates({
        updates: [
          new Api.UpdateNewMessage({
            message: new Api.Message({
              id: 88,
              peerId: new Api.PeerChannel({ channelId: bigInt(9) }),
              date: 1,
              message: 'hi',
            }),
            pts: 1,
            ptsCount: 1,
          }),
        ],
        users: [],
        chats: [],
        date: 1,
        seq: 1,
      }),
    );

    await expect(createService(client).sendMessage(peer, 'hi')).resolves.toBe(88);
  });

  it('reads the id from an UpdateMessageID inside an Updates envelope', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.Updates({
        updates: [
          new Api.UpdateUserTyping({
            userId: bigInt(1),
            action: new Api.SendMessageTypingAction(),
          }),
          new Api.UpdateMessageID({ id: 77, randomId: bigInt(1) }),
        ],
        users: [],
        chats: [],
        date: 1,
        seq: 1,
      }),
    );

    await expect(createService(client).sendMessage(peer, 'hi', 1_700_000_000)).resolves.toBe(77);
  });

  it('returns -1 when an Updates envelope carries no message id', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.Updates({ updates: [], users: [], chats: [], date: 1, seq: 1 }),
    );

    await expect(createService(client).sendMessage(peer, 'hi')).resolves.toBe(-1);
  });

  it('returns -1 for unrecognised responses', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(new Api.UpdatesTooLong());

    await expect(createService(client).sendMessage(peer, 'hi')).resolves.toBe(-1);
  });
});

describe('MessageService.sendSticker', () => {
  const peer = new Api.InputPeerUser({ userId: bigInt(7), accessHash: bigInt(1) });
  const document = {
    id: '7',
    accessHash: '8',
    fileReference: Buffer.from('ab').toString('base64'),
    setId: '10',
    setAccessHash: '20',
  };
  const sent = () =>
    new Api.UpdateShortSentMessage({ id: 55, pts: 1, ptsCount: 1, date: 1 } as never);
  const expired = () => Object.assign(new Error('expired'), { errorMessage: 'FILE_REFERENCE_EXPIRED' });

  it('sends InputMediaDocument with the decoded file reference and optional reply', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(sent());

    await expect(createService(client).sendSticker(peer, document, 12)).resolves.toBe(55);
    const request = client.invoke.mock.calls[0][0] as Api.messages.SendMedia;
    expect(request).toBeInstanceOf(Api.messages.SendMedia);
    expect(request.message).toBe('');
    expect(request.clearDraft).toBe(true);
    expect(request.replyTo).toBeInstanceOf(Api.InputReplyToMessage);
    expect((request.replyTo as Api.InputReplyToMessage).replyToMsgId).toBe(12);
    const media = request.media as Api.InputMediaDocument;
    expect(media).toBeInstanceOf(Api.InputMediaDocument);
    const input = media.id as Api.InputDocument;
    expect(input).toBeInstanceOf(Api.InputDocument);
    expect(String(input.id)).toBe('7');
    expect(Buffer.from(input.fileReference).toString()).toBe('ab');
  });

  it('reloads the file reference once and retries', async () => {
    const client = createClient();
    client.invoke.mockRejectedValueOnce(expired()).mockResolvedValueOnce(sent());
    const reload = jest.fn().mockResolvedValue(Buffer.from('cd').toString('base64'));

    await expect(createService(client).sendSticker(peer, document, undefined, reload)).resolves.toBe(55);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(client.invoke).toHaveBeenCalledTimes(2);
    const retry = client.invoke.mock.calls[1][0] as Api.messages.SendMedia;
    const input = (retry.media as Api.InputMediaDocument).id as Api.InputDocument;
    expect(Buffer.from(input.fileReference).toString()).toBe('cd');
  });

  it('does not reload a saved GIF that has no sticker set', async () => {
    const client = createClient();
    client.invoke.mockRejectedValue(expired());
    const { setId: _setId, setAccessHash: _setAccessHash, ...gif } = document;

    await expect(createService(client).sendSticker(peer, gif)).rejects.toMatchObject({
      errorMessage: 'FILE_REFERENCE_EXPIRED',
    });
    expect(client.invoke).toHaveBeenCalledTimes(1);
  });
});

describe('MessageService.sendGifResult', () => {
  const peer = new Api.InputPeerUser({ userId: bigInt(7), accessHash: bigInt(1) });

  it('sends the inline result id and optional reply', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.UpdateShortSentMessage({ id: 9, pts: 1, ptsCount: 1, date: 1 } as never),
    );

    await expect(createService(client).sendGifResult(peer, '99', 'hit', 4)).resolves.toBe(9);
    const request = client.invoke.mock.calls[0][0] as Api.messages.SendInlineBotResult;
    expect(request).toBeInstanceOf(Api.messages.SendInlineBotResult);
    expect(String(request.queryId)).toBe('99');
    expect(request.id).toBe('hit');
    expect(request.clearDraft).toBe(true);
    expect((request.replyTo as Api.InputReplyToMessage).replyToMsgId).toBe(4);
  });
});

describe('MessageService.saveDraft', () => {
  const peer = new Api.InputPeerUser({ userId: bigInt(7), accessHash: bigInt(1) });

  it('throws when the client is missing', async () => {
    await expect(createService(null).saveDraft(peer, 'hi')).rejects.toThrow('Client not initialized');
  });

  it('saves the draft text and reply', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(true);

    await createService(client).saveDraft(peer, 'tomorrow', 12);
    const request = client.invoke.mock.calls[0][0] as Api.messages.SaveDraft;
    expect(request).toBeInstanceOf(Api.messages.SaveDraft);
    expect(request.message).toBe('tomorrow');
    expect(request.replyTo).toBeInstanceOf(Api.InputReplyToMessage);
    expect((request.replyTo as Api.InputReplyToMessage).replyToMsgId).toBe(12);
  });

  it('saves a custom emoji entity with the draft', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(true);

    await createService(client).saveDraft(peer, '😁', undefined, [
      { offset: 0, length: 2, documentId: '99' },
    ]);
    const request = client.invoke.mock.calls[0][0] as Api.messages.SaveDraft;
    const entity = request.entities?.[0];
    expect(entity).toBeInstanceOf(Api.MessageEntityCustomEmoji);
    expect(String((entity as Api.MessageEntityCustomEmoji).documentId)).toBe('99');
  });

  it('clears the draft when the message is empty', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(true);

    await createService(client).saveDraft(peer, '', 12);
    const request = client.invoke.mock.calls[0][0] as Api.messages.SaveDraft;
    expect(request).toBeInstanceOf(Api.messages.SaveDraft);
    expect(request.message).toBe('');
    expect(request.replyTo).toBeUndefined();
  });
});

describe('MessageService.sendMedia', () => {
  const peer = new Api.InputPeerChannel({ channelId: bigInt(9), accessHash: bigInt(1) });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws when the client is missing', async () => {
    await expect(createService(null).sendMedia(peer, asFile('image/png'), 'hi')).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('uploads images as a photo via FileService', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.Updates({ updates: [], users: [], chats: [], date: 1, seq: 1 }),
    );

    await createService(client).sendMedia(peer, asFile('image/png', 'a.png'), 'caption');

    expect(client.uploadFile).toHaveBeenCalledTimes(1);
    expect(client.uploadFile.mock.calls[0][0].workers).toBeUndefined();
    const request = client.invoke.mock.calls[0][0] as Api.messages.SendMedia;
    expect(request).toBeInstanceOf(Api.messages.SendMedia);
    expect(request.media).toBeInstanceOf(Api.InputMediaUploadedPhoto);
    expect(request.message).toBe('caption');
  });

  it('uploads videos as a document with video attributes', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.Updates({ updates: [], users: [], chats: [], date: 1, seq: 1 }),
    );

    await createService(client).sendMedia(peer, asFile('video/mp4', 'a.mp4'), 'clip', 1_700_000_000);

    const request = client.invoke.mock.calls[0][0] as Api.messages.SendMedia;
    const media = request.media as Api.InputMediaUploadedDocument;
    expect(media).toBeInstanceOf(Api.InputMediaUploadedDocument);
    expect(media.mimeType).toBe('video/mp4');
    expect(media.attributes[0]).toBeInstanceOf(Api.DocumentAttributeVideo);
    expect(request.scheduleDate).toBe(1_700_000_000);
  });

  it('reports upload progress through the console', async () => {
    const client = createClient();
    client.uploadFile.mockImplementation(async ({ onProgress }) => {
      onProgress(0.5);
      return new Api.InputFile({ id: bigInt(1), parts: 1, name: 'a.png', md5Checksum: '' });
    });
    client.invoke.mockResolvedValue(
      new Api.Updates({ updates: [], users: [], chats: [], date: 1, seq: 1 }),
    );

    await createService(client).sendMedia(peer, asFile('image/png'), 'caption');

    expect(console.log).toHaveBeenCalledWith(0.5);
  });

  it('uploads generic files as documents with filename attributes', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.Updates({ updates: [], users: [], chats: [], date: 1, seq: 1 }),
    );

    await createService(client).sendMedia(peer, asFile('application/pdf', 'a.pdf'), 'doc');

    expect(client.uploadFile).toHaveBeenCalledTimes(1);
    const request = client.invoke.mock.calls[0][0] as Api.messages.SendMedia;
    expect(request.media).toBeInstanceOf(Api.InputMediaUploadedDocument);
    const media = request.media as Api.InputMediaUploadedDocument;
    expect(media.mimeType).toBe('application/pdf');
    expect(media.attributes[0]).toBeInstanceOf(Api.DocumentAttributeFilename);
    expect((media.attributes[0] as Api.DocumentAttributeFilename).fileName).toBe('a.pdf');
  });

  it('uploads images as documents when forceDocument is true', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.Updates({ updates: [], users: [], chats: [], date: 1, seq: 1 }),
    );

    await createService(client).sendMedia(
      peer,
      asFile('image/png', 'photo.png'),
      'doc',
      undefined,
      undefined,
      true,
    );

    expect(client.uploadFile).toHaveBeenCalledTimes(1);
    const request = client.invoke.mock.calls[0][0] as Api.messages.SendMedia;
    expect(request.media).toBeInstanceOf(Api.InputMediaUploadedDocument);
    const media = request.media as Api.InputMediaUploadedDocument;
    expect(media.mimeType).toBe('image/png');
    expect(media.attributes[0]).toBeInstanceOf(Api.DocumentAttributeFilename);
    expect((media.attributes[0] as Api.DocumentAttributeFilename).fileName).toBe('photo.png');
  });

  it('includes replyTo when replyToMsgId is provided and returns message id from short sent message', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.UpdateShortSentMessage({ id: 88, pts: 1, ptsCount: 1, date: 1 } as never),
    );

    const result = await createService(client).sendMedia(
      peer,
      asFile('image/png', 'img.png'),
      'caption',
      undefined,
      42,
    );

    expect(result).toBe(88);
    const request = client.invoke.mock.calls[0][0] as Api.messages.SendMedia;
    expect(request.replyTo).toBeInstanceOf(Api.InputReplyToMessage);
    expect((request.replyTo as Api.InputReplyToMessage).replyToMsgId).toBe(42);
  });

  it('supports sendMediaWithOptions with spoiler, invertMedia, and custom options', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.UpdateShortSentMessage({ id: 101, pts: 1, ptsCount: 1, date: 1 } as never),
    );

    const result = await createService(client).sendMediaWithOptions(
      peer,
      asFile('image/png', 'img.png'),
      'spoiler caption',
      {
        spoiler: true,
        invertMedia: true,
        replyToMsgId: 55,
      },
    );

    expect(result).toBe(101);
    const request = client.invoke.mock.calls[0][0] as Api.messages.SendMedia;
    expect(request.invertMedia).toBe(true);
    expect(request.media).toBeInstanceOf(Api.InputMediaUploadedPhoto);
    expect((request.media as Api.InputMediaUploadedPhoto).spoiler).toBe(true);
    expect((request.replyTo as Api.InputReplyToMessage).replyToMsgId).toBe(55);
  });

  it('uploads multiple media items and calls SendMultiMedia', async () => {
    const client = createClient();
    client.invoke.mockImplementation(async (request: any) => {
      if (request instanceof Api.messages.UploadMedia) {
        return new Api.MessageMediaPhoto({
          photo: new Api.Photo({
            id: bigInt(555),
            accessHash: bigInt(666),
            fileReference: Buffer.from('ref'),
            date: 1,
            sizes: [],
            dcId: 2,
          }),
        });
      }
      if (request instanceof Api.messages.SendMultiMedia) {
        return new Api.Updates({
          updates: [
            new Api.UpdateNewMessage({
              message: new Api.Message({ id: 201, peerId: new Api.PeerChat({ chatId: bigInt(1) }) } as any),
              pts: 1,
              ptsCount: 1,
            }),
            new Api.UpdateNewMessage({
              message: new Api.Message({ id: 202, peerId: new Api.PeerChat({ chatId: bigInt(1) }) } as any),
              pts: 2,
              ptsCount: 1,
            }),
          ],
          users: [],
          chats: [],
          date: 1,
          seq: 1,
        });
      }
      return {};
    });

    const progressEvents: any[] = [];
    const svc = createService(client);
    const ids = await svc.sendMultiMedia(
      peer,
      [
        { file: asFile('image/png', '1.png'), uploadId: 'u1', spoiler: true },
        { file: asFile('image/jpeg', '2.jpg'), uploadId: 'u2' },
      ],
      {
        message: 'album text',
        onProgress: (e) => progressEvents.push(e),
      },
    );

    expect(ids).toEqual([201, 202]);
    const sendReq = client.invoke.mock.calls.find(
      (c) => c[0] instanceof Api.messages.SendMultiMedia,
    )?.[0] as Api.messages.SendMultiMedia;
    expect(sendReq).toBeDefined();
    expect(sendReq.multiMedia).toHaveLength(2);
    expect(sendReq.multiMedia[0].message).toBe('album text');
    expect(progressEvents.some((e) => e.uploadId === 'u1')).toBe(true);
    expect(progressEvents.some((e) => e.uploadId === 'u2')).toBe(true);
  });

  it('uploads video with video cover as thumb on InputMediaUploadedDocument', async () => {
    const client = createClient();
    let uploadedMediaDocument: Api.InputMediaUploadedDocument | undefined;
    client.invoke.mockImplementation(async (request: any) => {
      if (request instanceof Api.messages.UploadMedia) {
        if (request.media instanceof Api.InputMediaUploadedDocument) {
          uploadedMediaDocument = request.media;
          return new Api.MessageMediaDocument({
            document: new Api.Document({
              id: bigInt(999),
              accessHash: bigInt(1000),
              fileReference: Buffer.from('doc-ref'),
              date: 1,
              mimeType: 'video/mp4',
              size: bigInt(10000),
              dcId: 2,
              attributes: [],
            }),
          });
        }
        if (request.media instanceof Api.InputMediaUploadedPhoto) {
          return new Api.MessageMediaPhoto({
            photo: new Api.Photo({
              id: bigInt(555),
              accessHash: bigInt(666),
              fileReference: Buffer.from('photo-ref'),
              date: 1,
              sizes: [],
              dcId: 2,
            }),
          });
        }
      }
      if (request instanceof Api.messages.SendMultiMedia) {
        return new Api.Updates({
          updates: [
            new Api.UpdateNewMessage({
              message: new Api.Message({ id: 301, peerId: new Api.PeerChat({ chatId: bigInt(1) }) } as any),
              pts: 1,
              ptsCount: 1,
            }),
            new Api.UpdateNewMessage({
              message: new Api.Message({ id: 302, peerId: new Api.PeerChat({ chatId: bigInt(1) }) } as any),
              pts: 2,
              ptsCount: 1,
            }),
          ],
          users: [],
          chats: [],
          date: 1,
          seq: 1,
        });
      }
      return {};
    });

    const svc = createService(client);
    const videoFile = asFile('video/mp4', 'clip.mp4');
    const coverFile = asFile('image/jpeg', 'cover.jpg');

    const ids = await svc.sendMultiMedia(
      peer,
      [
        { file: videoFile, videoCover: coverFile, uploadId: 'vid1', width: 1280, height: 720, duration: 15 },
        { file: asFile('image/jpeg', 'photo.jpg'), uploadId: 'img1' },
      ],
      { message: 'video with cover' },
    );

    expect(ids).toEqual([301, 302]);
    expect(uploadedMediaDocument).toBeDefined();
    expect(uploadedMediaDocument?.thumb).toBeDefined();
    expect((uploadedMediaDocument as any)?.videoCover).toBeInstanceOf(Api.InputPhoto);
    const videoAttr = uploadedMediaDocument?.attributes.find(
      (a): a is Api.DocumentAttributeVideo => a instanceof Api.DocumentAttributeVideo,
    );
    expect(videoAttr).toBeDefined();
    expect(videoAttr?.w).toBe(1280);
    expect(videoAttr?.h).toBe(720);
    expect(videoAttr?.duration).toBe(15);
    const sendReq = client.invoke.mock.calls.find(
      (c) => c[0] instanceof Api.messages.SendMultiMedia,
    )?.[0] as Api.messages.SendMultiMedia;
    expect(sendReq).toBeDefined();
    const videoMedia = sendReq.multiMedia[0].media as Api.InputMediaDocument;
    expect(videoMedia).toBeInstanceOf(Api.InputMediaDocument);
    expect(videoMedia.videoCover).toBeInstanceOf(Api.InputPhoto);
  });
});

describe('MessageService.getPinnedMessages', () => {
  it('throws when client is not initialized', async () => {
    await expect(createService(null).getPinnedMessages(CHAT_ID)).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('searches for pinned messages and returns converted result', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.messages.Messages({
        messages: [
          new Api.Message({
            id: 10,
            peerId: new Api.PeerChat({ chatId: bigInt(1) }),
            date: 100,
            message: 'pinned text',
            pinned: true,
          } as never),
        ],
        topics: [],
        chats: [],
        users: [],
      }),
    );

    const result = await createService(client).getPinnedMessages(CHAT_ID);
    expect(client.invoke).toHaveBeenCalledTimes(1);
    const request = client.invoke.mock.calls[0][0];
    expect(request).toBeInstanceOf(Api.messages.Search);
    expect(request.filter).toBeInstanceOf(Api.InputMessagesFilterPinned);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].id).toBe(10);
    expect(result.count).toBe(1);
  });

  it('handles MessagesNotModified', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(new Api.messages.MessagesNotModified({ count: 0 }));

    const result = await createService(client).getPinnedMessages(CHAT_ID);
    expect(result.messages).toEqual([]);
    expect(result.count).toBe(0);
  });
});

describe('MessageService.unpinAllMessages', () => {
  it('throws when client is not initialized', async () => {
    await expect(createService(null).unpinAllMessages(CHAT_ID)).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('invokes UnpinAllMessages', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(new Api.messages.AffectedHistory({ pts: 1, ptsCount: 1, offset: 0 }));

    await createService(client).unpinAllMessages(CHAT_ID);
    expect(client.invoke).toHaveBeenCalledTimes(1);
    expect(client.invoke.mock.calls[0][0]).toBeInstanceOf(Api.messages.UnpinAllMessages);
  });
});

describe('MessageService.editMessage', () => {
  const peer = new Api.InputPeerUser({ userId: bigInt(7), accessHash: bigInt(1) });

  it('throws when the client is missing', async () => {
    await expect(createService(null).editMessage(peer, 12, 'edited')).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('invokes EditMessage and processes the returned updates', async () => {
    const client = createClient();
    const process = jest.fn().mockResolvedValue(undefined);
    const updates = new Api.Updates({
      updates: [
        new Api.UpdateEditMessage({
          pts: 2,
          ptsCount: 1,
          message: message(12, 'edited'),
        }),
      ],
      users: [],
      chats: [],
      date: 1,
      seq: 0,
    });
    client.invoke.mockResolvedValue(updates);
    const service = new MessageService({
      transportService: { client, debug: false } as unknown as TransportService,
      fileService: new FileService({
        transportService: { client, debug: false } as unknown as TransportService,
        localDb: { getFileRef: jest.fn(async () => undefined) } as never,
      }),
      updateManager: { process } as never,
    });

    await service.editMessage(peer, 12, 'edited');

    const request = client.invoke.mock.calls[0][0] as Api.messages.EditMessage;
    expect(request).toBeInstanceOf(Api.messages.EditMessage);
    expect(request.id).toBe(12);
    expect(request.message).toBe('edited');
    expect(request.peer).toBe(peer);
    expect(process).toHaveBeenCalledWith(updates, 'rpc');
  });
});

function serviceWithUpdates(client: FakeClient, process: jest.Mock = jest.fn()) {
  return {
    process,
    service: new MessageService({
      transportService: { client, debug: false } as unknown as TransportService,
      fileService: new FileService({
        transportService: { client, debug: false } as unknown as TransportService,
        localDb: { getFileRef: jest.fn(async () => undefined) } as never,
      }),
      updateManager: { process } as never,
    }),
  };
}

describe('MessageService.forwardMessages', () => {
  const fromPeer = new Api.InputPeerUser({ userId: bigInt(7), accessHash: bigInt(1) });
  const toPeer = new Api.InputPeerChat({ chatId: bigInt(4) });

  it('throws when the client is missing', async () => {
    await expect(createService(null).forwardMessages(fromPeer, toPeer, [3])).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('forwards with dropAuthor and silent and processes updates', async () => {
    const client = createClient();
    const updates = new Api.Updates({ updates: [], users: [], chats: [], date: 1, seq: 0 });
    client.invoke.mockResolvedValue(updates);
    const { service, process } = serviceWithUpdates(client);

    await service.forwardMessages(fromPeer, toPeer, [3, 4], { dropAuthor: true, silent: true });

    const request = client.invoke.mock.calls[0][0] as Api.messages.ForwardMessages;
    expect(request).toBeInstanceOf(Api.messages.ForwardMessages);
    expect(request.fromPeer).toBe(fromPeer);
    expect(request.toPeer).toBe(toPeer);
    expect(request.id).toEqual([3, 4]);
    expect(request.randomId).toHaveLength(2);
    expect(request.dropAuthor).toBe(true);
    expect(request.silent).toBe(true);
    expect(process).toHaveBeenCalledWith(updates, 'rpc');
  });
});

describe('MessageService.deleteMessages', () => {
  it('throws when the client is missing', async () => {
    await expect(createService(null).deleteMessages(USER_ID, [1], true)).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('revokes a private-chat delete', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(new Api.messages.AffectedMessages({ pts: 1, ptsCount: 1 }));

    await createService(client).deleteMessages(USER_ID, [8], true);

    const request = client.invoke.mock.calls[0][0] as Api.messages.DeleteMessages;
    expect(request).toBeInstanceOf(Api.messages.DeleteMessages);
    expect(request.id).toEqual([8]);
    expect(request.revoke).toBe(true);
  });

  it('deletes channel messages without revoke', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(new Api.messages.AffectedMessages({ pts: 1, ptsCount: 1 }));

    await createService(client).deleteMessages(CHAT_ID, [8, 9], false, '123');

    const request = client.invoke.mock.calls[0][0] as Api.channels.DeleteMessages;
    expect(request).toBeInstanceOf(Api.channels.DeleteMessages);
    expect(request.id).toEqual([8, 9]);
    expect(request.channel).toBeInstanceOf(Api.InputChannel);
  });
});

describe('MessageService.updatePinnedMessage', () => {
  const peer = new Api.InputPeerUser({ userId: bigInt(7), accessHash: bigInt(1) });

  it('throws when the client is missing', async () => {
    await expect(createService(null).updatePinnedMessage(peer, 4)).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('pins silently for one side and processes updates', async () => {
    const client = createClient();
    const updates = new Api.Updates({ updates: [], users: [], chats: [], date: 1, seq: 0 });
    client.invoke.mockResolvedValue(updates);
    const { service, process } = serviceWithUpdates(client);

    await service.updatePinnedMessage(peer, 4, { silent: true, pmOneside: true });

    const request = client.invoke.mock.calls[0][0] as Api.messages.UpdatePinnedMessage;
    expect(request).toBeInstanceOf(Api.messages.UpdatePinnedMessage);
    expect(request.peer).toBe(peer);
    expect(request.id).toBe(4);
    expect(request.silent).toBe(true);
    expect(request.pmOneside).toBe(true);
    expect(request.unpin).toBeUndefined();
    expect(process).toHaveBeenCalledWith(updates, 'rpc');
  });

  it('unpins', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(new Api.Updates({ updates: [], users: [], chats: [], date: 1, seq: 0 }));
    const { service } = serviceWithUpdates(client);

    await service.updatePinnedMessage(peer, 4, { unpin: true });

    const request = client.invoke.mock.calls[0][0] as Api.messages.UpdatePinnedMessage;
    expect(request.unpin).toBe(true);
  });
});
