import { TelegramClient } from '@telegenie/libs/foundation/telegram/types';
import type {
  Channel as FdnChannel,
  ChannelForbidden as FdnChannelForbidden,
  ChannelFull as FdnChannelFull,
  Chat as FdnChat,
  ChatEmpty as FdnChatEmpty,
  ChatForbidden as FdnChatForbidden,
  ChatFull as FdnChatFull,
  Dialog as FdnDialog,
  DialogFolder as FdnDialogFolder,
  MessageEmpty as FdnMessageEmpty,
  TypePeer,
  TypeEncryptedChat,
  User as FdnUser,
  UserEmpty as FdnUserEmpty,
} from '@telegenie/libs/foundation/telegram/types/api-types';
import type {
  Message as FdnMessage,
  MessageService as FdnMessageService,
} from '@telegenie/libs/foundation/telegram/types/message';
import type { UserFull as FdnUserFull } from '@telegenie/libs/foundation/telegram/types/users';
import { isChannelId, isUserId } from '@telegenie/libs/foundation/telegram/utils';
import {
  encryptedChatStatus,
  type EncryptedChatEntity,
} from '@telegenie/sdk/store/types/encrypted-chat';
import type {
  ChannelEntity,
  ChannelFullEntity,
  ChatEntity,
  ChatFullEntity,
  DialogEntity,
  MessageEntity,
  PeerType,
  UserEntity,
  UserFullEntity,
} from '@telegenie/sdk/store/types';

type ConversionServiceOptions = {
  debug?: boolean;
};

type ConvertGetAllChatsPartialResponse = {
  dialogs: DialogEntity[];
  users: UserEntity[];
  chats: ChatEntity[];
  channels: ChannelEntity[];
  dialogMessages: Map<string, MessageEntity[]>;
  lastMessageByDialog: Map<string, string>;
  tgDialogMessages: Map<string, FdnMessage[]>;
};

type ConvertGetAllChatsPartialParams = {
  dialogs: FdnDialog[];
  messages: FdnMessage[];
  chats: FdnChat[];
  channels: FdnChannel[];
  users: FdnUser[];
};

type PeerIdParts = {
  peerId: string;
  peerType: PeerType;
  fromId?: string;
  fromType?: PeerType | '';
};

/**
 * ConversionService — maps foundation types onto store entities without stripping fields.
 */
export class ConversionService {
  private debug: boolean;
  private log: (...args: any) => void;
  client: TelegramClient | null = null;

  constructor({ debug }: ConversionServiceOptions = {}) {
    this.debug = debug ?? false;
    this.log = (...args: any) => {
      if (this.debug) {
        console.info('[ConversionService]', ...args);
      }
    };
  }

  private peerIdFromTypePeer = (peer?: TypePeer | null): string => {
    if (!peer) {
      return '';
    }
    if ('userId' in peer) {
      return peer.userId;
    }
    if ('chatId' in peer) {
      return peer.chatId;
    }
    if ('channelId' in peer) {
      return peer.channelId;
    }
    return '';
  };

  private peerTypeFromId = (peerId: string): PeerType => {
    if (isUserId(peerId)) {
      return 'user';
    }
    if (isChannelId(peerId)) {
      return 'channel';
    }
    return 'group';
  };

  private peerTypeFromTypePeer = (peer?: TypePeer | null): PeerType | '' => {
    if (!peer) {
      return '';
    }
    if ('userId' in peer) {
      return 'user';
    }
    if ('channelId' in peer) {
      return 'channel';
    }
    if ('chatId' in peer) {
      return 'group';
    }
    return '';
  };

  private peerParts = (peer?: TypePeer | null, from?: TypePeer | null): PeerIdParts => {
    const peerId = this.peerIdFromTypePeer(peer);
    return {
      peerId,
      peerType: this.peerTypeFromId(peerId),
      fromId: from ? this.peerIdFromTypePeer(from) : undefined,
      fromType: from ? this.peerTypeFromTypePeer(from) : undefined,
    };
  };

  convertMessages = (messages: FdnMessage[]): MessageEntity[] => {
    return messages.map((message) => {
      const parts = this.peerParts(message.peer_id, message.from_id);
      return {
        kind: 'message',
        id: message.id.toString(),
        peerId: parts.peerId,
        peerType: parts.peerType,
        fromId: parts.fromId,
        fromType: parts.fromType,
        out: message.out,
        mentioned: message.mentioned,
        mediaUnread: message.media_unread,
        silent: message.silent,
        post: message.post,
        fromScheduled: message.from_scheduled,
        legacy: message.legacy,
        editHide: message.edit_hide,
        pinned: message.pinned,
        noforwards: message.noforwards,
        invertMedia: message.invert_media,
        date: message.date,
        message: message.message ?? '',
        fwdFrom: message.fwd_from,
        viaBotId: message.via_bot_id,
        replyTo: message.reply_to,
        media: message.media,
        replyMarkup: message.reply_markup,
        entities: message.entities as MessageEntity['entities'],
        views: message.views,
        forwards: message.forwards,
        replies: message.replies,
        editDate: message.edit_date,
        postAuthor: message.post_author,
        groupedId: message.grouped_id,
        reactions: message.reactions,
        restrictionReason: message.restriction_reason,
        ttlPeriod: message.ttl_period,
        ...(message.reactionsArePossible ? { reactionsArePossible: true as const } : {}),
        isEmpty: false,
      };
    });
  };

  convertServiceMessages = (messages: FdnMessageService[]): MessageEntity[] => {
    return messages.map((message) => {
      const parts = this.peerParts(message.peer_id, message.from_id);
      return {
        kind: 'service',
        id: message.id.toString(),
        peerId: parts.peerId,
        peerType: parts.peerType,
        fromId: parts.fromId,
        fromType: parts.fromType,
        out: message.out,
        mentioned: message.mentioned,
        mediaUnread: message.media_unread,
        silent: message.silent,
        post: message.post,
        legacy: message.legacy,
        date: message.date,
        message: '',
        replyTo: message.reply_to,
        ttlPeriod: message.ttl_period,
        action: message.action,
        isEmpty: false,
      };
    });
  };

  convertUsers = (users: FdnUser[]): UserEntity[] => {
    return users.map((user) => ({
      id: user.id.toString(),
      self: user.self,
      contact: user.contact,
      mutualContact: user.mutualContact,
      deleted: user.deleted,
      bot: user.bot,
      botChatHistory: user.botChatHistory,
      botNochats: user.botNochats,
      verified: user.verified,
      restricted: user.restricted,
      min: user.min,
      botInlineGeo: user.botInlineGeo,
      support: user.support,
      scam: user.scam,
      applyMinPhoto: user.applyMinPhoto,
      fake: user.fake,
      botAttachMenu: user.botAttachMenu,
      premium: user.premium,
      attachMenuEnabled: user.attachMenuEnabled,
      botCanEdit: user.botCanEdit,
      closeFriend: user.closeFriend,
      storiesHidden: user.storiesHidden,
      storiesUnavailable: user.storiesUnavailable,
      contactRequirePremium: user.contactRequirePremium,
      botBusiness: user.botBusiness,
      botHasMainApp: user.botHasMainApp,
      accessHash: user.accessHash,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      phone: user.phone,
      photo: user.photo,
      status: user.status,
      botInfoVersion: user.botInfoVersion,
      restrictionReason: user.restrictionReason,
      botInlinePlaceholder: user.botInlinePlaceholder,
      langCode: user.langCode,
      emojiStatus: user.emojiStatus,
      usernames: user.usernames,
      storiesMaxId: user.storiesMaxId,
      color: user.color,
      profileColor: user.profileColor,
      botActiveUsers: user.botActiveUsers,
      botVerificationIcon: user.botVerificationIcon,
    }));
  };

  /** LocalDb may emit User or UserEmpty. */
  convertLocalDbUsers = (users: Array<FdnUser | FdnUserEmpty>): UserEntity[] => {
    return users.map((user) => {
      if ('accessHash' in user || 'firstName' in user || 'username' in user || 'phone' in user) {
        return this.convertUsers([user as FdnUser])[0];
      }
      return {
        id: user.id.toString(),
        deleted: true,
      };
    });
  };

  convertUserFull = (userFull: FdnUserFull): UserFullEntity => {
    return {
      ...userFull,
      id: String(userFull.id),
    };
  };

  convertChatFull = (chatFull: FdnChatFull): ChatFullEntity => {
    return {
      ...chatFull,
      id: String(chatFull.id),
    };
  };

  convertChannelFull = (channelFull: FdnChannelFull): ChannelFullEntity => {
    return {
      ...channelFull,
      id: String(channelFull.id),
    };
  };

  /** LocalDb chat puts may include empty/forbidden variants. */
  convertLocalDbChats = (
    chats: Array<FdnChat | FdnChatEmpty | FdnChatForbidden>,
  ): ChatEntity[] => {
    return chats.map((chat) => {
      if ('participantsCount' in chat || 'creator' in chat || 'version' in chat) {
        return this.convertChat(chat as FdnChat);
      }
      if ('title' in chat) {
        return this.convertForbiddenChat(chat as FdnChatForbidden);
      }
      return this.convertEmptyChat(chat as FdnChatEmpty);
    });
  };

  convertLocalDbChannels = (
    channels: Array<FdnChannel | FdnChannelForbidden>,
  ): ChannelEntity[] => {
    return channels.map((channel) => {
      if (
        'gigagroup' in channel ||
        'participantsCount' in channel ||
        'username' in channel ||
        'photo' in channel
      ) {
        return this.convertChannel(channel as FdnChannel);
      }
      return this.convertForbiddenChannel(channel as FdnChannelForbidden);
    });
  };

  convertChat = (chat: FdnChat): ChatEntity => {
    return {
      id: chat.id,
      creator: chat.creator,
      left: chat.left,
      deactivated: chat.deactivated,
      callActive: chat.callActive,
      callNotEmpty: chat.callNotEmpty,
      noforwards: chat.noforwards,
      title: chat.title ?? '',
      photo: chat.photo,
      participantsCount: chat.participantsCount,
      date: chat.date,
      version: chat.version,
      migratedTo: chat.migratedTo,
      adminRights: chat.adminRights,
      defaultBannedRights: chat.defaultBannedRights,
      status: 'active',
    };
  };

  convertChannel = (channel: FdnChannel): ChannelEntity => {
    return {
      id: channel.id,
      creator: channel.creator,
      left: channel.left,
      broadcast: channel.broadcast,
      verified: channel.verified,
      megagroup: channel.megagroup,
      restricted: channel.restricted,
      signatures: channel.signatures,
      min: channel.min,
      scam: channel.scam,
      hasLink: channel.hasLink,
      hasGeo: channel.hasGeo,
      slowmodeEnabled: channel.slowmodeEnabled,
      callActive: channel.callActive,
      callNotEmpty: channel.callNotEmpty,
      fake: channel.fake,
      gigagroup: channel.gigagroup,
      noforwards: channel.noforwards,
      joinToSend: channel.joinToSend,
      joinRequest: channel.joinRequest,
      forum: channel.forum,
      storiesHidden: channel.storiesHidden,
      storiesHiddenMin: channel.storiesHiddenMin,
      storiesUnavailable: channel.storiesUnavailable,
      signatureProfiles: channel.signatureProfiles,
      accessHash: channel.accessHash,
      title: channel.title ?? '',
      username: channel.username,
      photo: channel.photo,
      date: channel.date,
      restrictionReason: channel.restrictionReason,
      adminRights: channel.adminRights,
      bannedRights: channel.bannedRights,
      defaultBannedRights: channel.defaultBannedRights,
      participantsCount: channel.participantsCount,
      usernames: channel.usernames,
      storiesMaxId: channel.storiesMaxId,
      color: channel.color,
      profileColor: channel.profileColor,
      emojiStatus: channel.emojiStatus,
      level: channel.level,
      subscriptionUntilDate: channel.subscriptionUntilDate,
      botVerificationIcon: channel.botVerificationIcon,
      status: 'active',
    };
  };

  convertTypeChats = (chats: (FdnChat | FdnChannel)[]): [ChatEntity[], ChannelEntity[]] => {
    const chatsArray: ChatEntity[] = [];
    const channelsArray: ChannelEntity[] = [];
    chats.forEach((chat) => {
      if ('gigagroup' in chat || 'broadcast' in chat || 'megagroup' in chat) {
        channelsArray.push(this.convertChannel(chat as FdnChannel));
      } else {
        chatsArray.push(this.convertChat(chat as FdnChat));
      }
    });
    return [chatsArray, channelsArray];
  };

  convertDialogs = (tgDialogs: FdnDialog[]): DialogEntity[] => {
    return tgDialogs.map((dialog) => {
      const peerId = this.peerIdFromTypePeer(dialog.peer);
      return {
        id: peerId,
        peerId,
        pinned: dialog.pinned,
        unreadMark: dialog.unreadMark,
        viewForumAsMessages: dialog.viewForumAsMessages,
        topMessageId: dialog.topMessage?.toString() ?? '',
        readInboxMaxId: dialog.readInboxMaxId,
        readOutboxMaxId: dialog.readOutboxMaxId,
        unreadCount: dialog.unreadCount ?? 0,
        unreadMentionsCount: dialog.unreadMentionsCount,
        unreadReactionsCount: dialog.unreadReactionsCount,
        notifySettings: dialog.notifySettings,
        pts: dialog.pts,
        draft: dialog.draft,
        folderId: dialog.folderId,
        ttlPeriod: dialog.ttlPeriod,
        isFolder: false,
      };
    });
  };

  /**
   * Convert DialogFolder entries to DialogEntity with isFolder=true.
   */
  convertDialogFolders = (tgFolders: FdnDialogFolder[]): DialogEntity[] => {
    return tgFolders.map((folder) => {
      const peerId = this.peerIdFromTypePeer(folder.peer);
      return {
        id: peerId,
        peerId,
        unreadCount:
          (folder.unreadUnmutedMessagesCount ?? 0) + (folder.unreadMutedMessagesCount ?? 0),
        topMessageId: folder.topMessage?.toString() ?? '',
        isFolder: true,
        folder: folder.folder,
        folderTitle: folder.folder?.title ?? '',
        pinned: folder.pinned,
        unreadMutedPeersCount: folder.unreadMutedPeersCount,
        unreadUnmutedPeersCount: folder.unreadUnmutedPeersCount,
        unreadMutedMessagesCount: folder.unreadMutedMessagesCount,
        unreadUnmutedMessagesCount: folder.unreadUnmutedMessagesCount,
      };
    });
  };

  convertForbiddenChat = (chat: FdnChatForbidden): ChatEntity => {
    return {
      id: chat.id,
      title: chat.title ?? '',
      status: 'forbidden',
    };
  };

  convertEmptyChat = (chat: FdnChatEmpty): ChatEntity => {
    return {
      id: chat.id,
      title: '',
      status: 'empty',
    };
  };

  convertForbiddenChannel = (channel: FdnChannelForbidden): ChannelEntity => {
    return {
      id: channel.id,
      title: channel.title ?? '',
      accessHash: channel.accessHash,
      megagroup: channel.megagroup,
      broadcast: channel.broadcast,
      status: 'forbidden',
      untilDate: channel.untilDate,
    };
  };

  convertEmptyMessages = (messages: FdnMessageEmpty[]): MessageEntity[] => {
    return messages.map((msg) => {
      const peerId = this.peerIdFromTypePeer(msg.peerId);
      return {
        kind: 'empty',
        id: msg.id.toString(),
        peerId,
        peerType: this.peerTypeFromId(peerId),
        date: 0,
        message: '',
        isEmpty: true,
      };
    });
  };

  convertGetAllChatsPartialResponse = ({
    dialogs,
    messages,
    chats,
    channels,
    users,
  }: ConvertGetAllChatsPartialParams): ConvertGetAllChatsPartialResponse => {
    const lastMessageByDialog = new Map<string, string>();
    const dialogMessages = new Map<string, MessageEntity[]>();
    const tgDialogMessages = new Map<string, FdnMessage[]>();
    if (dialogs.length === 0) {
      return {
        dialogs: [],
        users: [],
        chats: [],
        channels: [],
        dialogMessages: new Map<string, MessageEntity[]>(),
        lastMessageByDialog: new Map<string, string>(),
        tgDialogMessages: new Map<string, FdnMessage[]>(),
      };
    }
    const convertedDialogs = this.convertDialogs(dialogs);
    const convertedMessages = this.convertMessages(messages);
    convertedDialogs.forEach((dialog) => {
      lastMessageByDialog.set(dialog.peerId, dialog.topMessageId);
      dialogMessages.set(dialog.peerId, [
        ...(dialogMessages.get(dialog.peerId) ?? []),
        ...convertedMessages.filter((message) => message.peerId === dialog.peerId),
      ]);
    });
    messages.forEach((message) => {
      const peerId = this.peerIdFromTypePeer(message.peer_id);
      tgDialogMessages.set(peerId, [...(tgDialogMessages.get(peerId) ?? []), message]);
    });

    return {
      dialogs: convertedDialogs,
      users: this.convertUsers(users),
      chats: chats.map((chat) => this.convertChat(chat)),
      channels: channels.map((channel) => this.convertChannel(channel)),
      dialogMessages,
      lastMessageByDialog,
      tgDialogMessages,
    };
  };

  convertEncryptedChat = (chat: TypeEncryptedChat): EncryptedChatEntity => ({
    ...chat,
    status: encryptedChatStatus(chat),
  });

  convertLocalDbEncryptedChats = (chats: TypeEncryptedChat[]): EncryptedChatEntity[] =>
    chats.map((chat) => this.convertEncryptedChat(chat));
}
