import { Api } from '@telegenie/teleproto';
import { buildMarkedPeerIdByType } from '../../helpers';
import type {
  TypeDataJSON,
  TypeDocumentAttribute,
  TypeInputGame,
  TypeInputUser,
  TypeInputWebDocument,
  TypeInvoice,
  TypeLabeledPrice,
  TypeMessageEntity,
  TypePoll,
  TypePollAnswer,
  TypeTextWithEntities,
} from '../../types/api-types';
import type {
  InputDocument,
  InputDocumentFileLocation,
  InputEncryptedFileLocation,
  InputFile,
  InputFileBig,
  InputFileLocation,
  InputFileStoryDocument,
  InputGeoPoint,
  InputGroupCallStream,
  InputMediaContact,
  InputMediaDice,
  InputMediaDocument,
  InputMediaDocumentExternal,
  InputMediaGame,
  InputMediaGeoLive,
  InputMediaGeoPoint,
  InputMediaInvoice,
  InputMediaPaidMedia,
  InputMediaPhoto,
  InputMediaPhotoExternal,
  InputMediaPoll,
  InputMediaStory,
  InputMediaUploadedDocument,
  InputMediaUploadedPhoto,
  InputMediaVenue,
  InputMediaWebPage,
  InputPhoto,
  InputPhotoFileLocation,
  InputPhotoLegacyFileLocation,
  InputSecureFileLocation,
  InputStickerSetThumb,
  TypeInputDocument,
  TypeInputFile,
  TypeInputFileLocation,
  TypeInputGeoPoint,
  TypeInputMedia,
  TypeInputPhoto,
} from '../../types/input';
import {
  convertTypeInputPeer as convertTypeInputPeerCommon,
  convertTypeInputPeerExcludeSelf,
} from './common.converter';

// Main converter functions
export const convertTypeInputMedia = (media?: Api.TypeInputMedia): TypeInputMedia | undefined => {
  if (!media) {
    return undefined;
  }
  if (media instanceof Api.InputMediaEmpty) {
    return undefined;
  }
  if (media instanceof Api.InputMediaUploadedPhoto) {
    return convertInputMediaUploadedPhoto(media);
  }
  if (media instanceof Api.InputMediaPhoto) {
    return convertInputMediaPhoto(media);
  }
  if (media instanceof Api.InputMediaGeoPoint) {
    return convertInputMediaGeoPoint(media);
  }
  if (media instanceof Api.InputMediaContact) {
    return convertInputMediaContact(media);
  }
  if (media instanceof Api.InputMediaUploadedDocument) {
    return convertInputMediaUploadedDocument(media);
  }
  if (media instanceof Api.InputMediaDocument) {
    return convertInputMediaDocument(media);
  }
  if (media instanceof Api.InputMediaVenue) {
    return convertInputMediaVenue(media);
  }
  if (media instanceof Api.InputMediaPhotoExternal) {
    return convertInputMediaPhotoExternal(media);
  }
  if (media instanceof Api.InputMediaDocumentExternal) {
    return convertInputMediaDocumentExternal(media);
  }
  if (media instanceof Api.InputMediaGame) {
    return convertInputMediaGame(media);
  }
  if (media instanceof Api.InputMediaInvoice) {
    return convertInputMediaInvoice(media);
  }
  if (media instanceof Api.InputMediaGeoLive) {
    return convertInputMediaGeoLive(media);
  }
  if (media instanceof Api.InputMediaPoll) {
    return convertInputMediaPoll(media);
  }
  if (media instanceof Api.InputMediaDice) {
    return convertInputMediaDice(media);
  }
  if (media instanceof Api.InputMediaStory) {
    return convertInputMediaStory(media);
  }
  if (media instanceof Api.InputMediaWebPage) {
    return convertInputMediaWebPage(media);
  }
  if (media instanceof Api.InputMediaPaidMedia) {
    return convertInputMediaPaidMedia(media);
  }
  return undefined;
};

export const convertTypeInputFile = (file?: Api.TypeInputFile): TypeInputFile | undefined => {
  if (!file) {
    return undefined;
  }
  if (file instanceof Api.InputFile) {
    return convertInputFile(file);
  }
  if (file instanceof Api.InputFileBig) {
    return convertInputFileBig(file);
  }
  if (file instanceof Api.InputFileStoryDocument) {
    return convertInputFileStoryDocument(file);
  }
  return undefined;
};

export const convertTypeInputFileLocation = (
  location?: Api.TypeInputFileLocation,
): TypeInputFileLocation | undefined => {
  if (!location) {
    return undefined;
  }
  if (location instanceof Api.InputFileLocation) {
    return convertInputFileLocation(location);
  }
  if (location instanceof Api.InputEncryptedFileLocation) {
    return convertInputEncryptedFileLocation(location);
  }
  if (location instanceof Api.InputDocumentFileLocation) {
    return convertInputDocumentFileLocation(location);
  }
  if (location instanceof Api.InputSecureFileLocation) {
    return convertInputSecureFileLocation(location);
  }
  if (location instanceof Api.InputPhotoFileLocation) {
    return convertInputPhotoFileLocation(location);
  }
  if (location instanceof Api.InputPhotoLegacyFileLocation) {
    return convertInputPhotoLegacyFileLocation(location);
  }
  if (location instanceof Api.InputStickerSetThumb) {
    return convertInputStickerSetThumb(location);
  }
  if (location instanceof Api.InputGroupCallStream) {
    return convertInputGroupCallStream(location);
  }
  return undefined;
};

// InputMedia converter functions
export const convertInputMediaUploadedPhoto = (
  media: Api.InputMediaUploadedPhoto,
): InputMediaUploadedPhoto => ({
  spoiler: media.spoiler,
  file: convertTypeInputFile(media.file)!,
  stickers: media.stickers
    ?.map((sticker) => convertTypeInputDocument(sticker))
    .filter(Boolean) as TypeInputDocument[],
  ttlSeconds: media.ttlSeconds,
});

export const convertInputMediaPhoto = (media: Api.InputMediaPhoto): InputMediaPhoto => ({
  spoiler: media.spoiler,
  id: convertTypeInputPhoto(media.id)!,
  ttlSeconds: media.ttlSeconds,
});

export const convertInputMediaGeoPoint = (media: Api.InputMediaGeoPoint): InputMediaGeoPoint => ({
  geoPoint: convertTypeInputGeoPoint(media.geoPoint),
});

export const convertInputMediaContact = (media: Api.InputMediaContact): InputMediaContact => ({
  phoneNumber: media.phoneNumber,
  firstName: media.firstName,
  lastName: media.lastName,
  vcard: media.vcard,
});

export const convertInputMediaUploadedDocument = (
  media: Api.InputMediaUploadedDocument,
): InputMediaUploadedDocument => ({
  nosoundVideo: media.nosoundVideo,
  forceFile: media.forceFile,
  spoiler: media.spoiler,
  file: convertTypeInputFile(media.file)!,
  thumb: media.thumb ? convertTypeInputFile(media.thumb) : undefined,
  mimeType: media.mimeType,
  attributes: media.attributes as TypeDocumentAttribute[],
  stickers: media.stickers
    ?.map((sticker) => convertTypeInputDocument(sticker))
    .filter(Boolean) as TypeInputDocument[],
  videoCover: (media as any).videoCover ? convertTypeInputPhoto((media as any).videoCover) : undefined,
  ttlSeconds: media.ttlSeconds,
});

export const convertInputMediaDocument = (media: Api.InputMediaDocument): InputMediaDocument => ({
  spoiler: media.spoiler,
  id: convertTypeInputDocument(media.id)!,
  videoCover: (media as any).videoCover ? convertTypeInputPhoto((media as any).videoCover) : undefined,
  videoTimestamp: (media as any).videoTimestamp,
  ttlSeconds: media.ttlSeconds,
  query: media.query,
});

export const convertInputMediaVenue = (media: Api.InputMediaVenue): InputMediaVenue => ({
  geoPoint: convertTypeInputGeoPoint(media.geoPoint)!,
  title: media.title,
  address: media.address,
  provider: media.provider,
  venueId: media.venueId,
  venueType: media.venueType,
});

export const convertInputMediaPhotoExternal = (
  media: Api.InputMediaPhotoExternal,
): InputMediaPhotoExternal => ({
  spoiler: media.spoiler,
  url: media.url,
  ttlSeconds: media.ttlSeconds,
});

export const convertInputMediaDocumentExternal = (
  media: Api.InputMediaDocumentExternal,
): InputMediaDocumentExternal => ({
  spoiler: media.spoiler,
  url: media.url,
  ttlSeconds: media.ttlSeconds,
  videoCover: (media as any).videoCover ? convertTypeInputPhoto((media as any).videoCover) : undefined,
  videoTimestamp: (media as any).videoTimestamp,
});

export const convertInputMediaGame = (media: Api.InputMediaGame): InputMediaGame => ({
  id: convertTypeInputGame(media.id)!,
});

export const convertInputMediaInvoice = (media: Api.InputMediaInvoice): InputMediaInvoice => ({
  title: media.title,
  description: media.description,
  photo: media.photo ? convertTypeInputWebDocument(media.photo) : undefined,
  invoice: convertTypeInvoice(media.invoice),
  payload: media.payload,
  provider: media.provider,
  providerData: convertTypeDataJSON(media.providerData),
  startParam: media.startParam,
  extendedMedia: media.extendedMedia ? convertTypeInputMedia(media.extendedMedia) : undefined,
});

export const convertInputMediaGeoLive = (media: Api.InputMediaGeoLive): InputMediaGeoLive => ({
  stopped: media.stopped,
  geoPoint: convertTypeInputGeoPoint(media.geoPoint)!,
  heading: media.heading,
  period: media.period,
  proximityNotificationRadius: media.proximityNotificationRadius,
});

export const convertInputMediaPoll = (media: Api.InputMediaPoll): InputMediaPoll => ({
  poll: convertTypePoll(media.poll),
  correctAnswers: media.correctAnswers,
  solution: media.solution,
  solutionEntities: media.solutionEntities
    ?.map((entity) => convertTypeMessageEntity(entity))
    .filter(Boolean) as TypeMessageEntity[],
});

export const convertInputMediaDice = (media: Api.InputMediaDice): InputMediaDice => ({
  emoticon: media.emoticon,
});

export const convertInputMediaStory = (media: Api.InputMediaStory): InputMediaStory => ({
  peer: convertTypeInputPeerExcludeSelf(media.peer),
  id: media.id,
});

export const convertInputMediaWebPage = (media: Api.InputMediaWebPage): InputMediaWebPage => ({
  forceLargeMedia: media.forceLargeMedia,
  forceSmallMedia: media.forceSmallMedia,
  optional: media.optional,
  url: media.url,
});

export const convertInputMediaPaidMedia = (
  media: Api.InputMediaPaidMedia,
): InputMediaPaidMedia => ({
  starsAmount: media.starsAmount.toString(),
  extendedMedia: media.extendedMedia
    .map((item) => convertTypeInputMedia(item))
    .filter(Boolean) as TypeInputMedia[],
  payload: media.payload,
});

// InputFile converter functions
export const convertInputFile = (file: Api.InputFile): InputFile => ({
  id: file.id.toString(),
  parts: file.parts,
  name: file.name,
  md5Checksum: file.md5Checksum,
});

export const convertInputFileBig = (file: Api.InputFileBig): InputFileBig => ({
  id: file.id.toString(),
  parts: file.parts,
  name: file.name,
});

export const convertInputFileStoryDocument = (
  file: Api.InputFileStoryDocument,
): InputFileStoryDocument => ({
  id: convertTypeInputDocument(file.id)!,
});

// InputFileLocation converter functions
export const convertInputFileLocation = (location: Api.InputFileLocation): InputFileLocation => ({
  volumeId: location.volumeId.toString(),
  localId: location.localId,
  secret: location.secret.toString(),
  fileReference: location.fileReference,
});

export const convertInputEncryptedFileLocation = (
  location: Api.InputEncryptedFileLocation,
): InputEncryptedFileLocation => ({
  id: location.id.toString(),
  accessHash: location.accessHash.toString(),
});

export const convertInputDocumentFileLocation = (
  location: Api.InputDocumentFileLocation,
): InputDocumentFileLocation => ({
  id: location.id.toString(),
  accessHash: location.accessHash.toString(),
  fileReference: location.fileReference,
  thumbSize: location.thumbSize,
});

export const convertInputSecureFileLocation = (
  location: Api.InputSecureFileLocation,
): InputSecureFileLocation => ({
  id: location.id.toString(),
  accessHash: location.accessHash.toString(),
});

export const convertInputPhotoFileLocation = (
  location: Api.InputPhotoFileLocation,
): InputPhotoFileLocation => ({
  id: location.id.toString(),
  accessHash: location.accessHash.toString(),
  fileReference: location.fileReference,
  thumbSize: location.thumbSize,
});

export const convertInputPhotoLegacyFileLocation = (
  location: Api.InputPhotoLegacyFileLocation,
): InputPhotoLegacyFileLocation => ({
  id: location.id.toString(),
  accessHash: location.accessHash.toString(),
  fileReference: location.fileReference,
  volumeId: location.volumeId.toString(),
  localId: location.localId,
  secret: location.secret.toString(),
});

export const convertInputStickerSetThumb = (
  location: Api.InputStickerSetThumb,
): InputStickerSetThumb => ({
  stickerset: location.stickerset as unknown,
  thumbVersion: location.thumbVersion,
});

export const convertInputGroupCallStream = (
  location: Api.InputGroupCallStream,
): InputGroupCallStream => ({
  call: location.call as unknown,
  timeMs: location.timeMs.toString(),
  scale: location.scale,
  videoChannel: location.videoChannel,
  videoQuality: location.videoQuality,
});

// Helper converter functions for nested types
export const convertTypeInputPhoto = (photo?: Api.TypeInputPhoto): TypeInputPhoto | undefined => {
  if (!photo) {
    return undefined;
  }
  if (photo instanceof Api.InputPhoto) {
    return convertInputPhoto(photo);
  }
  return undefined;
};

export const convertTypeInputDocument = (
  document?: Api.TypeInputDocument,
): TypeInputDocument | undefined => {
  if (!document) {
    return undefined;
  }
  if (document instanceof Api.InputDocument) {
    return convertInputDocument(document);
  }
  return undefined;
};

export const convertTypeInputGeoPoint = (
  geoPoint?: Api.TypeInputGeoPoint,
): TypeInputGeoPoint | undefined => {
  if (!geoPoint) {
    return undefined;
  }
  if (geoPoint instanceof Api.InputGeoPoint) {
    return convertInputGeoPoint(geoPoint);
  }
  return undefined;
};

export const convertInputPhoto = (photo: Api.InputPhoto): InputPhoto => ({
  id: photo.id.toString(),
  accessHash: photo.accessHash.toString(),
  fileReference: photo.fileReference,
});

export const convertInputDocument = (document: Api.InputDocument): InputDocument => ({
  id: document.id.toString(),
  accessHash: document.accessHash.toString(),
  fileReference: document.fileReference,
});

export const convertInputGeoPoint = (geoPoint: Api.InputGeoPoint): InputGeoPoint => ({
  lat: geoPoint.lat,
  long: geoPoint.long,
  accuracyRadius: geoPoint.accuracyRadius,
});

export const convertTypeInputUser = (user?: Api.TypeInputUser): TypeInputUser | undefined => {
  if (!user) {
    return undefined;
  }
  if (user instanceof Api.InputUser) {
    return {
      userId: buildMarkedPeerIdByType(user.userId.toString(), 'user'),
      accessHash: user.accessHash.toString(),
    };
  }
  if (user instanceof Api.InputUserFromMessage) {
    return {
      peer: convertTypeInputPeerCommon(user.peer),
      msgId: user.msgId,
      userId: buildMarkedPeerIdByType(user.userId.toString(), 'user'),
    };
  }
  return undefined;
};

export const convertTypeTextWithEntities = (
  textWithEntities: Api.TypeTextWithEntities,
): TypeTextWithEntities => {
  if (textWithEntities instanceof Api.TextWithEntities) {
    return {
      text: textWithEntities.text,
      entities: textWithEntities.entities
        ?.map((entity) => convertTypeMessageEntity(entity))
        .filter(Boolean) as TypeMessageEntity[],
    };
  }
  return textWithEntities as unknown as TypeTextWithEntities;
};

export const convertTypePollAnswer = (pollAnswer: Api.TypePollAnswer): TypePollAnswer => {
  if (pollAnswer instanceof Api.PollAnswer) {
    return {
      text: convertTypeTextWithEntities(pollAnswer.text),
      option: pollAnswer.option,
    };
  }
  return pollAnswer as unknown as TypePollAnswer;
};

export const convertTypeInputGame = (game?: Api.TypeInputGame): TypeInputGame | undefined => {
  if (!game) {
    return undefined;
  }
  if (game instanceof Api.InputGameID) {
    return {
      id: game.id.toString(),
      accessHash: game.accessHash.toString(),
    };
  }
  if (game instanceof Api.InputGameShortName) {
    return {
      botId: convertTypeInputUser(game.botId)!,
      shortName: game.shortName,
    };
  }
  return undefined;
};

export const convertTypeInputWebDocument = (
  webDoc?: Api.TypeInputWebDocument,
): TypeInputWebDocument | undefined => {
  if (!webDoc) {
    return undefined;
  }
  if (webDoc instanceof Api.InputWebDocument) {
    return {
      url: webDoc.url,
      size: webDoc.size,
      mimeType: webDoc.mimeType,
      attributes: webDoc.attributes as TypeDocumentAttribute[],
    };
  }
  return undefined;
};

export const convertTypeInvoice = (invoice: Api.TypeInvoice): TypeInvoice => {
  if (invoice instanceof Api.Invoice) {
    return {
      test: invoice.test ?? false,
      nameRequested: invoice.nameRequested ?? false,
      phoneRequested: invoice.phoneRequested ?? false,
      emailRequested: invoice.emailRequested ?? false,
      shippingAddressRequested: invoice.shippingAddressRequested ?? false,
      flexible: invoice.flexible ?? false,
      phoneToProvider: invoice.phoneToProvider ?? false,
      emailToProvider: invoice.emailToProvider ?? false,
      recurring: invoice.recurring ?? false,
      currency: invoice.currency,
      prices: invoice.prices.map((price) => convertTypeLabeledPrice(price)),
      maxTipAmount: invoice.maxTipAmount?.toString(),
      suggestedTipAmounts: invoice.suggestedTipAmounts?.map((amount) => amount.toString()),
      termsUrl: invoice.termsUrl,
    };
  }
  return invoice as unknown as TypeInvoice;
};

export const convertTypeLabeledPrice = (labeledPrice: Api.TypeLabeledPrice): TypeLabeledPrice => {
  if (labeledPrice instanceof Api.LabeledPrice) {
    return {
      label: labeledPrice.label,
      amount: labeledPrice.amount.toString(),
    };
  }
  return labeledPrice as unknown as TypeLabeledPrice;
};

export const convertTypeDataJSON = (dataJSON: Api.TypeDataJSON): TypeDataJSON => {
  if (dataJSON instanceof Api.DataJSON) {
    return {
      data: dataJSON.data,
    };
  }
  return dataJSON as unknown as TypeDataJSON;
};

export const convertTypePoll = (poll: Api.TypePoll): TypePoll => {
  if (poll instanceof Api.Poll) {
    return {
      id: poll.id.toString(),
      closed: poll.closed ?? false,
      publicVoters: poll.publicVoters ?? false,
      multipleChoice: poll.multipleChoice ?? false,
      quiz: poll.quiz ?? false,
      question: convertTypeTextWithEntities(poll.question),
      answers: poll.answers?.map((answer) => convertTypePollAnswer(answer)) as TypePollAnswer[],
      closePeriod: poll.closePeriod,
      closeDate: poll.closeDate,
    };
  }
  return poll as unknown as TypePoll;
};

export const convertTypeMessageEntity = (
  entity: Api.TypeMessageEntity,
): TypeMessageEntity | undefined => {
  if (!entity) {
    return undefined;
  }

  // Common properties for most entities (className enables UI entity discrimination)
  const baseEntity = {
    offset: entity.offset,
    length: entity.length,
    className: entity.className,
  };

  if (entity instanceof Api.MessageEntityUnknown) {
    return baseEntity;
  }
  if (entity instanceof Api.MessageEntityMention) {
    return baseEntity;
  }
  if (entity instanceof Api.MessageEntityHashtag) {
    return baseEntity;
  }
  if (entity instanceof Api.MessageEntityBotCommand) {
    return baseEntity;
  }
  if (entity instanceof Api.MessageEntityUrl) {
    return baseEntity;
  }
  if (entity instanceof Api.MessageEntityEmail) {
    return baseEntity;
  }
  if (entity instanceof Api.MessageEntityBold) {
    return baseEntity;
  }
  if (entity instanceof Api.MessageEntityItalic) {
    return baseEntity;
  }
  if (entity instanceof Api.MessageEntityCode) {
    return baseEntity;
  }
  if (entity instanceof Api.MessageEntityPre) {
    return {
      ...baseEntity,
      language: entity.language,
    };
  }
  if (entity instanceof Api.MessageEntityTextUrl) {
    return {
      ...baseEntity,
      url: entity.url,
    };
  }
  if (entity instanceof Api.MessageEntityMentionName) {
    return {
      ...baseEntity,
      userId: buildMarkedPeerIdByType(entity.userId.toString(), 'user'),
    };
  }
  if (entity instanceof Api.InputMessageEntityMentionName) {
    return {
      ...baseEntity,
      userId: buildMarkedPeerIdByType(entity.userId.toString(), 'user'),
    };
  }
  if (entity instanceof Api.MessageEntityPhone) {
    return baseEntity;
  }
  if (entity instanceof Api.MessageEntityCashtag) {
    return baseEntity;
  }
  if (entity instanceof Api.MessageEntityUnderline) {
    return baseEntity;
  }
  if (entity instanceof Api.MessageEntityStrike) {
    return baseEntity;
  }
  if (entity instanceof Api.MessageEntityBankCard) {
    return baseEntity;
  }
  if (entity instanceof Api.MessageEntitySpoiler) {
    return baseEntity;
  }
  if (entity instanceof Api.MessageEntityCustomEmoji) {
    return {
      ...baseEntity,
      documentId: entity.documentId.toString(),
    };
  }
  if (entity instanceof Api.MessageEntityBlockquote) {
    return {
      ...baseEntity,
      collapsed: entity.collapsed ?? false,
    };
  }

  return entity as unknown as TypeMessageEntity;
};
