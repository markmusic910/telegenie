import { BACKEND_TOKEN_STORAGE_KEY } from '@telegenie/config';
import type { TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';
import GlobalStore from '../../store/global/global.store';
import StoreManager from '../../store/store.manager';
import { AuthController } from './auth.controller';

class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('AuthController Backend Authentication', () => {
  let globalStore: GlobalStore;
  let mockWorker: jest.Mocked<TelegramWorkerClient>;
  let authController: AuthController;
  const mockApiBaseUrl = 'https://api.example.com';
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    (global as any).window = {};
    (global as any).localStorage = mockStorage;
    const sm = new StoreManager();
    globalStore = new GlobalStore(sm);
    mockWorker = {
      call: jest.fn(),
      on: jest.fn(),
    } as unknown as jest.Mocked<TelegramWorkerClient>;

    authController = new AuthController({
      debug: false,
      globalStore,
      worker: mockWorker,
      apiBaseUrl: mockApiBaseUrl,
    });

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates correct Telegram deep-link URL', () => {
    globalStore.auth.setBackendChallenge('nonce-123', 'telegenie_ai');
    expect(authController.getDeepLinkUrl()).toBe('https://t.me/telegenie_ai?start=nonce-123');
    expect(authController.getDeepLinkUrl('custom-nonce')).toBe(
      'https://t.me/telegenie_ai?start=custom-nonce',
    );
  });

  it('supports custom or staging bot username via options and setBackendBotUsername', () => {
    authController.setBackendBotUsername('telegenie_stage_aibot');
    expect(authController.getDeepLinkUrl('test-nonce')).toBe(
      'https://t.me/telegenie_stage_aibot?start=test-nonce',
    );
  });

  it('restores existing valid token from localStorage without creating challenge', async () => {
    localStorage.setItem(BACKEND_TOKEN_STORAGE_KEY, 'valid-saved-jwt');

    const mockProfile = {
      telegramId: '12345678',
      credits: {
        dailyFreeLimit: 5000,
        dailyFreeUsed: 100,
        dailyFreeRemaining: 4900,
        paidCredits: 200,
        totalAvailable: 5100,
        lastResetDate: '2026-11-01',
      },
      status: {
        isBlocked: false,
        createdAt: 1700000000,
        lastActiveAt: 1700001000,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockProfile,
    });

    const success = await authController.authenticateBackend();

    expect(success).toBe(true);
    expect(globalStore.auth.backendToken).toBe('valid-saved-jwt');
    expect(globalStore.auth.backendAuthStatus).toBe('authenticated');
    expect(globalStore.auth.backendUserProfile).toEqual(mockProfile);
    expect(global.fetch).toHaveBeenCalledWith(
      `${mockApiBaseUrl}/api/users/me`,
      expect.objectContaining({
        headers: { Authorization: 'Bearer valid-saved-jwt' },
      }),
    );
    expect(mockWorker.call).not.toHaveBeenCalledWith('auth.startBot', expect.anything());
  });

  it('executes full challenge-response workflow when no token is present', async () => {
    const challengeResponse = {
      nonce: 'challenge-uuid-456',
      botUsername: 'telegenie_ai',
      expiresAt: Math.floor(Date.now() / 1000) + 120,
    };

    const claimResponse = {
      token: 'newly-issued-jwt',
      telegramId: '98765432',
      expiresIn: 2592000,
    };

    const mockProfile = {
      telegramId: '98765432',
      credits: {
        dailyFreeLimit: 5000,
        dailyFreeUsed: 0,
        dailyFreeRemaining: 5000,
        paidCredits: 0,
        totalAvailable: 5000,
        lastResetDate: '2026-11-01',
      },
      status: {
        isBlocked: false,
        createdAt: 1700000000,
        lastActiveAt: 1700001000,
      },
    };

    // 1. /api/auth/challenge
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => challengeResponse,
    });

    // 2. /api/auth/claim (first attempt succeeds)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => claimResponse,
    });

    // 3. /api/users/me
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockProfile,
    });

    mockWorker.call.mockResolvedValueOnce(undefined);

    const success = await authController.authenticateBackend();

    expect(success).toBe(true);
    expect(mockWorker.call).toHaveBeenCalledWith('auth.startBot', [
      'telegenie_ai',
      'challenge-uuid-456',
    ]);
    expect(localStorage.getItem(BACKEND_TOKEN_STORAGE_KEY)).toBe('newly-issued-jwt');
    expect(globalStore.auth.backendToken).toBe('newly-issued-jwt');
    expect(globalStore.auth.backendAuthStatus).toBe('authenticated');
    expect(globalStore.auth.backendUserProfile).toEqual(mockProfile);
  });

  it('handles logoutBackend by clearing storage and resetting auth slice', () => {
    localStorage.setItem(BACKEND_TOKEN_STORAGE_KEY, 'some-jwt');
    globalStore.auth.setBackendToken('some-jwt');
    globalStore.auth.setBackendAuthStatus('authenticated');

    authController.logoutBackend();

    expect(localStorage.getItem(BACKEND_TOKEN_STORAGE_KEY)).toBeNull();
    expect(globalStore.auth.backendToken).toBeNull();
    expect(globalStore.auth.backendAuthStatus).toBe('idle');
    expect(globalStore.auth.backendUserProfile).toBeNull();
  });

  it('retries auth when getBackendMe returns 401 unauthenticated and succeeds', async () => {
    globalStore.auth.setBackendToken('expired-jwt');
    localStorage.setItem(BACKEND_TOKEN_STORAGE_KEY, 'expired-jwt');

    const challengeResponse = {
      nonce: 'retry-nonce-789',
      botUsername: 'telegenie_ai',
      expiresAt: Math.floor(Date.now() / 1000) + 120,
    };

    const claimResponse = {
      token: 'fresh-jwt-token',
      telegramId: '12345678',
      expiresIn: 2592000,
    };

    const freshProfile = {
      telegramId: '12345678',
      credits: {
        dailyFreeLimit: 5000,
        dailyFreeUsed: 50,
        dailyFreeRemaining: 4950,
        paidCredits: 100,
        totalAvailable: 5050,
        lastResetDate: '2026-11-02',
      },
      status: {
        isBlocked: false,
        createdAt: 1700000000,
        lastActiveAt: 1700002000,
      },
    };

    // 1. Initial getBackendMe call with expired token returns 401
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    // 2. Retry auth: /api/auth/challenge
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => challengeResponse,
    });

    // 3. Retry auth: /api/auth/claim
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => claimResponse,
    });

    // 4. Retry auth: getBackendMe with fresh token inside claimBackendChallenge
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => freshProfile,
    });

    mockWorker.call.mockResolvedValueOnce(undefined);

    const profile = await authController.getBackendMe();

    expect(profile).toEqual(freshProfile);
    expect(globalStore.auth.backendToken).toBe('fresh-jwt-token');
    expect(globalStore.auth.backendAuthStatus).toBe('authenticated');
    expect(globalStore.auth.backendUserProfile).toEqual(freshProfile);
    expect(localStorage.getItem(BACKEND_TOKEN_STORAGE_KEY)).toBe('fresh-jwt-token');
  });

  it('does not retry auth when retry option is false on 401', async () => {
    globalStore.auth.setBackendToken('expired-jwt');
    localStorage.setItem(BACKEND_TOKEN_STORAGE_KEY, 'expired-jwt');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    const profile = await authController.getBackendMe(undefined, { retry: false });

    expect(profile).toBeNull();
    expect(globalStore.auth.backendToken).toBeNull();
    expect(globalStore.auth.backendAuthStatus).toBe('idle');
    expect(localStorage.getItem(BACKEND_TOKEN_STORAGE_KEY)).toBeNull();
    // fetch was only called once, no challenge or claim calls
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to challenge-response when saved token in localStorage returns 401 in authenticateBackend', async () => {
    localStorage.setItem(BACKEND_TOKEN_STORAGE_KEY, 'stale-token');

    const challengeResponse = {
      nonce: 'fallback-nonce-999',
      botUsername: 'telegenie_ai',
      expiresAt: Math.floor(Date.now() / 1000) + 120,
    };

    const claimResponse = {
      token: 'recovered-jwt',
      telegramId: '12345678',
      expiresIn: 2592000,
    };

    const recoveredProfile = {
      telegramId: '12345678',
      credits: {
        dailyFreeLimit: 5000,
        dailyFreeUsed: 0,
        dailyFreeRemaining: 5000,
        paidCredits: 0,
        totalAvailable: 5000,
        lastResetDate: '2026-11-02',
      },
      status: {
        isBlocked: false,
        createdAt: 1700000000,
        lastActiveAt: 1700002000,
      },
    };

    // 1. Initial saved token validation returns 401
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    // 2. /api/auth/challenge
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => challengeResponse,
    });

    // 3. /api/auth/claim
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => claimResponse,
    });

    // 4. /api/users/me with recovered token
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => recoveredProfile,
    });

    mockWorker.call.mockResolvedValueOnce(undefined);

    const success = await authController.authenticateBackend();

    expect(success).toBe(true);
    expect(globalStore.auth.backendToken).toBe('recovered-jwt');
    expect(globalStore.auth.backendAuthStatus).toBe('authenticated');
    expect(globalStore.auth.backendUserProfile).toEqual(recoveredProfile);
    expect(localStorage.getItem(BACKEND_TOKEN_STORAGE_KEY)).toBe('recovered-jwt');
  });

  it('updates enableTracing preference via setEnableTracing', async () => {
    globalStore.auth.setBackendToken('jwt-token-tracing');
    const updatedProfile = {
      telegramId: '123456789',
      enableTracing: true,
      credits: {
        dailyFreeLimit: 5000,
        dailyFreeUsed: 100,
        dailyFreeRemaining: 4900,
        paidCredits: 0,
        totalAvailable: 4900,
        lastResetDate: '2026-11-03',
      },
      status: {
        isBlocked: false,
        createdAt: 1700000000,
        lastActiveAt: 1700002000,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => updatedProfile,
    });

    const result = await authController.setEnableTracing(true);

    expect(result).toEqual(updatedProfile);
    expect(globalStore.auth.backendUserProfile).toEqual(updatedProfile);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/users/me/tracing',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-token-tracing',
        }),
        body: JSON.stringify({ enableTracing: true }),
      }),
    );
  });
});
