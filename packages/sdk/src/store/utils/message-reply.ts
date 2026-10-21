import type {
  MessageReplyHeader,
  TypeMessageFwdHeader,
  TypeMessageMedia,
  TypeMessageReplyHeader,
  TypePeer,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import type { Message } from '../entity/models/message.model';

export function peerIdFromTypePeer(peer?: TypePeer | null): string | undefined {
  if (!peer) return undefined;
  if ('userId' in peer && peer.userId) return String(peer.userId);
  if ('chatId' in peer && peer.chatId) return String(peer.chatId);
  if ('channelId' in peer && peer.channelId) return String(peer.channelId);
  return undefined;
}

export function resolveMessageReplyHeader(
  replyTo: TypeMessageReplyHeader | undefined,
): MessageReplyHeader | undefined {
  if (!replyTo || !('replyToMsgId' in replyTo)) return undefined;
  const replyToMsgId = replyTo.replyToMsgId;
  if (replyToMsgId == null || replyToMsgId <= 0) return undefined;
  return replyTo;
}

export function hasHeaderReplyPreview(header: MessageReplyHeader): boolean {
  if (header.quoteText?.trim()) return true;
  if (header.replyMedia) return true;

  const replyFrom = header.replyFrom;
  if (replyFrom?.fromName?.trim()) return true;
  if (replyFrom?.postAuthor?.trim()) return true;

  return false;
}

type ReplyPreviewRecord = {
  id: string;
  peerId: string;
  isEmpty?: boolean;
  date?: number;
  message?: string;
  media?: unknown;
  replyTo?: TypeMessageReplyHeader;
  replyTargetVerified?: boolean;
};

export function hasStoredReplyPreview(message: Message | ReplyPreviewRecord | null | undefined): boolean {
  if (!message || message.isEmpty || !message.date) return false;
  if ('summaryText' in message && message.summaryText?.trim()) return true;
  if (message.message?.trim()) return true;
  if (message.media) return true;
  return false;
}

export function replyTargetRef(
  entity: Pick<ReplyPreviewRecord, 'peerId' | 'replyTo'>,
): { peerId: string; messageId: string } | undefined {
  const header = resolveMessageReplyHeader(entity.replyTo);
  if (!header?.replyToMsgId) return undefined;
  return {
    peerId: peerIdFromTypePeer(header.replyToPeerId) ?? entity.peerId,
    messageId: String(header.replyToMsgId),
  };
}

export function resolveReplyTargetVerified(
  entity: ReplyPreviewRecord,
  getTarget: (peerId: string, messageId: string) => ReplyPreviewRecord | undefined,
): boolean {
  const header = resolveMessageReplyHeader(entity.replyTo);
  if (!header || header.replyToMsgId == null) return false;
  if (hasHeaderReplyPreview(header)) return true;
  const targetRef = replyTargetRef(entity);
  if (!targetRef) return false;
  return hasStoredReplyPreview(getTarget(targetRef.peerId, targetRef.messageId));
}

export function stampReplyTargetVerified<T extends ReplyPreviewRecord>(
  entities: T[],
  getStored: (peerId: string, messageId: string) => ReplyPreviewRecord | undefined,
): T[] {
  const batch = new Map<string, ReplyPreviewRecord>();
  for (const entity of entities) {
    batch.set(`${entity.peerId}:${entity.id}`, entity);
  }
  const getTarget = (peerId: string, messageId: string) =>
    batch.get(`${peerId}:${messageId}`) ?? getStored(peerId, messageId);

  return entities.map((entity) => ({
    ...entity,
    replyTargetVerified: resolveReplyTargetVerified(entity, getTarget),
  }));
}

/** Reply targets that are not in this batch or the store — fetch before writing. */
export function collectMissingReplyTargetIds(
  entities: ReplyPreviewRecord[],
  getStored: (peerId: string, messageId: string) => ReplyPreviewRecord | undefined,
): Map<string, string[]> {
  const batch = new Map<string, ReplyPreviewRecord>();
  for (const entity of entities) {
    batch.set(`${entity.peerId}:${entity.id}`, entity);
  }

  const byPeer = new Map<string, Set<string>>();
  for (const entity of entities) {
    const header = resolveMessageReplyHeader(entity.replyTo);
    if (!header || header.replyToMsgId == null) continue;
    if (hasHeaderReplyPreview(header)) continue;
    const targetRef = replyTargetRef(entity);
    if (!targetRef) continue;
    const key = `${targetRef.peerId}:${targetRef.messageId}`;
    if (batch.has(key) || hasStoredReplyPreview(getStored(targetRef.peerId, targetRef.messageId))) {
      continue;
    }
    const ids = byPeer.get(targetRef.peerId) ?? new Set<string>();
    ids.add(targetRef.messageId);
    byPeer.set(targetRef.peerId, ids);
  }

  const result = new Map<string, string[]>();
  for (const [peerId, ids] of byPeer) {
    result.set(peerId, [...ids]);
  }
  return result;
}

export function previewFromReplyMedia(media: TypeMessageMedia): string | undefined {
  if ('photo' in media) return 'Photo';
  if ('voice' in media && media.voice) return 'Voice message';
  if ('round' in media && media.round) return 'Video message';
  if ('video' in media && media.video) return 'Video';
  if ('document' in media && media.document) {
    const doc = media.document as { attributes?: unknown[] };
    const stickerAttr = doc.attributes?.find(
      (attr): attr is { alt?: string; stickerset?: unknown } =>
        Boolean(attr && typeof attr === 'object' && 'alt' in attr && 'stickerset' in attr),
    );
    if (stickerAttr) {
      return stickerAttr.alt ? `${stickerAttr.alt} Sticker` : 'Sticker';
    }
    return 'File';
  }
  if ('poll' in media) return 'Poll';
  if ('geo' in media || 'venueId' in media) return 'Location';
  if ('phoneNumber' in media) return 'Contact';
  if ('game' in media) return 'Game';
  if ('currency' in media) return 'Invoice';
  return undefined;
}

function fileNameFromReplyMedia(media: TypeMessageMedia): string | undefined {
  if (!('document' in media) || !media.document) return undefined;
  const attributes = (media.document as { attributes?: unknown[] }).attributes;
  if (!attributes) return undefined;
  for (const attr of attributes) {
    if (
      attr
      && typeof attr === 'object'
      && 'fileName' in attr
      && (attr as { fileName?: string }).fileName
    ) {
      return (attr as { fileName: string }).fileName;
    }
  }
  return undefined;
}

export function buildReplyPreviewText(
  header: MessageReplyHeader,
  repliedMessage: Message | null | undefined,
): string {
  const quoteText = header.quoteText?.trim();
  if (quoteText) return quoteText;

  const repliedText = repliedMessage?.message?.trim();
  if (repliedText) return repliedText;

  const fileName = repliedMessage?.mediaFileName
    ?? (header.replyMedia ? fileNameFromReplyMedia(header.replyMedia) : undefined);
  if (fileName) return fileName;

  if (repliedMessage?.summaryText?.trim()) return repliedMessage.summaryText;

  const mediaLabel = header.replyMedia ? previewFromReplyMedia(header.replyMedia) : undefined;
  if (mediaLabel) return mediaLabel;

  return 'Message';
}

export function replySenderPeerId(
  replyFrom: TypeMessageFwdHeader | undefined,
  repliedMessage: Message | null | undefined,
): string | undefined {
  return (
    peerIdFromTypePeer(replyFrom?.fromId)
    ?? repliedMessage?.fromId
    ?? undefined
  );
}
