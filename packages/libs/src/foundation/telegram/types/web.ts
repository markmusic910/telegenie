import type { GeoPoint } from './index';
import type { DocumentAttribute } from './file';

// Rich Text Types
export type TextPlain = {
  text: string;
};

export type TextBold = {
  text: TypeRichText;
};

export type TextItalic = {
  text: TypeRichText;
};

export type TextUnderline = {
  text: TypeRichText;
};

export type TextStrike = {
  text: TypeRichText;
};

export type TextFixed = {
  text: TypeRichText;
};

export type TextUrl = {
  text: TypeRichText;
  url: string;
  webpageId: string; // long -> string
};

export type TextEmail = {
  text: TypeRichText;
  email: string;
};

export type TextConcat = {
  texts: TypeRichText[];
};

export type TextSubscript = {
  text: TypeRichText;
};

export type TextSuperscript = {
  text: TypeRichText;
};

export type TextMarked = {
  text: TypeRichText;
};

export type TextPhone = {
  text: TypeRichText;
  phone: string;
};

export type TextImage = {
  documentId: string; // long -> string
  w: number; // int -> number
  h: number; // int -> number
};

export type TextAnchor = {
  text: TypeRichText;
  name: string;
};

// Union type for all rich text (excluding void classes)
export type TypeRichText =
  | TextPlain
  | TextBold
  | TextItalic
  | TextUnderline
  | TextStrike
  | TextFixed
  | TextUrl
  | TextEmail
  | TextConcat
  | TextSubscript
  | TextSuperscript
  | TextMarked
  | TextPhone
  | TextImage
  | TextAnchor;

// Page List Item Types
export type PageListItemText = {
  text: TypeRichText;
};

export type PageListItemBlocks = {
  blocks: PageBlock[];
};

// Union type for all page list items
export type TypePageListItem = PageListItemText | PageListItemBlocks;

// Page List Ordered Item Types
export type PageListOrderedItemText = {
  num: string;
  text: TypeRichText;
};

export type PageListOrderedItemBlocks = {
  num: string;
  blocks: PageBlock[];
};

// Union type for all page list ordered items
export type TypePageListOrderedItem = PageListOrderedItemText | PageListOrderedItemBlocks;

// Page Caption Types
export type PageCaption = {
  text: TypeRichText;
  credit: TypeRichText;
};

// Union type for page caption
export type TypePageCaption = PageCaption;

// Page Related Article Types
export type PageRelatedArticle = {
  url: string;
  webpageId: string; // long -> string
  title?: string;
  description?: string;
  photoId?: string; // long -> string
  author?: string;
  publishedDate?: number; // int -> number
};

// Union type for page related article
export type TypePageRelatedArticle = PageRelatedArticle;

// Web Document Types
export type WebDocument = {
  url: string;
  accessHash: string; // long -> string
  size: number; // int -> number
  mimeType: string;
  attributes: DocumentAttribute[];
};

export type WebDocumentNoProxy = {
  url: string;
  size: number; // int -> number
  mimeType: string;
  attributes: DocumentAttribute[];
};

// Union type for all web documents
export type TypeWebDocument = WebDocument | WebDocumentNoProxy;

// Page Block Types
export type PageBlockTitle = {
  text: TypeRichText;
};

export type PageBlockSubtitle = {
  text: TypeRichText;
};

export type PageBlockAuthorDate = {
  author: TypeRichText;
  publishedDate: number;
};

export type PageBlockHeader = {
  text: TypeRichText;
};

export type PageBlockSubheader = {
  text: TypeRichText;
};

export type PageBlockParagraph = {
  text: TypeRichText;
};

export type PageBlockPreformatted = {
  text: TypeRichText;
  language: string;
};

export type PageBlockFooter = {
  text: TypeRichText;
};

export type PageBlockAnchor = {
  name: string;
};

export type PageBlockList = {
  items: TypePageListItem[];
};

export type PageBlockBlockquote = {
  text: TypeRichText;
  caption: TypeRichText;
};

export type PageBlockPullquote = {
  text: TypeRichText;
  caption: TypeRichText;
};

export type PageBlockPhoto = {
  photoId: string; // long -> string
  caption: TypePageCaption;
  url?: string;
  webpageId?: string; // long -> string
};

export type PageBlockVideo = {
  autoplay?: boolean;
  loop?: boolean;
  videoId: string; // long -> string
  caption: TypePageCaption;
};

export type PageBlockCover = {
  cover: PageBlock;
};

export type PageBlockEmbed = {
  fullWidth?: boolean;
  allowScrolling?: boolean;
  url?: string;
  html?: string;
  posterPhotoId?: string; // long -> string
  w?: number; // int -> number
  h?: number; // int -> number
  caption: TypePageCaption;
};

export type PageBlockEmbedPost = {
  url: string;
  webpageId: string; // long -> string
  authorPhotoId: string; // long -> string
  author: string;
  date: number; // int -> number
  blocks: PageBlock[];
  caption: TypePageCaption;
};

export type PageBlockCollage = {
  items: PageBlock[];
  caption: TypePageCaption;
};

export type PageBlockSlideshow = {
  items: PageBlock[];
  caption: TypePageCaption;
};

export type PageBlockChannel = {
  channel: unknown; // Api.TypeChat -> unknown
};

export type PageBlockAudio = {
  audioId: string; // long -> string
  caption: TypePageCaption;
};

export type PageBlockKicker = {
  text: TypeRichText;
};

export type PageBlockTable = {
  bordered?: boolean;
  striped?: boolean;
  title: TypeRichText;
  rows: TypePageTableRow[];
};

export type PageBlockOrderedList = {
  items: TypePageListOrderedItem[];
};

export type PageBlockDetails = {
  open?: boolean;
  blocks: PageBlock[];
  title: TypeRichText;
};

export type PageBlockRelatedArticles = {
  title: TypeRichText;
  articles: TypePageRelatedArticle[];
};

export type PageBlockMap = {
  geo: GeoPoint;
  zoom: number; // int -> number
  w: number; // int -> number
  h: number; // int -> number
  caption: TypePageCaption;
};

// Union type for all page blocks (excluding void classes)
export type PageBlock =
  | PageBlockTitle
  | PageBlockSubtitle
  | PageBlockAuthorDate
  | PageBlockHeader
  | PageBlockSubheader
  | PageBlockParagraph
  | PageBlockPreformatted
  | PageBlockFooter
  | PageBlockAnchor
  | PageBlockList
  | PageBlockBlockquote
  | PageBlockPullquote
  | PageBlockPhoto
  | PageBlockVideo
  | PageBlockCover
  | PageBlockEmbed
  | PageBlockEmbedPost
  | PageBlockCollage
  | PageBlockSlideshow
  | PageBlockChannel
  | PageBlockAudio
  | PageBlockKicker
  | PageBlockTable
  | PageBlockOrderedList
  | PageBlockDetails
  | PageBlockRelatedArticles
  | PageBlockMap;

export type TypePageTableRow = {
  header?: boolean;
  alignCenter?: boolean;
  alignRight?: boolean;
  valignMiddle?: boolean;
  valignBottom?: boolean;
  text?: TypeRichText;
  colspan?: number;
  rowspan?: number;
};
