import type { LocalDb } from '../../local-db/local-db';
import type { EncryptedChat, TypeEncryptedChat } from '../../types/api-types';
import { calcAuthKeyFromDh, calcKeyFingerprint, type DhConfigCache } from './dh.helper';

const META_DH_CONFIG = 'dhConfig';

export async function getCachedDhConfig(localDb: LocalDb): Promise<DhConfigCache | undefined> {
  const row = await localDb.getMeta(META_DH_CONFIG);
  if (!row || typeof row !== 'object' || row === null) return undefined;
  const cached = row as { version?: number; g?: number; p?: string };
  if (
    typeof cached.version !== 'number' ||
    typeof cached.g !== 'number' ||
    typeof cached.p !== 'string'
  ) {
    return undefined;
  }
  return { version: cached.version, g: cached.g, p: Buffer.from(cached.p, 'base64') };
}

export async function setCachedDhConfig(localDb: LocalDb, config: DhConfigCache): Promise<void> {
  await localDb.setMeta(META_DH_CONFIG, {
    version: config.version,
    g: config.g,
    p: config.p.toString('base64'),
  });
}

/** Persist UpdateEncryption and complete auth_key when the chat becomes ready. */
export async function handleUpdateEncryption(
  localDb: LocalDb,
  chat: TypeEncryptedChat,
): Promise<TypeEncryptedChat> {
  await localDb.putEncryptedChat(chat);

  if ('keyFingerprint' in chat && 'gAOrB' in chat) {
    const ready = chat as EncryptedChat;
    const keyRow = await localDb.getEncryptedChatKey(String(ready.id));
    const dhConfig = await getCachedDhConfig(localDb);
    if (keyRow?.dhPrivate && dhConfig) {
      const authKey = calcAuthKeyFromDh(Buffer.from(keyRow.dhPrivate), ready.gAOrB, dhConfig);
      const fingerprint = await calcKeyFingerprint(authKey);
      if (fingerprint !== ready.keyFingerprint) {
        throw new Error(`Encrypted chat key fingerprint mismatch for ${ready.id}`);
      }
      await localDb.putEncryptedChatKey(String(ready.id), {
        authKey: new Uint8Array(authKey),
        keyFingerprint: fingerprint,
      });
    }
  }

  return chat;
}
