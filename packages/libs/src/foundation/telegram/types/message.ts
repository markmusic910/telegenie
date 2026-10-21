import type { Api } from '@telegenie/teleproto';
import type { GeoPoint } from './index';
import type {
  Channel,
  Chat,
  TypeFactCheck,
  TypeMessageAction,
  TypeMessageFwdHeader,
  TypeMessageMedia,
  TypeMessagePeerReaction,
  TypeMessageReactions,
  TypeMessageReplies,
  TypeMessageReplyHeader,
  TypePeer,
  TypePoll,
  TypePollResults,
  TypeReplyMarkup,
  TypeRestrictionReason,
  TypeStoryItem,
} from './api-types';
import type { User } from './users';
import type { Document, Photo, PhotoSize, VideoSize } from './file';
import type { TypeInputUser } from './input';
import type { PageBlock, TypeWebDocument } from './web';

// Base message entity types with common properties
export type MessageEntityBase = {
  offset: number;
  length: number;
};

// Specific message entity types
export type MessageEntityUnknown = MessageEntityBase;

export type MessageEntityMention = MessageEntityBase;

export type MessageEntityHashtag = MessageEntityBase;

export type MessageEntityBotCommand = MessageEntityBase;

export type MessageEntityUrl = MessageEntityBase;

export type MessageEntityEmail = MessageEntityBase;

export type MessageEntityBold = MessageEntityBase;

export type MessageEntityItalic = MessageEntityBase;

export type MessageEntityCode = MessageEntityBase;

export type MessageEntityPre = MessageEntityBase & {
  language: string;
};

export type MessageEntityTextUrl = MessageEntityBase & {
  url: string;
};

export type MessageEntityMentionName = MessageEntityBase & {
  userId: string; // long -> string
};

export type InputMessageEntityMentionName = MessageEntityBase & {
  userId: TypeInputUser;
};

export type MessageEntityPhone = MessageEntityBase;

export type MessageEntityCashtag = MessageEntityBase;

export type MessageEntityUnderline = MessageEntityBase;

export type MessageEntityStrike = MessageEntityBase;

export type MessageEntityBankCard = MessageEntityBase;

export type MessageEntitySpoiler = MessageEntityBase;

export type MessageEntityCustomEmoji = MessageEntityBase & {
  documentId: string; // long -> string
};

export type MessageEntityBlockquote = MessageEntityBase & {
  collapsed?: boolean;
};

// Union type for all message entities
export type MessageEntity =
  | MessageEntityUnknown
  | MessageEntityMention
  | MessageEntityHashtag
  | MessageEntityBotCommand
  | MessageEntityUrl
  | MessageEntityEmail
  | MessageEntityBold
  | MessageEntityItalic
  | MessageEntityCode
  | MessageEntityPre
  | MessageEntityTextUrl
  | MessageEntityMentionName
  | InputMessageEntityMentionName
  | MessageEntityPhone
  | MessageEntityCashtag
  | MessageEntityUnderline
  | MessageEntityStrike
  | MessageEntityBankCard
  | MessageEntitySpoiler
  | MessageEntityCustomEmoji
  | MessageEntityBlockquote;

// Message Media Types
export type MessageMediaPhoto = {
  spoiler?: boolean;
  photo?: Photo;
  ttlSeconds?: number; // int -> number
};

export type MessageMediaGeo = {
  geo: GeoPoint;
};

export type MessageMediaContact = {
  phoneNumber: string;
  firstName: string;
  lastName: string;
  vcard: string;
  userId: string; // long -> string
};

export type MessageMediaDocument = {
  nopremium?: boolean;
  spoiler?: boolean;
  video?: boolean;
  round?: boolean;
  voice?: boolean;
  document?: Document;
  altDocuments?: Document[];
  videoCover?: Photo;
  videoTimestamp?: number; // int -> number
  ttlSeconds?: number; // int -> number
};

export type MessageMediaWebPage = {
  forceLargeMedia?: boolean;
  forceSmallMedia?: boolean;
  manual?: boolean;
  safe?: boolean;
  webpage: WebPage;
};

export type WebPage = {
  hasLargeMedia?: boolean;
  id: string;
  url: string;
  displayUrl: string;
  hash: number;
  type?: string;
  siteName?: string;
  title?: string;
  description?: string;
  photo?: Photo;
  embedUrl?: string;
  embedType?: string;
  embedWidth?: number;
  embedHeight?: number;
  duration?: number;
  author?: string;
  document?: Document;
  cachedPage?: Page;
  attributes?: Api.TypeWebPageAttribute[];
};

export type Page = {
  part?: boolean;
  rtl?: boolean;
  v2?: boolean;
  url: string;
  blocks: PageBlock[];
  photos: Photo[];
  documents: Document[];
  views?: number;
};

export type MessageMediaVenue = {
  geo: GeoPoint;
  title: string;
  address: string;
  provider: string;
  venueId: string;
  venueType: string;
};

export type MessageMediaGame = {
  game: Game;
};

export type Game = {
  id: string;
  accessHash: string;
  shortName: string;
  title: string;
  description: string;
  photo: Photo;
  document?: Document;
};

export type MessageMediaInvoice = {
  shippingAddressRequested?: boolean;
  test?: boolean;
  title: string;
  description: string;
  photo?: TypeWebDocument;
  receiptMsgId?: number; // int -> number
  currency: string;
  totalAmount: string; // long -> string
  startParam: string;
  extendedMedia?: TypeMessageExtendedMedia;
};

// Message Extended Media Types
export type MessageExtendedMediaPreview = {
  w?: number; // int -> number
  h?: number; // int -> number
  thumb?: PhotoSize;
  videoDuration?: number; // int -> number
};

export type MessageExtendedMedia = {
  media: MessageMedia;
};

// Union type for all message extended media
export type TypeMessageExtendedMedia = MessageExtendedMediaPreview | MessageExtendedMedia;

export type MessageMediaGeoLive = {
  geo: GeoPoint;
  heading?: number; // int -> number
  period: number; // int -> number
  proximityNotificationRadius?: number; // int -> number
};

export type MessageMediaPoll = {
  poll: TypePoll; // Api.TypePoll
  results: TypePollResults; // Api.TypePollResults
};

export type MessageMediaDice = {
  value: number; // int -> number
  emoticon: string;
};

export type MessageMediaStory = {
  viaMention?: boolean;
  peer: TypePeer; // Api.TypePeer
  id: number; // int -> number
  story?: TypeStoryItem; // Api.TypeStoryItem
};

export type MessageMediaGiveaway = {
  onlyNewSubscribers?: boolean;
  winnersAreVisible?: boolean;
  channels: string[]; // long[] -> string[]
  countriesIso2?: string[];
  prizeDescription?: string;
  quantity: number; // int -> number
  months?: number; // int -> number
  stars?: string; // long -> string
  untilDate: number; // int -> number
};

export type MessageMediaGiveawayResults = {
  onlyNewSubscribers?: boolean;
  refunded?: boolean;
  channelId: string; // long -> string
  additionalPeersCount?: number; // int -> number
  launchMsgId: number; // int -> number
  winnersCount: number; // int -> number
  unclaimedCount: number; // int -> number
  winners: string[]; // long[] -> string[]
  months?: number; // int -> number
  stars?: string; // long -> string
  prizeDescription?: string;
  untilDate: number; // int -> number
};

export type MessageMediaPaidMedia = {
  starsAmount: string; // long -> string
  extendedMedia: TypeMessageExtendedMedia[]; // Api.TypeMessageExtendedMedia[]
};

// Union type for all message media (excluding void classes)
export type MessageMedia =
  | MessageMediaPhoto
  | MessageMediaGeo
  | MessageMediaContact
  | MessageMediaDocument
  | MessageMediaWebPage
  | MessageMediaVenue
  | MessageMediaGame
  | MessageMediaInvoice
  | MessageMediaGeoLive
  | MessageMediaPoll
  | MessageMediaDice
  | MessageMediaStory
  | MessageMediaGiveaway
  | MessageMediaGiveawayResults
  | MessageMediaPaidMedia;

export type Message = {
  // flags: number; // flags field for bit flags
  // flags2: number; // flags2 field for additional bit flags

  // Flag-based optional fields
  out?: boolean; // flags.1?true
  mentioned?: boolean; // flags.4?true
  media_unread?: boolean; // flags.5?true
  silent?: boolean; // flags.13?true
  post?: boolean; // flags.14?true
  from_scheduled?: boolean; // flags.18?true
  legacy?: boolean; // flags.19?true
  edit_hide?: boolean; // flags.21?true
  pinned?: boolean; // flags.24?true
  noforwards?: boolean; // flags.26?true
  invert_media?: boolean;

  // Required fields
  id: number; // int
  date: number; // int
  message: string; // string
  peer_id: TypePeer; // Peer

  // Optional fields based on flags
  from_id?: TypePeer; // flags.8?Peer
  fwd_from?: TypeMessageFwdHeader; // flags.2?MessageFwdHeader
  via_bot_id?: string; // flags.11?long
  reply_to?: TypeMessageReplyHeader; // flags.3?MessageReplyHeader
  media?: TypeMessageMedia; // flags.9?MessageMedia
  reply_markup?: TypeReplyMarkup; // flags.6?ReplyMarkup
  entities?: MessageEntity[]; // flags.7?Vector<MessageEntity>
  views?: number; // flags.10?int
  forwards?: number; // flags.10?int
  replies?: TypeMessageReplies; // flags.23?MessageReplies
  edit_date?: number; // flags.15?int
  post_author?: string; // flags.16?string
  grouped_id?: string; // flags.17?long
  reactions?: TypeMessageReactions; // flags.20?MessageReactions
  restriction_reason?: TypeRestrictionReason[]; // flags.22?Vector<RestrictionReason>
  ttl_period?: number; // flags.25?int
  /** flags2.3?true — service messages that can still take a reaction */
  reactionsArePossible?: true;
};

export type MessageService = {
  // flags: number; // flags field for bit flags

  // Flag-based optional fields
  out?: boolean; // flags.1?true
  mentioned?: boolean; // flags.4?true
  media_unread?: boolean; // flags.5?true
  silent?: boolean; // flags.13?true
  post?: boolean; // flags.14?true
  legacy?: boolean; // flags.19?true

  // Required fields
  id: number; // int
  from_id?: TypePeer; // flags.8?Peer
  peer_id: TypePeer; // Peer
  reply_to?: TypeMessageReplyHeader; // flags.3?MessageReplyHeader
  date: number; // int
  action: TypeMessageAction; // MessageAction

  // Optional fields based on flags
  ttl_period?: number; // flags.25?int
  /** flags.9?true — service messages that can still take a reaction */
  reactionsArePossible?: true;
};

/** Converted `messages.MessageReactionsList` (worker / SDK reaction list API). */
export type MessageReactionsList = {
  count: number;
  reactions: TypeMessagePeerReaction[];
  chats: Array<Chat | Channel>;
  users: User[];
  nextOffset?: string;
};
