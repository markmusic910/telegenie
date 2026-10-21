import { toJS } from 'mobx';
import type {
  TypeChatAdminRights,
  TypeChatBannedRights,
  TypeChatPhoto,
  TypeEmojiStatus,
  TypePeerColor,
  TypeRestrictionReason,
  TypeUsername,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import type { ChannelEntity } from '../../types';
import { stringifyJson } from '../../utils/json';
import BaseEntityModel, { makeModelObservable } from './base.model';
import { buildPeerDisplay, type PeerDisplay } from '../../utils/peer-display';

/**
 * @see https://core.telegram.org/constructor/channel
 */
export class Channel extends BaseEntityModel<ChannelEntity> {
  creator?: boolean;
  left?: boolean;
  broadcast?: boolean;
  verified?: boolean;
  megagroup?: boolean;
  restricted?: boolean;
  signatures?: boolean;
  min?: boolean;
  scam?: boolean;
  hasLink?: boolean;
  hasGeo?: boolean;
  slowmodeEnabled?: boolean;
  callActive?: boolean;
  callNotEmpty?: boolean;
  fake?: boolean;
  gigagroup?: boolean;
  noforwards?: boolean;
  joinToSend?: boolean;
  joinRequest?: boolean;
  forum?: boolean;
  storiesHidden?: boolean;
  storiesHiddenMin?: boolean;
  storiesUnavailable?: boolean;
  signatureProfiles?: boolean;
  accessHash?: string;
  title: string;
  username?: string;
  photo?: TypeChatPhoto;
  date?: number;
  restrictionReason?: TypeRestrictionReason[];
  adminRights?: TypeChatAdminRights;
  bannedRights?: TypeChatBannedRights;
  defaultBannedRights?: TypeChatBannedRights;
  participantsCount?: number;
  usernames?: TypeUsername[];
  storiesMaxId?: number;
  color?: TypePeerColor;
  profileColor?: TypePeerColor;
  emojiStatus?: TypeEmojiStatus;
  level?: number;
  subscriptionUntilDate?: number;
  botVerificationIcon?: string;
  status: 'active' | 'forbidden';
  untilDate?: number;

  constructor(data: ChannelEntity) {
    super(data);
    this.creator = data.creator;
    this.left = data.left;
    this.broadcast = data.broadcast;
    this.verified = data.verified;
    this.megagroup = data.megagroup;
    this.restricted = data.restricted;
    this.signatures = data.signatures;
    this.min = data.min;
    this.scam = data.scam;
    this.hasLink = data.hasLink;
    this.hasGeo = data.hasGeo;
    this.slowmodeEnabled = data.slowmodeEnabled;
    this.callActive = data.callActive;
    this.callNotEmpty = data.callNotEmpty;
    this.fake = data.fake;
    this.gigagroup = data.gigagroup;
    this.noforwards = data.noforwards;
    this.joinToSend = data.joinToSend;
    this.joinRequest = data.joinRequest;
    this.forum = data.forum;
    this.storiesHidden = data.storiesHidden;
    this.storiesHiddenMin = data.storiesHiddenMin;
    this.storiesUnavailable = data.storiesUnavailable;
    this.signatureProfiles = data.signatureProfiles;
    this.accessHash = data.accessHash;
    this.title = data.title ?? '';
    this.username = data.username;
    this.photo = data.photo;
    this.date = data.date;
    this.restrictionReason = data.restrictionReason;
    this.adminRights = data.adminRights;
    this.bannedRights = data.bannedRights;
    this.defaultBannedRights = data.defaultBannedRights;
    this.participantsCount = data.participantsCount;
    this.usernames = data.usernames;
    this.storiesMaxId = data.storiesMaxId;
    this.color = data.color;
    this.profileColor = data.profileColor;
    this.emojiStatus = data.emojiStatus;
    this.level = data.level;
    this.subscriptionUntilDate = data.subscriptionUntilDate;
    this.botVerificationIcon = data.botVerificationIcon;
    this.status = data.status ?? 'active';
    this.untilDate = data.untilDate;
    makeModelObservable(this);
  }

  get display(): PeerDisplay {
    return buildPeerDisplay(this);
  }

  /** Serialize to a plain JSON string round-trippable via {@link Channel.fromJSON}. */
  toJSON(): string {
    return stringifyJson(toJS(this));
  }

  static fromJSON(json: string): Channel {
    return new Channel(JSON.parse(json) as ChannelEntity);
  }
}
