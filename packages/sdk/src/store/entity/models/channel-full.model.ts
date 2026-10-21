import { toJS } from 'mobx';
import type {
  TypeBotInfo,
  TypeBotVerification,
  TypeChannelLocation,
  TypeChatReactions,
  TypeExportedChatInvite,
  TypeInputGroupCall,
  TypePeer,
  TypePeerNotifySettings,
  TypePeerStories,
  TypePhoto,
  TypeProfileTab,
  TypeStickerSet,
  TypeWallPaper,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import type { ChannelFullEntity } from '../../types';
import { stringifyJson } from '../../utils/json';
import BaseEntityModel, { makeModelObservable } from './base.model';

/**
 * @see https://core.telegram.org/constructor/channelFull
 */
export class ChannelFull extends BaseEntityModel<ChannelFullEntity> {
  canViewParticipants?: boolean;
  canSetUsername?: boolean;
  canSetStickers?: boolean;
  hiddenPrehistory?: boolean;
  canSetLocation?: boolean;
  hasScheduled?: boolean;
  canViewStats?: boolean;
  blocked?: boolean;
  canDeleteChannel?: boolean;
  antispam?: boolean;
  participantsHidden?: boolean;
  translationsDisabled?: boolean;
  storiesPinnedAvailable?: boolean;
  viewForumAsMessages?: boolean;
  restrictedSponsored?: boolean;
  canViewRevenue?: boolean;
  paidMediaAllowed?: boolean;
  canViewStarsRevenue?: boolean;
  paidReactionsAvailable?: boolean;
  stargiftsAvailable?: boolean;
  paidMessagesAvailable?: boolean;
  about: string;
  participantsCount?: number;
  adminsCount?: number;
  kickedCount?: number;
  bannedCount?: number;
  onlineCount?: number;
  readInboxMaxId!: number;
  readOutboxMaxId!: number;
  unreadCount!: number;
  chatPhoto!: TypePhoto;
  notifySettings!: TypePeerNotifySettings;
  exportedInvite?: TypeExportedChatInvite;
  botInfo!: TypeBotInfo[];
  migratedFromChatId?: string;
  migratedFromMaxId?: number;
  pinnedMsgId?: number;
  stickerset?: TypeStickerSet;
  availableMinId?: number;
  folderId?: number;
  linkedChatId?: string;
  location?: TypeChannelLocation;
  slowmodeSeconds?: number;
  slowmodeNextSendDate?: number;
  statsDc?: number;
  pts!: number;
  call?: TypeInputGroupCall;
  ttlPeriod?: number;
  pendingSuggestions?: string[];
  groupcallDefaultJoinAs?: TypePeer;
  themeEmoticon?: string;
  requestsPending?: number;
  recentRequesters?: string[];
  defaultSendAs?: TypePeer;
  availableReactions?: TypeChatReactions;
  reactionsLimit?: number;
  stories?: TypePeerStories;
  wallpaper?: TypeWallPaper;
  boostsApplied?: number;
  boostsUnrestrict?: number;
  emojiset?: TypeStickerSet;
  botVerification?: TypeBotVerification;
  stargiftsCount?: number;
  sendPaidMessagesStars?: string;
  mainTab?: TypeProfileTab;

  constructor(data: ChannelFullEntity) {
    super(data);
    this.canViewParticipants = data.canViewParticipants;
    this.canSetUsername = data.canSetUsername;
    this.canSetStickers = data.canSetStickers;
    this.hiddenPrehistory = data.hiddenPrehistory;
    this.canSetLocation = data.canSetLocation;
    this.hasScheduled = data.hasScheduled;
    this.canViewStats = data.canViewStats;
    this.blocked = data.blocked;
    this.canDeleteChannel = data.canDeleteChannel;
    this.antispam = data.antispam;
    this.participantsHidden = data.participantsHidden;
    this.translationsDisabled = data.translationsDisabled;
    this.storiesPinnedAvailable = data.storiesPinnedAvailable;
    this.viewForumAsMessages = data.viewForumAsMessages;
    this.restrictedSponsored = data.restrictedSponsored;
    this.canViewRevenue = data.canViewRevenue;
    this.paidMediaAllowed = data.paidMediaAllowed;
    this.canViewStarsRevenue = data.canViewStarsRevenue;
    this.paidReactionsAvailable = data.paidReactionsAvailable;
    this.stargiftsAvailable = data.stargiftsAvailable;
    this.paidMessagesAvailable = data.paidMessagesAvailable;
    this.about = data.about ?? '';
    this.participantsCount = data.participantsCount;
    this.adminsCount = data.adminsCount;
    this.kickedCount = data.kickedCount;
    this.bannedCount = data.bannedCount;
    this.onlineCount = data.onlineCount;
    this.readInboxMaxId = data.readInboxMaxId;
    this.readOutboxMaxId = data.readOutboxMaxId;
    this.unreadCount = data.unreadCount;
    this.chatPhoto = data.chatPhoto;
    this.notifySettings = data.notifySettings;
    this.exportedInvite = data.exportedInvite;
    this.botInfo = data.botInfo;
    this.migratedFromChatId = data.migratedFromChatId;
    this.migratedFromMaxId = data.migratedFromMaxId;
    this.pinnedMsgId = data.pinnedMsgId;
    this.stickerset = data.stickerset;
    this.availableMinId = data.availableMinId;
    this.folderId = data.folderId;
    this.linkedChatId = data.linkedChatId;
    this.location = data.location;
    this.slowmodeSeconds = data.slowmodeSeconds;
    this.slowmodeNextSendDate = data.slowmodeNextSendDate;
    this.statsDc = data.statsDc;
    this.pts = data.pts;
    this.call = data.call;
    this.ttlPeriod = data.ttlPeriod;
    this.pendingSuggestions = data.pendingSuggestions;
    this.groupcallDefaultJoinAs = data.groupcallDefaultJoinAs;
    this.themeEmoticon = data.themeEmoticon;
    this.requestsPending = data.requestsPending;
    this.recentRequesters = data.recentRequesters;
    this.defaultSendAs = data.defaultSendAs;
    this.availableReactions = data.availableReactions;
    this.reactionsLimit = data.reactionsLimit;
    this.stories = data.stories;
    this.wallpaper = data.wallpaper;
    this.boostsApplied = data.boostsApplied;
    this.boostsUnrestrict = data.boostsUnrestrict;
    this.emojiset = data.emojiset;
    this.botVerification = data.botVerification;
    this.stargiftsCount = data.stargiftsCount;
    this.sendPaidMessagesStars = data.sendPaidMessagesStars;
    this.mainTab = data.mainTab;
    makeModelObservable(this);
  }

  /** Serialize to a plain JSON string round-trippable via {@link ChannelFull.fromJSON}. */
  toJSON(): string {
    return stringifyJson(toJS(this));
  }

  static fromJSON(json: string): ChannelFull {
    return new ChannelFull(JSON.parse(json) as ChannelFullEntity);
  }
}
