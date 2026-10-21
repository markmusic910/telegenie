import { TelegramClient } from '@telegenie/teleproto';
import type { FileRefEngine } from '../file-ref/engine';
import { initClient, type TelegramCredentials } from '../utils';

type TransportServiceOptions = {
  debug?: boolean;
};

/**
 * TransportService
 */
export class TransportService {
  private debug: boolean;
  client: TelegramClient | null = null;
  fileRefEngine?: FileRefEngine;

  constructor({ debug }: TransportServiceOptions = {}) {
    this.debug = debug ?? false;
  }

  log(...args: any) {
    if (this.debug) {
      console.info('[TransportService]', ...args);
    }
  }

  setFileRefEngine(engine?: FileRefEngine): void {
    this.fileRefEngine = engine;
    if (engine && this.client && typeof this.client.invoke === 'function') {
      engine.install(this.client);
    }
  }

  private connectClient = async (session = '', credentials?: TelegramCredentials) => {
    this.client = await initClient(session, credentials);
    if (!this.client.connected) {
      const connected = await this.client.connect();
      if (!connected) {
        throw new Error('unable to connect to telegram');
      }
    }
    if (this.fileRefEngine && typeof this.client.invoke === 'function') {
      this.fileRefEngine.install(this.client);
    }
  };

  prepareConnection = async (session = '', credentials?: TelegramCredentials) => {
    await this.connectClient(session, credentials);
  };

  private _initTG = async () => {
    if (this.client?.connected) {
      const authenticated = await this.client.checkAuthorization();
      if (authenticated) {
        this.log('TG client already initialized');
        return;
      }
    }
    await this.connectClient();
    const authenticated = await this.client!.checkAuthorization();
    if (!authenticated) {
      throw new Error('unauthorized');
    }
  };

  init = async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await this._initTG();
        break;
      } catch (e) {
        this.log('initTG error', e, 'retrying...');
        switch (i) {
          case 0:
            await new Promise((resolve) => setTimeout(resolve, 500));
            break;
          case 1:
            await new Promise((resolve) => setTimeout(resolve, 1000));
            break;
          default:
            throw e;
        }
      }
    }
  };
}
