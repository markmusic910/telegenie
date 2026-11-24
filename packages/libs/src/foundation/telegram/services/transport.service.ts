import { TelegramClient } from '@telegenie/teleproto';
import type { FileRefEngine } from '../file-ref/engine';
import { initClient, type TelegramCredentials } from '../utils';

type TransportServiceOptions = {
  debug?: boolean;
};

type ClientChangeListener = (client: TelegramClient) => void;

function connectionKey(session: string, credentials?: TelegramCredentials): string {
  return `${session}|${credentials?.apiId ?? ''}|${credentials?.apiHash ?? ''}`;
}

/**
 * TransportService
 */
export class TransportService {
  private debug: boolean;
  client: TelegramClient | null = null;
  fileRefEngine?: FileRefEngine;
  private activeSessionKey: string | undefined;
  private pendingConnect: { key: string; promise: Promise<void> } | null = null;
  private readonly clientChangeListeners = new Set<ClientChangeListener>();

  constructor({ debug }: TransportServiceOptions = {}) {
    this.debug = debug ?? false;
  }

  log(...args: any) {
    if (this.debug) {
      console.info('[TransportService]', ...args);
    }
  }

  subscribeClientChange(listener: ClientChangeListener): () => void {
    this.clientChangeListeners.add(listener);
    return () => {
      this.clientChangeListeners.delete(listener);
    };
  }

  setFileRefEngine(engine?: FileRefEngine): void {
    this.fileRefEngine = engine;
    if (engine && this.client && typeof this.client.invoke === 'function') {
      engine.install(this.client);
    }
  }

  private connectClient = async (session = '', credentials?: TelegramCredentials) => {
    const prevClient = this.client;
    const nextClient = await initClient(session, credentials);
    if (!nextClient.connected) {
      const connected = await nextClient.connect();
      if (!connected) {
        throw new Error('unable to connect to telegram');
      }
    }
    this.client = nextClient;
    this.activeSessionKey = connectionKey(session, credentials);
    if (this.fileRefEngine && typeof nextClient.invoke === 'function') {
      this.fileRefEngine.install(nextClient);
    }
    if (prevClient && prevClient !== nextClient) {
      if (typeof prevClient.disconnect === 'function') {
        void prevClient.disconnect().catch(() => {
          // Ignore disconnect errors on superseded clients.
        });
      }
      for (const listener of this.clientChangeListeners) {
        try {
          listener(nextClient);
        } catch (err) {
          console.error('[TransportService] clientChange listener error', err);
        }
      }
    }
  };

  prepareConnection = async (session = '', credentials?: TelegramCredentials) => {
    const key = connectionKey(session, credentials);
    if (session.trim().length > 0 && this.client?.connected && this.activeSessionKey === key) {
      this.log('Reusing existing connected TG client');
      return;
    }
    if (this.pendingConnect && this.pendingConnect.key === key) {
      return this.pendingConnect.promise;
    }
    const promise = this.connectClient(session, credentials).finally(() => {
      if (this.pendingConnect?.promise === promise) {
        this.pendingConnect = null;
      }
    });
    this.pendingConnect = { key, promise };
    return promise;
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
