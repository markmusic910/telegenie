import type {
  TypeMessageAction,
  TypeMessageEntity,
  TypeMessageFwdHeader,
  TypeMessageMedia,
  TypeMessageReactions,
  TypeMessageReplies,
  TypeMessageReplyHeader,
  TypeReplyMarkup,
  TypeRestrictionReason,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import type {
  Document,
  DocumentAttributeSticker,
  Photo,
  TypeInputStickerSet,
} from '@telegenie/libs/foundation/telegram/types/file';
import { toJS } from 'mobx';
import type { MessageEntity, MessageKind, PeerType } from '../../types';
import { stringifyJson } from '../../utils/json';
import {
  buildReplyPreviewText,
  hasHeaderReplyPreview,
  hasStoredReplyPreview,
  peerIdFromTypePeer,
  replySenderPeerId,
  resolveMessageReplyHeader,
} from '../../utils/message-reply';
import BaseEntityModel, { makeModelObservable } from './base.model';

export type MessageOutgoingStatus = 'succeeded' | 'read';
export type MessagePreviewKind = 'photo' | 'video' | 'sticker';

const TRUNCATED_SUMMARY_LENGTH = 80;
const ALBUM_PREVIEW_MAX = 3;

function truncateSummary(text: string, max = TRUNCATED_SUMMARY_LENGTH): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}...`;
}

export type DialogPreviewOptions = {
  currentUserId?: string;
  currentUsername?: string;
};

function mentionEntityUserId(entity: TypeMessageEntity): string | undefined {
  if (!('userId' in entity) || entity.userId == null) {
    return undefined;
  }
  const { userId } = entity;
  if (typeof userId === 'string') {
    return userId;
  }
  if (typeof userId === 'object' && 'userId' in userId && typeof userId.userId === 'string') {
    return userId.userId;
  }
  return undefined;
}

function isSelfMentionEntity(
  entity: TypeMessageEntity,
  text: string,
  opts: DialogPreviewOptions,
): boolean {
  if (entity.className === 'MessageEntityMentionName') {
    const uid = mentionEntityUserId(entity);
    return Boolean(uid && opts.currentUserId && uid === opts.currentUserId);
  }
  if (entity.className === 'MessageEntityMention') {
    if (!opts.currentUsername) return false;
    const slice = text.slice(entity.offset, entity.offset + entity.length);
    const username = slice.startsWith('@') ? slice.slice(1) : slice;
    return username.toLowerCase() === opts.currentUsername.toLowerCase();
  }
  return false;
}

/** Replace @username / mention-name spans that refer to the current user with `@you`. */
export function replaceSelfMentionsInText(
  text: string,
  entities: TypeMessageEntity[] | undefined,
  opts: DialogPreviewOptions,
  mentioned?: boolean,
): string {
  if (!opts.currentUserId && !opts.currentUsername) return text;

  const mentionEntities = (entities ?? []).filter(
    (entity) =>
      entity.className === 'MessageEntityMention' ||
      entity.className === 'MessageEntityMentionName',
  );

  let result = text;
  let replaced = false;
  for (const entity of [...mentionEntities].sort((a, b) => b.offset - a.offset)) {
    if (!isSelfMentionEntity(entity, text, opts)) continue;
    const start = entity.offset;
    const end = start + entity.length;
    result = `${result.slice(0, start)}@you${result.slice(end)}`;
    replaced = true;
  }

  if (!replaced && mentioned && opts.currentUsername) {
    const pattern = new RegExp(`@${opts.currentUsername}\\b`, 'i');
    if (pattern.test(result)) {
      result = result.replace(pattern, '@you');
    }
  }

  return result;
}

export function formatDialogPreviewText(
  message: Message,
  opts: DialogPreviewOptions = {},
): string | undefined {
  if (message.isEmpty) return undefined;
  if (message.kind === 'service') return message.summaryText || 'Service message';

  const label = message.media ? mediaLabel(message.media) : undefined;
  const rawText = message.message?.trim();
  const text = rawText
    ? replaceSelfMentionsInText(rawText, message.entities, opts, message.mentioned)
    : undefined;

  if (label && text) return truncateSummary(`${label} · ${text}`);
  if (label) return label;
  if (text) return truncateSummary(text);
  return undefined;
}

function mediaLabel(media: TypeMessageMedia): string | undefined {
  if ('poll' in media) return 'Poll';
  if ('phoneNumber' in media) return 'Contact';
  if ('emoticon' in media && 'value' in media) return media.emoticon || 'Dice';
  if ('game' in media) return 'Game';
  if ('currency' in media && 'totalAmount' in media) return media.title || 'Invoice';
  if ('venueId' in media) return media.title || 'Location';
  if ('starsAmount' in media) return 'Paid media';
  if ('winnersCount' in media) return 'Giveaway results';
  if ('quantity' in media && 'channels' in media) return 'Giveaway';
  if ('webpage' in media) return undefined;
  if ('story' in media || ('peer' in media && 'id' in media && !('geo' in media))) return 'Story';
  if ('voice' in media && media.voice) return 'Voice message';
  if ('round' in media && media.round) return 'Video message';
  if ('video' in media && media.video) return 'Video';
  if ('document' in media && media.document) {
    if (isRealDocument(media.document) && documentHasStickerAttribute(media.document as Document)) {
      const stickerAttr = getDocumentStickerAttribute(media.document as Document);
      return stickerAttr?.alt ? `${stickerAttr.alt} Sticker` : 'Sticker';
    }
    return 'File';
  }
  if ('photo' in media) return 'Photo';
  if ('geo' in media) return 'Location';
  return undefined;
}

function isDataUri(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

function thumbUriFromSizes(sizes: unknown): string | undefined {
  if (!Array.isArray(sizes)) return undefined;
  for (const size of sizes) {
    if (size && typeof size === 'object' && 'bytes' in size && isDataUri(size.bytes)) {
      return size.bytes;
    }
  }
  return undefined;
}

function isRealPhoto(photo: unknown): photo is { id: string; accessHash: string; sizes?: unknown } {
  return Boolean(
    photo &&
      typeof photo === 'object' &&
      'id' in photo &&
      'accessHash' in photo &&
      Boolean((photo as { accessHash?: string }).accessHash),
  );
}

function isRealDocument(
  document: unknown,
): document is { thumbs?: unknown; attributes?: unknown[]; accessHash: string } {
  return Boolean(
    document &&
      typeof document === 'object' &&
      'accessHash' in document &&
      Boolean((document as { accessHash?: string }).accessHash),
  );
}

function getDocumentStickerAttribute(document: {
  attributes?: unknown[];
}): DocumentAttributeSticker | undefined {
  if (!document.attributes || !Array.isArray(document.attributes)) return undefined;
  return document.attributes.find((attr): attr is DocumentAttributeSticker => {
    if (!attr || typeof attr !== 'object') return false;
    return (
      ('alt' in attr && 'stickerset' in attr) ||
      (attr as { className?: string }).className === 'DocumentAttributeSticker'
    );
  }) as DocumentAttributeSticker | undefined;
}

function documentHasStickerAttribute(document: { attributes?: unknown[] }): boolean {
  return Boolean(getDocumentStickerAttribute(document));
}

function documentAudioAttribute(document: {
  attributes?: unknown[];
}): { voice?: boolean; duration?: number; waveform?: string } | undefined {
  for (const attr of document.attributes ?? []) {
    if (!attr || typeof attr !== 'object') continue;
    if (!('duration' in attr) || 'w' in attr || 'h' in attr) continue;
    return attr as { voice?: boolean; duration?: number; waveform?: string };
  }
  return undefined;
}

/** Unpack Telegram's 5-bit voice waveform. Values are 0–31. */
export function decodeVoiceWaveform(waveformBase64: string | undefined): number[] {
  if (!waveformBase64) return [];
  let bytes: Uint8Array;
  try {
    const binary = globalThis.atob(waveformBase64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  } catch {
    return [];
  }
  if (bytes.length === 0) return [];

  const count = Math.floor((bytes.length * 8) / 5);
  const result: number[] = [];
  let bitPos = 0;
  for (let i = 0; i < count; i++) {
    const bytePos = Math.floor(bitPos / 8);
    const shift = bitPos % 8;
    let value = (bytes[bytePos] >> shift) & 0x1f;
    if (shift > 3 && bytePos + 1 < bytes.length) {
      value |= (bytes[bytePos + 1] << (8 - shift)) & 0x1f;
    }
    result.push(value);
    bitPos += 5;
  }
  return result;
}

function documentHasVideoAttribute(document: {
  attributes?: unknown[];
  mimeType?: string;
}): boolean {
  if (
    typeof document.mimeType === 'string' &&
    document.mimeType.toLowerCase().startsWith('video/')
  ) {
    return true;
  }
  return (document.attributes ?? []).some((attr) => {
    if (!attr || typeof attr !== 'object') return false;
    return (
      'roundMessage' in attr ||
      'supportsStreaming' in attr ||
      'videoCodec' in attr ||
      (attr as { className?: string }).className === 'DocumentAttributeVideo' ||
      ('duration' in attr && ('w' in attr || 'h' in attr) && !('voice' in attr))
    );
  });
}

function documentIsImage(document: { attributes?: unknown[]; mimeType?: string }): boolean {
  return (
    typeof document.mimeType === 'string' && document.mimeType.toLowerCase().startsWith('image/')
  );
}

export type MessagePreviewContent = {
  kind?: MessagePreviewKind;
  thumbs: string[];
  text: string;
};

export function previewKindFromMedia(media: TypeMessageMedia | undefined): MessagePreviewKind | undefined {
  if (!media) return undefined;
  if ('photo' in media && isRealPhoto(media.photo)) return 'photo';
  if ('voice' in media && media.voice) return undefined;
  if ('document' in media && isRealDocument(media.document)) {
    if (documentHasStickerAttribute(media.document)) return 'sticker';
    if (('video' in media && media.video) || ('round' in media && media.round)) return 'video';
    if (documentHasVideoAttribute(media.document)) return 'video';
    if (documentIsImage(media.document)) return 'photo';
  }
  return undefined;
}

export function previewThumbFromMedia(media: TypeMessageMedia | undefined): string | undefined {
  if (!media) return undefined;
  if ('videoCover' in media && isRealPhoto(media.videoCover)) {
    const fromCover = thumbUriFromSizes(media.videoCover.sizes);
    if (fromCover) return fromCover;
  }
  if ('photo' in media && isRealPhoto(media.photo)) {
    return thumbUriFromSizes(media.photo.sizes);
  }
  if ('document' in media && isRealDocument(media.document)) {
    const fromThumbs = thumbUriFromSizes(media.document.thumbs);
    if (fromThumbs) return fromThumbs;
  }
  return undefined;
}

export function albumPreviewPlaceholder(kind: MessagePreviewKind, count: number): string {
  if (kind === 'sticker') return 'Sticker';
  if (kind === 'photo') return count > 1 ? 'Photos' : 'Photo';
  return count > 1 ? 'Videos' : 'Video';
}

export function collectAlbumPreview(
  messages: Iterable<Message>,
  lastMessage: Message,
  max = ALBUM_PREVIEW_MAX,
): { kind: MessagePreviewKind; count: number; thumbs: string[]; caption?: string } | undefined {
  const kind = lastMessage.previewKind;
  if (!kind) return undefined;

  const groupedId = lastMessage.groupedId;
  const pool = groupedId
    ? [...messages].filter((item) => item.groupedId === groupedId && item.previewKind === kind)
    : [lastMessage];
  const items = (pool.length > 0 ? pool : [lastMessage]).sort(
    (a, b) => Number(a.id) - Number(b.id),
  );

  const thumbs: string[] = [];
  for (const item of items) {
    if (thumbs.length >= max) break;
    const uri = item.previewThumbDataUri;
    if (uri) thumbs.push(uri);
  }

  let caption: string | undefined;
  for (const item of items) {
    const text = item.message?.replace(/\s+/g, ' ').trim();
    if (text) {
      caption = text;
      break;
    }
  }
  if (!caption) {
    const text = lastMessage.message?.replace(/\s+/g, ' ').trim();
    if (text) caption = text;
  }

  return { kind, count: items.length, thumbs, caption };
}

export function collectMessagePreview(message: Message | null | undefined): MessagePreviewContent | undefined {
  if (!message || message.isEmpty || message.kind !== 'message') return undefined;

  const kind = message.previewKind;
  const thumb = message.previewThumbDataUri;
  const thumbs = thumb ? [thumb] : [];

  const text = message.message?.trim()
    || (message.isDocument ? message.mediaFileName : undefined)
    || (kind ? albumPreviewPlaceholder(kind, 1) : message.summaryText)
    || 'Message';

  return { kind, thumbs, text };
}

export class Message extends BaseEntityModel<MessageEntity> {
  kind: MessageKind;
  peerId: string;
  peerType: PeerType;
  fromId?: string;
  fromType?: PeerType | '';
  out?: boolean;
  mentioned?: boolean;
  mediaUnread?: boolean;
  silent?: boolean;
  post?: boolean;
  fromScheduled?: boolean;
  legacy?: boolean;
  editHide?: boolean;
  pinned?: boolean;
  noforwards?: boolean;
  invertMedia?: boolean;
  date: number;
  message: string;
  fwdFrom?: TypeMessageFwdHeader;
  viaBotId?: string;
  replyTo?: TypeMessageReplyHeader;
  media?: TypeMessageMedia;
  replyMarkup?: TypeReplyMarkup;
  entities?: TypeMessageEntity[];
  views?: number;
  forwards?: number;
  replies?: TypeMessageReplies;
  editDate?: number;
  postAuthor?: string;
  groupedId?: string;
  reactions?: TypeMessageReactions;
  restrictionReason?: TypeRestrictionReason[];
  ttlPeriod?: number;
  reactionsArePossible?: true;
  action?: TypeMessageAction;
  isEmpty: boolean;
  replyTargetVerified?: boolean;
  sendingState?: 'pending' | 'failed';
  uploadProgress?: number;
  uploadId?: string;
  localBlobUrl?: string;
  localCoverBlobUrl?: string;

  constructor(data: MessageEntity) {
    super(data);
    this.kind = data.kind ?? (data.isEmpty ? 'empty' : 'message');
    this.peerId = data.peerId ?? '';
    this.peerType = data.peerType ?? 'user';
    this.fromId = data.fromId;
    this.fromType = data.fromType;
    this.out = data.out;
    this.mentioned = data.mentioned;
    this.mediaUnread = data.mediaUnread;
    this.silent = data.silent;
    this.post = data.post;
    this.fromScheduled = data.fromScheduled;
    this.legacy = data.legacy;
    this.editHide = data.editHide;
    this.pinned = data.pinned;
    this.noforwards = data.noforwards;
    this.invertMedia = data.invertMedia;
    this.date = data.date ?? 0;
    this.message = data.message ?? '';
    this.fwdFrom = data.fwdFrom;
    this.viaBotId = data.viaBotId;
    this.replyTo = data.replyTo;
    this.media = data.media;
    this.replyMarkup = data.replyMarkup;
    this.entities = data.entities;
    this.views = data.views;
    this.forwards = data.forwards;
    this.replies = data.replies;
    this.editDate = data.editDate;
    this.postAuthor = data.postAuthor;
    this.groupedId = data.groupedId;
    this.reactions = data.reactions;
    this.restrictionReason = data.restrictionReason;
    this.ttlPeriod = data.ttlPeriod;
    this.reactionsArePossible = data.reactionsArePossible;
    this.action = data.action;
    this.isEmpty = data.isEmpty ?? this.kind === 'empty';
    this.replyTargetVerified = data.replyTargetVerified;
    this.sendingState = data.sendingState;
    this.uploadProgress = data.uploadProgress;
    this.uploadId = data.uploadId;
    this.localBlobUrl = data.localBlobUrl;
    this.localCoverBlobUrl = data.localCoverBlobUrl;
    makeModelObservable(this);
  }

  get isUploading(): boolean {
    return Boolean(this.sendingState === 'pending');
  }

  /** Telegram: you were @mentioned and the mention is still unread. */
  get hasUnreadMention(): boolean {
    return Boolean(this.mentioned && this.mediaUnread);
  }

  get isPinMessage(): boolean {
    if (this.kind !== 'service') return false;
    const action = this.action;
    if (
      action &&
      ('isPin' in action || ('type' in action && (action as { type?: string }).type === 'pinMessage'))
    ) {
      return true;
    }
    if (this.replyToMessageId != null) {
      return true;
    }
    return false;
  }

  get isBoostMessage(): boolean {
    if (this.kind !== 'service') return false;
    const action = this.action;
    return Boolean(
      action &&
        ('boosts' in action || ('type' in action && (action as { type?: string }).type === 'boostApply')),
    );
  }

  get boostCount(): number {
    if (!this.isBoostMessage || !this.action) return 0;
    return typeof (this.action as { boosts?: number }).boosts === 'number'
      ? (this.action as { boosts?: number }).boosts!
      : 1;
  }

  get summaryText(): string | undefined {
    if (this.isEmpty) return undefined;
    if (this.kind === 'service') {
      if (this.isPinMessage) return 'Pinned a message';
      if (this.isBoostMessage) {
        const count = this.boostCount;
        return count > 1 ? `Boosted the group ${count} times` : 'Boosted the group';
      }
      return 'Service message';
    }

    const label = this.media ? mediaLabel(this.media) : undefined;
    const text = this.message?.trim();

    if (label && text) return truncateSummary(`${label} · ${text}`);
    if (label) return label;
    if (text) return truncateSummary(text);
    return undefined;
  }

  get previewKind(): MessagePreviewKind | undefined {
    if (this.isEmpty || this.kind !== 'message') return undefined;
    return previewKindFromMedia(this.media);
  }

  get previewThumbDataUri(): string | undefined {
    if (this.localCoverBlobUrl) return this.localCoverBlobUrl;
    if (this.localBlobUrl) return this.localBlobUrl;
    if (!this.previewKind) return undefined;
    return previewThumbFromMedia(this.media);
  }

  get isSticker(): boolean {
    if (this.isEmpty || this.kind !== 'message' || !this.media) return false;
    if (!('document' in this.media) || !isRealDocument(this.media.document)) return false;
    return documentHasStickerAttribute(this.media.document as Document);
  }

  get stickerDocument(): Document | undefined {
    if (this.isSticker && this.media && 'document' in this.media) {
      return this.media.document as Document;
    }
    return undefined;
  }

  get stickerEmoji(): string | undefined {
    const doc = this.stickerDocument;
    if (!doc) return undefined;
    const attr = getDocumentStickerAttribute(doc);
    return attr?.alt || undefined;
  }

  get stickerSet(): TypeInputStickerSet | undefined {
    const doc = this.stickerDocument;
    if (!doc) return undefined;
    const attr = getDocumentStickerAttribute(doc);
    return attr?.stickerset;
  }

  get isStaticSticker(): boolean {
    if (!this.isSticker || !this.stickerDocument) return false;
    const mime = this.stickerDocument.mimeType?.toLowerCase() || '';
    return mime === 'image/webp';
  }

  get isAnimatedSticker(): boolean {
    if (!this.isSticker || !this.stickerDocument) return false;
    const mime = this.stickerDocument.mimeType?.toLowerCase() || '';
    if (mime === 'application/x-tgsticker') return true;
    return (this.stickerDocument.attributes ?? []).some(
      (attr) =>
        attr &&
        typeof attr === 'object' &&
        ((attr as { className?: string }).className === 'DocumentAttributeAnimated' ||
          (attr as { animated?: boolean }).animated),
    );
  }

  get isVideoSticker(): boolean {
    if (!this.isSticker || !this.stickerDocument) return false;
    const mime = this.stickerDocument.mimeType?.toLowerCase() || '';
    if (mime === 'video/webm') return true;
    return documentHasVideoAttribute(this.stickerDocument);
  }

  get isPhoto(): boolean {
    if (this.isEmpty || this.kind !== 'message' || !this.media) return false;
    if (this.isSticker) return false;
    if ('photo' in this.media && isRealPhoto(this.media.photo)) return true;
    if ('document' in this.media && isRealDocument(this.media.document)) {
      if (this.isVideo) return false;
      if ('voice' in this.media && (this.media as { voice?: boolean }).voice) return false;
      const doc = this.media.document as Document;
      if (documentIsImage(doc)) return true;
      const fileName = this.mediaFileName?.toLowerCase() || '';
      if (/\.(jpe?g|png|webp|gif|bmp|heic|svg)$/i.test(fileName)) return true;
    }
    return false;
  }

  get hasSpoiler(): boolean {
    if (!this.media || typeof this.media !== 'object') return false;
    return Boolean('spoiler' in this.media && (this.media as { spoiler?: boolean }).spoiler);
  }

  get videoCover(): Photo | undefined {
    if (!this.media || typeof this.media !== 'object') return undefined;
    if ('videoCover' in this.media && isRealPhoto((this.media as { videoCover?: Photo }).videoCover)) {
      return (this.media as { videoCover?: Photo }).videoCover;
    }
    return undefined;
  }

  get photo(): Photo | undefined {
    if (this.isPhoto && 'photo' in this.media!) {
      return this.media.photo as Photo;
    }
    return undefined;
  }

  get photoDocument(): Document | undefined {
    if (
      this.isPhoto &&
      this.media &&
      'document' in this.media &&
      isRealDocument(this.media.document)
    ) {
      return this.media.document as Document;
    }
    return undefined;
  }

  get isVideo(): boolean {
    if (this.isEmpty || this.kind !== 'message' || !this.media) return false;
    if (this.isSticker) return false;
    if (!('document' in this.media) || !isRealDocument(this.media.document)) return false;
    if (
      ('video' in this.media && this.media.video) ||
      ('round' in this.media && this.media.round)
    ) {
      return true;
    }
    const doc = this.media.document as Document;
    if (documentHasVideoAttribute(doc)) return true;
    const fileName = this.mediaFileName?.toLowerCase() || '';
    if (/\.(mp4|mov|webm|mkv|m4v|avi)$/i.test(fileName)) return true;
    return false;
  }

  get isRoundVideo(): boolean {
    if (!this.isVideo || !this.media || !('document' in this.media)) return false;
    if ('round' in this.media && this.media.round) return true;
    return (
      (this.media.document as Document)?.attributes?.some(
        (attr) =>
          typeof attr === 'object' &&
          attr !== null &&
          'roundMessage' in attr &&
          (attr as { roundMessage?: boolean }).roundMessage,
      ) ?? false
    );
  }

  get videoDocument(): Document | undefined {
    if (this.isVideo && this.media && 'document' in this.media) {
      return this.media.document as Document;
    }
    return undefined;
  }

  get isVoice(): boolean {
    if (this.isEmpty || this.kind !== 'message' || !this.media) return false;
    if (!('voice' in this.media) || !this.media.voice) return false;
    if ('video' in this.media && this.media.video) return false;
    if ('round' in this.media && this.media.round) return false;
    return true;
  }

  get voiceDocument(): Document | undefined {
    if (
      this.isVoice &&
      this.media &&
      'document' in this.media &&
      isRealDocument(this.media.document)
    ) {
      return this.media.document as Document;
    }
    return undefined;
  }

  get voiceDuration(): number | undefined {
    if (!this.isVoice) return undefined;
    return this.mediaDuration;
  }

  /** Packed waveform samples (0–31). Empty when the audio attribute has no waveform. */
  get voiceWaveform(): number[] {
    const doc = this.voiceDocument;
    if (!doc) return [];
    return decodeVoiceWaveform(documentAudioAttribute(doc)?.waveform);
  }

  get isDocument(): boolean {
    if (this.isEmpty || this.kind !== 'message' || !this.media) return false;
    if (this.isSticker) return false;
    if (!('document' in this.media) || !isRealDocument(this.media.document)) return false;
    if (this.isVideo) return false;
    if (this.isPhoto) return false;
    if ('voice' in this.media && this.media.voice) return false;
    return true;
  }

  get fileDocument(): Document | undefined {
    if (this.isDocument && this.media && 'document' in this.media) {
      return this.media.document as Document;
    }
    return undefined;
  }

  get isInAlbum(): boolean {
    return Boolean(this.groupedId) && (this.isPhoto || this.isVideo);
  }

  get isInFileGroup(): boolean {
    return Boolean(this.groupedId) && this.isDocument;
  }

  get mediaFileName(): string | undefined {
    const doc =
      this.media && 'document' in this.media && isRealDocument(this.media.document)
        ? (this.media.document as Document)
        : undefined;
    if (!doc?.attributes) return undefined;
    for (const attr of doc.attributes) {
      if (
        attr &&
        typeof attr === 'object' &&
        'fileName' in attr &&
        (attr as { fileName?: string }).fileName
      ) {
        return (attr as { fileName: string }).fileName;
      }
    }
    return undefined;
  }

  get mediaFileSize(): number | undefined {
    const doc =
      this.media && 'document' in this.media && isRealDocument(this.media.document)
        ? (this.media.document as Document)
        : undefined;
    if (doc?.size != null) {
      const size = Number(doc.size);
      if (Number.isFinite(size)) return size;
    }
    return undefined;
  }

  get mediaMimeType(): string | undefined {
    if (this.isPhoto && 'photo' in this.media!) return 'image/jpeg';
    if (this.media && 'document' in this.media && isRealDocument(this.media.document)) {
      return (
        (this.media.document as Document).mimeType || (this.isPhoto ? 'image/jpeg' : undefined)
      );
    }
    return undefined;
  }

  get mediaDuration(): number | undefined {
    const doc =
      this.media && 'document' in this.media && isRealDocument(this.media.document)
        ? (this.media.document as Document)
        : undefined;
    if (!doc?.attributes) return undefined;
    for (const attr of doc.attributes) {
      if (
        attr &&
        typeof attr === 'object' &&
        'duration' in attr &&
        typeof (attr as { duration?: number }).duration === 'number'
      ) {
        return (attr as { duration: number }).duration;
      }
    }
    return undefined;
  }

  get mediaDimensions(): { width: number; height: number } | undefined {
    if (this.isPhoto && this.photo?.sizes) {
      let best: { width: number; height: number } | undefined;
      for (const size of this.photo.sizes) {
        if (
          'w' in size &&
          'h' in size &&
          (size as { w: number; h: number }).w > 0 &&
          (size as { w: number; h: number }).h > 0
        ) {
          const width = (size as { w: number }).w;
          const height = (size as { h: number }).h;
          if (!best || width * height > best.width * best.height) {
            best = { width, height };
          }
        }
      }
      return best;
    }
    const doc = this.photoDocument || this.videoDocument;
    if (doc?.attributes) {
      for (const attr of doc.attributes) {
        if (
          attr &&
          typeof attr === 'object' &&
          'w' in attr &&
          'h' in attr &&
          (attr as { w: number; h: number }).w > 0 &&
          (attr as { w: number; h: number }).h > 0
        ) {
          return { width: (attr as { w: number }).w, height: (attr as { h: number }).h };
        }
      }
    }
    return undefined;
  }

  outgoingStatus(readOutboxMaxId?: number): MessageOutgoingStatus | undefined {
    if (!this.out) return undefined;
    const id = Number(this.id);
    if (Number.isFinite(id) && readOutboxMaxId != null && id <= readOutboxMaxId) {
      return 'read';
    }
    return 'succeeded';
  }

  /** Parsed reply header when this message replies to another message. */
  get messageReplyHeader() {
    return resolveMessageReplyHeader(this.replyTo);
  }

  get replyToMessageId(): number | undefined {
    return this.messageReplyHeader?.replyToMsgId;
  }

  /** Peer that owns the replied-to message (defaults to this message's peer). */
  get replyTargetPeerId(): string {
    const replyToPeerId = peerIdFromTypePeer(this.messageReplyHeader?.replyToPeerId);
    return replyToPeerId ?? this.peerId;
  }

  /** Original sender of a forwarded message, when the author was kept. */
  get forwardSenderPeerId(): string | undefined {
    return peerIdFromTypePeer(this.fwdFrom?.fromId);
  }

  /** Header carries enough inline data to render without loading the target. */
  get hasInlineReplyPreview(): boolean {
    const header = this.messageReplyHeader;
    return header != null && hasHeaderReplyPreview(header);
  }

  /** Whether a reply preview chip may be shown (header snapshot or loaded target). */
  hasReplyPreviewContent(repliedMessage: Message | null | undefined): boolean {
    const header = this.messageReplyHeader;
    if (!header) return false;
    if (hasHeaderReplyPreview(header)) return true;
    return hasStoredReplyPreview(repliedMessage);
  }

  /**
   * Whether the reply chip may render. Resolved when the message is ingested
   * (`replyTargetVerified`), so the UI never flips height after first paint.
   * - `true` — show
   * - `false` — hide
   */
  replyPreviewVerificationState(repliedMessage: Message | null | undefined): boolean {
    if (!this.messageReplyHeader || this.replyToMessageId == null) return false;
    if (this.replyTargetVerified === true) return true;
    if (this.replyTargetVerified === false) return false;
    if (this.hasInlineReplyPreview) return true;
    return hasStoredReplyPreview(repliedMessage);
  }

  needsReplyTargetVerification(repliedMessage: Message | null | undefined): boolean {
    if (this.replyTargetVerified != null) return false;
    if (!this.messageReplyHeader || this.replyToMessageId == null) return false;
    if (this.hasInlineReplyPreview) return false;
    return hasStoredReplyPreview(repliedMessage);
  }

  replyPreviewText(repliedMessage: Message | null | undefined): string {
    const header = this.messageReplyHeader;
    if (!header) return 'Message';
    return buildReplyPreviewText(header, repliedMessage);
  }

  replyPreviewContent(repliedMessage: Message | null | undefined): MessagePreviewContent {
    const header = this.messageReplyHeader;
    if (!header) return { thumbs: [], text: 'Message' };

    const text = buildReplyPreviewText(header, repliedMessage);
    const fromMessage = collectMessagePreview(repliedMessage);
    if (fromMessage) {
      return { ...fromMessage, text };
    }

    const media = header.replyMedia;
    if (media) {
      const kind = previewKindFromMedia(media);
      const thumb = previewThumbFromMedia(media);
      return {
        kind,
        thumbs: thumb ? [thumb] : [],
        text,
      };
    }

    return { thumbs: [], text };
  }

  replySenderPeerIdValue(repliedMessage: Message | null | undefined): string | undefined {
    return replySenderPeerId(this.messageReplyHeader?.replyFrom, repliedMessage);
  }

  /** Serialize to a plain JSON string round-trippable via {@link Message.fromJSON}. */
  toJSON(): string {
    return stringifyJson(toJS(this));
  }

  static fromJSON(json: string): Message {
    return new Message(JSON.parse(json) as MessageEntity);
  }
}
