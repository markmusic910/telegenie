import type { FileSourceRecord } from '../local-db/types';

export type FileIdPhoto = { kind: 'fileIdPhoto'; id: string };
export type FileIdDocument = { kind: 'fileIdDocument'; id: string };
export type FileRefFileId = FileIdPhoto | FileIdDocument;

export type FileSourceMessage = {
  kind: 'fileSourceMessage';
  peer: string;
  id: number;
  quick_reply_shortcut_id?: number;
};

export type FileSourceStarsTransaction = {
  kind: 'fileSourceStarsTransaction';
  peer: string;
  id: string;
  refund?: boolean;
  ton?: boolean;
};

export type FileSourceScheduledMessage = {
  kind: 'fileSourceScheduledMessage';
  peer: string;
  id: number;
};

export type FileSourceStory = {
  kind: 'fileSourceStory';
  id: number;
  peer: string;
};

export type FileSourceWebPage = {
  kind: 'fileSourceWebPage';
  url: string;
};

export type FileSourceBotApp = {
  kind: 'fileSourceBotApp';
  id: string;
  access_hash: string;
};

export type FileSourceUserFull = { kind: 'fileSourceUserFull'; id: string };
export type FileSourceAdminLog = {
  kind: 'fileSourceAdminLog';
  channel: string;
  max_id: string;
};
export type FileSourceStoryAlbum = { kind: 'fileSourceStoryAlbum'; peer: string };
export type FileSourceBotPreviewMedia = { kind: 'fileSourceBotPreviewMedia'; bot: string };
export type FileSourceBotPreviewInfo = {
  kind: 'fileSourceBotPreviewInfo';
  bot: string;
  lang_code: string;
};
export type FileSourcePaidMedia = {
  kind: 'fileSourcePaidMedia';
  id: number;
  peer: string;
};
export type FileSourceSavedMusic = {
  kind: 'fileSourceSavedMusic';
  user_id: string;
  id: string;
  access_hash: string;
};
export type FileSourceChatFull = { kind: 'fileSourceChatFull'; chat_id: string };
export type FileSourceChannelFull = { kind: 'fileSourceChannelFull'; channel: string };
export type FileSourcePremiumPromo = { kind: 'fileSourcePremiumPromo' };
export type FileSourceAttachMenuBot = { kind: 'fileSourceAttachMenuBot'; bot: string };
export type FileSourceTheme = {
  kind: 'fileSourceTheme';
  id: string;
  access_hash: string;
};
export type FileSourceWallPaper = {
  kind: 'fileSourceWallPaper';
  id: string;
  access_hash: string;
};
export type FileSourceStickerSet = {
  kind: 'fileSourceStickerSet';
  stickerset: unknown;
};
export type FileSourceSavedGifs = { kind: 'fileSourceSavedGifs' };
export type FileSourceSavedRingtones = { kind: 'fileSourceSavedRingtones' };
export type FileSourceAvailableEffects = { kind: 'fileSourceAvailableEffects' };
export type FileSourceAvailableReactions = { kind: 'fileSourceAvailableReactions' };
export type FileSourceUserProfilePhoto = {
  kind: 'fileSourceUserProfilePhoto';
  user_id: string;
  max_id: string;
};
export type FileSourceDocumentByHash = {
  kind: 'fileSourceDocumentByHash';
  sha256: string;
  size: string;
  mime_type: string;
};

export type FileSource =
  | FileSourceMessage
  | FileSourceStarsTransaction
  | FileSourceScheduledMessage
  | FileSourceStory
  | FileSourceWebPage
  | FileSourceBotApp
  | FileSourceUserFull
  | FileSourceAdminLog
  | FileSourceStoryAlbum
  | FileSourceBotPreviewMedia
  | FileSourceBotPreviewInfo
  | FileSourcePaidMedia
  | FileSourceSavedMusic
  | FileSourceChatFull
  | FileSourceChannelFull
  | FileSourcePremiumPromo
  | FileSourceAttachMenuBot
  | FileSourceTheme
  | FileSourceWallPaper
  | FileSourceStickerSet
  | FileSourceSavedGifs
  | FileSourceSavedRingtones
  | FileSourceAvailableEffects
  | FileSourceAvailableReactions
  | FileSourceUserProfilePhoto
  | FileSourceDocumentByHash;

export type JsonMapNode = {
  _?: string;
  [key: string]: unknown;
};

export type PredicateNode = {
  _: 'predicate';
  predicate: string;
  is_constructor: boolean;
};

export type TraverseParamNode = {
  _: 'traverseParam';
  name: string;
  is_flag?: boolean;
  is_vector?: boolean;
  type: string;
};

export type SourceNode = {
  _: 'source';
  predicate: PredicateNode;
  stored_constructor: string;
  stored_params: JsonMapNode[];
  skipped_flags?: string[];
  needs_parent?: PredicateNode;
  needs_not_parents?: PredicateNode[];
};

export type IncomingMethodNode = {
  _: 'traverseMethodResult';
  name: string;
  push_sources: SourceNode[];
  is_needed_parent?: boolean;
};

export type IncomingCtorNode = {
  _: 'traverseIncomingConstructor';
  type: string;
  predicate: string;
  params: TraverseParamNode[];
  push_sources: SourceNode[];
  is_needed_parent?: boolean;
};

export type CommitNode = {
  _: 'traverseCommitSourceLocation';
  type: string;
  predicate: string;
  push_sources: SourceNode[];
  stored_constructor: string;
};

export type OutgoingMethodNode = {
  _: 'traverseMethodCall';
  name: string;
  params: TraverseParamNode[];
};

export type OutgoingCtorNode = {
  _: 'traverseOutgoingConstructor';
  type: string;
  predicate: string;
  params: TraverseParamNode[];
};

export type SwapNode = {
  _: 'traverseSwapLocation';
  type: string;
  predicate: string;
  stored_constructor: string;
};

export type RefreshActionNode = {
  _: 'refreshAction';
  stored_constructor: string;
  action: JsonMapNode;
};

export type FileReferenceMapJson = {
  _: 'fileReferenceMap';
  layer: number;
  db_schema?: string;
  traversers_incoming: Array<IncomingMethodNode | IncomingCtorNode | CommitNode | JsonMapNode>;
  traversers_outgoing: Array<OutgoingMethodNode | OutgoingCtorNode | SwapNode | JsonMapNode>;
  refresh_actions: RefreshActionNode[];
  skipped_incoming_sources?: JsonMapNode[];
};

export type IndexedFileRefMap = {
  layer: number;
  methodResults: Map<string, IncomingMethodNode>;
  incomingByPredicate: Map<string, IncomingCtorNode>;
  commitsByPredicate: Map<string, CommitNode>;
  outgoingMethods: Map<string, OutgoingMethodNode>;
  outgoingByPredicate: Map<string, OutgoingCtorNode>;
  swapsByPredicate: Map<string, SwapNode>;
  refreshByKind: Map<string, RefreshActionNode>;
};

export type MethodFrame = {
  __fileRefMethod: true;
  method: string;
  request: object;
  result: unknown;
  className: string;
};

export function isMethodFrame(value: unknown): value is MethodFrame {
  return Boolean(value && typeof value === 'object' && (value as MethodFrame).__fileRefMethod);
}

export function asFileSourceRecord(source: FileSourceRecord | FileSource): FileSourceRecord {
  return source as FileSourceRecord;
}
