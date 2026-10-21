import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';
import type { LocalDb } from '../local-db/local-db';
import type { TypeEncryptedChat } from '../types/api-types';
import type { UpdateManager } from '../update-manager/update-manager';
import {
  convertTypeEncryptedChat,
  convertTypeEncryptedChatWithStatus,
} from './converters/encrypted-chat.converter';
import type { TransportService } from './transport.service';
import {
  calcAuthKeyFromDh,
  calcKeyFingerprint,
  fetchDhConfig,
  generateDhKeyPair,
  getCachedDhConfig,
  handleUpdateEncryption,
  resolveInputUsers,
  setCachedDhConfig,
  type DhConfigCache,
} from './utils';

type EncryptedChatServiceOptions = {
  debug?: boolean;
  transportService: TransportService;
  localDb?: LocalDb;
  updateManager?: UpdateManager;
};

/**
 * EncryptedChatService — secret chat initiate + accept handshake.
 */
export class EncryptedChatService {
  private debug: boolean;
  private log: (...args: any) => void;
  transportService: TransportService;
  localDb: LocalDb | undefined;
  updateManager: UpdateManager | undefined;
  private dhConfigCache: DhConfigCache | undefined;

  constructor({ debug, transportService, localDb, updateManager }: EncryptedChatServiceOptions) {
    this.transportService = transportService;
    this.localDb = localDb;
    this.updateManager = updateManager;
    this.debug = debug ?? false;
    this.log = (...args: any) => {
      if (this.debug) {
        console.info('[EncryptedChatService]', ...args);
      }
    };
  }

  get client() {
    return this.transportService?.client ?? null;
  }

  create = async (userId: string, accessHash?: string): Promise<TypeEncryptedChat> => {
    if (!this.client || !this.localDb) {
      throw new Error('Client not initialized');
    }

    const cached = (await getCachedDhConfig(this.localDb)) ?? this.dhConfigCache;
    const { config, random } = await fetchDhConfig(this.client, cached);
    this.dhConfigCache = config;
    await setCachedDhConfig(this.localDb, config);

    const { privateKey, publicKey } = generateDhKeyPair(config);
    const randomId = random.readInt32LE(0);

    await this.localDb.putEncryptedChatKey(String(randomId), {
      dhPrivate: new Uint8Array(privateKey),
    });

    const [inputUser] = await resolveInputUsers(this.localDb, [{ id: userId, accessHash }]);
    const result = await this.client.invoke(
      new Api.messages.RequestEncryption({
        userId: inputUser,
        randomId,
        gA: publicKey,
      }),
    );

    const converted = convertTypeEncryptedChat(result);
    await this.localDb.putEncryptedChat(converted);
    return converted;
  };

  accept = async (chatId: number): Promise<TypeEncryptedChat> => {
    if (!this.client || !this.localDb) {
      throw new Error('Client not initialized');
    }

    const row = await this.localDb.getEncryptedChatRow(String(chatId));
    if (!row || !('gA' in row.entity)) {
      throw new Error(`Encrypted chat ${chatId} is not in requested state`);
    }

    const cached = (await getCachedDhConfig(this.localDb)) ?? this.dhConfigCache;
    const { config } = await fetchDhConfig(this.client, cached);
    this.dhConfigCache = config;
    await setCachedDhConfig(this.localDb, config);

    const { privateKey, publicKey } = generateDhKeyPair(config);
    const authKey = calcAuthKeyFromDh(privateKey, row.entity.gA, config);
    const keyFingerprint = await calcKeyFingerprint(authKey);

    const result = await this.client.invoke(
      new Api.messages.AcceptEncryption({
        peer: new Api.InputEncryptedChat({
          chatId,
          accessHash: bigInt(row.entity.accessHash),
        }),
        gB: publicKey,
        keyFingerprint: bigInt(keyFingerprint),
      }),
    );

    await this.localDb.putEncryptedChatKey(String(chatId), {
      dhPrivate: new Uint8Array(privateKey),
      authKey: new Uint8Array(authKey),
      keyFingerprint,
    });

    const converted = convertTypeEncryptedChat(result);
    await this.localDb.putEncryptedChat(converted);
    return converted;
  };

  /** Handle UpdateEncryption from UpdateManager builtins. */
  async onUpdateEncryption(update: { chat: TypeEncryptedChat }): Promise<TypeEncryptedChat> {
    if (!this.localDb) {
      throw new Error('LocalDb not initialized');
    }
    return handleUpdateEncryption(this.localDb, update.chat);
  }

  convertWithStatus(chat: Api.TypeEncryptedChat) {
    return convertTypeEncryptedChatWithStatus(chat);
  }
}
