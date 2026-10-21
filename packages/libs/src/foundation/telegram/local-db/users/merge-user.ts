import type { User, UserEmpty } from '../../types/users';
import { deriveUserMinAccessHash, mergeAccessHashFields } from '../access-hash';
import type { MergeUserResult, UserPeerRow } from '../types';

const USER_MIN_SKIP_KEYS = new Set<keyof User>([
  'contact',
  'mutualContact',
  'attachMenuEnabled',
  'botCanEdit',
  'closeFriend',
  'storiesHidden',
  'storiesMaxId',
]);

/** Fields that invalidate userFull when they change (non-min apply). */
const USER_FULL_INVALIDATE_KEYS: Array<keyof User> = [
  'deleted',
  'bot',
  'premium',
  'botInfoVersion',
  'botCanEdit',
  'username',
  'usernames',
];

/** Runtime empty check. Not a type predicate: UserEmpty ⊂ User structurally, so a false branch would narrow to `never`. */
export function isUserEmpty(user: User | UserEmpty): boolean {
  return !('min' in user) && !('accessHash' in user) && !('firstName' in user) && !('bot' in user);
}

export function mergeUser(
  incoming: User | UserEmpty,
  local?: UserPeerRow,
  now = Date.now(),
): MergeUserResult {
  if (isUserEmpty(incoming)) {
    if (!local) {
      return {
        row: {
          id: incoming.id,
          entity: { id: incoming.id } as User,
          minAccessHash: false,
          updatedAt: now,
        },
        invalidateFull: false,
      };
    }
    return { row: { ...local, updatedAt: now }, invalidateFull: false };
  }

  const user = incoming as User;

  if (!local || !local.entity || isSparseLocal(local.entity)) {
    const minAccessHash = deriveUserMinAccessHash(user);
    return {
      row: {
        id: user.id,
        entity: { ...user },
        minAccessHash,
        updatedAt: now,
      },
      invalidateFull: false,
    };
  }

  if (!user.min) {
    const invalidateFull = shouldInvalidateUserFull(local.entity, user);
    const minAccessHash = deriveUserMinAccessHash(user);
    const hash = mergeAccessHashFields({
      incomingHash: user.accessHash,
      incomingMinAccessHash: minAccessHash,
      localHash: local.entity.accessHash,
      localMinAccessHash: local.minAccessHash,
    });
    const entity: User = {
      ...user,
      accessHash: hash.accessHash,
    };
    return {
      row: {
        id: user.id,
        entity,
        minAccessHash: hash.minAccessHash,
        updatedAt: now,
      },
      invalidateFull,
    };
  }

  // min merge
  const localEntity = local.entity;
  const localWasMin = Boolean(localEntity.min);
  const merged: User = { ...localEntity };

  const incomingMinAccessHash = deriveUserMinAccessHash(user);
  const hash = mergeAccessHashFields({
    incomingHash: user.accessHash,
    incomingMinAccessHash,
    localHash: localEntity.accessHash,
    localMinAccessHash: local.minAccessHash,
  });
  if (hash.accessHash !== undefined) {
    merged.accessHash = hash.accessHash;
  }

  // Always take non-protected flags/fields from incoming when docs allow
  applyMinUserFields(merged, user, localWasMin);

  // Keep min flag true if local was min and incoming is min; if local was full, stay non-min
  if (!localWasMin) {
    merged.min = false;
  } else {
    merged.min = true;
  }

  return {
    row: {
      id: user.id,
      entity: merged,
      minAccessHash: hash.minAccessHash,
      updatedAt: now,
    },
    invalidateFull: false,
  };
}

function isSparseLocal(entity: User): boolean {
  return Object.keys(entity).length <= 1;
}

function applyMinUserFields(target: User, incoming: User, localWasMin: boolean): void {
  const canApplyIdentity = !incoming.min || localWasMin;

  for (const key of Object.keys(incoming) as Array<keyof User>) {
    if (key === 'id' || key === 'accessHash' || key === 'min') continue;
    if (USER_MIN_SKIP_KEYS.has(key)) continue;

    if (
      key === 'firstName' ||
      key === 'lastName' ||
      key === 'username' ||
      key === 'phone' ||
      key === 'usernames'
    ) {
      if (canApplyIdentity) {
        assignField(target, key, incoming[key]);
      }
      continue;
    }

    if (key === 'photo') {
      if (!incoming.min || incoming.applyMinPhoto || localWasMin) {
        assignField(target, key, incoming[key]);
      }
      continue;
    }

    if (key === 'status') {
      if (
        !incoming.min ||
        localWasMin ||
        target.status === undefined ||
        isEmptyStatus(target.status)
      ) {
        assignField(target, key, incoming[key]);
      }
      continue;
    }

    // Other fields present on min constructors: apply when local was also min, else keep local
    if (localWasMin) {
      assignField(target, key, incoming[key]);
    }
  }
}

function assignField<K extends keyof User>(target: User, key: K, value: User[K]): void {
  if (value === undefined) {
    delete target[key];
  } else {
    target[key] = value;
  }
}

function isEmptyStatus(status: User['status']): boolean {
  if (!status || typeof status !== 'object') return true;
  // userStatusEmpty is typically `{}` or a marker — treat empty object / unknown empty as empty
  return Object.keys(status as object).length === 0;
}

function shouldInvalidateUserFull(local: User, incoming: User): boolean {
  for (const key of USER_FULL_INVALIDATE_KEYS) {
    if (local[key] !== incoming[key]) {
      if (key === 'username' || key === 'usernames') {
        // docs: invalidate if bot_can_edit also set
        if (incoming.botCanEdit || local.botCanEdit) return true;
        continue;
      }
      return true;
    }
  }
  return false;
}
