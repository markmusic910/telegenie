import type {
  TypeBotInfo,
  TypeChatAdminRights,
  TypeChatBannedRights,
  TypeChatParticipants,
  TypeChatPhoto,
  TypeChatReactions,
  TypeExportedChatInvite,
  TypeInputChannel,
  TypeInputGroupCall,
  TypePeer,
  TypePeerNotifySettings,
  TypePhoto,
} from '@telegenie/libs/foundation/telegram/types/api-types';

/**
 * @see https://core.telegram.org/constructor/chat
 */
export type ChatEntity = {
  id: string;
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
  /** Classification: 'active' | 'forbidden' (no access) | 'empty' (deleted/tombstone) */
  status: 'active' | 'forbidden' | 'empty';
};

/**
 * @see https://core.telegram.org/constructor/chatFull
 */
export type ChatFullEntity = {
  id: string;
  canSetUsername?: boolean;
  hasScheduled?: boolean;
  translationsDisabled?: boolean;
  about: string;
  participants: TypeChatParticipants;
  chatPhoto?: TypePhoto;
  notifySettings: TypePeerNotifySettings;
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
};
