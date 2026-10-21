jest.mock('../utils', () => ({
  initClient: jest.fn(),
}));

import { initClient } from '../utils';
import { TransportService } from './transport.service';

const initClientMock = initClient as unknown as jest.Mock;

type FakeClient = {
  connected: boolean;
  connect: jest.Mock;
  checkAuthorization: jest.Mock;
};

function createClient(overrides: Partial<FakeClient> = {}): FakeClient {
  return {
    connected: false,
    connect: jest.fn().mockResolvedValue(true),
    checkAuthorization: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('TransportService.prepareConnection', () => {
  beforeEach(() => {
    initClientMock.mockReset();
  });

  it('does not reconnect an already connected client', async () => {
    const client = createClient({ connected: true });
    initClientMock.mockResolvedValue(client);

    const transport = new TransportService();
    await transport.prepareConnection('session', { apiId: 1, apiHash: 'hash' });

    expect(initClientMock).toHaveBeenCalledWith('session', { apiId: 1, apiHash: 'hash' });
    expect(client.connect).not.toHaveBeenCalled();
    expect(transport.client).toBe(client as never);
  });

  it('connects a disconnected client', async () => {
    const client = createClient();
    initClientMock.mockResolvedValue(client);

    const transport = new TransportService();
    await transport.prepareConnection();

    expect(initClientMock).toHaveBeenCalledWith('', undefined);
    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  it('throws when the connection cannot be established', async () => {
    const client = createClient({ connect: jest.fn().mockResolvedValue(false) });
    initClientMock.mockResolvedValue(client);

    const transport = new TransportService();
    await expect(transport.prepareConnection()).rejects.toThrow('unable to connect to telegram');
  });
});

describe('TransportService.init', () => {
  beforeEach(() => {
    initClientMock.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('short-circuits when the existing client is already authorized', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const client = createClient({ connected: true });
    initClientMock.mockResolvedValue(client);

    const transport = new TransportService({ debug: true });
    await transport.prepareConnection();
    initClientMock.mockClear();

    await transport.init();

    expect(initClientMock).not.toHaveBeenCalled();
    expect(client.checkAuthorization).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith('[TransportService]', 'TG client already initialized');
  });

  it('reconnects and authorizes when no client exists yet', async () => {
    const client = createClient();
    initClientMock.mockResolvedValue(client);

    const transport = new TransportService();
    await transport.init();

    expect(initClientMock).toHaveBeenCalledTimes(1);
    expect(client.checkAuthorization).toHaveBeenCalledTimes(1);
  });

  it('reconnects when the existing client is connected but unauthorized', async () => {
    const client = createClient({
      connected: true,
      checkAuthorization: jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true),
    });
    initClientMock.mockResolvedValue(client);

    const transport = new TransportService();
    await transport.prepareConnection();
    initClientMock.mockClear();

    await transport.init();

    expect(initClientMock).toHaveBeenCalledTimes(1);
    expect(client.checkAuthorization).toHaveBeenCalledTimes(2);
  });

  it('retries with backoff and succeeds on the second attempt', async () => {
    jest.useFakeTimers();
    const client = createClient({
      checkAuthorization: jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true),
    });
    initClientMock.mockResolvedValue(client);

    const transport = new TransportService();
    const pending = transport.init();
    await jest.advanceTimersByTimeAsync(500);
    await pending;

    expect(client.checkAuthorization).toHaveBeenCalledTimes(2);
  });

  it('gives up after three attempts and rethrows the unauthorized error', async () => {
    jest.useFakeTimers();
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const client = createClient({ checkAuthorization: jest.fn().mockResolvedValue(false) });
    initClientMock.mockResolvedValue(client);

    const transport = new TransportService({ debug: true });
    const pending = transport.init();
    const assertion = expect(pending).rejects.toThrow('unauthorized');
    await jest.advanceTimersByTimeAsync(500);
    await jest.advanceTimersByTimeAsync(1000);
    await assertion;

    expect(client.checkAuthorization).toHaveBeenCalledTimes(3);
    expect(info).toHaveBeenCalledTimes(3);
  });

  it('stays silent without the debug flag', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const client = createClient({ connected: true });
    initClientMock.mockResolvedValue(client);

    const transport = new TransportService();
    await transport.prepareConnection();
    await transport.init();

    expect(info).not.toHaveBeenCalled();
  });
});
