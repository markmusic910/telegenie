import BigInt from 'big-integer';

import type {
  ApiBotApp,
  ApiChatAdminRights,
  ApiChatBannedRights,
  ApiChatReactions,
  ApiParsedMedia,
  ApiReactionWithPaid,
  ApiReportReason,
  ApiSendMessageAction,
  ApiThemeParameters,
} from '../types';
import type { TypeChatReactions, TypeReaction } from '../types/api-types';
import { ApiMediaFormat } from '../types';

import { Api } from '@telegenie/teleproto';
import {
  buildMtpPeerId,
  buildPeer,
  getEntityTypeById,
} from './peer-id.helper';

export {
  isApiOfClass,
  isMessageEmpty,
  isPeerChannel,
  isPeerChat,
  isPeerUser,
} from './api-class.helper';
export {
  buildMarkedPeerIdByType,
  buildMtpPeerId,
  buildPeer,
  getEntityTypeById,
  getPeerId,
  markedChannelIdFromMtp,
  markedPeerIdFromApiInputPeer,
  markedPeerIdFromApiPeer,
  mtpChannelIdFromPeerId,
  peerIdFromMessage,
  MAX_CHAT_ID,
  MAX_USER_ID,
  MIN_MARKED_CHAT_ID,
  ZERO_CHANNEL_ID,
} from './peer-id.helper';
export type { PeerEntityType } from './peer-id.helper';

function pick<T, K extends keyof T>(object: T, keys: K[]) {
  return keys.reduce(
    (result, key) => {
      result[key] = object[key];
      return result;
    },
    {} as Pick<T, K>,
  );
}

export function buildInputPeer(chatOrUserId: string, accessHash?: string): Api.TypeInputPeer {
  const type = getEntityTypeById(chatOrUserId);

  if (type === 'user') {
    return new Api.InputPeerUser({
      userId: buildMtpPeerId(chatOrUserId, 'user'),
      accessHash: BigInt(accessHash!),
    });
  } else if (type === 'channel') {
    return new Api.InputPeerChannel({
      channelId: buildMtpPeerId(chatOrUserId, 'channel'),
      accessHash: BigInt(accessHash!),
    });
  } else {
    return new Api.InputPeerChat({
      chatId: buildMtpPeerId(chatOrUserId, 'chat'),
    });
  }
}

export function buildInputEntity(chatOrUserId: string, accessHash?: string) {
  const type = getEntityTypeById(chatOrUserId);

  if (type === 'user') {
    return new Api.InputUser({
      userId: buildMtpPeerId(chatOrUserId, 'user'),
      accessHash: BigInt(accessHash!),
    });
  } else if (type === 'channel') {
    return new Api.InputChannel({
      channelId: buildMtpPeerId(chatOrUserId, 'channel'),
      accessHash: BigInt(accessHash!),
    });
  } else {
    return buildMtpPeerId(chatOrUserId, 'chat');
  }
}

export function buildInputStickerSet(id: string, accessHash: string) {
  return new Api.InputStickerSetID({
    id: BigInt(id),
    accessHash: BigInt(accessHash),
  });
}

export function buildInputStickerSetShortName(shortName: string) {
  return new Api.InputStickerSetShortName({
    shortName,
  });
}

export function buildInputDocument(doc: Api.Document) {
  return new Api.InputDocument(pick(doc, ['id', 'accessHash', 'fileReference']));
}

export function buildMessageFromUpdate(
  id: number,
  chatId: string,
  update: Api.UpdateShortSentMessage | Api.UpdateServiceNotification,
) {
  // This is not a proper message, but we only need these fields for downloading media through `localDb`.
  return new Api.Message({
    id,
    peerId: buildPeer(chatId),
    fromId: buildPeer(chatId),
    media: update.media,
  } as Api.Message);
}

export function buildChatPhotoForLocalDb(photo: Api.TypePhoto) {
  if (photo instanceof Api.PhotoEmpty) {
    return new Api.ChatPhotoEmpty();
  }

  const { dcId, id: photoId } = photo;

  return new Api.ChatPhoto({
    dcId,
    photoId,
  });
}

export function buildInputContact({
  phone,
  firstName,
  lastName,
}: {
  phone: string;
  firstName: string;
  lastName: string;
}) {
  return new Api.InputPhoneContact({
    clientId: BigInt(1),
    phone,
    firstName,
    lastName,
  });
}

export function buildChatBannedRights(bannedRights: ApiChatBannedRights, untilDate = 0) {
  return new Api.ChatBannedRights({
    ...bannedRights,
    untilDate,
  });
}

export function buildChatAdminRights(adminRights: ApiChatAdminRights) {
  return new Api.ChatAdminRights(adminRights);
}

export function buildShippingInfo(info: Api.PaymentRequestedInfo) {
  const { shippingAddress } = info;
  return new Api.PaymentRequestedInfo({
    ...info,
    shippingAddress: shippingAddress ? new Api.PostAddress(shippingAddress) : undefined,
  });
}

export function buildInputReportReason(reason: ApiReportReason) {
  switch (reason) {
    case 'spam':
      return new Api.InputReportReasonSpam();
    case 'violence':
      return new Api.InputReportReasonViolence();
    case 'childAbuse':
      return new Api.InputReportReasonChildAbuse();
    case 'pornography':
      return new Api.InputReportReasonPornography();
    case 'copyright':
      return new Api.InputReportReasonCopyright();
    case 'fake':
      return new Api.InputReportReasonFake();
    case 'geoIrrelevant':
      return new Api.InputReportReasonGeoIrrelevant();
    case 'illegalDrugs':
      return new Api.InputReportReasonIllegalDrugs();
    case 'personalDetails':
      return new Api.InputReportReasonPersonalDetails();
    case 'other':
      return new Api.InputReportReasonOther();
  }

  return undefined;
}

export function buildSendMessageAction(action: ApiSendMessageAction) {
  switch (action.type) {
    case 'cancel':
      return new Api.SendMessageCancelAction();
    case 'typing':
      return new Api.SendMessageTypingAction();
    case 'recordAudio':
      return new Api.SendMessageRecordAudioAction();
    case 'chooseSticker':
      return new Api.SendMessageChooseStickerAction();
    case 'playingGame':
      return new Api.SendMessageGamePlayAction();
  }
  return undefined;
}

export function buildInputThemeParams(params: ApiThemeParameters) {
  return new Api.DataJSON({
    data: JSON.stringify(params),
  });
}

export type ReactionPeerKind = 'user' | 'group' | 'channel';

export function isEmojiReaction(reaction: TypeReaction): reaction is { emoticon: string } {
  return 'emoticon' in reaction && typeof reaction.emoticon === 'string';
}

export function isCustomReaction(reaction: TypeReaction): reaction is { documentId: string } {
  return 'documentId' in reaction && typeof reaction.documentId === 'string';
}

export function isPaidReaction(reaction: TypeReaction): reaction is { paid: true } {
  return 'paid' in reaction && reaction.paid === true;
}

export function isEmptyReaction(reaction: TypeReaction): reaction is { empty: true } {
  return 'empty' in reaction && reaction.empty === true;
}

/** Stable identity for emoji, custom, and paid reactions. */
export function reactionKey(reaction: TypeReaction): string {
  if (isEmojiReaction(reaction)) {
    return `emoji:${reaction.emoticon.replace(/\uFE0F/g, '')}`;
  }
  if (isCustomReaction(reaction)) return `custom:${reaction.documentId}`;
  if (isPaidReaction(reaction)) return 'paid';
  if (isEmptyReaction(reaction)) return 'empty';
  return 'unknown';
}

export function reactionsEqual(a?: TypeReaction, b?: TypeReaction): boolean {
  if (!a || !b) return false;
  return reactionKey(a) === reactionKey(b);
}

/**
 * Chat-full shapes: `{}` is none, `{ allowCustom }` is all, `{ reactions }` is an allow-list.
 * Private user peers may send emoji. Paid reactions are not sent through this check.
 */
/** `{}` from convertTypeChatReactions — reactions disabled for new emojis, not “unknown policy”. */
export function isChatReactionsNone(chatReactions: TypeChatReactions): boolean {
  return !('reactions' in chatReactions) && !('allowCustom' in chatReactions);
}

export function canSendReaction(
  reaction: TypeReaction,
  chatReactions: TypeChatReactions | undefined,
  peerKind: ReactionPeerKind,
): boolean {
  if (isPaidReaction(reaction) || isEmptyReaction(reaction)) return false;
  if (peerKind === 'user') return isEmojiReaction(reaction);
  if (!chatReactions) return false;
  if (isChatReactionsNone(chatReactions)) return false;
  if ('reactions' in chatReactions && Array.isArray(chatReactions.reactions)) {
    return chatReactions.reactions.some((allowed) => reactionsEqual(allowed, reaction));
  }
  if ('allowCustom' in chatReactions) {
    if (isEmojiReaction(reaction)) return true;
    if (isCustomReaction(reaction)) return Boolean(chatReactions.allowCustom);
  }
  return false;
}

export function plainReactionToInput(reaction: TypeReaction) {
  if (isEmojiReaction(reaction)) {
    return buildInputReaction({ type: 'emoji', emoticon: reaction.emoticon });
  }
  if (isCustomReaction(reaction)) {
    return buildInputReaction({ type: 'custom', documentId: reaction.documentId });
  }
  if (isPaidReaction(reaction)) {
    return buildInputReaction({ type: 'paid' });
  }
  return buildInputReaction();
}

export function buildInputReaction(reaction?: ApiReactionWithPaid) {
  switch (reaction?.type) {
    case 'emoji':
      return new Api.ReactionEmoji({
        emoticon: reaction.emoticon,
      });
    case 'custom':
      return new Api.ReactionCustomEmoji({
        documentId: BigInt(reaction.documentId),
      });
    case 'paid':
      return new Api.ReactionPaid();
    default:
      return new Api.ReactionEmpty();
  }
}

export function buildInputChatReactions(chatReactions?: ApiChatReactions) {
  if (chatReactions?.type === 'all') {
    return new Api.ChatReactionsAll({
      allowCustom: chatReactions.areCustomAllowed,
    });
  }

  if (chatReactions?.type === 'some') {
    return new Api.ChatReactionsSome({
      reactions: chatReactions.allowed.map(buildInputReaction),
    });
  }

  return new Api.ChatReactionsNone();
}

export function buildInputBotApp(app: ApiBotApp) {
  return new Api.InputBotAppID({
    id: BigInt(app.id),
    accessHash: BigInt(app.accessHash),
  });
}

export type EntityType =
  | 'sticker'
  | 'wallpaper'
  | 'channel'
  | 'chat'
  | 'user'
  | 'photo'
  | 'stickerSet'
  | 'webDocument'
  | 'document'
  | 'staticMap';

export async function parseMedia(
  data: Uint8Array,
  mediaFormat: ApiMediaFormat,
  mimeType?: string,
): Promise<ApiParsedMedia | undefined> {
  switch (mediaFormat) {
    case ApiMediaFormat.BlobUrl:
      return new Blob([data as any], { type: mimeType });
    case ApiMediaFormat.Text:
      return data.toString();
    case ApiMediaFormat.Progressive:
    case ApiMediaFormat.DownloadUrl:
      return data.buffer as ApiParsedMedia;
  }

  return undefined;
}

export function getMimeType(data: Uint8Array, fallbackMimeType = 'image/jpeg') {
  if (data.length < 4) {
    return fallbackMimeType;
  }

  let type = fallbackMimeType;
  const signature = data.subarray(0, 4).reduce((result, byte) => result + byte.toString(16), '');

  // https://en.wikipedia.org/wiki/List_of_file_signatures
  switch (signature) {
    case '89504e47':
      type = 'image/png';
      break;
    case '47494638':
      type = 'image/gif';
      break;
    case 'ffd8ffe0':
    case 'ffd8ffe1':
    case 'ffd8ffe2':
    case 'ffd8ffe3':
    case 'ffd8ffe8':
      type = 'image/jpeg';
      break;
    case '52494646':
      // In our case only webp is expected
      type = 'image/webp';
      break;
  }

  return type;
}

export function parseMediaUrl(url: string) {
  const mediaMatch = url.startsWith('staticMap')
    ? url.match(/(staticMap):([0-9-]+)(\?.+)/)
    : url.startsWith('webDocument')
      ? url.match(/(webDocument):(.+)/)
      : url.match(
          /(avatar|profile|photo|stickerSet|sticker|wallpaper|document)([-\d\w./]+)(?::\d+)?(\?size=\w+)?/,
        );
  if (!mediaMatch) {
    return undefined;
  }

  const mediaMatchType = mediaMatch[1];
  const entityId: string | number = mediaMatch[2];

  let entityType: EntityType;
  const params = mediaMatch[3];
  const sizeType = params?.replace('?size=', '') || undefined;

  if (mediaMatch[1] === 'avatar' || mediaMatch[1] === 'profile') {
    entityType = getEntityTypeById(entityId);
  } else {
    entityType = mediaMatch[1] as EntityType;
  }

  return {
    mediaMatchType,
    entityType,
    entityId,
    sizeType,
    params,
  };
}
