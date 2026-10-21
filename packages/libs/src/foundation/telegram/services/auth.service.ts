import { Api, TelegramClient } from '@telegenie/teleproto';
import type { TelegramCredentials } from '../utils';
import { TransportService } from './transport.service';
import { convertUser } from './converters/user.converter';
import type { User } from '../types/users';

export class SessionPasswordNeededError extends Error {
  constructor() {
    super('SESSION_PASSWORD_NEEDED');
    this.name = 'SessionPasswordNeededError';
  }
}

type AuthServiceOptions = {
  debug?: boolean;
  transportService: TransportService;
};

export class AuthService {
  private debug: boolean;
  private apiCredentials: TelegramCredentials = { apiId: 0, apiHash: '' };
  transportService: TransportService;

  constructor({ debug, transportService }: AuthServiceOptions) {
    this.transportService = transportService;
    this.debug = debug ?? false;
  }

  private log(...args: unknown[]) {
    if (this.debug) {
      console.info('[AuthService]', ...args);
    }
  }

  get client() {
    return this.transportService.client;
  }

  configure(credentials: TelegramCredentials) {
    this.apiCredentials = credentials;
  }

  async prepareClient(session = '') {
    await this.transportService.prepareConnection(session, this.apiCredentials);
  }

  async isAuthorized() {
    const client = this.client;
    if (!client) {
      return false;
    }
    return client.checkAuthorization();
  }

  async sendCode(phoneNumber: string) {
    const client = this.ensureClient();
    this.log('sendCode', phoneNumber);
    return client.sendCode(this.apiCredentials, phoneNumber);
  }

  async signIn(phoneNumber: string, phoneCodeHash: string, phoneCode: string): Promise<User> {
    const client = this.ensureClient();
    this.log('signIn', phoneNumber);

    try {
      const result = await client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash,
          phoneCode,
        }),
      );

      if (result instanceof Api.auth.Authorization) {
        return convertUser(result.user);
      }

      throw new Error('Unexpected sign-in result');
    } catch (err: unknown) {
      if (this.isSessionPasswordNeeded(err)) {
        throw new SessionPasswordNeededError();
      }
      throw err;
    }
  }

  async signInWithPassword(password: string): Promise<User> {
    const client = this.ensureClient();
    this.log('signInWithPassword');

    const result = await client.signInWithPassword(this.apiCredentials, {
      password: async () => password,
      onError: (err) => {
        throw err;
      },
    });
    return convertUser(result);
  }

  async getPasswordHint(): Promise<string | undefined> {
    const client = this.ensureClient();
    const result = await client.invoke(new Api.account.GetPassword());
    return result.hint ?? undefined;
  }

  getSessionString(): string {
    const client = this.ensureClient();
    const saved = client.session.save() as unknown;
    return typeof saved === 'string' ? saved : '';
  }

  private ensureClient(): TelegramClient {
    if (!this.client) {
      throw new Error('Telegram client not initialized');
    }
    return this.client;
  }

  private isSessionPasswordNeeded(err: unknown) {
    return (
      err instanceof SessionPasswordNeededError ||
      (typeof err === 'object' &&
        err !== null &&
        'errorMessage' in err &&
        (err as { errorMessage?: string }).errorMessage === 'SESSION_PASSWORD_NEEDED')
    );
  }
}
