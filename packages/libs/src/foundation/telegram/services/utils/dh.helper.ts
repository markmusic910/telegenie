import bigInt from 'big-integer';
import { helpers } from '@telegenie/teleproto';
import { Api } from '@telegenie/teleproto';

const { bigIntMod, generateRandomBytes, readBigIntFromBuffer, readBufferFromBigInt, sha1 } = helpers;

export type DhConfigCache = {
  version: number;
  g: number;
  p: Buffer;
};

export type DhKeyPair = {
  privateKey: Buffer;
  publicKey: Buffer;
};

const DH_RANDOM_LENGTH = 256;

export async function fetchDhConfig(
  client: { invoke: (req: Api.messages.GetDhConfig) => Promise<Api.messages.TypeDhConfig> },
  cache?: DhConfigCache,
): Promise<{ config: DhConfigCache; random: Buffer }> {
  const result = await client.invoke(
    new Api.messages.GetDhConfig({
      version: cache?.version ?? 0,
      randomLength: DH_RANDOM_LENGTH,
    }),
  );

  if (result instanceof Api.messages.DhConfig) {
    return {
      config: {
        version: result.version,
        g: result.g,
        p: Buffer.from(result.p),
      },
      random: Buffer.from(result.random),
    };
  }

  if (result instanceof Api.messages.DhConfigNotModified) {
    if (!cache) {
      throw new Error('DhConfigNotModified but no cached config');
    }
    return { config: cache, random: Buffer.from(result.random) };
  }

  throw new Error('Unexpected DhConfig response');
}

/** Generate DH key pair g^a mod p with Telegram constraints on g_a. */
export function generateDhKeyPair(config: DhConfigCache): DhKeyPair {
  const p = readBigIntFromBuffer(config.p, false, false);
  const g = bigInt(config.g);
  const pMinusOne = p.minus(1);

  for (let attempt = 0; attempt < 8; attempt++) {
    const privateKey = generateRandomBytes(DH_RANDOM_LENGTH);
    const exponent = readBigIntFromBuffer(privateKey, false, false);
    const publicInt = bigIntMod(g.modPow(exponent, p), p);
    if (publicInt.greater(1) && publicInt.lesser(pMinusOne)) {
      const publicKey = readBufferFromBigInt(publicInt, config.p.length, false, false);
      return { privateKey, publicKey };
    }
  }

  throw new Error('Failed to generate valid DH public key');
}

export function calcAuthKeyFromDh(
  privateKey: Buffer,
  gAOrB: Buffer | Uint8Array,
  config: DhConfigCache,
): Buffer {
  const p = readBigIntFromBuffer(config.p, false, false);
  const peerPublic = readBigIntFromBuffer(Buffer.from(gAOrB), false, false);
  const exponent = readBigIntFromBuffer(privateKey, false, false);
  const shared = bigIntMod(peerPublic.modPow(exponent, p), p);
  return readBufferFromBigInt(shared, config.p.length, false, false);
}

export async function calcKeyFingerprint(authKey: Buffer): Promise<string> {
  const hash = await sha1(authKey);
  return readBigIntFromBuffer(hash.slice(-8), true, true).toString();
}
