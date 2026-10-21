export enum ApiMediaFormat {
  BlobUrl,
  Progressive,
  DownloadUrl,
  Text,
}

export type ApiParsedMedia = string | Blob | ArrayBuffer;

export type ApiChatType =
  | 'chatTypePrivate'
  | 'chatTypeSecret'
  | 'chatTypeBasicGroup'
  | 'chatTypeSuperGroup'
  | 'chatTypeChannel';

export interface ApiChat {
  id: string;
  type: ApiChatType;
  title: string;
}

export interface ApiUser {
  id: string;
}

export type ApiPeer = ApiChat | ApiUser;

export interface ApiChatAdminRights {
  changeInfo?: true;
  postMessages?: true;
  editMessages?: true;
  deleteMessages?: true;
  banUsers?: true;
  inviteUsers?: true;
  pinMessages?: true;
  addAdmins?: true;
  anonymous?: true;
  manageCall?: true;
  manageTopics?: true;
  postStories?: true;
  editStories?: true;
  deleteStories?: true;
  manageDirectMessages?: true;
  manageRanks?: true;
}

export interface ApiChatBannedRights {
  viewMessages?: true;
  sendMessages?: true;
  sendMedia?: true;
  sendStickers?: true;
  sendGifs?: true;
  sendGames?: true;
  sendInline?: true;
  embedLinks?: true;
  sendPolls?: true;
  changeInfo?: true;
  inviteUsers?: true;
  pinMessages?: true;
  manageTopics?: true;
  sendPhotos?: true;
  sendVideos?: true;
  sendRoundvideos?: true;
  sendAudios?: true;
  sendVoices?: true;
  sendDocs?: true;
  sendPlain?: true;
  editRank?: true;
  untilDate?: number;
}

export type ApiReactionEmoji = {
  type: 'emoji';
  emoticon: string;
};

export type ApiReactionCustomEmoji = {
  type: 'custom';
  documentId: string;
};

export type ApiReactionPaid = {
  type: 'paid';
};

export type ApiReaction = ApiReactionEmoji | ApiReactionCustomEmoji;
export type ApiReactionWithPaid = ApiReaction | ApiReactionPaid;

type ApiChatReactionsAll = {
  type: 'all';
  areCustomAllowed?: true;
};

type ApiChatReactionsSome = {
  type: 'some';
  allowed: ApiReaction[];
};

export type ApiChatReactions = ApiChatReactionsAll | ApiChatReactionsSome;

export type ApiReportReason =
  | 'spam'
  | 'violence'
  | 'pornography'
  | 'childAbuse'
  | 'copyright'
  | 'geoIrrelevant'
  | 'fake'
  | 'illegalDrugs'
  | 'personalDetails'
  | 'other';

export type ApiSendMessageAction = {
  type: 'cancel' | 'typing' | 'recordAudio' | 'chooseSticker' | 'playingGame';
};

export type ApiThemeParameters = {
  bg_color: string;
  text_color: string;
  hint_color: string;
  link_color: string;
  button_color: string;
  button_text_color: string;
  secondary_bg_color: string;
  header_bg_color: string;
  accent_text_color: string;
  section_bg_color: string;
  section_header_text_color: string;
  subtitle_text_color: string;
  destructive_text_color: string;
  section_separator_color: string;
};

export type ApiBotApp = {
  id: string;
  accessHash: string;
  title: string;
  shortName: string;
  description: string;
};

export { Api, TelegramClient } from '@telegenie/teleproto';
export { getPeerId } from '../helpers/peer-id.helper';

export type GeoPoint = {
  long: number;
  lat: number;
  accessHash: string;
  accuracyRadius?: number;
};
