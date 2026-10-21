import { toJS } from 'mobx';
import type {
  TypeEmojiStatus,
  TypePeerColor,
  TypeRestrictionReason,
  TypeUsername,
  TypeUserProfilePhoto,
  TypeUserStatus,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import type { UserEntity } from '../../types';
import { stringifyJson } from '../../utils/json';
import BaseEntityModel, { makeModelObservable } from './base.model';
import { buildPeerDisplay, type PeerDisplay } from '../../utils/peer-display';

/**
 * @see https://core.telegram.org/constructor/user
 */
export class User extends BaseEntityModel<UserEntity> {
  self?: boolean;
  contact?: boolean;
  mutualContact?: boolean;
  deleted?: boolean;
  bot?: boolean;
  botChatHistory?: boolean;
  botNochats?: boolean;
  verified?: boolean;
  restricted?: boolean;
  min?: boolean;
  botInlineGeo?: boolean;
  support?: boolean;
  scam?: boolean;
  applyMinPhoto?: boolean;
  fake?: boolean;
  botAttachMenu?: boolean;
  premium?: boolean;
  attachMenuEnabled?: boolean;
  botCanEdit?: boolean;
  closeFriend?: boolean;
  storiesHidden?: boolean;
  storiesUnavailable?: boolean;
  contactRequirePremium?: boolean;
  botBusiness?: boolean;
  botHasMainApp?: boolean;
  accessHash?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  phone?: string;
  photo?: TypeUserProfilePhoto;
  status?: TypeUserStatus;
  botInfoVersion?: number;
  restrictionReason?: TypeRestrictionReason[];
  botInlinePlaceholder?: string;
  langCode?: string;
  emojiStatus?: TypeEmojiStatus;
  usernames?: TypeUsername[];
  storiesMaxId?: number;
  color?: TypePeerColor;
  profileColor?: TypePeerColor;
  botActiveUsers?: number;
  botVerificationIcon?: string;

  constructor(data: UserEntity) {
    super(data);
    this.self = data.self;
    this.contact = data.contact;
    this.mutualContact = data.mutualContact;
    this.deleted = data.deleted;
    this.bot = data.bot;
    this.botChatHistory = data.botChatHistory;
    this.botNochats = data.botNochats;
    this.verified = data.verified;
    this.restricted = data.restricted;
    this.min = data.min;
    this.botInlineGeo = data.botInlineGeo;
    this.support = data.support;
    this.scam = data.scam;
    this.applyMinPhoto = data.applyMinPhoto;
    this.fake = data.fake;
    this.botAttachMenu = data.botAttachMenu;
    this.premium = data.premium;
    this.attachMenuEnabled = data.attachMenuEnabled;
    this.botCanEdit = data.botCanEdit;
    this.closeFriend = data.closeFriend;
    this.storiesHidden = data.storiesHidden;
    this.storiesUnavailable = data.storiesUnavailable;
    this.contactRequirePremium = data.contactRequirePremium;
    this.botBusiness = data.botBusiness;
    this.botHasMainApp = data.botHasMainApp;
    this.accessHash = data.accessHash;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.username = data.username;
    this.phone = data.phone;
    this.photo = data.photo;
    this.status = data.status;
    this.botInfoVersion = data.botInfoVersion;
    this.restrictionReason = data.restrictionReason;
    this.botInlinePlaceholder = data.botInlinePlaceholder;
    this.langCode = data.langCode;
    this.emojiStatus = data.emojiStatus;
    this.usernames = data.usernames;
    this.storiesMaxId = data.storiesMaxId;
    this.color = data.color;
    this.profileColor = data.profileColor;
    this.botActiveUsers = data.botActiveUsers;
    this.botVerificationIcon = data.botVerificationIcon;
    makeModelObservable(this);
  }

  get display(): PeerDisplay {
    return buildPeerDisplay(this);
  }

  /** Serialize to a plain JSON string round-trippable via {@link User.fromJSON}. */
  toJSON(): string {
    return stringifyJson(toJS(this));
  }

  static fromJSON(json: string): User {
    return new User(JSON.parse(json) as UserEntity);
  }
}
