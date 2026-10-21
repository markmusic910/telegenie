import { Api } from '@telegenie/teleproto';
import { buildMarkedPeerIdByType } from '../../helpers';
import type {
  Channel,
  ChannelForbidden,
  ChannelFull,
  Chat,
  ChatEmpty,
  ChatForbidden,
  ChatFull,
  StickerSet,
  TypeBotInfo,
  TypeChannelLocation,
  TypeChatBannedRights,
  TypeChatParticipant,
  TypeChatParticipants,
  TypeChatPhoto,
  TypeChatReactions,
  TypeExportedChatInvite,
  TypeInputChannel,
  TypeInputGroupCall,
  TypeReaction,
  TypeRestrictionReason,
  TypeStarsSubscriptionPricing,
  TypeStickerSet,
} from '../../types/api-types';
import type { TypeUsername } from '../../types/users';
import { convertTypeChatPhoto, convertTypeInputPeer, convertTypePeer, convertTypePeerNotifySettings } from './common.converter';
import { convertTypePhotoSize } from './media.converter';
import {
  convertTypeBotInfo,
  convertTypeBotVerification,
  convertTypeChatAdminRights,
  convertTypeEmojiStatus,
  convertTypeGeoPoint,
  convertTypePeerColor,
  convertTypePeerStories,
  convertTypePhoto,
  convertTypeProfileTab,
  convertTypeRestrictionReason,
  convertTypeUsername,
  convertTypeWallPaper,
} from './user.converter';

// Converter for Chat
export const convertChat = (chat: Api.Chat): Chat => {
  const markedId = buildMarkedPeerIdByType(chat.id.toString(), 'chat');

  return {
    id: markedId,
    title: chat.title ?? '',
    photo: convertTypeChatPhoto(chat.photo) ?? null,
    participantsCount: chat.participantsCount ?? 0,
    date: chat.date ?? 0,
    version: chat.version ?? 0,
    migratedTo: chat.migratedTo ? convertTypeInputChannel(chat.migratedTo) : undefined,
    adminRights: chat.adminRights ? convertTypeChatAdminRights(chat.adminRights) : undefined,
    defaultBannedRights: chat.defaultBannedRights
      ? convertTypeChatBannedRights(chat.defaultBannedRights)
      : undefined,
    // Boolean flags
    creator: chat.creator ?? false,
    left: chat.left ?? false,
    deactivated: chat.deactivated ?? false,
    callActive: chat.callActive ?? false,
    callNotEmpty: chat.callNotEmpty ?? false,
    noforwards: chat.noforwards ?? false,
  };
};

// Converter for Channel
export const convertChannel = (channel: Api.Channel): Channel => {
  const markedId = buildMarkedPeerIdByType(channel.id.toString(), 'channel');

  return {
    id: markedId,
    title: channel.title ?? '',
    username: channel.username,
    photo: convertTypeChatPhoto(channel.photo) ?? ({} as TypeChatPhoto),
    date: channel.date ?? 0,
    restrictionReason: channel.restrictionReason
      ?.map(convertTypeRestrictionReason)
      .filter(Boolean) as TypeRestrictionReason[],
    adminRights: channel.adminRights ? convertTypeChatAdminRights(channel.adminRights) : undefined,
    bannedRights: channel.bannedRights
      ? convertTypeChatBannedRights(channel.bannedRights)
      : undefined,
    defaultBannedRights: channel.defaultBannedRights
      ? convertTypeChatBannedRights(channel.defaultBannedRights)
      : undefined,
    participantsCount: channel.participantsCount,
    usernames: channel.usernames?.map(convertTypeUsername).filter(Boolean) as TypeUsername[],
    storiesMaxId: channel.storiesMaxId?.maxId,
    color: convertTypePeerColor(channel.color),
    profileColor: convertTypePeerColor(channel.profileColor),
    emojiStatus: convertTypeEmojiStatus(channel.emojiStatus),
    level: channel.level,
    subscriptionUntilDate: channel.subscriptionUntilDate,
    botVerificationIcon: (channel as any).botVerificationIcon?.toString(),
    accessHash: channel.accessHash?.toString(),
    // Boolean flags
    creator: channel.creator ?? false,
    left: channel.left ?? false,
    broadcast: channel.broadcast ?? false,
    verified: channel.verified ?? false,
    megagroup: channel.megagroup ?? false,
    restricted: channel.restricted ?? false,
    signatures: channel.signatures ?? false,
    min: channel.min ?? false,
    scam: channel.scam ?? false,
    hasLink: channel.hasLink ?? false,
    hasGeo: channel.hasGeo ?? false,
    slowmodeEnabled: channel.slowmodeEnabled ?? false,
    callActive: channel.callActive ?? false,
    callNotEmpty: channel.callNotEmpty ?? false,
    fake: channel.fake ?? false,
    gigagroup: channel.gigagroup ?? false,
    noforwards: channel.noforwards ?? false,
    joinToSend: channel.joinToSend ?? false,
    joinRequest: channel.joinRequest ?? false,
    forum: channel.forum ?? false,
    storiesHidden: channel.storiesHidden ?? false,
    storiesHiddenMin: channel.storiesHiddenMin ?? false,
    storiesUnavailable: channel.storiesUnavailable ?? false,
    signatureProfiles: channel.signatureProfiles ?? false,
  };
};

// Converter for ChatForbidden
export const convertChatForbidden = (chatForbidden: Api.ChatForbidden): ChatForbidden => {
  return {
    id: buildMarkedPeerIdByType(chatForbidden.id.toString(), 'chat'),
    title: chatForbidden.title ?? '',
  };
};

// Converter for ChannelForbidden
export const convertChannelForbidden = (
  channelForbidden: Api.ChannelForbidden,
): ChannelForbidden => {
  return {
    id: buildMarkedPeerIdByType(channelForbidden.id.toString(), 'channel'),
    accessHash: channelForbidden.accessHash?.toString() ?? '',
    title: channelForbidden.title ?? '',
    untilDate: channelForbidden.untilDate,
    // Boolean flags
    broadcast: channelForbidden.broadcast ?? false,
    megagroup: channelForbidden.megagroup ?? false,
  };
};

// Converter for ChatEmpty
export const convertChatEmpty = (chatEmpty: Api.ChatEmpty): ChatEmpty => {
  const markedId = buildMarkedPeerIdByType(chatEmpty.id.toString(), 'chat');

  return {
    id: markedId,
  };
};

// Helper converter for ChatBannedRights
export const convertTypeChatBannedRights = (
  rights?: Api.TypeChatBannedRights,
): TypeChatBannedRights | undefined => {
  if (!rights) {
    return undefined;
  }
  if (rights instanceof Api.ChatBannedRights) {
    return {
      viewMessages: rights.viewMessages ?? false,
      sendMessages: rights.sendMessages ?? false,
      sendMedia: rights.sendMedia ?? false,
      sendStickers: rights.sendStickers ?? false,
      sendGifs: rights.sendGifs ?? false,
      sendGames: rights.sendGames ?? false,
      sendInline: rights.sendInline ?? false,
      embedLinks: rights.embedLinks ?? false,
      sendPolls: rights.sendPolls ?? false,
      changeInfo: rights.changeInfo ?? false,
      inviteUsers: rights.inviteUsers ?? false,
      pinMessages: rights.pinMessages ?? false,
      untilDate: rights.untilDate ?? 0,
      sendPhotos: rights.sendPhotos ?? false,
      sendVideos: rights.sendVideos ?? false,
      sendRoundvideos: rights.sendRoundvideos ?? false,
      sendAudios: rights.sendAudios ?? false,
      sendVoices: rights.sendVoices ?? false,
      sendDocs: rights.sendDocs ?? false,
      sendPlain: rights.sendPlain ?? false,
    };
  }
  return undefined;
};

// Helper converter for InputChannel
export const convertTypeInputChannel = (
  inputChannel?: Api.TypeInputChannel,
): TypeInputChannel | undefined => {
  if (!inputChannel) {
    return undefined;
  }
  if (inputChannel instanceof Api.InputChannel) {
    return {
      channelId: buildMarkedPeerIdByType(inputChannel.channelId?.toString(), 'channel'),
      accessHash: inputChannel.accessHash?.toString(),
    };
  }
  if (inputChannel instanceof Api.InputChannelFromMessage) {
    const peer = convertTypeInputPeer(inputChannel.peer);
    if (!peer) {
      return undefined;
    }
    return {
      peer,
      msgId: inputChannel.msgId,
      channelId: buildMarkedPeerIdByType(inputChannel.channelId?.toString(), 'channel'),
    };
  }
  return undefined;
};

export const convertTypeChat = (
  chats: Api.TypeChat[],
): {
  chats: Chat[];
  channels: Channel[];
  forbiddenChats: ChatForbidden[];
  forbiddenChannels: ChannelForbidden[];
  emptyChats: ChatEmpty[];
} => {
  const chatsArray: Chat[] = [];
  const channelsArray: Channel[] = [];
  const forbiddenChats: ChatForbidden[] = [];
  const forbiddenChannels: ChannelForbidden[] = [];
  const emptyChats: ChatEmpty[] = [];

  chats.forEach((chat) => {
    if (chat instanceof Api.Chat) {
      chatsArray.push(convertChat(chat));
    } else if (chat instanceof Api.Channel) {
      channelsArray.push(convertChannel(chat));
    } else if (chat instanceof Api.ChatEmpty) {
      emptyChats.push(convertChatEmpty(chat));
    } else if (chat instanceof Api.ChatForbidden) {
      forbiddenChats.push(convertChatForbidden(chat));
    } else if (chat instanceof Api.ChannelForbidden) {
      forbiddenChannels.push(convertChannelForbidden(chat));
    }
  });

  return {
    chats: chatsArray,
    channels: channelsArray,
    forbiddenChats,
    forbiddenChannels,
    emptyChats,
  };
};

// Helper converter for StarsSubscriptionPricing
export const convertTypeStarsSubscriptionPricing = (
  pricing?: Api.TypeStarsSubscriptionPricing,
): TypeStarsSubscriptionPricing | undefined => {
  if (!pricing) {
    return undefined;
  }
  if (pricing instanceof Api.StarsSubscriptionPricing) {
    return {
      period: pricing.period ?? 0,
      amount: pricing.amount?.toString() ?? '0',
    };
  }
  return undefined;
};

// Helper converter for ChatInviteExported / TypeExportedChatInvite
export const convertTypeExportedChatInvite = (
  invite?: Api.TypeExportedChatInvite,
): TypeExportedChatInvite | undefined => {
  if (!invite) {
    return undefined;
  }
  if (invite instanceof Api.ChatInvitePublicJoinRequests) {
    return undefined;
  }
  if (invite instanceof Api.ChatInviteExported) {
    return {
      revoked: invite.revoked ?? false,
      permanent: invite.permanent ?? false,
      requestNeeded: invite.requestNeeded ?? false,
      link: invite.link ?? '',
      adminId: invite.adminId?.toString() ?? '',
      date: invite.date ?? 0,
      startDate: invite.startDate,
      expireDate: invite.expireDate,
      usageLimit: invite.usageLimit,
      usage: invite.usage,
      requested: invite.requested,
      subscriptionExpired: invite.subscriptionExpired,
      title: invite.title,
      subscriptionPricing: convertTypeStarsSubscriptionPricing(invite.subscriptionPricing),
    } as unknown as TypeExportedChatInvite;
  }
  return undefined;
};

// Helper converter for InputGroupCall
export const convertTypeInputGroupCall = (
  call?: Api.TypeInputGroupCall,
): TypeInputGroupCall | undefined => {
  if (!call) {
    return undefined;
  }
  if (call instanceof Api.InputGroupCall) {
    return {
      id: call.id.toString(),
      accessHash: call.accessHash.toString(),
    };
  }
  return undefined;
};

// Helper converter for Reaction
export const convertTypeReaction = (reaction?: Api.TypeReaction): TypeReaction | undefined => {
  if (!reaction) {
    return undefined;
  }
  if (reaction instanceof Api.ReactionEmpty) {
    return { empty: true };
  }
  if (reaction instanceof Api.ReactionPaid) {
    return { paid: true };
  }
  if (reaction instanceof Api.ReactionEmoji) {
    return {
      emoticon: reaction.emoticon ?? '',
    };
  }
  if (reaction instanceof Api.ReactionCustomEmoji) {
    return {
      documentId: reaction.documentId.toString(),
    };
  }
  return undefined;
};

// Helper converter for ChatReactions
export const convertTypeChatReactions = (
  reactions?: Api.TypeChatReactions,
): TypeChatReactions | undefined => {
  if (!reactions) {
    return undefined;
  }
  if (reactions instanceof Api.ChatReactionsNone) {
    return {} as TypeChatReactions;
  }
  if (reactions instanceof Api.ChatReactionsAll) {
    return {
      allowCustom: reactions.allowCustom ?? false,
    };
  }
  if (reactions instanceof Api.ChatReactionsSome) {
    return {
      reactions: (reactions.reactions
        ?.map(convertTypeReaction)
        .filter(Boolean) ?? []) as TypeReaction[],
    };
  }
  return undefined;
};

// Helper converter for ChannelLocation
export const convertTypeChannelLocation = (
  location?: Api.TypeChannelLocation,
): TypeChannelLocation | undefined => {
  if (!location) {
    return undefined;
  }
  if (location instanceof Api.ChannelLocationEmpty) {
    return {} as TypeChannelLocation;
  }
  if (location instanceof Api.ChannelLocation) {
    return {
      geoPoint: convertTypeGeoPoint(location.geoPoint)!,
      address: location.address ?? '',
    };
  }
  return undefined;
};

// Helper converter for StickerSet (bare Api.StickerSet used by ChannelFull)
export const convertTypeStickerSet = (
  stickerset?: Api.TypeStickerSet,
): TypeStickerSet | undefined => {
  if (!stickerset) {
    return undefined;
  }
  if (stickerset instanceof Api.StickerSet) {
    const converted: StickerSet = {
      archived: stickerset.archived ?? false,
      official: stickerset.official ?? false,
      masks: stickerset.masks ?? false,
      emojis: stickerset.emojis ?? false,
      textColor: stickerset.textColor ?? false,
      channelEmojiStatus: stickerset.channelEmojiStatus ?? false,
      creator: stickerset.creator ?? false,
      installedDate: stickerset.installedDate,
      id: stickerset.id.toString(),
      accessHash: stickerset.accessHash.toString(),
      title: stickerset.title ?? '',
      shortName: stickerset.shortName ?? '',
      thumbs: stickerset.thumbs
        ?.map(convertTypePhotoSize)
        .filter(Boolean) as StickerSet['thumbs'],
      thumbDcId: stickerset.thumbDcId,
      thumbVersion: stickerset.thumbVersion,
      thumbDocumentId: stickerset.thumbDocumentId?.toString(),
      count: stickerset.count ?? 0,
      hash: stickerset.hash ?? 0,
    };
    // ChannelFull.stickerset is Api.TypeStickerSet (bare), while TypeStickerSet alias
    // currently points at messages.StickerSet — cast to match ChannelFull field typing.
    return converted as unknown as TypeStickerSet;
  }
  return undefined;
};

// Helper converter for ChatParticipant
export const convertTypeChatParticipant = (
  participant?: Api.TypeChatParticipant,
): TypeChatParticipant | undefined => {
  if (!participant) {
    return undefined;
  }
  if (participant instanceof Api.ChatParticipantCreator) {
    return {
      userId: buildMarkedPeerIdByType(participant.userId.toString(), 'user'),
    };
  }
  if (participant instanceof Api.ChatParticipantAdmin) {
    return {
      userId: buildMarkedPeerIdByType(participant.userId.toString(), 'user'),
      inviterId: buildMarkedPeerIdByType(participant.inviterId.toString(), 'user'),
      date: participant.date ?? 0,
    };
  }
  if (participant instanceof Api.ChatParticipant) {
    return {
      userId: buildMarkedPeerIdByType(participant.userId.toString(), 'user'),
      inviterId: buildMarkedPeerIdByType(participant.inviterId.toString(), 'user'),
      date: participant.date ?? 0,
    };
  }
  return undefined;
};

// Helper converter for ChatParticipants
export const convertTypeChatParticipants = (
  participants?: Api.TypeChatParticipants,
): TypeChatParticipants | undefined => {
  if (!participants) {
    return undefined;
  }
  if (participants instanceof Api.ChatParticipantsForbidden) {
    return {
      chatId: buildMarkedPeerIdByType(participants.chatId.toString(), 'chat'),
      selfParticipant: convertTypeChatParticipant(participants.selfParticipant),
    };
  }
  if (participants instanceof Api.ChatParticipants) {
    return {
      chatId: buildMarkedPeerIdByType(participants.chatId.toString(), 'chat'),
      participants: (participants.participants
        ?.map(convertTypeChatParticipant)
        .filter(Boolean) ?? []) as TypeChatParticipant[],
      version: participants.version ?? 0,
    };
  }
  return undefined;
};

// Converter for ChatFull
export const convertChatFull = (chatFull: Api.ChatFull): ChatFull => {
  return {
    canSetUsername: chatFull.canSetUsername ?? false,
    hasScheduled: chatFull.hasScheduled ?? false,
    translationsDisabled: chatFull.translationsDisabled ?? false,
    id: buildMarkedPeerIdByType(chatFull.id.toString(), 'chat'),
    about: chatFull.about ?? '',
    participants: convertTypeChatParticipants(chatFull.participants)!,
    chatPhoto: convertTypePhoto(chatFull.chatPhoto),
    notifySettings: convertTypePeerNotifySettings(chatFull.notifySettings),
    exportedInvite: convertTypeExportedChatInvite(chatFull.exportedInvite),
    botInfo: chatFull.botInfo
      ?.map(convertTypeBotInfo)
      .filter(Boolean) as TypeBotInfo[] | undefined,
    pinnedMsgId: chatFull.pinnedMsgId,
    folderId: chatFull.folderId,
    call: convertTypeInputGroupCall(chatFull.call),
    ttlPeriod: chatFull.ttlPeriod,
    groupcallDefaultJoinAs: chatFull.groupcallDefaultJoinAs
      ? convertTypePeer(chatFull.groupcallDefaultJoinAs)
      : undefined,
    themeEmoticon: chatFull.themeEmoticon,
    requestsPending: chatFull.requestsPending,
    recentRequesters: chatFull.recentRequesters?.map((id) => id.toString()),
    availableReactions: convertTypeChatReactions(chatFull.availableReactions),
    reactionsLimit: chatFull.reactionsLimit,
  };
};

// Converter for ChannelFull
export const convertChannelFull = (channelFull: Api.ChannelFull): ChannelFull => {
  // Newer TL fields may not yet be typed on the GramJS class
  const extended = channelFull as Api.ChannelFull & {
    stargiftsAvailable?: boolean;
    botVerification?: unknown;
    stargiftsCount?: number;
    paidMessagesAvailable?: boolean;
    sendPaidMessagesStars?: { toString(): string } | string | number;
    mainTab?: unknown;
  };

  return {
    canViewParticipants: channelFull.canViewParticipants ?? false,
    canSetUsername: channelFull.canSetUsername ?? false,
    canSetStickers: channelFull.canSetStickers ?? false,
    hiddenPrehistory: channelFull.hiddenPrehistory ?? false,
    canSetLocation: channelFull.canSetLocation ?? false,
    hasScheduled: channelFull.hasScheduled ?? false,
    canViewStats: channelFull.canViewStats ?? false,
    blocked: channelFull.blocked ?? false,
    canDeleteChannel: channelFull.canDeleteChannel ?? false,
    antispam: channelFull.antispam ?? false,
    participantsHidden: channelFull.participantsHidden ?? false,
    translationsDisabled: channelFull.translationsDisabled ?? false,
    storiesPinnedAvailable: channelFull.storiesPinnedAvailable ?? false,
    viewForumAsMessages: channelFull.viewForumAsMessages ?? false,
    restrictedSponsored: channelFull.restrictedSponsored ?? false,
    canViewRevenue: channelFull.canViewRevenue ?? false,
    paidMediaAllowed: channelFull.paidMediaAllowed ?? false,
    canViewStarsRevenue: channelFull.canViewStarsRevenue ?? false,
    paidReactionsAvailable: channelFull.paidReactionsAvailable ?? false,
    stargiftsAvailable: extended.stargiftsAvailable ?? false,
    paidMessagesAvailable: extended.paidMessagesAvailable ?? false,
    id: buildMarkedPeerIdByType(channelFull.id.toString(), 'channel'),
    about: channelFull.about ?? '',
    participantsCount: channelFull.participantsCount,
    adminsCount: channelFull.adminsCount,
    kickedCount: channelFull.kickedCount,
    bannedCount: channelFull.bannedCount,
    onlineCount: channelFull.onlineCount,
    readInboxMaxId: channelFull.readInboxMaxId ?? 0,
    readOutboxMaxId: channelFull.readOutboxMaxId ?? 0,
    unreadCount: channelFull.unreadCount ?? 0,
    chatPhoto: convertTypePhoto(channelFull.chatPhoto)!,
    notifySettings: convertTypePeerNotifySettings(channelFull.notifySettings),
    exportedInvite: convertTypeExportedChatInvite(channelFull.exportedInvite),
    botInfo: (channelFull.botInfo?.map(convertTypeBotInfo).filter(Boolean) ??
      []) as TypeBotInfo[],
    migratedFromChatId: channelFull.migratedFromChatId
      ? buildMarkedPeerIdByType(channelFull.migratedFromChatId.toString(), 'chat')
      : undefined,
    migratedFromMaxId: channelFull.migratedFromMaxId,
    pinnedMsgId: channelFull.pinnedMsgId,
    stickerset: convertTypeStickerSet(channelFull.stickerset),
    availableMinId: channelFull.availableMinId,
    folderId: channelFull.folderId,
    linkedChatId: channelFull.linkedChatId
      ? buildMarkedPeerIdByType(channelFull.linkedChatId.toString(), 'channel')
      : undefined,
    location: convertTypeChannelLocation(channelFull.location),
    slowmodeSeconds: channelFull.slowmodeSeconds,
    slowmodeNextSendDate: channelFull.slowmodeNextSendDate,
    statsDc: channelFull.statsDc,
    pts: channelFull.pts ?? 0,
    call: convertTypeInputGroupCall(channelFull.call),
    ttlPeriod: channelFull.ttlPeriod,
    pendingSuggestions: channelFull.pendingSuggestions,
    groupcallDefaultJoinAs: channelFull.groupcallDefaultJoinAs
      ? convertTypePeer(channelFull.groupcallDefaultJoinAs)
      : undefined,
    themeEmoticon: channelFull.themeEmoticon,
    requestsPending: channelFull.requestsPending,
    recentRequesters: channelFull.recentRequesters?.map((id) => id.toString()),
    defaultSendAs: channelFull.defaultSendAs
      ? convertTypePeer(channelFull.defaultSendAs)
      : undefined,
    availableReactions: convertTypeChatReactions(channelFull.availableReactions),
    reactionsLimit: channelFull.reactionsLimit,
    stories: convertTypePeerStories(channelFull.stories),
    wallpaper: convertTypeWallPaper(channelFull.wallpaper),
    boostsApplied: channelFull.boostsApplied,
    boostsUnrestrict: channelFull.boostsUnrestrict,
    emojiset: convertTypeStickerSet(channelFull.emojiset),
    botVerification: convertTypeBotVerification(extended.botVerification),
    stargiftsCount: extended.stargiftsCount,
    sendPaidMessagesStars:
      extended.sendPaidMessagesStars != null
        ? extended.sendPaidMessagesStars.toString()
        : undefined,
    mainTab: convertTypeProfileTab(extended.mainTab),
  };
};
