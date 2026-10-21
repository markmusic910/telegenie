import { toJS } from 'mobx';
import type {
  TypeChatAdminRights,
  TypeChatBannedRights,
  TypeChatPhoto,
  TypeInputChannel,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import type { ChatEntity } from '../../types';
import { stringifyJson } from '../../utils/json';
import BaseEntityModel, { makeModelObservable } from './base.model';
import { buildPeerDisplay, type PeerDisplay } from '../../utils/peer-display';

/**
 * @see https://core.telegram.org/constructor/chat
 */
export class Chat extends BaseEntityModel<ChatEntity> {
  creator?: boolean;
  left?: boolean;
  deactivated?: boolean;
  callActive?: boolean;
  callNotEmpty?: boolean;
  noforwards?: boolean;
  title: string;
  photo?: TypeChatPhoto | null;
  participantsCount?: number;
  date?: number;
  version?: number;
  migratedTo?: TypeInputChannel;
  adminRights?: TypeChatAdminRights;
  defaultBannedRights?: TypeChatBannedRights;
  status: 'active' | 'forbidden' | 'empty';

  constructor(data: ChatEntity) {
    super(data);
    this.creator = data.creator;
    this.left = data.left;
    this.deactivated = data.deactivated;
    this.callActive = data.callActive;
    this.callNotEmpty = data.callNotEmpty;
    this.noforwards = data.noforwards;
    this.title = data.title ?? '';
    this.photo = data.photo;
    this.participantsCount = data.participantsCount;
    this.date = data.date;
    this.version = data.version;
    this.migratedTo = data.migratedTo;
    this.adminRights = data.adminRights;
    this.defaultBannedRights = data.defaultBannedRights;
    this.status = data.status ?? 'active';
    makeModelObservable(this);
  }

  get display(): PeerDisplay {
    return buildPeerDisplay(this);
  }

  /** Serialize to a plain JSON string round-trippable via {@link Chat.fromJSON}. */
  toJSON(): string {
    return stringifyJson(toJS(this));
  }

  static fromJSON(json: string): Chat {
    return new Chat(JSON.parse(json) as ChatEntity);
  }
}
