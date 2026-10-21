import type { Channel } from '../types/api-types';
import type { User } from '../types/users';

/**
 * Derive virtual min_access_hash for a user (Telegram user constructor docs).
 * True when min is set AND (phone flag unset OR phone string non-empty).
 * Our converters always include phone as string (possibly ''), so:
 * - min + missing/empty phone with no phone field semantics → treat empty phone as "phone flag not meaningfully set for min hash" per docs:
 *   "phone flag is not set OR phone flag is set and associated phone number is non-empty"
 * Converted User always has phone?: string — if undefined or we use presence:
 * minAccessHash = min && (phone is undefined || phone.length > 0) is wrong for empty string.
 * Docs: min AND (phone flag NOT set OR phone non-empty).
 * Empty string means phone flag was set with empty → minAccessHash false.
 * Undefined phone → phone flag not set → minAccessHash true when min.
 */
export function deriveUserMinAccessHash(user: Pick<User, 'min' | 'phone' | 'accessHash'>): boolean {
  if (!user.accessHash) return false;
  if (!user.min) return false;
  // phone undefined → flag not set → min access hash
  if (user.phone === undefined) return true;
  // phone set (including '') → only if non-empty
  return user.phone.length > 0;
}

/**
 * Channel min access hash: when min is set and accessHash present, treat as min hash
 * (channel docs: min constructors carry reduced/hash-limited access).
 */
export function deriveChannelMinAccessHash(
  channel: Pick<Channel, 'min' | 'accessHash'>,
): boolean {
  if (!channel.accessHash) return false;
  return Boolean(channel.min);
}

/**
 * Whether to apply an incoming access hash over the locally stored one.
 * Never downgrade full → min.
 */
export function shouldApplyAccessHash(options: {
  incomingHash?: string;
  incomingMinAccessHash: boolean;
  localHash?: string;
  localMinAccessHash: boolean;
}): boolean {
  const { incomingHash, incomingMinAccessHash, localHash, localMinAccessHash } = options;
  if (!incomingHash) return false;
  if (!incomingMinAccessHash) return true; // full hash always wins
  // incoming is min
  if (!localHash) return true;
  if (localMinAccessHash) return true;
  return false; // local has full; keep it
}

export function mergeAccessHashFields(options: {
  incomingHash?: string;
  incomingMinAccessHash: boolean;
  localHash?: string;
  localMinAccessHash: boolean;
}): { accessHash?: string; minAccessHash: boolean } {
  if (
    shouldApplyAccessHash({
      incomingHash: options.incomingHash,
      incomingMinAccessHash: options.incomingMinAccessHash,
      localHash: options.localHash,
      localMinAccessHash: options.localMinAccessHash,
    })
  ) {
    return {
      accessHash: options.incomingHash,
      minAccessHash: options.incomingMinAccessHash,
    };
  }
  return {
    accessHash: options.localHash,
    minAccessHash: options.localHash ? options.localMinAccessHash : false,
  };
}
