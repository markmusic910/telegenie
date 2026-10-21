import BigInt from 'big-integer';

import { Api } from '@telegenie/teleproto';

import { isMessageEmpty, isPeerChat, isPeerUser } from './api-class.helper';

/**
 * Bot API / TDLib peer ID helpers.
 *
 * @see https://core.telegram.org/api/bots/ids
 */

/** Base offset for channel/supergroup/monoforum bot API dialog IDs (`-1_000_000_000_000`). */
export const ZERO_CHANNEL_ID = BigInt('-1000000000000');

/** Max MTProto / bot API user id (`0xffffffffff`). */
export const MAX_USER_ID = BigInt('1099511627775');

/** Max MTProto chat id; bot API chat dialog IDs are `-MAX_CHAT_ID` .. `-1`. */
export const MAX_CHAT_ID = BigInt('999999999999');

export const MIN_MARKED_CHAT_ID = BigInt(`-${MAX_CHAT_ID}`);

export type PeerEntityType = 'user' | 'chat' | 'channel';

/**
 * Classify a bot API dialog id by the ranges in
 * https://core.telegram.org/api/bots/ids
 *
 * - user: `1` .. `0xffffffffff`
 * - chat: `-999999999999` .. `-1`
 * - channel (incl. monoforum): below `ZERO_CHANNEL_ID` (`-1000000000000`)
 */
export function getEntityTypeById(chatOrUserId: string): PeerEntityType {
  const id = BigInt(chatOrUserId);

  if (id.isPositive() && id.leq(MAX_USER_ID)) {
    return 'user';
  }

  if (id.geq(MIN_MARKED_CHAT_ID) && id.isNegative()) {
    return 'chat';
  }

  // Channels, monoforums: botApiId = -(10^12 + mtpId) ⇒ id < ZERO_CHANNEL_ID
  if (id.lt(ZERO_CHANNEL_ID)) {
    return 'channel';
  }

  return 'chat';
}

/**
 * Convert a bot API dialog id to an MTProto peer id.
 *
 * - user: unchanged
 * - chat: `mtpId = -botApiId`
 * - channel: `mtpId = -botApiId - 10^12` (= `ZERO_CHANNEL_ID - botApiId`)
 */
export function buildMtpPeerId(id: string, type: PeerEntityType) {
  const botApiId = BigInt(id);

  if (type === 'user') {
    return botApiId;
  }

  if (type === 'channel') {
    return ZERO_CHANNEL_ID.subtract(botApiId);
  }

  return botApiId.negate();
}

/**
 * Convert an MTProto peer id to a bot API dialog id.
 *
 * - user: unchanged
 * - chat: `botApiId = -mtpId`
 * - channel: `botApiId = -(10^12 + mtpId)` (= `ZERO_CHANNEL_ID - mtpId`)
 */
export function buildMarkedPeerIdByType(id: string, type: PeerEntityType): string {
  const mtpId = BigInt(id);

  if (type === 'user') {
    return mtpId.toString();
  }

  if (type === 'channel') {
    return ZERO_CHANNEL_ID.subtract(mtpId).toString();
  }

  return mtpId.negate().toString();
}

export function buildPeer(chatOrUserId: string): Api.TypePeer {
  const type = getEntityTypeById(chatOrUserId);

  if (type === 'user') {
    return new Api.PeerUser({
      userId: buildMtpPeerId(chatOrUserId, 'user'),
    });
  }

  if (type === 'channel') {
    return new Api.PeerChannel({
      channelId: buildMtpPeerId(chatOrUserId, 'channel'),
    });
  }

  return new Api.PeerChat({
    chatId: buildMtpPeerId(chatOrUserId, 'chat'),
  });
}

/** Mark an Api.TypePeer using Bot API / TDLib dialog id rules. */
export function markedPeerIdFromApiPeer(peer: Api.TypePeer): string {
  if (isPeerUser(peer)) {
    return buildMarkedPeerIdByType(peer.userId.toString(), 'user');
  }
  if (isPeerChat(peer)) {
    return buildMarkedPeerIdByType(peer.chatId.toString(), 'chat');
  }
  return buildMarkedPeerIdByType(peer.channelId.toString(), 'channel');
}

/** Mark an MTProto channel id using Bot API / TDLib dialog id rules. */
export function markedChannelIdFromMtp(channelId: { toString(): string }): string {
  return buildMarkedPeerIdByType(channelId.toString(), 'channel');
}

/**
 * Mark an `Api.TypeInputPeer` using Bot API / TDLib dialog id rules.
 *
 * `InputPeerSelf` needs `selfId` to resolve; `InputPeerEmpty` and the
 * `*FromMessage` variants have no standalone dialog id and yield `undefined`.
 */
export function markedPeerIdFromApiInputPeer(
  inputPeer: Api.TypeInputPeer | undefined,
  selfId?: string,
): string | undefined {
  if (!inputPeer || inputPeer instanceof Api.InputPeerEmpty) {
    return undefined;
  }
  if (inputPeer instanceof Api.InputPeerSelf) {
    return selfId;
  }
  if (inputPeer instanceof Api.InputPeerUser) {
    return buildMarkedPeerIdByType(inputPeer.userId.toString(), 'user');
  }
  if (inputPeer instanceof Api.InputPeerChat) {
    return buildMarkedPeerIdByType(inputPeer.chatId.toString(), 'chat');
  }
  if (inputPeer instanceof Api.InputPeerChannel) {
    return buildMarkedPeerIdByType(inputPeer.channelId.toString(), 'channel');
  }
  return undefined;
}

/**
 * Bot API / TDLib dialog id for an MTProto user/chat/channel entity or `TypePeer`.
 *
 * Prefer this over GramJS `utils.getPeerId`, which marks channels as `-100${mtpId}`
 * instead of `-(10^12 + mtpId)`.
 *
 * @see https://core.telegram.org/api/bots/ids
 */
export function getPeerId(entity: Api.TypeUser | Api.TypeChat | Api.TypePeer): string {
  if (entity instanceof Api.User || entity instanceof Api.UserEmpty) {
    return buildMarkedPeerIdByType(entity.id.toString(), 'user');
  }
  if (
    entity instanceof Api.Chat ||
    entity instanceof Api.ChatEmpty ||
    entity instanceof Api.ChatForbidden
  ) {
    return buildMarkedPeerIdByType(entity.id.toString(), 'chat');
  }
  if (entity instanceof Api.Channel || entity instanceof Api.ChannelForbidden) {
    return buildMarkedPeerIdByType(entity.id.toString(), 'channel');
  }
  return markedPeerIdFromApiPeer(entity);
}

/**
 * Extract MTProto channel id from a Bot API / TDLib marked channel dialog id
 * (`-(10^12 + mtpId)`). Foundation peer ids must use this form — not GramJS
 * `utils.getPeerId`'s `-100${mtpId}` string concat.
 */
export function mtpChannelIdFromPeerId(peerId: string): BigInt.BigInteger | undefined {
  const id = BigInt(peerId);
  if (id.lt(ZERO_CHANNEL_ID)) {
    return ZERO_CHANNEL_ID.subtract(id);
  }
  return undefined;
}

/** Bot API / TDLib dialog id from a message's peerId, if present. */
export function peerIdFromMessage(message: Api.TypeMessage): string | undefined {
  if (isMessageEmpty(message)) {
    return message.peerId ? markedPeerIdFromApiPeer(message.peerId) : undefined;
  }
  if ('peerId' in message && message.peerId) {
    return markedPeerIdFromApiPeer(message.peerId);
  }
  return undefined;
}
