jest.mock('../../../utils/scheduler/sleep', () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
}));

import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { sleep } from '../../../utils/scheduler/sleep';
import { ChannelService } from './channel.service';
import type { TransportService } from './transport.service';
import type { UpdateManager } from '../update-manager/update-manager';

const sleepMock = sleep as unknown as jest.Mock;

type FakeClient = {
  invoke: jest.Mock;
};

function createService(
  client: FakeClient | null,
  options: { debug?: boolean; updateManager?: UpdateManager } = {},
): ChannelService {
  return new ChannelService({
    debug: options.debug,
    transportService: { client, debug: false } as unknown as TransportService,
    updateManager: options.updateManager,
  });
}

const CHANNEL_ID = '-1000000000009';

const channel = (id: number, title = 'News') =>
  new Api.Channel({ id: bigInt(id), accessHash: bigInt(1), title } as never);

const chat = (id: number, title = 'Group') =>
  new Api.Chat({ id: bigInt(id), title, participantsCount: 1, date: 1, version: 1 } as never);

const user = (id: number) =>
  new Api.User({ id: bigInt(id), accessHash: bigInt(2), firstName: 'Ada' } as never);

const channelFull = (id: number) => new Api.ChannelFull({ id: bigInt(id), about: 'a' } as never);

describe('ChannelService.getChannelsByIds', () => {
  it('throws when the client is missing', async () => {
    await expect(createService(null).getChannelsByIds([CHANNEL_ID])).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('keeps only Api.Channel entries keyed by marked id', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(
        new Api.messages.Chats({ chats: [channel(9), chat(5)] }),
      ),
    };

    const result = await createService(client).getChannelsByIds([CHANNEL_ID]);

    expect(Object.keys(result)).toEqual([CHANNEL_ID]);
    expect(result[CHANNEL_ID]).toMatchObject({ title: 'News', accessHash: '1' });
    expect(client.invoke.mock.calls[0][0]).toBeInstanceOf(Api.channels.GetChannels);
  });

  it('returns an empty map when the request resolves empty', async () => {
    const client: FakeClient = { invoke: jest.fn().mockResolvedValue(undefined) };
    await expect(createService(client).getChannelsByIds([CHANNEL_ID])).resolves.toEqual({});
  });
});

describe('ChannelService.getFullChannelByIds', () => {
  beforeEach(() => {
    sleepMock.mockClear();
  });

  it('throws when the client is missing', async () => {
    await expect(
      createService(null).getFullChannelByIds([{ id: CHANNEL_ID, accessHash: '1' }]),
    ).rejects.toThrow('Client not initialized');
  });

  it('collects full channels along with related chats, channels and users', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(
        new Api.messages.ChatFull({
          fullChat: channelFull(9),
          chats: [chat(5), channel(11, 'Linked')],
          users: [user(42)],
        } as never),
      ),
    };

    const result = await createService(client).getFullChannelByIds([
      { id: CHANNEL_ID, accessHash: '1' },
    ]);

    expect(result.fullChannels[CHANNEL_ID]).toMatchObject({ about: 'a' });
    expect(result.chats['-5']).toMatchObject({ title: 'Group' });
    expect(result.channels['-1000000000011']).toMatchObject({ title: 'Linked' });
    expect(result.users['42']).toMatchObject({ firstName: 'Ada' });
    expect(sleepMock).toHaveBeenCalledWith(300);
  });

  it('chunks requests in groups of five', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(
        new Api.messages.ChatFull({ fullChat: channelFull(9), chats: [], users: [] } as never),
      ),
    };
    const options = Array.from({ length: 6 }, (_, index) => ({
      id: `-100000000000${index + 1}`,
      accessHash: '1',
    }));

    await createService(client).getFullChannelByIds(options);

    expect(client.invoke).toHaveBeenCalledTimes(6);
    expect(sleepMock).toHaveBeenCalledTimes(2);
  });

  it('skips entries without an access hash', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const client: FakeClient = { invoke: jest.fn() };

    const result = await createService(client).getFullChannelByIds([
      { id: CHANNEL_ID, accessHash: '' },
    ]);

    expect(client.invoke).not.toHaveBeenCalled();
    expect(result.fullChannels).toEqual({});
    expect(error).toHaveBeenCalledWith(
      `getFullChannelByIds param error for id: ${CHANNEL_ID}, no accessHash`,
    );
    error.mockRestore();
  });

  it('swallows request errors', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const client: FakeClient = { invoke: jest.fn().mockRejectedValue(new Error('FLOOD_WAIT')) };

    const result = await createService(client).getFullChannelByIds([
      { id: CHANNEL_ID, accessHash: '1' },
    ]);

    expect(result).toEqual({ fullChannels: {}, chats: {}, channels: {}, users: {} });
    expect(error).toHaveBeenCalledWith('getFullChannelByIds error', expect.any(Error));
    error.mockRestore();
  });

  it('ignores results that are not messages.ChatFull', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const client: FakeClient = { invoke: jest.fn().mockResolvedValue(undefined) };

    const result = await createService(client).getFullChannelByIds([
      { id: CHANNEL_ID, accessHash: '1' },
    ]);

    expect(result.fullChannels).toEqual({});
    expect(error).toHaveBeenCalledWith('getFullChannelByIds error', undefined);
    error.mockRestore();
  });

  it('ignores full chats that are not channel fulls', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(
        new Api.messages.ChatFull({
          fullChat: new Api.ChatFull({ id: bigInt(5) } as never),
          chats: [],
          users: [],
        } as never),
      ),
    };

    const result = await createService(client).getFullChannelByIds([
      { id: CHANNEL_ID, accessHash: '1' },
    ]);

    expect(result.fullChannels).toEqual({});
  });
});

describe('ChannelService.createGroup', () => {
  it('throws when the client is missing', async () => {
    await expect(createService(null).createGroup('t', 'a')).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('creates a megagroup channel', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(
        new Api.Updates({
          updates: [],
          users: [],
          chats: [channel(9, 'Mega')],
          date: 1,
          seq: 1,
        }),
      ),
    };

    await expect(createService(client).createGroup('Mega', 'about')).resolves.toMatchObject({
      id: CHANNEL_ID,
      title: 'Mega',
    });

    const createCall = client.invoke.mock.calls[0][0] as Api.channels.CreateChannel;
    expect(createCall).toBeInstanceOf(Api.channels.CreateChannel);
    expect(createCall.megagroup).toBe(true);
    expect(createCall.broadcast).toBeUndefined();
  });

  it('throws when the response contains no channel', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(
        new Api.Updates({ updates: [], users: [], chats: [chat(5)], date: 1, seq: 1 }),
      ),
    };

    await expect(createService(client).createGroup('Mega', 'about')).rejects.toThrow(
      'Failed to create channel',
    );
  });

  it('throws when the response is not an Updates envelope', async () => {
    const client: FakeClient = { invoke: jest.fn().mockResolvedValue(undefined) };
    await expect(createService(client).createGroup('Mega', 'about')).rejects.toThrow(
      'Failed to create channel',
    );
  });
});

describe('ChannelService.createChannel', () => {
  it('creates a broadcast channel', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(
        new Api.Updates({
          updates: [],
          users: [],
          chats: [channel(9, 'News')],
          date: 1,
          seq: 1,
        }),
      ),
    };

    await expect(createService(client).createChannel('News', 'about')).resolves.toMatchObject({
      title: 'News',
    });

    const createCall = client.invoke.mock.calls[0][0] as Api.channels.CreateChannel;
    expect(createCall.broadcast).toBe(true);
    expect(createCall.megagroup).toBeUndefined();
  });
});

describe('ChannelService logging', () => {
  it('reports the client as null without a transport service', () => {
    const service = new ChannelService({
      transportService: undefined as unknown as TransportService,
    });
    expect(service.client).toBeNull();
  });

  it('prefixes debug output and stays silent otherwise', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});

    (createService(null, { debug: true }) as never as { log: (...args: unknown[]) => void }).log(
      'hello',
    );
    expect(info).toHaveBeenCalledWith('[ChannelService]', 'hello');

    info.mockClear();
    (createService(null) as never as { log: (...args: unknown[]) => void }).log('hello');
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
});
