jest.mock('../../../utils/scheduler/sleep', () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
}));

import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { sleep } from '../../../utils/scheduler/sleep';
import { LocalDb } from '../local-db/local-db';
import type { Chat, ChatFull } from '../types/api-types';
import { ChatService } from './chat.service';
import type { TransportService } from './transport.service';
import type { UpdateManager } from '../update-manager/update-manager';

const sleepMock = sleep as unknown as jest.Mock;

type FakeClient = {
  invoke: jest.Mock;
};

function createService(
  client: FakeClient | null,
  options: { debug?: boolean; localDb?: LocalDb; updateManager?: UpdateManager } = {},
): ChatService {
  return new ChatService({
    debug: options.debug,
    transportService: { client, debug: false } as unknown as TransportService,
    localDb: options.localDb,
    updateManager: options.updateManager,
  });
}

const CHAT_ID = '-5';

const chat = (id: number, title = 'Group') =>
  new Api.Chat({ id: bigInt(id), title, participantsCount: 2, date: 1, version: 1 } as never);

const channel = (id: number, title = 'News') =>
  new Api.Channel({ id: bigInt(id), accessHash: bigInt(1), title } as never);

const user = (id: number) =>
  new Api.User({ id: bigInt(id), accessHash: bigInt(2), firstName: 'Ada' } as never);

describe('ChatService.getChatsByIds', () => {
  it('throws when the client is missing', async () => {
    await expect(createService(null).getChatsByIds([CHAT_ID])).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('keeps only Api.Chat entries keyed by marked id', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(new Api.messages.Chats({ chats: [chat(5), channel(9)] })),
    };

    const result = await createService(client).getChatsByIds([CHAT_ID]);

    expect(Object.keys(result)).toEqual([CHAT_ID]);
    expect(result[CHAT_ID]).toMatchObject({ title: 'Group', participantsCount: 2 });
    expect(client.invoke.mock.calls[0][0]).toBeInstanceOf(Api.messages.GetChats);
  });

  it('returns an empty map when the request resolves empty', async () => {
    const client: FakeClient = { invoke: jest.fn().mockResolvedValue(undefined) };
    await expect(createService(client).getChatsByIds([CHAT_ID])).resolves.toEqual({});
  });

  it('returns LocalDb hits without invoking GramJS', async () => {
    const localDb = new LocalDb({
      accountSlot: `chat-hit-${Date.now()}`,
      flushDelayMs: 10_000,
    });
    await localDb.open();
    await localDb.putChat({
      id: CHAT_ID,
      title: 'Cached',
      participantsCount: 2,
      date: 1,
      version: 1,
    } as Chat);
    const client: FakeClient = { invoke: jest.fn() };
    try {
      const result = await createService(client, { localDb }).getChatsByIds([CHAT_ID]);
      expect(result[CHAT_ID]).toMatchObject({ title: 'Cached' });
      expect(client.invoke).not.toHaveBeenCalled();
    } finally {
      await localDb.deleteDatabase();
    }
  });
});

describe('ChatService.getFullChatByIds', () => {
  beforeEach(() => {
    sleepMock.mockClear();
  });

  it('throws when the client is missing', async () => {
    await expect(createService(null).getFullChatByIds([CHAT_ID])).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('collects full chats along with related chats, channels and users', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(
        new Api.messages.ChatFull({
          fullChat: new Api.ChatFull({ id: bigInt(5), about: 'about' } as never),
          chats: [chat(6, 'Other'), channel(9, 'Linked')],
          users: [user(42)],
        } as never),
      ),
    };

    const result = await createService(client).getFullChatByIds([CHAT_ID]);

    expect(result.fullChats['-5']).toMatchObject({ about: 'about' });
    expect(result.chats['-6']).toMatchObject({ title: 'Other' });
    expect(result.channels['-1000000000009']).toMatchObject({ title: 'Linked' });
    expect(result.users['42']).toMatchObject({ firstName: 'Ada' });
    expect(client.invoke.mock.calls[0][0]).toBeInstanceOf(Api.messages.GetFullChat);
    expect(sleepMock).toHaveBeenCalledWith(300);
  });

  it('chunks requests in groups of five', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(
        new Api.messages.ChatFull({
          fullChat: new Api.ChatFull({ id: bigInt(5) } as never),
          chats: [],
          users: [],
        } as never),
      ),
    };

    await createService(client).getFullChatByIds(['-1', '-2', '-3', '-4', '-5', '-6']);

    expect(client.invoke).toHaveBeenCalledTimes(6);
    expect(sleepMock).toHaveBeenCalledTimes(2);
  });

  it('swallows request errors', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const client: FakeClient = { invoke: jest.fn().mockRejectedValue(new Error('CHAT_ID_INVALID')) };

    const result = await createService(client).getFullChatByIds([CHAT_ID]);

    expect(result).toEqual({ fullChats: {}, chats: {}, channels: {}, users: {} });
    expect(error).toHaveBeenCalledWith('getFullChatByIds error', expect.any(Error));
    error.mockRestore();
  });

  it('ignores results that are not messages.ChatFull', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const client: FakeClient = { invoke: jest.fn().mockResolvedValue(null) };

    const result = await createService(client).getFullChatByIds([CHAT_ID]);

    expect(result.fullChats).toEqual({});
    expect(error).toHaveBeenCalledWith('getFullChatByIds error', null);
    error.mockRestore();
  });

  it('ignores full chats that are not basic chat fulls', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(
        new Api.messages.ChatFull({
          fullChat: new Api.ChannelFull({ id: bigInt(9) } as never),
          chats: [],
          users: [],
        } as never),
      ),
    };

    const result = await createService(client).getFullChatByIds([CHAT_ID]);

    expect(result.fullChats).toEqual({});
  });
});

describe('ChatService.createBasicGroup', () => {
  it('throws when the client is missing', async () => {
    await expect(createService(null).createBasicGroup('Group', [])).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('unwraps InvitedUsers and returns missing invitees', async () => {
    const localDb = new LocalDb({
      accountSlot: `chat-create-${Date.now()}`,
      flushDelayMs: 10_000,
    });
    await localDb.open();
    await localDb.putUser({
      id: '42',
      firstName: 'Ada',
      accessHash: '2',
    } as any);

    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(
        new Api.messages.InvitedUsers({
          updates: new Api.Updates({
            updates: [],
            users: [],
            chats: [chat(5, 'New Group')],
            date: 1,
            seq: 1,
          }),
          missingInvitees: [
            new Api.MissingInvitee({
              userId: bigInt(99),
              premiumRequiredForPm: true,
            } as never),
          ],
        }),
      ),
    };

    const updateManager = { process: jest.fn().mockResolvedValue(undefined) } as unknown as UpdateManager;

    try {
      const result = await createService(client, { localDb, updateManager }).createBasicGroup(
        'New Group',
        [{ id: '42' }],
      );

      expect(result.chat).toMatchObject({ id: CHAT_ID, title: 'New Group' });
      expect(result.missingInvitees).toEqual([
        { userId: '99', premiumRequiredForPm: true, premiumWouldAllowInvite: undefined },
      ]);
      expect(updateManager.process).toHaveBeenCalled();
      expect(client.invoke.mock.calls[0][0]).toBeInstanceOf(Api.messages.CreateChat);
    } finally {
      await localDb.deleteDatabase();
    }
  });
});

describe('ChatService.setAvailableReactions', () => {
  it('reloads chatFull so availableReactions replaces the cached row', async () => {
    const localDb = new LocalDb({
      accountSlot: `chat-reactions-${Date.now()}`,
      flushDelayMs: 10_000,
    });
    await localDb.open();
    await localDb.putChatFull({
      id: CHAT_ID,
      about: '',
      participants: { chatId: CHAT_ID, participants: [], version: 1 },
      notifySettings: {},
      availableReactions: { reactions: [{ emoticon: '❤' }] },
    } as ChatFull);

    const client: FakeClient = {
      invoke: jest
        .fn()
        .mockResolvedValueOnce(new Api.Updates({ updates: [], users: [], chats: [], date: 1, seq: 0 }))
        .mockResolvedValueOnce(
          new Api.messages.ChatFull({
            fullChat: new Api.ChatFull({
              id: bigInt(5),
              about: '',
              participants: new Api.ChatParticipants({
                chatId: bigInt(5),
                participants: [],
                version: 1,
              }),
              notifySettings: new Api.PeerNotifySettings({}),
              availableReactions: new Api.ChatReactionsNone(),
            } as never),
            chats: [],
            users: [],
          } as never),
        ),
    };

    try {
      await createService(client, { localDb }).setAvailableReactions(CHAT_ID, 'none');
      expect(client.invoke.mock.calls[0][0]).toBeInstanceOf(Api.messages.SetChatAvailableReactions);
      expect(client.invoke.mock.calls[1][0]).toBeInstanceOf(Api.messages.GetFullChat);
      expect(await localDb.getChatFull(CHAT_ID)).toMatchObject({ availableReactions: {} });
    } finally {
      await localDb.deleteDatabase();
    }
  });
});

describe('ChatService logging', () => {
  it('reports the client as null without a transport service', () => {
    const service = new ChatService({
      transportService: undefined as unknown as TransportService,
    });
    expect(service.client).toBeNull();
  });

  it('prefixes debug output and stays silent otherwise', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});

    (createService(null, { debug: true }) as never as { log: (...args: unknown[]) => void }).log(
      'hello',
    );
    expect(info).toHaveBeenCalledWith('[ChatService]', 'hello');

    info.mockClear();
    (createService(null) as never as { log: (...args: unknown[]) => void }).log('hello');
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
});
