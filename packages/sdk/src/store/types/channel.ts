import type {
  TypeChatAdminRights,
  TypeChatBannedRights,
  TypeChatPhoto,
  TypeEmojiStatus,
  TypePeerColor,
  TypeRestrictionReason,
  TypeUsername,
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
  TypeBotInfo,
} from '@telegenie/libs/foundation/telegram/types/api-types';

/**
 * Stored entities intentionally omit:
 * - TL `flags` / `flags2` bitmasks (expanded booleans instead)
 * - Wrapper companion `users` / `chats` from users.UserFull / messages.ChatFull (own stores)
 * - Raw `TypePeer` when Bot-API `peerId` / `fromId` is stored
 * - Downloaded media file bytes (metadata only via converters)
 * - Fields GramJS cannot emit yet (typed; remain undefined until TL upgrade)
 *
 * @see https://core.telegram.org/constructor/channel
 */
export type ChannelEntity = {
  id: string;
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
  /** Classification: 'active' | 'forbidden' (restricted access) */
  status: 'active' | 'forbidden';
  /** Access restriction expiry (populated for forbidden channels with untilDate) */
  untilDate?: number;
};

/**
 * @see https://core.telegram.org/constructor/channelFull
 */
export type ChannelFullEntity = {
  id: string;
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
  readInboxMaxId: number;
  readOutboxMaxId: number;
  unreadCount: number;
  chatPhoto: TypePhoto;
  notifySettings: TypePeerNotifySettings;
  exportedInvite?: TypeExportedChatInvite;
  botInfo: TypeBotInfo[];
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
  pts: number;
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
};
