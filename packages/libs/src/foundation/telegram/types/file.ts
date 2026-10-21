/**
 * File / media constructor types (Document, Photo, sizes, sticker-set refs).
 * Canonical home — prefer this over defining the same shapes in api-types.ts.
 */

// --- Photo sizes ---

export type PhotoSizeEmpty = {
  type: string;
};

export type PhotoSize = {
  type: string;
  w: number;
  h: number;
  size: number;
};

export type PhotoCachedSize = {
  type: string;
  w: number;
  h: number;
  /** JPEG data URI (JSON-safe) */
  bytes: string;
};

export type PhotoStrippedSize = {
  type: string;
  /** JPEG data URI from stripped bytes (JSON-safe) */
  bytes: string;
};

export type PhotoSizeProgressive = {
  type: string;
  w: number;
  h: number;
  sizes: number[];
};

export type PhotoPathSize = {
  type: string;
  /** Base64-encoded path bytes (JSON-safe) */
  bytes: string;
};

export type TypePhotoSize =
  | PhotoSizeEmpty
  | PhotoSize
  | PhotoCachedSize
  | PhotoStrippedSize
  | PhotoSizeProgressive
  | PhotoPathSize;

// --- Video sizes ---

export type VideoSize = {
  type: string;
  w: number;
  h: number;
  size: number;
  videoStartTs?: number;
};

export type VideoSizeEmojiMarkup = {
  emojiId: string;
  backgroundColors: number[];
};

export type VideoSizeStickerMarkup = {
  stickerset: TypeInputStickerSet;
  stickerId: string;
  backgroundColors: number[];
};

export type TypeVideoSize = VideoSize | VideoSizeEmojiMarkup | VideoSizeStickerMarkup;

// --- Input sticker sets ---

export type InputStickerSetEmpty = Record<string, never>;
export type InputStickerSetAnimatedEmoji = Record<string, never>;
export type InputStickerSetAnimatedEmojiAnimations = Record<string, never>;
export type InputStickerSetPremiumGifts = Record<string, never>;
export type InputStickerSetEmojiGenericAnimations = Record<string, never>;
export type InputStickerSetEmojiDefaultStatuses = Record<string, never>;
export type InputStickerSetEmojiDefaultTopicIcons = Record<string, never>;
export type InputStickerSetEmojiChannelDefaultStatuses = Record<string, never>;

export type InputStickerSetID = {
  id: string;
  accessHash: string;
};

export type InputStickerSetShortName = {
  shortName: string;
};

export type InputStickerSetDice = {
  emoticon: string;
};

export type TypeInputStickerSet =
  | InputStickerSetEmpty
  | InputStickerSetID
  | InputStickerSetShortName
  | InputStickerSetAnimatedEmoji
  | InputStickerSetDice
  | InputStickerSetAnimatedEmojiAnimations
  | InputStickerSetPremiumGifts
  | InputStickerSetEmojiGenericAnimations
  | InputStickerSetEmojiDefaultStatuses
  | InputStickerSetEmojiDefaultTopicIcons
  | InputStickerSetEmojiChannelDefaultStatuses;

export type MaskCoords = {
  n: number;
  x: number;
  y: number;
  zoom: number;
};

export type TypeMaskCoords = MaskCoords;

// --- Document attributes ---

export type DocumentAttributeImageSize = {
  w: number;
  h: number;
};

export type DocumentAttributeAnimated = Record<string, never>;

export type DocumentAttributeSticker = {
  mask?: boolean;
  alt: string;
  stickerset: TypeInputStickerSet;
  maskCoords?: TypeMaskCoords;
};

export type DocumentAttributeVideo = {
  roundMessage?: boolean;
  supportsStreaming?: boolean;
  nosound?: boolean;
  duration: number;
  w: number;
  h: number;
  preloadPrefixSize?: number;
  videoStartTs?: number;
  videoCodec?: string;
};

export type DocumentAttributeAudio = {
  voice?: boolean;
  duration: number;
  title?: string;
  performer?: string;
  /** Base64-encoded waveform bytes (JSON-safe) */
  waveform?: string;
};

export type DocumentAttributeFilename = {
  fileName: string;
};

export type DocumentAttributeHasStickers = Record<string, never>;

export type DocumentAttributeCustomEmoji = {
  free?: boolean;
  textColor?: boolean;
  alt: string;
  stickerset: TypeInputStickerSet;
};

export type TypeDocumentAttribute =
  | DocumentAttributeImageSize
  | DocumentAttributeAnimated
  | DocumentAttributeSticker
  | DocumentAttributeVideo
  | DocumentAttributeAudio
  | DocumentAttributeFilename
  | DocumentAttributeHasStickers
  | DocumentAttributeCustomEmoji;

/** @deprecated Prefer TypeDocumentAttribute */
export type DocumentAttribute = TypeDocumentAttribute;

// --- Document ---

export type DocumentEmpty = {
  id: string;
};

export type Document = {
  id: string;
  accessHash: string;
  /** Base64-encoded file reference bytes (JSON-safe) */
  fileReference: string;
  date: number;
  mimeType: string;
  size: string;
  thumbs?: TypePhotoSize[];
  videoThumbs?: TypeVideoSize[];
  dcId: number;
  attributes: TypeDocumentAttribute[];
};

export type TypeDocument = DocumentEmpty | Document;

// --- Photo constructor (not photos.* namespace results) ---

export type PhotoEmpty = {
  id: string;
};

/**
 * TL constructor `photo` — JSON-safe fileReference / size bytes.
 * Not to be confused with `photos.Photo` (see photos.ts → PhotosPhoto).
 */
export type Photo = {
  hasStickers?: boolean;
  id: string;
  accessHash: string;
  /** Base64-encoded file reference bytes (JSON-safe) */
  fileReference: string;
  date: number;
  sizes: TypePhotoSize[];
  videoSizes?: TypeVideoSize[];
  dcId: number;
};

/** Constructor union (PhotoEmpty | Photo). Not photos.Photo. */
export type TypePhoto = PhotoEmpty | Photo;
