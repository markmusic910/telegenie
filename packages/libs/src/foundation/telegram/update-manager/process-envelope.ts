import { Api } from '@telegenie/teleproto';

import { isMessageEmpty, isPeerChannel } from '../helpers/api-class.helper';
import {
  markedChannelIdFromMtp,
  markedPeerIdFromApiPeer,
} from '../helpers/peer-id.helper';
import {
  shortChatMessageToUpdateNewMessage,
  shortMessageToUpdateNewMessage,
  shortSentMessageToUpdateNewMessage,
} from './short-to-update';

export type SeqMeta = {
  seqStart: number;
  seq: number;
  date: number;
};

export type UnwrappedEnvelope = {
  /** Normalized individual updates ready for pts/qts gating + dispatch */
  updates: Api.TypeUpdate[];
  users: Api.TypeUser[];
  chats: Api.TypeChat[];
  seq?: SeqMeta;
  /** True when the envelope itself requires getDifference */
  tooLong: boolean;
};

/**
 * Unwrap a TypeUpdates (or already-unwrapped TypeUpdate) into a list of
 * TypeUpdate plus optional seq metadata and entity bags.
 */
export function unwrapEnvelope(input: Api.TypeUpdates | Api.TypeUpdate): UnwrappedEnvelope {
  if (input instanceof Api.UpdatesTooLong) {
    return { updates: [], users: [], chats: [], tooLong: true };
  }

  if (input instanceof Api.Updates) {
    return {
      updates: [...input.updates],
      users: [...input.users],
      chats: [...input.chats],
      seq: { seqStart: input.seq, seq: input.seq, date: input.date },
      tooLong: false,
    };
  }

  if (input instanceof Api.UpdatesCombined) {
    return {
      updates: [...input.updates],
      users: [...input.users],
      chats: [...input.chats],
      seq: { seqStart: input.seqStart, seq: input.seq, date: input.date },
      tooLong: false,
    };
  }

  if (input instanceof Api.UpdateShort) {
    return {
      updates: [input.update],
      users: [],
      chats: [],
      tooLong: false,
    };
  }

  if (input instanceof Api.UpdateShortMessage) {
    return {
      updates: [shortMessageToUpdateNewMessage(input)],
      users: [],
      chats: [],
      tooLong: false,
    };
  }

  if (input instanceof Api.UpdateShortChatMessage) {
    return {
      updates: [shortChatMessageToUpdateNewMessage(input)],
      users: [],
      chats: [],
      tooLong: false,
    };
  }

  if (input instanceof Api.UpdateShortSentMessage) {
    return {
      updates: [shortSentMessageToUpdateNewMessage(input)],
      users: [],
      chats: [],
      tooLong: false,
    };
  }

  // Already a TypeUpdate (teleproto Raw dispatch)
  return {
    updates: [input as Api.TypeUpdate],
    users: [],
    chats: [],
    tooLong: false,
  };
}

export type PtsKind =
  | { kind: 'none' }
  | { kind: 'common'; pts: number; ptsCount: number }
  | { kind: 'channel'; channelId: string; pts: number; ptsCount: number }
  | { kind: 'qts'; qts: number }
  | { kind: 'channelTooLong'; channelId: string; pts?: number };

export function getChannelIdFromUpdate(update: Api.TypeUpdate): string | undefined {
  if (update instanceof Api.UpdateChannelTooLong) {
    return markedChannelIdFromMtp((update as Api.UpdateChannelTooLong).channelId);
  }
  if ('channelId' in update && update.channelId != null) {
    try {
      return markedChannelIdFromMtp(update.channelId as { toString(): string });
    } catch {
      return undefined;
    }
  }
  if (!('message' in update) || update.message == null) return undefined;
  const message = update.message;
  // TypeUpdate.message unions can include non-objects; `in` requires object.
  if (typeof message !== 'object' || isMessageEmpty(message)) return undefined;
  if (!('peerId' in message) || !message.peerId || !isPeerChannel(message.peerId)) {
    return undefined;
  }
  return markedPeerIdFromApiPeer(message.peerId);
}

/**
 * Classify pts/qts handling for an individual Update.
 * UpdateChannelTooLong is special-cased (triggers channel difference, not apply).
 */
const CHANNEL_UPDATE_CLASS_NAMES = new Set([
  'UpdateNewChannelMessage',
  'UpdateEditChannelMessage',
  'UpdateDeleteChannelMessages',
  'UpdateChannelWebPage',
  'UpdateChannelTooLong',
]);

export function classifyUpdatePts(update: Api.TypeUpdate): PtsKind {
  if (update instanceof Api.UpdateChannelTooLong) {
    const channelId = getChannelIdFromUpdate(update)!;
    return {
      kind: 'channelTooLong',
      channelId,
      pts: (update as Api.UpdateChannelTooLong).pts,
    };
  }

  if ('qts' in update && typeof (update as { qts?: number }).qts === 'number') {
    return { kind: 'qts', qts: (update as { qts: number }).qts };
  }

  if (
    'pts' in update &&
    typeof (update as { pts?: number }).pts === 'number' &&
    'ptsCount' in update &&
    typeof (update as { ptsCount?: number }).ptsCount === 'number'
  ) {
    const pts = (update as { pts: number }).pts;
    const ptsCount = (update as { ptsCount: number }).ptsCount;
    const channelId = getChannelIdFromUpdate(update);
    if (channelId || CHANNEL_UPDATE_CLASS_NAMES.has(update.className)) {
      if (!channelId) {
        return { kind: 'none' };
      }
      return { kind: 'channel', channelId, pts, ptsCount };
    }
    return { kind: 'common', pts, ptsCount };
  }

  // Some channel updates have pts without ptsCount (treat count as 0 / state sync)
  if (
    'pts' in update &&
    typeof (update as { pts?: number }).pts === 'number' &&
    getChannelIdFromUpdate(update)
  ) {
    const channelId = getChannelIdFromUpdate(update)!;
    const pts = (update as { pts: number }).pts;
    return { kind: 'channel', channelId, pts, ptsCount: 0 };
  }

  return { kind: 'none' };
}

export function sequenceKeyForPts(kind: PtsKind): 'common' | `channel:${string}` | undefined {
  if (kind.kind === 'common' || kind.kind === 'qts') return 'common';
  if (kind.kind === 'channel' || kind.kind === 'channelTooLong') {
    return `channel:${kind.channelId}`;
  }
  return undefined;
}
