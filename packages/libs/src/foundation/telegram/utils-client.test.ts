/**
 * @jest-environment node
 */
const mockConnect = jest.fn();
const mockGetDC = jest.fn();

jest.mock('@telegenie/teleproto', () => {
  const actual = jest.requireActual('@telegenie/teleproto');
  return {
    ...actual,
    TelegramClient: jest.fn().mockImplementation(() => ({
      connect: mockConnect,
      getDC: mockGetDC,
    })),
  };
});

import { TelegramClient, extensions } from '@telegenie/teleproto';
import { StringSession } from '@telegenie/teleproto/sessions';
import { getBrowserWssClientParams, getDCAddressBySession, initClient } from './utils';

describe('initClient / getDCAddressBySession', () => {
  const prevEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_TELEGRAM_API_ID = '1';
    process.env.NEXT_PUBLIC_TELEGRAM_API_HASH = 'hash';
    mockConnect.mockResolvedValue(undefined);
    mockGetDC.mockResolvedValue({ ipAddress: '1.2.3.4', port: 443 });
  });

  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
    delete (globalThis as any).tg_client;
  });

  it('initClient creates a client with default DC for empty session', async () => {
    process.env.NODE_ENV = 'development';
    const client = await initClient('', { apiId: 1, apiHash: 'h' });
    expect(TelegramClient).toHaveBeenCalled();
    expect(client).toBeDefined();
    expect((globalThis as any).tg_client).toBe(client);
  });

  it('initClient forces WebSocket/WSS client params', async () => {
    await initClient('', { apiId: 1, apiHash: 'h' });
    const opts = (TelegramClient as unknown as jest.Mock).mock.calls[0][3];
    expect(opts.networkSocket).toBe(extensions.PromisedWebSockets);
  });

  it('getBrowserWssClientParams returns browser-safe defaults', () => {
    const opts = getBrowserWssClientParams();
    expect(opts.networkSocket).toBe(extensions.PromisedWebSockets);
  });

  it('initClient does not assign global outside development', async () => {
    process.env.NODE_ENV = 'test';
    await initClient('', { apiId: 1, apiHash: 'h' });
    expect((globalThis as any).tg_client).toBeUndefined();
  });

  it('getDCAddressBySession connects and returns DC address', async () => {
    const session = new StringSession('');
    session.setDC(2, '127.0.0.1', 80);
    const result = await getDCAddressBySession(session, true);
    expect(mockConnect).toHaveBeenCalled();
    expect(mockGetDC).toHaveBeenCalledWith(2, true);
    expect(result).toEqual({ address: '1.2.3.4', port: 443 });
  });
});
