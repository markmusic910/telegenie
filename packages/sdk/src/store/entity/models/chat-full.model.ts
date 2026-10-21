import { toJS } from 'mobx';
import type {
  TypeBotInfo,
  TypeChatParticipants,
  TypeChatReactions,
  TypeExportedChatInvite,
  TypeInputGroupCall,
  TypePeer,
  TypePeerNotifySettings,
  TypePhoto,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import type { ChatFullEntity } from '../../types';
import { stringifyJson } from '../../utils/json';
import BaseEntityModel, { makeModelObservable } from './base.model';

/**
 * @see https://core.telegram.org/constructor/chatFull
 */
export class ChatFull extends BaseEntityModel<ChatFullEntity> {
  canSetUsername?: boolean;
  hasScheduled?: boolean;
  translationsDisabled?: boolean;
  about: string;
  participants!: TypeChatParticipants;
  chatPhoto?: TypePhoto;
  notifySettings!: TypePeerNotifySettings;
  exportedInvite?: TypeExportedChatInvite;
  botInfo?: TypeBotInfo[];
  pinnedMsgId?: number;
  folderId?: number;
  call?: TypeInputGroupCall;
  ttlPeriod?: number;
  groupcallDefaultJoinAs?: TypePeer;
  themeEmoticon?: string;
  requestsPending?: number;
  recentRequesters?: string[];
  availableReactions?: TypeChatReactions;
  reactionsLimit?: number;

  constructor(data: ChatFullEntity) {
    super(data);
    this.canSetUsername = data.canSetUsername;
    this.hasScheduled = data.hasScheduled;
    this.translationsDisabled = data.translationsDisabled;
    this.about = data.about ?? '';
    this.participants = data.participants;
    this.chatPhoto = data.chatPhoto;
    this.notifySettings = data.notifySettings;
    this.exportedInvite = data.exportedInvite;
    this.botInfo = data.botInfo;
    this.pinnedMsgId = data.pinnedMsgId;
    this.folderId = data.folderId;
    this.call = data.call;
    this.ttlPeriod = data.ttlPeriod;
    this.groupcallDefaultJoinAs = data.groupcallDefaultJoinAs;
    this.themeEmoticon = data.themeEmoticon;
    this.requestsPending = data.requestsPending;
    this.recentRequesters = data.recentRequesters;
    this.availableReactions = data.availableReactions;
    this.reactionsLimit = data.reactionsLimit;
    makeModelObservable(this);
  }

  /** Serialize to a plain JSON string round-trippable via {@link ChatFull.fromJSON}. */
  toJSON(): string {
    return stringifyJson(toJS(this));
  }

  static fromJSON(json: string): ChatFull {
    return new ChatFull(JSON.parse(json) as ChatFullEntity);
  }
}
