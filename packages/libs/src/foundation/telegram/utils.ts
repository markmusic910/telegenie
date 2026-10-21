import { Api, TelegramClient, extensions } from '@telegenie/teleproto';
import type { TelegramClientParams } from '@telegenie/teleproto/client/telegramBaseClient';
import { StringSession } from '@telegenie/teleproto/sessions';
import { CHANNEL_ID_LENGTH } from './constants';
import { getEntityTypeById } from './helpers/peer-id.helper';
import type { ApiChat, ApiPeer } from './types';

/**
 * Entity map that can look up a user or channel by id.
 * `get` is loose so a mixed store manager (user, channel, dialog, …) still fits.
 * Basic groups have no access hash.
 */
export type PeerEntitySource = {
  has(name: string): boolean;
  get(name: string): object;
};

/** Access hash for a user or channel. Basic groups return undefined. */
export function readPeerAccessHash(entities: PeerEntitySource, peerId: string): string | undefined {
  const type = getEntityTypeById(peerId);
  if (type === 'chat') return undefined;
  if (!entities.has(type)) return undefined;
  const bucket = entities.get(type) as { get(id: string): { accessHash?: string } | undefined };
  return bucket.get(peerId)?.accessHash;
}

type ProcessLike = { env?: Record<string, string | undefined> };

function getProcessEnv(): Record<string, string | undefined> | undefined {
  return (globalThis as { process?: ProcessLike }).process?.env;
}

export type TelegramCredentials = {
  apiId: number;
  apiHash: string;
};

/**
 * Dedicated Workers look like Node to teleproto (`typeof window === 'undefined'`),
 * which would pick TCP sockets. Force the browser WSS stack instead.
 */
export function isTelegramWorkerRealm(): boolean {
  const workerScope = (globalThis as { WorkerGlobalScope?: new () => unknown }).WorkerGlobalScope;
  return (
    typeof window === 'undefined' &&
    typeof self !== 'undefined' &&
    typeof workerScope === 'function' &&
    self instanceof workerScope
  );
}

export function getBrowserWssClientParams(
  override?: Partial<TelegramClientParams>,
): TelegramClientParams {
  return {
    networkSocket: extensions.PromisedWebSockets,
    ...override,
  };
}

export function getTelegramCredentials(override?: Partial<TelegramCredentials>): TelegramCredentials {
  const env = getProcessEnv();
  const apiId = override?.apiId ?? +(env?.NEXT_PUBLIC_TELEGRAM_API_ID ?? 0);
  const apiHash = override?.apiHash ?? env?.NEXT_PUBLIC_TELEGRAM_API_HASH ?? '';

  return { apiId, apiHash };
}

export const initClient = async (session: string = '', credentials?: TelegramCredentials) => {
  const { apiId, apiHash } = getTelegramCredentials(credentials);
  // Always use WebSocket/WSS — TeleGenie runs in browser or dedicated Worker, never Node TCP.
  const opts: TelegramClientParams = getBrowserWssClientParams();

  const s = new StringSession(session);
  const dcId = session.trim() ? s.dcId : 2;
  const { ipAddress: address, port } = getWebDC(dcId, false);
  s.setDC(dcId, address, port);
  const client = new TelegramClient(s, apiId, apiHash, opts);

  if (getProcessEnv()?.NODE_ENV === 'development') {
    (globalThis as any).tg_client = client;
  }

  return client;
};

export const getDCAddressBySession = async (
  session: StringSession,
  downloadDC?: boolean,
): Promise<{ address: string; port: number }> => {
  const { apiId, apiHash } = getTelegramCredentials();
  const client = new TelegramClient(session, apiId, apiHash, {
    ...getBrowserWssClientParams(),
    retryDelay: 1000,
    reconnectRetries: 10,
    connectionRetries: 5,
  });

  await client.connect();

  const { ipAddress: address, port } = await client.getDC(session.dcId, downloadDC);
  return { address, port };
};

/**
 * Returns the appropriate Web DC based on the id
 * @param dcId the id of the DC.
 * @param downloadDC whether to use -1 DCs or not
 * (These only support downloading/uploading and not creating a new AUTH key)
 * @return {{port: number, ipAddress: string, id: number}}
 */
export function getWebDC(dcId: number, downloadDC = false) {
  switch (dcId) {
    case 1:
      return {
        id: 1,
        ipAddress: `zws1${downloadDC ? '-1' : ''}.web.telegram.org`,
        port: 443,
      };
    case 2:
      return {
        id: 2,
        ipAddress: `zws2${downloadDC ? '-1' : ''}.web.telegram.org`,
        port: 443,
      };
    case 3:
      return {
        id: 3,
        ipAddress: `zws3${downloadDC ? '-1' : ''}.web.telegram.org`,
        port: 443,
      };
    case 4:
      return {
        id: 4,
        ipAddress: `zws4${downloadDC ? '-1' : ''}.web.telegram.org`,
        port: 443,
      };
    case 5:
      return {
        id: 5,
        ipAddress: `zws5${downloadDC ? '-1' : ''}.web.telegram.org`,
        port: 443,
      };
    default:
      throw new Error(`Cannot find the DC with the ID of ${dcId}`);
  }
}

// TODO: move to convert service
// export const getDialogTitle = (
//   dialog: Dialog,
//   channelMap: Map<string, Channel>,
//   userMap: Map<string, User>,
//   chatMap: Map<string, Chat>,
// ) => {
//   if (!dialog) {
//     return '';
//   }
//   if (isChannelId(dialog.peerId)) {
//     const chat = channelMap.get(dialog.peerId);
//     return chat?.title ?? '';
//   } else if (isUserId(dialog.peerId)) {
//     const user = userMap.get(dialog.peerId);
//     return user ? getUserTitle(user) : '';
//   } else {
//     const chat = chatMap.get(dialog.peerId);
//     return chat?.title ?? '';
//   }
// };

// export const getUserTitle = (user: User) => {
//   if (user.deleted) {
//     return 'Deleted Account';
//   }

//   return user.firstName
//     ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
//     : (user.username ?? '');
// };

/**
 * check if dialog id is a channel id
 */
export function checkIfChannelId(id: string) {
  return id.length === CHANNEL_ID_LENGTH && id.startsWith('-1');
}

export function isUserId(entityId: string) {
  return !entityId.startsWith('-');
}

export function isPeerChat(entity: ApiPeer): entity is ApiChat {
  return 'title' in entity;
}

export function isPeerUser(entity: ApiPeer): entity is any {
  return !isPeerChat(entity);
}

export function isChannelId(entityId: string) {
  return entityId.length === CHANNEL_ID_LENGTH && entityId.startsWith('-1');
}

export function toChannelId(mtpId: string) {
  return `-1${mtpId.padStart(CHANNEL_ID_LENGTH - 2, '0')}`;
}

export function isChatGroup(chat: ApiChat) {
  return isChatBasicGroup(chat) || isChatSuperGroup(chat);
}

export function isChatBasicGroup(chat: ApiChat) {
  return chat.type === 'chatTypeBasicGroup';
}

export function isChatSuperGroup(chat: ApiChat) {
  return chat.type === 'chatTypeSuperGroup';
}

export function isChatChannel(chat: ApiChat) {
  return chat.type === 'chatTypeChannel';
}

export function isCommonBoxChat(chat: ApiChat) {
  return chat.type === 'chatTypePrivate' || chat.type === 'chatTypeBasicGroup';
}

/**
 * Gets the appropriated part size when downloading files,
 * given an initial file size.
 * @param fileSize
 * @returns {Number}
 */
export function getDownloadPartSize(fileSize: number) {
  if (fileSize <= 65536) {
    // 64KB
    return 64;
  }
  if (fileSize <= 104857600) {
    // 100MB
    return 128;
  }
  if (fileSize <= 786432000) {
    // 750MB
    return 256;
  }
  if (fileSize <= 2097152000) {
    // 2000MB
    return 512;
  }
  if (fileSize <= 4194304000) {
    // 4000MB
    return 1024;
  }

  throw new Error('File size too large');
}

export const getPeer = (peer: Api.TypePeer | null | undefined): ['user' | 'channel' | 'group', string] => {
  if (peer == null || typeof peer !== 'object') {
    throw new Error('Invalid peer');
  }
  if ('userId' in peer) {
    return ['user', peer.userId.toString()];
  } else if ('chatId' in peer) {
    return ['group', peer.chatId.toString()];
  } else if ('channelId' in peer) {
    return ['channel', peer.channelId.toString()];
  }
  throw new Error('Invalid peer');
};
