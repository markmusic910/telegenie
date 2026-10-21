import { toJS } from 'mobx';
import type {
  TypeDraftMessage,
  TypeFolder,
  TypePeerNotifySettings,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import type { DialogEntity } from '../../types';
import { stringifyJson } from '../../utils/json';
import BaseEntityModel, { makeModelObservable } from './base.model';
import { dialogPeerKindFromId, type DialogPeerKind } from '../../utils/peer-display';

/**
 * @see https://core.telegram.org/constructor/dialog
 * @see https://core.telegram.org/constructor/dialogFolder
 */
export class Dialog extends BaseEntityModel<DialogEntity> {
  peerId: string;
  pinned?: boolean;
  unreadMark?: boolean;
  viewForumAsMessages?: boolean;
  topMessageId: string;
  readInboxMaxId?: number;
  readOutboxMaxId?: number;
  unreadCount: number;
  unreadMentionsCount?: number;
  unreadReactionsCount?: number;
  notifySettings?: TypePeerNotifySettings;
  pts?: number;
  draft?: TypeDraftMessage;
  folderId?: number;
  ttlPeriod?: number;
  isFolder: boolean;
  folder?: TypeFolder;
  folderTitle?: string;
  unreadMutedPeersCount?: number;
  unreadUnmutedPeersCount?: number;
  unreadMutedMessagesCount?: number;
  unreadUnmutedMessagesCount?: number;

  constructor(data: DialogEntity) {
    super(data);
    this.peerId = data.peerId ?? '';
    this.pinned = data.pinned;
    this.unreadMark = data.unreadMark;
    this.viewForumAsMessages = data.viewForumAsMessages;
    this.topMessageId = data.topMessageId ?? '';
    this.readInboxMaxId = data.readInboxMaxId;
    this.readOutboxMaxId = data.readOutboxMaxId;
    this.unreadCount = data.unreadCount ?? 0;
    this.unreadMentionsCount = data.unreadMentionsCount;
    this.unreadReactionsCount = data.unreadReactionsCount;
    this.notifySettings = data.notifySettings;
    this.pts = data.pts;
    this.draft = data.draft;
    this.folderId = data.folderId;
    this.ttlPeriod = data.ttlPeriod;
    this.isFolder = data.isFolder ?? false;
    this.folder = data.folder;
    this.folderTitle = data.folderTitle;
    this.unreadMutedPeersCount = data.unreadMutedPeersCount;
    this.unreadUnmutedPeersCount = data.unreadUnmutedPeersCount;
    this.unreadMutedMessagesCount = data.unreadMutedMessagesCount;
    this.unreadUnmutedMessagesCount = data.unreadUnmutedMessagesCount;
    makeModelObservable(this);
  }

  /** True when muteUntil is a unix timestamp still in the future (including “forever”). */
  get isMuted(): boolean {
    const muteUntil = this.notifySettings?.muteUntil;
    if (!muteUntil) return false;
    return muteUntil > Math.floor(Date.now() / 1000);
  }

  get draftText(): string | undefined {
    const draft = this.draft;
    if (!draft || !('message' in draft)) return undefined;
    const text = draft.message?.trim();
    return text || undefined;
  }

  get draftDate(): number | undefined {
    const date = this.draft?.date;
    return typeof date === 'number' && date > 0 ? date : undefined;
  }

  get peerKind(): DialogPeerKind {
    return dialogPeerKindFromId(this.peerId);
  }

  get isPrivate(): boolean {
    return this.peerKind === 'user';
  }

  static peerKindFromId(peerId: string): DialogPeerKind {
    return dialogPeerKindFromId(peerId);
  }

  /** Serialize to a plain JSON string round-trippable via {@link Dialog.fromJSON}. */
  toJSON(): string {
    return stringifyJson(toJS(this));
  }

  static fromJSON(json: string): Dialog {
    return new Dialog(JSON.parse(json) as DialogEntity);
  }
}
