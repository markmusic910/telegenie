jest.mock('../../../utils/scheduler/sleep', () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
}));

import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { sleep } from '../../../utils/scheduler/sleep';
import { LocalDb } from '../local-db/local-db';
import type { TransportService } from './transport.service';
import { UserService } from './user.service';
import type { User, UserFull } from '../types/users';

const sleepMock = sleep as unknown as jest.Mock;

type FakeClient = {
  invoke: jest.Mock;
};

function createService(
  client: FakeClient | null,
  options: { debug?: boolean; localDb?: LocalDb } = {},
): UserService {
  return new UserService({
    debug: options.debug,
    transportService: { client, debug: false } as unknown as TransportService,
    localDb: options.localDb,
  });
}

const user = (id: number, firstName = 'Ada') =>
  new Api.User({ id: bigInt(id), accessHash: bigInt(2), firstName } as never);

const chat = (id: number, title = 'Group') =>
  new Api.Chat({ id: bigInt(id), title, participantsCount: 1, date: 1, version: 1 } as never);

const channel = (id: number, title = 'News') =>
  new Api.Channel({ id: bigInt(id), accessHash: bigInt(1), title } as never);

const userFull = (id: number) =>
  new Api.UserFull({
    id: bigInt(id),
    about: 'bio',
    settings: new Api.PeerSettings({} as never),
    notifySettings: new Api.PeerNotifySettings({} as never),
  } as never);

function sampleLocalUser(id = '42'): User {
  return {
    id,
    accessHash: '2',
    firstName: 'Cached',
    min: false,
  } as User;
}

describe('UserService.getUsers', () => {
  it('throws when the client is missing', async () => {
    await expect(createService(null).getUsers([{ id: '42' }])).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('keeps only Api.User entries keyed by id', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue([user(42), new Api.UserEmpty({ id: bigInt(43) })]),
    };

    const result = await createService(client).getUsers([{ id: '42', accessHash: '2' }]);

    expect(Object.keys(result)).toEqual(['42']);
    expect(result['42']).toMatchObject({ firstName: 'Ada', accessHash: '2' });
    expect(client.invoke.mock.calls[0][0]).toBeInstanceOf(Api.users.GetUsers);
  });

  it('returns an empty map when the request resolves empty', async () => {
    const client: FakeClient = { invoke: jest.fn().mockResolvedValue(undefined) };
    await expect(createService(client).getUsers([{ id: '42' }])).resolves.toEqual({});
  });

  it('maps plain ids through getUsersByIds', async () => {
    const client: FakeClient = { invoke: jest.fn().mockResolvedValue([user(42)]) };

    const result = await createService(client).getUsersByIds(['42']);

    expect(result['42']).toMatchObject({ firstName: 'Ada' });
  });

  it('returns LocalDb hits without invoking GramJS', async () => {
    const localDb = new LocalDb({
      accountSlot: `us-hit-${Date.now()}`,
      flushDelayMs: 10_000,
    });
    await localDb.open();
    await localDb.putUser(sampleLocalUser());
    const client: FakeClient = { invoke: jest.fn() };

    try {
      const result = await createService(client, { localDb }).getUsers([{ id: '42' }]);
      expect(result['42']).toMatchObject({ firstName: 'Cached' });
      expect(client.invoke).not.toHaveBeenCalled();
    } finally {
      await localDb.deleteDatabase();
    }
  });

  it('fetches only misses and persists them into LocalDb', async () => {
    const localDb = new LocalDb({
      accountSlot: `us-miss-${Date.now()}`,
      flushDelayMs: 10_000,
    });
    await localDb.open();
    await localDb.putUser(sampleLocalUser('1'));
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue([user(2, 'Bob')]),
    };

    try {
      const result = await createService(client, { localDb }).getUsers([
        { id: '1' },
        { id: '2', accessHash: '2' },
      ]);
      expect(result['1']).toMatchObject({ firstName: 'Cached' });
      expect(result['2']).toMatchObject({ firstName: 'Bob' });
      expect(client.invoke).toHaveBeenCalledTimes(1);
      await expect(localDb.getUser('2')).resolves.toMatchObject({ firstName: 'Bob' });
    } finally {
      await localDb.deleteDatabase();
    }
  });
});

describe('UserService.getFullUsers', () => {
  beforeEach(() => {
    sleepMock.mockClear();
  });

  it('throws when the client is missing', async () => {
    await expect(createService(null).getFullUsers([{ id: '42' }])).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('collects full users along with related chats, channels and users', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(
        new Api.users.UserFull({
          fullUser: userFull(42),
          chats: [chat(5), channel(9, 'Linked')],
          users: [user(43, 'Grace')],
        } as never),
      ),
    };

    const result = await createService(client).getFullUsers([{ id: '42', accessHash: '2' }]);

    expect(result.fullUsers['42']).toMatchObject({ about: 'bio' });
    expect(result.chats['-5']).toMatchObject({ title: 'Group' });
    expect(result.channels['-1000000000009']).toMatchObject({ title: 'Linked' });
    expect(result.users['43']).toMatchObject({ firstName: 'Grace' });
    expect(client.invoke.mock.calls[0][0]).toBeInstanceOf(Api.users.GetFullUser);
    expect(sleepMock).toHaveBeenCalledWith(300);
  });

  it('returns LocalDb full hits without invoking GramJS', async () => {
    const localDb = new LocalDb({
      accountSlot: `uf-hit-${Date.now()}`,
      flushDelayMs: 10_000,
    });
    await localDb.open();
    await localDb.putUserFull({ id: '42', about: 'cached-bio' } as UserFull);
    const client: FakeClient = { invoke: jest.fn() };

    try {
      const result = await createService(client, { localDb }).getFullUsers([{ id: '42' }]);
      expect(result.fullUsers['42']).toMatchObject({ about: 'cached-bio' });
      expect(client.invoke).not.toHaveBeenCalled();
    } finally {
      await localDb.deleteDatabase();
    }
  });

  it('chunks requests in groups of five', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(
        new Api.users.UserFull({ fullUser: userFull(42), chats: [], users: [] } as never),
      ),
    };

    await createService(client).getFullUsers(
      Array.from({ length: 6 }, (_, index) => ({ id: `${index + 1}` })),
    );

    expect(client.invoke).toHaveBeenCalledTimes(6);
    expect(sleepMock).toHaveBeenCalledTimes(2);
  });

  it('swallows request errors', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const client: FakeClient = { invoke: jest.fn().mockRejectedValue(new Error('USER_ID_INVALID')) };

    const result = await createService(client).getFullUsers([{ id: '42' }]);

    expect(result).toEqual({ fullUsers: {}, chats: {}, channels: {}, users: {} });
    expect(error).toHaveBeenCalledWith('getFullUsers error', expect.any(Error));
    error.mockRestore();
  });

  it('ignores results that are not users.UserFull', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const client: FakeClient = { invoke: jest.fn().mockResolvedValue(undefined) };

    const result = await createService(client).getFullUsers([{ id: '42' }]);

    expect(result.fullUsers).toEqual({});
    expect(error).toHaveBeenCalledWith('getFullUsers error', undefined);
    error.mockRestore();
  });

  it('skips chat and channel ids instead of calling users.getFullUser', async () => {
    const client: FakeClient = { invoke: jest.fn() };

    const result = await createService(client).getFullUsers([
      { id: '-10' },
      { id: '-1000000000009' },
    ]);

    expect(result).toEqual({ fullUsers: {}, chats: {}, channels: {}, users: {} });
    expect(client.invoke).not.toHaveBeenCalled();
  });

  it('maps plain ids through getFullUsersByIds', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(
        new Api.users.UserFull({ fullUser: userFull(42), chats: [], users: [] } as never),
      ),
    };

    const result = await createService(client).getFullUsersByIds(['42']);

    expect(result.fullUsers['42']).toMatchObject({ about: 'bio' });
  });
});

describe('UserService.resolveUsername', () => {
  it('throws when the client is missing', async () => {
    await expect(createService(null).resolveUsername('alice')).rejects.toThrow(
      'Client not initialized',
    );
  });

  it('returns undefined for empty input', async () => {
    const client: FakeClient = { invoke: jest.fn() };
    await expect(createService(client).resolveUsername('@')).resolves.toBeUndefined();
    expect(client.invoke).not.toHaveBeenCalled();
  });

  it('invokes ResolveUsername and returns the resolved peer id', async () => {
    const client: FakeClient = {
      invoke: jest.fn().mockResolvedValue(
        new Api.contacts.ResolvedPeer({
          peer: new Api.PeerUser({ userId: bigInt(42) }),
          users: [user(42, 'Alice')],
          chats: [],
        }),
      ),
    };
    const localDb = {
      putUsers: jest.fn().mockResolvedValue(undefined),
      putChats: jest.fn().mockResolvedValue(undefined),
      putChannels: jest.fn().mockResolvedValue(undefined),
    };

    const result = await createService(client, { localDb: localDb as never }).resolveUsername(
      '@Alice',
    );

    expect(client.invoke).toHaveBeenCalledTimes(1);
    const request = client.invoke.mock.calls[0][0];
    expect(request).toBeInstanceOf(Api.contacts.ResolveUsername);
    expect((request as Api.contacts.ResolveUsername).username).toBe('alice');
    expect(result).toEqual({
      peerId: '42',
      users: [expect.objectContaining({ id: '42', firstName: 'Alice' })],
      chats: [],
      channels: [],
    });
    expect(localDb.putUsers).toHaveBeenCalled();
  });
});

describe('UserService logging', () => {
  it('reports the client as null without a transport service', () => {
    const service = new UserService({
      transportService: undefined as unknown as TransportService,
    });
    expect(service.client).toBeNull();
  });

  it('prefixes debug output and stays silent otherwise', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});

    (createService(null, { debug: true }) as never as { log: (...args: unknown[]) => void }).log(
      'hello',
    );
    expect(info).toHaveBeenCalledWith('[UserService]', 'hello');

    info.mockClear();
    (createService(null) as never as { log: (...args: unknown[]) => void }).log('hello');
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
});
