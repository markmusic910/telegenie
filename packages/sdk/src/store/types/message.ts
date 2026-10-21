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
import type { PeerType } from './common';

export type MessageKind = 'message' | 'service' | 'empty';

/**
 * Stored message covering message / messageService / messageEmpty.
 * peerId/fromId are Bot-API dialog ids derived from peers (raw TypePeer not stored).
 *
 * @see https://core.telegram.org/constructor/message
 * @see https://core.telegram.org/constructor/messageService
 * @see https://core.telegram.org/constructor/messageEmpty
 */
export type MessageEntity = {
  kind: MessageKind;
  id: string;
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
  /** Text body (message constructor); empty for service/empty */
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
  /** messageService only */
  action?: TypeMessageAction;
  /** True when this is a deleted/inaccessible MessageEmpty tombstone */
  isEmpty: boolean;
  /**
   * Set before the message is written to the store.
   * `true` — reply chip is safe to render; `false` — do not show a reply.
   */
  replyTargetVerified?: boolean;
  /** Optimistic upload & send state */
  sendingState?: 'pending' | 'failed';
  uploadProgress?: number;
  uploadId?: string;
  localBlobUrl?: string;
  localCoverBlobUrl?: string;
};
