import { Controller, Method, RequestLog } from '@telegenie/decorators';
import {
  BACKEND_BOT_USERNAME,
  BACKEND_TOKEN_STORAGE_KEY,
  DEFAULT_API_BASE_URL,
  type BackendAuthChallenge,
  type BackendClaimResponse,
  type BackendUserProfile,
} from '@telegenie/config';
import {
  RpcError,
  SESSION_PASSWORD_NEEDED_CODE,
  type TelegramWorkerClient,
} from '@telegenie/libs/foundation/telegram/worker';
import type { TelegramCredentials } from '@telegenie/libs/foundation/telegram/utils';
import type GlobalStore from '../../store/global/global.store';

export const SESSION_STORAGE_KEY = 'telegenie_session';

type AuthControllerOptions = {
  debug?: boolean;
  globalStore: GlobalStore;
  worker: TelegramWorkerClient;
  apiBaseUrl?: string;
  backendBotUsername?: string;
  /** Called after a successful login or session restore. */
  onAuthSuccess?: () => void | Promise<void>;
};

function mapAuthError(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message;
    if (message.includes('PHONE_CODE_INVALID')) {
      return 'Invalid code, try again';
    }
    if (message.includes('PHONE_CODE_EXPIRED')) {
      return 'Code expired, restart login';
    }
    if (message.includes('PASSWORD_HASH_INVALID')) {
      return 'Incorrect 2FA password';
    }
    if (message.length > 0) {
      return message;
    }
  }

  if (
    typeof err === 'object' &&
    err !== null &&
    'errorMessage' in err &&
    typeof (err as { errorMessage?: string }).errorMessage === 'string'
  ) {
    const errorMessage = (err as { errorMessage: string }).errorMessage;
    switch (errorMessage) {
      case 'PHONE_CODE_INVALID':
        return 'Invalid code, try again';
      case 'PHONE_CODE_EXPIRED':
        return 'Code expired, restart login';
      case 'PASSWORD_HASH_INVALID':
        return 'Incorrect 2FA password';
      default:
        return errorMessage;
    }
  }

  return 'Authentication failed';
}

function isSessionPasswordNeeded(err: unknown): boolean {
  return (
    (err instanceof RpcError && err.code === SESSION_PASSWORD_NEEDED_CODE) ||
    (err instanceof Error && err.message === SESSION_PASSWORD_NEEDED_CODE)
  );
}

@Controller
export class AuthController {
  private debug: boolean;
  private globalStore: GlobalStore;
  private worker: TelegramWorkerClient;
  private apiBaseUrl: string;
  private onAuthSuccess?: () => void | Promise<void>;
  /** In-flight backend authentication promise used to deduplicate concurrent authenticateBackend calls. */
  private backendAuthPromise: Promise<boolean> | null = null;

  constructor({
    debug,
    globalStore,
    worker,
    apiBaseUrl,
    backendBotUsername,
    onAuthSuccess,
  }: AuthControllerOptions) {
    this.debug = debug ?? false;
    this.globalStore = globalStore;
    this.worker = worker;
    this.apiBaseUrl = apiBaseUrl || DEFAULT_API_BASE_URL;
    this.onAuthSuccess = onAuthSuccess;
    if (backendBotUsername) {
      this.auth.setBackendChallenge(null, backendBotUsername.replace(/^@+/, '').trim());
    }
  }

  @RequestLog()
  @Method()
  configure(credentials: TelegramCredentials) {
    return this.worker.call('auth.configure', [credentials]);
  }

  private get auth() {
    return this.globalStore.auth;
  }

  @RequestLog()
  @Method()
  async tryRestoreSession() {
    if (typeof window === 'undefined') {
      this.auth.setAuthStep('phone');
      return;
    }

    const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!savedSession) {
      this.auth.setAuthStep('phone');
      return;
    }

    this.auth.setAuthLoading(true);
    this.auth.setAuthError(null);

    try {
      await this.worker.call('auth.prepareClient', [savedSession]);
      const authorized = await this.worker.call('auth.isAuthorized', []);

      if (authorized) {
        const sessionString = await this.worker.call('auth.getSessionString', []);
        this.persistSession(sessionString);
        this.auth.setAuthSessionString(sessionString);
        this.auth.setAuthStep('success');
        await this.onAuthSuccess?.();
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        this.auth.setAuthStep('phone');
      }
    } catch (err) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      this.auth.setAuthError(mapAuthError(err));
      this.auth.setAuthStep('phone');
    } finally {
      this.auth.setAuthLoading(false);
    }
  }

  @RequestLog()
  @Method()
  async submitPhone(phone: string) {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      this.auth.setAuthError('Phone number is required');
      return;
    }

    this.auth.setAuthLoading(true);
    this.auth.setAuthError(null);

    try {
      await this.worker.call('auth.prepareClient', ['']);
      const result = await this.worker.call('auth.sendCode', [normalizedPhone]);

      this.auth.setAuthPhoneNumber(normalizedPhone);
      this.auth.setAuthPhoneCodeHash(result.phoneCodeHash);
      this.auth.setAuthIsCodeViaApp(result.isCodeViaApp);
      this.auth.setAuthStep('code');
    } catch (err) {
      this.auth.setAuthError(mapAuthError(err));
      this.auth.setAuthStep('error');
    } finally {
      this.auth.setAuthLoading(false);
    }
  }

  @RequestLog()
  @Method()
  async submitCode(code: string) {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      this.auth.setAuthError('Verification code is required');
      return;
    }

    this.auth.setAuthLoading(true);
    this.auth.setAuthError(null);

    try {
      await this.worker.call('auth.signIn', [
        this.auth.authPhoneNumber,
        this.auth.authPhoneCodeHash,
        normalizedCode,
      ]);
      await this.completeLogin();
    } catch (err) {
      if (isSessionPasswordNeeded(err)) {
        try {
          const hint = await this.worker.call('auth.getPasswordHint', []);
          this.auth.setAuthPasswordHint(hint);
          this.auth.setAuthStep('password');
        } catch (hintErr) {
          this.auth.setAuthError(mapAuthError(hintErr));
          this.auth.setAuthStep('error');
        }
      } else {
        this.auth.setAuthError(mapAuthError(err));
        this.auth.setAuthStep('error');
      }
    } finally {
      this.auth.setAuthLoading(false);
    }
  }

  @RequestLog()
  @Method()
  async submitPassword(password: string) {
    if (!password) {
      this.auth.setAuthError('2FA password is required');
      return;
    }

    this.auth.setAuthLoading(true);
    this.auth.setAuthError(null);

    try {
      await this.worker.call('auth.signInWithPassword', [password]);
      await this.completeLogin();
    } catch (err) {
      this.auth.setAuthError(mapAuthError(err));
      this.auth.setAuthStep('error');
    } finally {
      this.auth.setAuthLoading(false);
    }
  }

  /**
   * Sets the base URL for the TeleGenie Cloud backend API.
   *
   * @param url - The backend API base URL (e.g. `https://api.telegenie.top`).
   */
  @RequestLog()
  @Method()
  setApiBaseUrl(url: string) {
    if (url && typeof url === 'string') {
      this.apiBaseUrl = url;
    }
  }

  /**
   * Sets the Telegram bot username used for zero-trust MTProto backend authentication.
   * Automatically strips leading `@` symbols and whitespace.
   *
   * @param username - The bot username (e.g. `telegenie_ai` or `@telegenie_ai`).
   */
  @RequestLog()
  @Method()
  setBackendBotUsername(username: string) {
    if (username && typeof username === 'string') {
      this.auth.setBackendChallenge(this.auth.backendChallengeNonce, username.replace(/^@+/, '').trim());
    }
  }

  /**
   * Returns the normalized backend API base URL with trailing slashes removed.
   */
  @RequestLog()
  @Method()
  getBackendBaseUrl(): string {
    return this.apiBaseUrl.replace(/\/+$/, '');
  }

  /**
   * Returns the active backend JWT token from the store, falling back to localStorage.
   */
  @RequestLog()
  @Method()
  getBackendToken(): string | null {
    if (this.auth.backendToken) {
      return this.auth.backendToken;
    }
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(BACKEND_TOKEN_STORAGE_KEY);
      if (saved) {
        this.auth.setBackendToken(saved);
        return saved;
      }
    }
    return null;
  }

  /**
   * Generates a Telegram deep-link URL (`https://t.me/<bot>?start=<nonce>`) for manual
   * challenge verification fallback when MTProto automated startBot cannot be completed.
   *
   * @param nonce - Optional challenge nonce override. Defaults to active nonce from store.
   */
  @RequestLog()
  @Method()
  getDeepLinkUrl(nonce?: string): string {
    const activeNonce = nonce || this.auth.backendChallengeNonce;
    const bot = this.auth.backendBotUsername || BACKEND_BOT_USERNAME;
    return activeNonce ? `https://t.me/${bot}?start=${activeNonce}` : `https://t.me/${bot}`;
  }

  /**
   * Fetches the current user profile, subscription status, and AI credits from `/api/users/me`.
   *
   * Behavior and Error Handling:
   * - If the backend returns HTTP 401 (Unauthenticated):
   *   1. Clears invalid/expired JWT from storage and MobX store.
   *   2. Automatically triggers `authenticateBackend({ force: true })` if `retry` is true.
   *   3. Returns the refreshed profile on re-auth success, or `null` on failure.
   * - If `retry` is explicitly set to false, clears token and sets status to `'idle'` without re-challenging.
   *
   * @param tokenOverrideOrOptions - Either an explicit JWT override string, or options object `{ retry?, token? }`.
   * @param optionsParam - Optional configuration `{ retry?: boolean }` when first arg is a token string.
   * @returns The user's backend profile or `null` if unauthenticated/failed.
   */
  @RequestLog()
  @Method()
  async getBackendMe(
    tokenOverrideOrOptions?: string | { retry?: boolean; token?: string },
    optionsParam?: { retry?: boolean },
  ): Promise<BackendUserProfile | null> {
    let tokenOverride: string | undefined;
    let retry = true;

    if (typeof tokenOverrideOrOptions === 'string') {
      tokenOverride = tokenOverrideOrOptions;
    } else if (typeof tokenOverrideOrOptions === 'object' && tokenOverrideOrOptions !== null) {
      tokenOverride = tokenOverrideOrOptions.token;
      if (tokenOverrideOrOptions.retry !== undefined) {
        retry = tokenOverrideOrOptions.retry;
      }
    }

    if (optionsParam?.retry !== undefined) {
      retry = optionsParam.retry;
    }

    const token = tokenOverride || this.auth.backendToken;
    if (!token) return null;

    try {
      const baseUrl = this.getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/api/users/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(BACKEND_TOKEN_STORAGE_KEY);
        }
        this.auth.setBackendToken(null);
        this.auth.setBackendUserProfile(null);

        if (retry) {
          if (this.debug) {
            console.info(
              '[AuthController] Backend returned 401 unauthenticated, retrying backend auth',
            );
          }
          const success = await this.authenticateBackend({ force: true });
          if (success) {
            return this.auth.backendUserProfile;
          }
          return null;
        }

        this.auth.setBackendAuthStatus('idle');
        return null;
      }

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Failed to fetch user profile: ${res.status} ${errorText}`);
      }

      const profile = (await res.json()) as BackendUserProfile;
      this.auth.setBackendUserProfile(profile);
      this.auth.setBackendAuthStatus('authenticated');
      this.auth.setBackendAuthError(null);
      return profile;
    } catch (err) {
      if (this.debug) {
        console.warn('[AuthController] getBackendMe error:', err);
      }
      this.auth.setBackendAuthError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  /**
   * Updates the user's enableTracing preference in backend users table.
   *
   * @param enableTracing - Whether tracing is enabled for this user.
   * @returns Updated BackendUserProfile or null on failure.
   */
  @RequestLog()
  @Method()
  async setEnableTracing(enableTracing: boolean): Promise<BackendUserProfile | null> {
    const token = this.getBackendToken();
    if (!token) return null;

    try {
      const baseUrl = this.getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/api/users/me/tracing`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enableTracing }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Failed to update tracing preference: ${res.status} ${errorText}`);
      }

      const profile = (await res.json()) as BackendUserProfile;
      this.auth.setBackendUserProfile(profile);
      return profile;
    } catch (err) {
      if (this.debug) {
        console.warn('[AuthController] setEnableTracing error:', err);
      }
      return null;
    }
  }

  /**
   * Attempts to claim an authentication token for a given challenge nonce from `/api/auth/claim`.
   *
   * Flow:
   * 1. Sends a POST request with `{ nonce }`.
   * 2. If verified and authorized by the bot, extracts the issued JWT token.
   * 3. Persists the JWT in `localStorage` and MobX state.
   * 4. Fetches the initial user profile via `getBackendMe(token, { retry: false })`.
   *
   * @param nonce - The challenge UUID nonce to claim.
   * @returns `true` if claimed and authenticated successfully, `false` otherwise.
   */
  @RequestLog()
  @Method()
  async claimBackendChallenge(nonce: string): Promise<boolean> {
    const trimmedNonce = nonce.trim();
    if (!trimmedNonce) return false;

    try {
      const baseUrl = this.getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nonce: trimmedNonce }),
      });

      if (!res.ok) {
        return false;
      }

      const claimData = (await res.json()) as BackendClaimResponse;
      if (!claimData.token) return false;

      if (typeof window !== 'undefined') {
        localStorage.setItem(BACKEND_TOKEN_STORAGE_KEY, claimData.token);
      }
      this.auth.setBackendToken(claimData.token);
      this.auth.setBackendChallenge(null, this.auth.backendBotUsername);
      await this.getBackendMe(claimData.token, { retry: false });
      return true;
    } catch (err) {
      if (this.debug) {
        console.warn('[AuthController] claimBackendChallenge error:', err);
      }
      return false;
    }
  }

  /**
   * Authenticates the current client with the TeleGenie Cloud backend to synchronize JWT
   * and AI credit balance.
   *
   * Flow & Invariants:
   * - Deduplicates concurrent calls via `backendAuthPromise`, ensuring only one challenge
   *   or token validation workflow runs at a time.
   * - If `options.force` is not set, attempts to restore session using existing saved JWT in `localStorage`.
   * - If no saved token exists or if saved token is invalid (401), initiates the full MTProto
   *   challenge-response workflow via `executeAuthenticateBackend`.
   *
   * @param options - `{ force?: boolean }`. When true, skips existing saved token check.
   * @returns `true` if authentication succeeded, `false` otherwise.
   */
  @RequestLog()
  @Method()
  async authenticateBackend(options?: { force?: boolean }): Promise<boolean> {
    if (this.backendAuthPromise) {
      return this.backendAuthPromise;
    }

    this.backendAuthPromise = this.executeAuthenticateBackend(options);
    try {
      return await this.backendAuthPromise;
    } finally {
      this.backendAuthPromise = null;
    }
  }

  /**
   * Executes the backend authentication workflow:
   *
   * Step 1: Token Restoration (unless force=true)
   * - Validates saved JWT via `getBackendMe(savedToken, { retry: false })`.
   * - If valid, establishes authenticated session immediately.
   *
   * Step 2: Challenge Creation
   * - Requests a new challenge nonce from `/api/auth/challenge`.
   * - Stores nonce and target bot username in store; sets status to `'verifying'`.
   *
   * Step 3: MTProto Automated Trigger
   * - Sends `/start <nonce>` to the auth bot via MTProto worker (`auth.startBot`).
   * - If worker call fails (e.g. rate limit, network), continues to polling while user
   *   can tap the deep-link fallback in UI.
   *
   * Step 4: Claim Polling
   * - Polls `/api/auth/claim` every 1.5s for up to 15 attempts (22.5s total).
   * - On success, stores token, profile, and transitions to `'authenticated'`.
   * - On timeout or failure, marks status as `'error'` and sets descriptive error message.
   *
   * @param options - `{ force?: boolean }`
   * @returns `true` if successfully authenticated, `false` otherwise.
   */
  private async executeAuthenticateBackend(options?: { force?: boolean }): Promise<boolean> {
    // 1. Check existing saved token if not forcing re-authentication
    if (!options?.force) {
      const savedToken =
        typeof window !== 'undefined'
          ? localStorage.getItem(BACKEND_TOKEN_STORAGE_KEY)
          : null;
      if (savedToken) {
        this.auth.setBackendToken(savedToken);
        const profile = await this.getBackendMe(savedToken, { retry: false });
        if (profile) {
          return true;
        }
      }
    }

    this.auth.setBackendAuthStatus('challenging');
    this.auth.setBackendAuthError(null);

    try {
      const baseUrl = this.getBackendBaseUrl();
      const challengeRes = await fetch(`${baseUrl}/api/auth/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!challengeRes.ok) {
        const text = await challengeRes.text().catch(() => '');
        throw new Error(`Failed to request challenge: ${challengeRes.status} ${text}`);
      }

      const challenge = (await challengeRes.json()) as BackendAuthChallenge;
      const botUsername = challenge.botUsername || BACKEND_BOT_USERNAME;
      this.auth.setBackendChallenge(challenge.nonce, botUsername);
      this.auth.setBackendAuthStatus('verifying');

      // 2. Automated trigger: startBot via MTProto in worker
      try {
        await this.worker.call('auth.startBot', [botUsername, challenge.nonce]);
      } catch (startErr) {
        if (this.debug) {
          console.warn(
            '[AuthController] Automated startBot MTProto call failed, continuing with polling for deep-link fallback:',
            startErr,
          );
        }
      }

      // 3. Poll /api/auth/claim (every 1.5s, up to 15 attempts = 22.5s)
      for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const claimed = await this.claimBackendChallenge(challenge.nonce);
        if (claimed) {
          return true;
        }
      }

      this.auth.setBackendAuthStatus('error');
      this.auth.setBackendAuthError(
        'Challenge verification timed out. Tap to open the bot in Telegram to verify.',
      );
      return false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.auth.setBackendAuthStatus('error');
      this.auth.setBackendAuthError(msg);
      return false;
    }
  }

  /**
   * Clears saved backend authentication tokens from `localStorage` and resets
   * all backend auth MobX store fields to their initial idle state.
   */
  @RequestLog()
  @Method()
  logoutBackend() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(BACKEND_TOKEN_STORAGE_KEY);
    }
    this.auth.resetBackendAuth();
  }

  @RequestLog()
  @Method()
  reset() {
    this.auth.resetAuth();
  }

  private async completeLogin() {
    const sessionString = await this.worker.call('auth.getSessionString', []);
    this.persistSession(sessionString);
    this.auth.setAuthSessionString(sessionString);
    this.auth.setAuthStep('success');
    await this.onAuthSuccess?.();
  }

  private persistSession(sessionString: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, sessionString);
    }
  }
}
