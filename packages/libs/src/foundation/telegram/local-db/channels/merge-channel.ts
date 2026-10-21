import type { Channel, ChannelForbidden } from '../../types/api-types';
import { deriveChannelMinAccessHash, mergeAccessHashFields } from '../access-hash';
import type { ChannelPeerRow, MergeChannelResult } from '../types';

/** Fields allowed to apply from a min channel over a non-min local (constructor docs). */
const CHANNEL_MIN_APPLY_KEYS = new Set<keyof Channel>([
  'title',
  'megagroup',
  'color',
  'photo',
  'username',
  'usernames',
  'hasGeo',
  'noforwards',
  'emojiStatus',
  'hasLink',
  'slowmodeEnabled',
  'scam',
  'fake',
  'gigagroup',
  'forum',
  'level',
  'restricted',
  'restrictionReason',
  'joinToSend',
  'joinRequest',
  'verified',
  'defaultBannedRights',
  'signatureProfiles',
  'botVerificationIcon',
]);

const CHANNEL_FULL_INVALIDATE_KEYS: Array<keyof Channel> = [
  'megagroup',
  'scam',
  'hasLink',
  'slowmodeEnabled',
  'fake',
  'gigagroup',
  'joinToSend',
  'joinRequest',
  'forum',
  'restrictionReason',
  'level',
];

export function isChannelForbidden(
  channel: Channel | ChannelForbidden,
): channel is ChannelForbidden {
  return !('min' in channel) && !('photo' in channel) && 'title' in channel && 'accessHash' in channel;
}

export function mergeChannel(
  incoming: Channel | ChannelForbidden,
  local: ChannelPeerRow | undefined,
  now = Date.now(),
): MergeChannelResult {
  if (isChannelForbidden(incoming)) {
    const entity = forbiddenToChannelStub(incoming);
    if (!local) {
      return {
        row: {
          id: incoming.id,
          entity,
          minAccessHash: false,
          updatedAt: now,
        },
        invalidateFull: false,
      };
    }
    const hash = mergeAccessHashFields({
      incomingHash: incoming.accessHash,
      incomingMinAccessHash: false,
      localHash: local.entity.accessHash,
      localMinAccessHash: local.minAccessHash,
    });
    return {
      row: {
        id: incoming.id,
        entity: {
          ...local.entity,
          title: incoming.title,
          accessHash: hash.accessHash,
          broadcast: incoming.broadcast ?? local.entity.broadcast,
          megagroup: incoming.megagroup ?? local.entity.megagroup,
        },
        minAccessHash: hash.minAccessHash,
        updatedAt: now,
      },
      invalidateFull: false,
    };
  }

  if (!local) {
    return {
      row: {
        id: incoming.id,
        entity: { ...incoming },
        minAccessHash: deriveChannelMinAccessHash(incoming),
        updatedAt: now,
      },
      invalidateFull: false,
    };
  }

  if (!incoming.min) {
    const invalidateFull = shouldInvalidateChannelFull(local.entity, incoming);
    const incomingMinAccessHash = deriveChannelMinAccessHash(incoming);
    const hash = mergeAccessHashFields({
      incomingHash: incoming.accessHash,
      incomingMinAccessHash,
      localHash: local.entity.accessHash,
      localMinAccessHash: local.minAccessHash,
    });
    return {
      row: {
        id: incoming.id,
        entity: { ...incoming, accessHash: hash.accessHash },
        minAccessHash: hash.minAccessHash,
        updatedAt: now,
      },
      invalidateFull,
    };
  }

  // min merge: only apply allowed fields
  const localEntity = local.entity;
  const localWasMin = Boolean(localEntity.min);
  const merged: Channel = { ...localEntity };

  const incomingMinAccessHash = deriveChannelMinAccessHash(incoming);
  const hash = mergeAccessHashFields({
    incomingHash: incoming.accessHash,
    incomingMinAccessHash,
    localHash: localEntity.accessHash,
    localMinAccessHash: local.minAccessHash,
  });
  if (hash.accessHash !== undefined) {
    merged.accessHash = hash.accessHash;
  }

  for (const key of CHANNEL_MIN_APPLY_KEYS) {
    if (key in incoming) {
      const value = incoming[key];
      if (value === undefined) {
        delete merged[key];
      } else {
        (merged as Record<string, unknown>)[key as string] = value;
      }
    }
  }

  if (!localWasMin) {
    merged.min = false;
  } else {
    merged.min = true;
  }

  return {
    row: {
      id: incoming.id,
      entity: merged,
      minAccessHash: hash.minAccessHash,
      updatedAt: now,
    },
    invalidateFull: false,
  };
}

function forbiddenToChannelStub(forbidden: ChannelForbidden): Channel {
  return {
    id: forbidden.id,
    accessHash: forbidden.accessHash,
    title: forbidden.title,
    photo: {} as Channel['photo'],
    date: 0,
    broadcast: forbidden.broadcast,
    megagroup: forbidden.megagroup,
  };
}

function shouldInvalidateChannelFull(local: Channel, incoming: Channel): boolean {
  for (const key of CHANNEL_FULL_INVALIDATE_KEYS) {
    if (local[key] !== incoming[key]) return true;
  }
  return false;
}
