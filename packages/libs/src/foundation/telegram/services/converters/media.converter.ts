import { Api } from '@telegenie/teleproto';
import type {
  Document,
  DocumentEmpty,
  MaskCoords,
  PeerStories,
  Photo,
  PhotoCachedSize,
  PhotoPathSize,
  PhotoSize,
  PhotoSizeEmpty,
  PhotoSizeProgressive,
  PhotoStrippedSize,
  TypeDocument,
  TypeDocumentAttribute,
  TypeInputStickerSet,
  TypeMessageMedia,
  TypePhotoSize,
  TypeStoryItem,
  TypeVideoSize,
  TypeWebPage,
  VideoSize,
  VideoSizeEmojiMarkup,
  VideoSizeStickerMarkup,
} from '../../types/api-types';
import { convertTypePeer } from './common.converter';
import { bytesToBase64, bytesToDataUri, buildStrippedThumbDataUri } from './thumbnail.converter';

/** Encode TL `bytes` / Buffer as a plain base64 string for JSON. */
export function convertBytesToBase64(bytes?: Uint8Array): string | undefined {
  if (!bytes || bytes.length === 0) {
    return undefined;
  }
  return bytesToBase64(bytes);
}

export const convertTypeInputStickerSet = (
  stickerset?: Api.TypeInputStickerSet,
): TypeInputStickerSet | undefined => {
  if (!stickerset) {
    return undefined;
  }
  if (stickerset instanceof Api.InputStickerSetEmpty) {
    return {} as TypeInputStickerSet;
  }
  if (stickerset instanceof Api.InputStickerSetID) {
    return {
      id: stickerset.id.toString(),
      accessHash: stickerset.accessHash.toString(),
    };
  }
  if (stickerset instanceof Api.InputStickerSetShortName) {
    return {
      shortName: stickerset.shortName ?? '',
    };
  }
  if (stickerset instanceof Api.InputStickerSetDice) {
    return {
      emoticon: stickerset.emoticon ?? '',
    };
  }
  // Empty marker variants (animated emoji sets, etc.)
  return {} as TypeInputStickerSet;
};

export const convertTypeMaskCoords = (
  coords?: Api.TypeMaskCoords,
): MaskCoords | undefined => {
  if (!coords) {
    return undefined;
  }
  if (coords instanceof Api.MaskCoords) {
    return {
      n: coords.n ?? 0,
      x: coords.x ?? 0,
      y: coords.y ?? 0,
      zoom: coords.zoom ?? 0,
    };
  }
  return undefined;
};

export const convertTypePhotoSize = (
  size?: Api.TypePhotoSize,
): TypePhotoSize | undefined => {
  if (!size) {
    return undefined;
  }
  if (size instanceof Api.PhotoSizeEmpty) {
    return {
      type: size.type ?? '',
    } satisfies PhotoSizeEmpty;
  }
  if (size instanceof Api.PhotoSize) {
    return {
      type: size.type ?? '',
      w: size.w ?? 0,
      h: size.h ?? 0,
      size: size.size ?? 0,
    } satisfies PhotoSize;
  }
  if (size instanceof Api.PhotoSizeProgressive) {
    return {
      type: size.type ?? '',
      w: size.w ?? 0,
      h: size.h ?? 0,
      sizes: size.sizes ?? [],
    } satisfies PhotoSizeProgressive;
  }
  if (size instanceof Api.PhotoCachedSize) {
    return {
      type: size.type ?? '',
      w: size.w ?? 0,
      h: size.h ?? 0,
      bytes: bytesToDataUri(size.bytes, false, 'image/jpeg'),
    } satisfies PhotoCachedSize;
  }
  if (size instanceof Api.PhotoStrippedSize) {
    return {
      type: size.type ?? '',
      bytes: buildStrippedThumbDataUri(size.bytes) ?? '',
    } satisfies PhotoStrippedSize;
  }
  if (size instanceof Api.PhotoPathSize) {
    return {
      type: size.type ?? '',
      bytes: convertBytesToBase64(size.bytes) ?? '',
    } satisfies PhotoPathSize;
  }
  return undefined;
};

export const convertTypeVideoSize = (
  videoSize?: Api.TypeVideoSize,
): TypeVideoSize | undefined => {
  if (!videoSize) {
    return undefined;
  }
  if (videoSize instanceof Api.VideoSize) {
    return {
      type: videoSize.type ?? '',
      w: videoSize.w ?? 0,
      h: videoSize.h ?? 0,
      size: videoSize.size ?? 0,
      videoStartTs: videoSize.videoStartTs,
    } satisfies VideoSize;
  }
  if (videoSize instanceof Api.VideoSizeEmojiMarkup) {
    return {
      emojiId: videoSize.emojiId.toString(),
      backgroundColors: videoSize.backgroundColors ?? [],
    } satisfies VideoSizeEmojiMarkup;
  }
  if (videoSize instanceof Api.VideoSizeStickerMarkup) {
    return {
      stickerset: convertTypeInputStickerSet(videoSize.stickerset)!,
      stickerId: videoSize.stickerId.toString(),
      backgroundColors: videoSize.backgroundColors ?? [],
    } satisfies VideoSizeStickerMarkup;
  }
  return undefined;
};

export const convertTypeDocumentAttribute = (
  attr?: Api.TypeDocumentAttribute,
): TypeDocumentAttribute | undefined => {
  if (!attr) {
    return undefined;
  }
  if (attr instanceof Api.DocumentAttributeImageSize) {
    return {
      w: attr.w ?? 0,
      h: attr.h ?? 0,
    };
  }
  if (attr instanceof Api.DocumentAttributeAnimated) {
    return {} as TypeDocumentAttribute;
  }
  if (attr instanceof Api.DocumentAttributeHasStickers) {
    return {} as TypeDocumentAttribute;
  }
  if (attr instanceof Api.DocumentAttributeFilename) {
    return {
      fileName: attr.fileName ?? '',
    };
  }
  if (attr instanceof Api.DocumentAttributeSticker) {
    return {
      mask: attr.mask ?? false,
      alt: attr.alt ?? '',
      stickerset: convertTypeInputStickerSet(attr.stickerset)!,
      maskCoords: convertTypeMaskCoords(attr.maskCoords),
    };
  }
  if (attr instanceof Api.DocumentAttributeCustomEmoji) {
    return {
      free: attr.free ?? false,
      textColor: attr.textColor ?? false,
      alt: attr.alt ?? '',
      stickerset: convertTypeInputStickerSet(attr.stickerset)!,
    };
  }
  if (attr instanceof Api.DocumentAttributeAudio) {
    return {
      voice: attr.voice ?? false,
      duration: attr.duration ?? 0,
      title: attr.title,
      performer: attr.performer,
      waveform: convertBytesToBase64(attr.waveform),
    };
  }
  if (attr instanceof Api.DocumentAttributeVideo) {
    return {
      roundMessage: attr.roundMessage ?? false,
      supportsStreaming: attr.supportsStreaming ?? false,
      nosound: attr.nosound ?? false,
      duration: attr.duration ?? 0,
      w: attr.w ?? 0,
      h: attr.h ?? 0,
      preloadPrefixSize: attr.preloadPrefixSize,
      videoStartTs: attr.videoStartTs,
      videoCodec: attr.videoCodec,
    };
  }
  return undefined;
};

/**
 * Convert GramJS Photo with JSON-safe nested sizes and base64 fileReference.
 */
export const convertTypePhotoSerializable = (photo?: Api.TypePhoto): Photo | undefined => {
  if (!photo) {
    return undefined;
  }
  if (photo instanceof Api.PhotoEmpty) {
    return undefined;
  }
  if (photo instanceof Api.Photo) {
    return {
      hasStickers: photo.hasStickers ?? false,
      id: photo.id.toString(),
      accessHash: photo.accessHash.toString(),
      fileReference: convertBytesToBase64(photo.fileReference) ?? '',
      date: photo.date ?? 0,
      sizes: (photo.sizes?.map(convertTypePhotoSize).filter(Boolean) ?? []) as TypePhotoSize[],
      videoSizes: photo.videoSizes
        ?.map(convertTypeVideoSize)
        .filter(Boolean) as TypeVideoSize[] | undefined,
      dcId: photo.dcId ?? 0,
    };
  }
  return undefined;
};

/**
 * Convert GramJS Document with JSON-safe thumbs/attributes/fileReference.
 */
export const convertTypeDocumentSerializable = (
  document?: Api.TypeDocument,
): TypeDocument | undefined => {
  if (!document) {
    return undefined;
  }
  if (document instanceof Api.DocumentEmpty) {
    return {
      id: document.id.toString(),
    } satisfies DocumentEmpty;
  }
  if (document instanceof Api.Document) {
    return {
      id: document.id.toString(),
      accessHash: document.accessHash.toString(),
      fileReference: convertBytesToBase64(document.fileReference) ?? '',
      date: document.date ?? 0,
      mimeType: document.mimeType ?? '',
      size: document.size?.toString() ?? '0',
      thumbs: document.thumbs?.map(convertTypePhotoSize).filter(Boolean) as
        | TypePhotoSize[]
        | undefined,
      videoThumbs: document.videoThumbs
        ?.map(convertTypeVideoSize)
        .filter(Boolean) as TypeVideoSize[] | undefined,
      dcId: document.dcId ?? 0,
      attributes: (document.attributes
        ?.map(convertTypeDocumentAttribute)
        .filter(Boolean) ?? []) as TypeDocumentAttribute[],
    } satisfies Document;
  }
  return undefined;
};

/**
 * Lightweight story conversion for Full-entity JSON safety.
 * Full `StoryItem.media` (MessageMedia tree) is omitted until media converters exist.
 */
export const convertTypeStoryItemLightweight = (
  item?: Api.TypeStoryItem,
): TypeStoryItem | undefined => {
  if (!item) {
    return undefined;
  }
  if (item instanceof Api.StoryItemDeleted) {
    return { id: item.id };
  }
  if (item instanceof Api.StoryItemSkipped) {
    return {
      closeFriends: item.closeFriends ?? false,
      id: item.id,
      date: item.date ?? 0,
      expireDate: item.expireDate ?? 0,
    };
  }
  if (item instanceof Api.StoryItem) {
    // Persist metadata only — media/entities/privacy/views stay out of cache JSON.
    return {
      pinned: item.pinned ?? false,
      public: item.public ?? false,
      closeFriends: item.closeFriends ?? false,
      min: item.min ?? false,
      noforwards: item.noforwards ?? false,
      edited: item.edited ?? false,
      contacts: item.contacts ?? false,
      selectedContacts: item.selectedContacts ?? false,
      out: item.out ?? false,
      id: item.id,
      date: item.date ?? 0,
      fromId: item.fromId ? convertTypePeer(item.fromId) : undefined,
      expireDate: item.expireDate ?? 0,
      caption: item.caption,
      // Required by type; intentionally unset until MessageMedia converters land.
      media: undefined as unknown as TypeMessageMedia,
    };
  }
  return undefined;
};

/** Convert GramJS WebPage variants into JSON-safe TypeWebPage. */
export const convertTypeWebPage = (webpage?: Api.TypeWebPage): TypeWebPage | undefined => {
  if (!webpage) {
    return undefined;
  }
  if (webpage instanceof Api.WebPageEmpty) {
    return {
      id: webpage.id.toString(),
      url: webpage.url ?? '',
      displayUrl: webpage.url ?? '',
      hash: 0,
    };
  }
  if (webpage instanceof Api.WebPagePending) {
    return {
      id: webpage.id.toString(),
      url: webpage.url ?? '',
      displayUrl: webpage.url ?? '',
      hash: 0,
    };
  }
  if (webpage instanceof Api.WebPageNotModified) {
    return {
      id: '0',
      url: '',
      displayUrl: '',
      hash: 0,
    };
  }
  if (webpage instanceof Api.WebPage) {
    return {
      hasLargeMedia: webpage.hasLargeMedia,
      id: webpage.id.toString(),
      url: webpage.url ?? '',
      displayUrl: webpage.displayUrl ?? '',
      hash: webpage.hash ?? 0,
      type: webpage.type,
      siteName: webpage.siteName,
      title: webpage.title,
      description: webpage.description,
      photo: convertTypePhotoSerializable(webpage.photo),
      embedUrl: webpage.embedUrl,
      embedType: webpage.embedType,
      embedWidth: webpage.embedWidth,
      embedHeight: webpage.embedHeight,
      duration: webpage.duration,
      author: webpage.author,
      document: convertTypeDocumentSerializable(webpage.document),
    };
  }
  return undefined;
};

export const convertTypePeerStoriesSerializable = (
  stories?: Api.TypePeerStories,
): PeerStories | undefined => {
  if (!stories) {
    return undefined;
  }
  if (stories instanceof Api.PeerStories) {
    return {
      peer: convertTypePeer(stories.peer),
      maxReadId: stories.maxReadId ?? 0,
      stories: (stories.stories
        ?.map(convertTypeStoryItemLightweight)
        .filter(Boolean) ?? []) as TypeStoryItem[],
    };
  }
  return undefined;
};
