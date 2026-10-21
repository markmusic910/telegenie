import { Controller, Method, RequestLog } from '@telegenie/decorators';
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
  private onAuthSuccess?: () => void | Promise<void>;

  constructor({ debug, globalStore, worker, onAuthSuccess }: AuthControllerOptions) {
    this.debug = debug ?? false;
    this.globalStore = globalStore;
    this.worker = worker;
    this.onAuthSuccess = onAuthSuccess;
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
