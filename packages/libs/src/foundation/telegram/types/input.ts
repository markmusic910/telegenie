/**
 * Input* Telegram constructors (peers, media, files, locations).
 * Canonical home — prefer this over redefining the same shapes in api-types.ts.
 */

import type {
  TypeDataJSON,
  TypeInputGame,
  TypeInputGroupCall,
  TypeInputWebDocument,
  TypeInvoice,
  TypeMessageEntity,
  TypePoll,
} from './api-types';
import type {
  TypeDocumentAttribute,
  TypeInputStickerSet,
  TypeVideoSize,
} from './file';

// --- Empty / marker variants ---

export type InputPeerEmpty = Record<string, never>;
export type InputUserEmpty = Record<string, never>;
export type InputUserSelf = Record<string, never>;
export type InputDocumentEmpty = Record<string, never>;
export type InputPhotoEmpty = Record<string, never>;
export type InputGeoPointEmpty = Record<string, never>;
export type InputChatPhotoEmpty = Record<string, never>;

export type InputPeerSelf = {
  self: true;
};

// --- Input users ---

export type InputUser = {
  userId: string;
  accessHash: string;
};

export type InputUserFromMessage = {
  peer: TypeInputPeer;
  msgId: number;
  userId: string;
};

export type TypeInputUser =
  | InputUserEmpty
  | InputUserSelf
  | InputUser
  | InputUserFromMessage;

// --- Input peers ---

export type InputPeerChat = {
  chatId: string;
};

export type InputPeerUser = {
  userId: string;
  accessHash: string;
};

export type InputPeerChannel = {
  channelId: string;
  accessHash: string;
};

export type InputPeerUserFromMessage = {
  peer: TypeInputPeer;
  msgId: number;
  userId: string;
};

export type InputPeerChannelFromMessage = {
  peer: TypeInputPeer;
  msgId: number;
  channelId: string;
};

export type TypeInputPeer =
  | InputPeerEmpty
  | InputPeerSelf
  | InputPeerChat
  | InputPeerUser
  | InputPeerChannel
  | InputPeerUserFromMessage
  | InputPeerChannelFromMessage;

// --- Contacts ---

export type InputPhoneContact = {
  clientId: string;
  phone: string;
  firstName: string;
  lastName: string;
};

export type TypeInputContact = InputPhoneContact;

// --- Files ---

export type InputFile = {
  id: string;
  parts: number;
  name: string;
  md5Checksum: string;
};

export type InputFileBig = {
  id: string;
  parts: number;
  name: string;
};

export type InputFileStoryDocument = {
  id: TypeInputDocument;
};

export type TypeInputFile = InputFile | InputFileBig | InputFileStoryDocument;

// --- Photos / documents / geo ---

export type InputPhoto = {
  id: string;
  accessHash: string;
  fileReference: Uint8Array;
};

export type TypeInputPhoto = InputPhotoEmpty | InputPhoto;

export type InputDocument = {
  id: string;
  accessHash: string;
  fileReference: Uint8Array;
};

export type TypeInputDocument = InputDocumentEmpty | InputDocument;

export type InputGeoPoint = {
  lat: number;
  long: number;
  accuracyRadius?: number;
};

export type TypeInputGeoPoint = InputGeoPointEmpty | InputGeoPoint;

// --- Chat photo ---

export type InputChatUploadedPhoto = {
  file?: TypeInputFile;
  video?: TypeInputFile;
  videoStartTs?: number;
  videoEmojiMarkup?: TypeVideoSize;
};

export type InputChatPhoto = {
  id: TypeInputPhoto;
};

export type TypeInputChatPhoto =
  | InputChatPhotoEmpty
  | InputChatUploadedPhoto
  | InputChatPhoto;

// --- Media ---

export type InputMediaUploadedPhoto = {
  spoiler?: boolean;
  file: TypeInputFile;
  stickers?: TypeInputDocument[];
  ttlSeconds?: number;
};

export type InputMediaPhoto = {
  spoiler?: boolean;
  id: TypeInputPhoto;
  ttlSeconds?: number;
};

export type InputMediaGeoPoint = {
  geoPoint: TypeInputGeoPoint;
};

export type InputMediaContact = {
  phoneNumber: string;
  firstName: string;
  lastName: string;
  vcard: string;
};

export type InputMediaUploadedDocument = {
  nosoundVideo?: boolean;
  forceFile?: boolean;
  spoiler?: boolean;
  file: TypeInputFile;
  thumb?: TypeInputFile;
  mimeType: string;
  attributes: TypeDocumentAttribute[];
  stickers?: TypeInputDocument[];
  videoCover?: TypeInputPhoto;
  videoTimestamp?: number;
  ttlSeconds?: number;
};

export type InputMediaDocument = {
  spoiler?: boolean;
  id: TypeInputDocument;
  videoCover?: TypeInputPhoto;
  videoTimestamp?: number;
  ttlSeconds?: number;
  query?: string;
};

export type InputMediaVenue = {
  geoPoint: TypeInputGeoPoint;
  title: string;
  address: string;
  provider: string;
  venueId: string;
  venueType: string;
};

export type InputMediaPhotoExternal = {
  spoiler?: boolean;
  url: string;
  ttlSeconds?: number;
};

export type InputMediaDocumentExternal = {
  spoiler?: boolean;
  url: string;
  ttlSeconds?: number;
  videoCover?: TypeInputPhoto;
  videoTimestamp?: number;
};

export type InputMediaGame = {
  id: TypeInputGame;
};

export type InputMediaInvoice = {
  title: string;
  description: string;
  photo?: TypeInputWebDocument;
  invoice: TypeInvoice;
  payload: Uint8Array;
  provider?: string;
  providerData: TypeDataJSON;
  startParam?: string;
  extendedMedia?: TypeInputMedia;
};

export type InputMediaGeoLive = {
  stopped?: boolean;
  geoPoint: TypeInputGeoPoint;
  heading?: number;
  period?: number;
  proximityNotificationRadius?: number;
};

export type InputMediaPoll = {
  poll: TypePoll;
  correctAnswers?: Uint8Array[];
  solution?: string;
  solutionEntities?: TypeMessageEntity[];
};

export type InputMediaDice = {
  emoticon: string;
};

export type InputMediaStory = {
  peer: TypeInputPeer;
  id: number;
};

export type InputMediaWebPage = {
  forceLargeMedia?: boolean;
  forceSmallMedia?: boolean;
  optional?: boolean;
  url: string;
};

export type InputMediaPaidMedia = {
  starsAmount: string;
  extendedMedia: TypeInputMedia[];
  payload?: string;
};

export type TypeInputMedia =
  | InputMediaUploadedPhoto
  | InputMediaPhoto
  | InputMediaGeoPoint
  | InputMediaContact
  | InputMediaUploadedDocument
  | InputMediaDocument
  | InputMediaVenue
  | InputMediaPhotoExternal
  | InputMediaDocumentExternal
  | InputMediaGame
  | InputMediaInvoice
  | InputMediaGeoLive
  | InputMediaPoll
  | InputMediaDice
  | InputMediaStory
  | InputMediaWebPage
  | InputMediaPaidMedia;

// --- File locations ---

export type InputFileLocation = {
  volumeId: string;
  localId: number;
  secret: string;
  fileReference: Uint8Array;
};

export type InputEncryptedFileLocation = {
  id: string;
  accessHash: string;
};

export type InputDocumentFileLocation = {
  id: string;
  accessHash: string;
  fileReference: Uint8Array;
  thumbSize: string;
};

export type InputSecureFileLocation = {
  id: string;
  accessHash: string;
};

export type InputTakeoutFileLocation = Record<string, never>;

export type InputPhotoFileLocation = {
  id: string;
  accessHash: string;
  fileReference: Uint8Array;
  thumbSize: string;
};

export type InputPhotoLegacyFileLocation = {
  id: string;
  accessHash: string;
  fileReference: Uint8Array;
  volumeId: string;
  localId: number;
  secret: string;
};

export type InputPeerPhotoFileLocation = {
  big?: boolean;
  peer: TypeInputPeer;
  photoId: string;
};

export type InputStickerSetThumb = {
  stickerset: TypeInputStickerSet;
  thumbVersion: number;
};

export type InputGroupCallStream = {
  call: TypeInputGroupCall;
  timeMs: string;
  scale: number;
  videoChannel?: number;
  videoQuality?: number;
};

export type TypeInputFileLocation =
  | InputFileLocation
  | InputEncryptedFileLocation
  | InputDocumentFileLocation
  | InputSecureFileLocation
  | InputTakeoutFileLocation
  | InputPhotoFileLocation
  | InputPhotoLegacyFileLocation
  | InputPeerPhotoFileLocation
  | InputStickerSetThumb
  | InputGroupCallStream;
