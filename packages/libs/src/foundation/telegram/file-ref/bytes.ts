import { Buffer } from 'buffer';

import { bytesToBase64 } from '../services/converters/thumbnail.converter';

export function fileRefToBase64(bytes: Uint8Array | Buffer | undefined): string | undefined {
  if (!bytes || bytes.length === 0) return undefined;
  return bytesToBase64(bytes);
}

export function base64ToFileRef(value: string): Buffer {
  return Buffer.from(value, 'base64');
}

export function isByteArray(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array || Buffer.isBuffer(value);
}
