import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';

import { AuthService, SessionPasswordNeededError } from './auth.service';
import type { TransportService } from './transport.service';

type FakeClient = {
  invoke: jest.Mock;
  checkAuthorization: jest.Mock;
  sendCode: jest.Mock;
  signInWithPassword: jest.Mock;
  session: { save: jest.Mock };
};

function createClient(): FakeClient {
  return {
    invoke: jest.fn(),
    checkAuthorization: jest.fn().mockResolvedValue(true),
    sendCode: jest.fn().mockResolvedValue({ phoneCodeHash: 'hash', isCodeViaApp: false }),
    signInWithPassword: jest.fn(),
    session: { save: jest.fn().mockReturnValue('session-string') },
  };
}

type FakeTransport = {
  client: FakeClient | null;
  prepareConnection: jest.Mock;
};

function createTransport(client: FakeClient | null): FakeTransport {
  return { client, prepareConnection: jest.fn().mockResolvedValue(undefined) };
}

function createService(
  client: FakeClient | null,
  options: { debug?: boolean } = {},
): { service: AuthService; transport: FakeTransport } {
  const transport = createTransport(client);
  const service = new AuthService({
    debug: options.debug,
    transportService: transport as unknown as TransportService,
  });
  return { service, transport };
}

const user = () =>
  new Api.User({ id: bigInt(42), accessHash: bigInt(7), firstName: 'Ada' } as never);

describe('AuthService connection lifecycle', () => {
  it('forwards configured credentials to the transport service', async () => {
    const { service, transport } = createService(createClient());
    service.configure({ apiId: 11, apiHash: 'secret' });

    await service.prepareClient('saved-session');

    expect(transport.prepareConnection).toHaveBeenCalledWith('saved-session', {
      apiId: 11,
      apiHash: 'secret',
    });
  });

  it('defaults to an empty session and zeroed credentials', async () => {
    const { service, transport } = createService(createClient());

    await service.prepareClient();

    expect(transport.prepareConnection).toHaveBeenCalledWith('', { apiId: 0, apiHash: '' });
  });

  it('exposes the transport client', () => {
    const client = createClient();
    const { service } = createService(client);
    expect(service.client).toBe(client as never);
  });
});

describe('AuthService.isAuthorized', () => {
  it('returns false without a client', async () => {
    const { service } = createService(null);
    await expect(service.isAuthorized()).resolves.toBe(false);
  });

  it('delegates to the client', async () => {
    const client = createClient();
    client.checkAuthorization.mockResolvedValue(false);
    const { service } = createService(client);
    await expect(service.isAuthorized()).resolves.toBe(false);
    expect(client.checkAuthorization).toHaveBeenCalled();
  });
});

describe('AuthService.sendCode', () => {
  it('sends the code with the configured credentials', async () => {
    const client = createClient();
    const { service } = createService(client);
    service.configure({ apiId: 1, apiHash: 'h' });

    await expect(service.sendCode('+123')).resolves.toMatchObject({ phoneCodeHash: 'hash' });
    expect(client.sendCode).toHaveBeenCalledWith({ apiId: 1, apiHash: 'h' }, '+123');
  });

  it('logs when debug is enabled', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const { service } = createService(createClient(), { debug: true });

    await service.sendCode('+123');

    expect(info).toHaveBeenCalledWith('[AuthService]', 'sendCode', '+123');
    info.mockRestore();
  });

  it('stays silent without the debug flag', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const { service } = createService(createClient());

    await service.sendCode('+123');

    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it('throws when the client is missing', async () => {
    const { service } = createService(null);
    await expect(service.sendCode('+123')).rejects.toThrow('Telegram client not initialized');
  });
});

describe('AuthService.signIn', () => {
  it('converts the authorized user', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(new Api.auth.Authorization({ user: user() } as never));
    const { service } = createService(client);

    await expect(service.signIn('+123', 'hash', '11111')).resolves.toMatchObject({
      id: '42',
      firstName: 'Ada',
    });
    expect(client.invoke.mock.calls[0][0]).toBeInstanceOf(Api.auth.SignIn);
  });

  it('throws on an unexpected sign-in result', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(
      new Api.auth.AuthorizationSignUpRequired({} as never),
    );
    const { service } = createService(client);

    await expect(service.signIn('+123', 'hash', '11111')).rejects.toThrow(
      'Unexpected sign-in result',
    );
  });

  it('maps a SESSION_PASSWORD_NEEDED RPC error', async () => {
    const client = createClient();
    client.invoke.mockRejectedValue({ errorMessage: 'SESSION_PASSWORD_NEEDED' });
    const { service } = createService(client);

    await expect(service.signIn('+123', 'hash', '11111')).rejects.toBeInstanceOf(
      SessionPasswordNeededError,
    );
  });

  it('passes through an already mapped SessionPasswordNeededError', async () => {
    const client = createClient();
    client.invoke.mockRejectedValue(new SessionPasswordNeededError());
    const { service } = createService(client);

    await expect(service.signIn('+123', 'hash', '11111')).rejects.toThrow(
      'SESSION_PASSWORD_NEEDED',
    );
  });

  it('rethrows unrelated errors', async () => {
    const client = createClient();
    client.invoke.mockRejectedValue(new Error('PHONE_CODE_INVALID'));
    const { service } = createService(client);

    await expect(service.signIn('+123', 'hash', '11111')).rejects.toThrow('PHONE_CODE_INVALID');
  });

  it('rethrows non-object errors', async () => {
    const client = createClient();
    client.invoke.mockRejectedValue('boom');
    const { service } = createService(client);

    await expect(service.signIn('+123', 'hash', '11111')).rejects.toBe('boom');
  });

  it('rethrows errors carrying a different errorMessage', async () => {
    const client = createClient();
    client.invoke.mockRejectedValue({ errorMessage: 'PHONE_CODE_EXPIRED' });
    const { service } = createService(client);

    await expect(service.signIn('+123', 'hash', '11111')).rejects.toEqual({
      errorMessage: 'PHONE_CODE_EXPIRED',
    });
  });

  it('throws when the client is missing', async () => {
    const { service } = createService(null);
    await expect(service.signIn('+1', 'h', '1')).rejects.toThrow('Telegram client not initialized');
  });
});

describe('AuthService.signInWithPassword', () => {
  it('resolves the password lazily and converts the user', async () => {
    const client = createClient();
    client.signInWithPassword.mockImplementation(async (_creds, callbacks) => {
      await expect(callbacks.password()).resolves.toBe('hunter2');
      return user();
    });
    const { service } = createService(client);
    service.configure({ apiId: 3, apiHash: 'x' });

    await expect(service.signInWithPassword('hunter2')).resolves.toMatchObject({ id: '42' });
    expect(client.signInWithPassword).toHaveBeenCalledWith(
      { apiId: 3, apiHash: 'x' },
      expect.objectContaining({ password: expect.any(Function) }),
    );
  });

  it('surfaces errors reported through onError', async () => {
    const client = createClient();
    client.signInWithPassword.mockImplementation(async (_creds, callbacks) => {
      callbacks.onError(new Error('PASSWORD_HASH_INVALID'));
      return user();
    });
    const { service } = createService(client);

    await expect(service.signInWithPassword('nope')).rejects.toThrow('PASSWORD_HASH_INVALID');
  });

  it('logs when debug is enabled', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const client = createClient();
    client.signInWithPassword.mockResolvedValue(user());
    const { service } = createService(client, { debug: true });

    await service.signInWithPassword('hunter2');

    expect(info).toHaveBeenCalledWith('[AuthService]', 'signInWithPassword');
    info.mockRestore();
  });

  it('throws when the client is missing', async () => {
    const { service } = createService(null);
    await expect(service.signInWithPassword('p')).rejects.toThrow(
      'Telegram client not initialized',
    );
  });
});

describe('AuthService.getPasswordHint', () => {
  it('returns the hint from the account password', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(new Api.account.Password({ hint: 'my dog' } as never));
    const { service } = createService(client);

    await expect(service.getPasswordHint()).resolves.toBe('my dog');
    expect(client.invoke.mock.calls[0][0]).toBeInstanceOf(Api.account.GetPassword);
  });

  it('returns undefined when no hint is set', async () => {
    const client = createClient();
    client.invoke.mockResolvedValue(new Api.account.Password({} as never));
    const { service } = createService(client);

    await expect(service.getPasswordHint()).resolves.toBeUndefined();
  });

  it('throws when the client is missing', async () => {
    const { service } = createService(null);
    await expect(service.getPasswordHint()).rejects.toThrow('Telegram client not initialized');
  });
});

describe('AuthService.getSessionString', () => {
  it('returns the saved session string', () => {
    const client = createClient();
    const { service } = createService(client);
    expect(service.getSessionString()).toBe('session-string');
  });

  it('falls back to an empty string for non-string sessions', () => {
    const client = createClient();
    client.session.save.mockReturnValue(undefined);
    const { service } = createService(client);
    expect(service.getSessionString()).toBe('');
  });

  it('throws when the client is missing', () => {
    const { service } = createService(null);
    expect(() => service.getSessionString()).toThrow('Telegram client not initialized');
  });
});
