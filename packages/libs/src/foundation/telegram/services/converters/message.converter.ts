import { Api } from '@telegenie/teleproto';
import { buildMarkedPeerIdByType } from '../../helpers';
import type {
  Channel,
  Chat,
  MessageActionBoostApply,
  MessageActionBotAllowed,
  MessageActionChannelCreate,
  MessageActionChannelMigrateFrom,
  MessageActionChatAddUser,
  MessageActionChatCreate,
  MessageActionChatDeleteUser,
  MessageActionChatEditPhoto,
  MessageActionChatEditTitle,
  MessageActionChatJoinedByLink,
  MessageActionChatMigrateTo,
  MessageActionCustomAction,
  MessageActionGameScore,
  MessageActionGeoProximityReached,
  MessageActionGiftCode,
  MessageActionGiftPremium,
  MessageActionGiftStars,
  MessageActionGiveawayLaunch,
  MessageActionGiveawayResults,
  MessageActionGroupCall,
  MessageActionGroupCallScheduled,
  MessageActionInviteToGroupCall,
  MessageActionPaymentRefunded,
  MessageActionPaymentSent,
  MessageActionPaymentSentMe,
  MessageActionPhoneCall,
  MessageActionPrizeStars,
  MessageActionRequestedPeer,
  MessageActionRequestedPeerSentMe,
  MessageActionSecureValuesSent,
  MessageActionSecureValuesSentMe,
  MessageActionSetChatTheme,
  MessageActionSetChatWallPaper,
  MessageActionSetMessagesTTL,
  MessageActionStarGift,
  MessageActionStarGiftUnique,
  MessageActionSuggestProfilePhoto,
  MessageActionTopicCreate,
  MessageActionTopicEdit,
  MessageActionWebViewDataSent,
  MessageActionWebViewDataSentMe,
  MessageEmpty,
  MessageReplyHeader,
  RequestedPeerChannel,
  RequestedPeerChat,
  RequestedPeerUser,
  TypeDocument,
  TypeMessageAction,
  TypeMessageEntity,
  TypeMessageFwdHeader,
  TypeMessageMedia,
  TypeMessageReactions,
  TypeMessageReplies,
  TypePaymentCharge,
  TypeReplyMarkup,
  TypeRequestedPeer,
  TypeRestrictionReason,
} from '../../types/api-types';
import type { Message, MessageReactionsList, MessageService } from '../../types/message';
import { convertChannel, convertChat, convertTypeReaction } from './chat.converter';
import { convertTypePeer } from './common.converter';
import { convertTypeMessageEntity } from './input.converter';
import { convertTypeWebPage } from './media.converter';
import { convertTypeDocument, convertTypePhoto, convertUser } from './user.converter';

// Converter for MessageEmpty
export const convertMessageEmpty = (message: Api.MessageEmpty): MessageEmpty => {
  return {
    id: message.id,
    peerId: message.peerId ? convertTypePeer(message.peerId) : undefined,
  };
};

// Converter for MessageService
export const convertMessageService = (message: Api.MessageService): MessageService => {
  return {
    // Flag-based optional fields
    out: message.out ?? false,
    mentioned: message.mentioned ?? false,
    media_unread: message.mediaUnread ?? false,
    silent: message.silent ?? false,
    post: message.post ?? false,
    legacy: message.legacy ?? false,

    // Required fields
    id: message.id,
    from_id: message.fromId ? convertTypePeer(message.fromId) : undefined,
    peer_id: convertTypePeer(message.peerId),
    reply_to: message.replyTo ? convertMessageReplyHeader(message.replyTo) : undefined,
    date: message.date,
    action: convertMessageAction(message.action),

    // Optional fields
    ttl_period: message.ttlPeriod,
    ...(messageReactionsArePossible(message) ? { reactionsArePossible: true as const } : {}),
  };
};

function messageReactionsArePossible(message: Api.MessageService): boolean {
  return (
    'reactionsArePossible' in message &&
    !!(message as Api.MessageService & { reactionsArePossible?: boolean }).reactionsArePossible
  );
}

// Converter for Message
export const convertMessage = (message: Api.Message): Message => {
  return {
    // Flag-based optional fields
    out: message.out ?? false,
    mentioned: message.mentioned ?? false,
    media_unread: message.mediaUnread ?? false,
    silent: message.silent ?? false,
    post: message.post ?? false,
    from_scheduled: message.fromScheduled ?? false,
    legacy: message.legacy ?? false,
    edit_hide: message.editHide ?? false,
    pinned: message.pinned ?? false,
    noforwards: message.noforwards ?? false,
    invert_media: message.invertMedia ?? false,

    // Required fields
    id: message.id,
    date: message.date,
    message: message.message ?? '',
    peer_id: convertTypePeer(message.peerId),

    // Optional fields based on flags
    from_id: message.fromId ? convertTypePeer(message.fromId) : undefined,
    fwd_from: message.fwdFrom ? convertMessageFwdHeader(message.fwdFrom) : undefined,
    via_bot_id: message.viaBotId?.toString(),
    reply_to: message.replyTo ? convertMessageReplyHeader(message.replyTo) : undefined,
    media: message.media ? convertMessageMedia(message.media) : undefined,
    reply_markup: message.replyMarkup ? convertReplyMarkup(message.replyMarkup) : undefined,
    entities: message.entities?.map(convertTypeMessageEntity).filter(Boolean) as any[],
    views: message.views,
    forwards: message.forwards,
    replies: message.replies ? convertMessageReplies(message.replies) : undefined,
    edit_date: message.editDate,
    post_author: message.postAuthor,
    grouped_id: message.groupedId?.toString(),
    reactions: message.reactions ? convertMessageReactions(message.reactions) : undefined,
    restriction_reason: message.restrictionReason
      ?.map(convertRestrictionReason)
      .filter(Boolean) as any[],
    ttl_period: message.ttlPeriod,
  };
};

// Helper converter functions (simplified versions - these would need full implementation)
const convertMessageReplyHeader = (replyTo: Api.MessageReplyHeader): MessageReplyHeader => {
  return {
    replyToScheduled: replyTo.replyToScheduled ?? false,
    forumTopic: replyTo.forumTopic ?? false,
    quote: replyTo.quote ?? false,
    replyToMsgId: replyTo.replyToMsgId,
    replyToPeerId: replyTo.replyToPeerId ? convertTypePeer(replyTo.replyToPeerId) : undefined,
    replyFrom: replyTo.replyFrom ? convertMessageFwdHeader(replyTo.replyFrom) : undefined,
    replyMedia: replyTo.replyMedia ? convertMessageMedia(replyTo.replyMedia) : undefined,
    replyToTopId: replyTo.replyToTopId,
    quoteText: replyTo.quoteText,
    quoteEntities: replyTo.quoteEntities
      ?.map(convertTypeMessageEntity)
      .filter(Boolean) as TypeMessageEntity[],
    quoteOffset: replyTo.quoteOffset,
  };
};

const convertMessageFwdHeader = (
  fwdFrom: Api.TypeMessageFwdHeader,
): TypeMessageFwdHeader | undefined => {
  if (!fwdFrom) {
    return undefined;
  }

  return {
    imported: fwdFrom.imported ?? false,
    savedOut: fwdFrom.savedOut ?? false,
    fromId: fwdFrom.fromId ? convertTypePeer(fwdFrom.fromId) : undefined,
    fromName: fwdFrom.fromName,
    date: fwdFrom.date,
    channelPost: fwdFrom.channelPost,
    postAuthor: fwdFrom.postAuthor,
    savedFromPeer: fwdFrom.savedFromPeer ? convertTypePeer(fwdFrom.savedFromPeer) : undefined,
    savedFromMsgId: fwdFrom.savedFromMsgId,
    savedFromId: fwdFrom.savedFromId ? convertTypePeer(fwdFrom.savedFromId) : undefined,
    savedFromName: fwdFrom.savedFromName,
    savedDate: fwdFrom.savedDate,
    psaType: fwdFrom.psaType,
  };
};

// Individual converter functions for each message action type
const convertMessageActionChatCreate = (
  action: Api.MessageActionChatCreate,
): MessageActionChatCreate => {
  return {
    title: action.title,
    users: action.users.map((id) => id.toString()),
  };
};

const convertMessageActionChatEditTitle = (
  action: Api.MessageActionChatEditTitle,
): MessageActionChatEditTitle => {
  return {
    title: action.title,
  };
};

const convertMessageActionChatEditPhoto = (
  action: Api.MessageActionChatEditPhoto,
): MessageActionChatEditPhoto => {
  return {
    photo: action.photo as any, // TypePhoto conversion would need separate implementation
  };
};

const convertMessageActionChatAddUser = (
  action: Api.MessageActionChatAddUser,
): MessageActionChatAddUser => {
  return {
    users: action.users.map((id) => id.toString()),
  };
};

const convertMessageActionChatDeleteUser = (
  action: Api.MessageActionChatDeleteUser,
): MessageActionChatDeleteUser => {
  return {
    userId: action.userId.toString(),
  };
};

const convertMessageActionChatJoinedByLink = (
  action: Api.MessageActionChatJoinedByLink,
): MessageActionChatJoinedByLink => {
  return {
    inviterId: action.inviterId.toString(),
  };
};

const convertMessageActionChannelCreate = (
  action: Api.MessageActionChannelCreate,
): MessageActionChannelCreate => {
  return {
    title: action.title,
  };
};

const convertMessageActionChatMigrateTo = (
  action: Api.MessageActionChatMigrateTo,
): MessageActionChatMigrateTo => {
  return {
    channelId: action.channelId.toString(),
  };
};

const convertMessageActionChannelMigrateFrom = (
  action: Api.MessageActionChannelMigrateFrom,
): MessageActionChannelMigrateFrom => {
  return {
    title: action.title,
    chatId: action.chatId.toString(),
  };
};

const convertMessageActionGameScore = (
  action: Api.MessageActionGameScore,
): MessageActionGameScore => {
  return {
    gameId: action.gameId.toString(),
    score: action.score,
  };
};

const convertMessageActionPaymentSentMe = (
  action: Api.MessageActionPaymentSentMe,
): MessageActionPaymentSentMe => {
  return {
    recurringInit: action.recurringInit ?? false,
    recurringUsed: action.recurringUsed ?? false,
    currency: action.currency,
    totalAmount: action.totalAmount.toString(),
    payload: action.payload,
    charge: convertMessageActionPaymentCharge(action.charge),
  };
};

const convertMessageActionPaymentCharge = (action: Api.TypePaymentCharge): TypePaymentCharge => {
  return {
    id: action.id,
    providerChargeId: action.providerChargeId,
  };
};

const convertMessageActionPaymentSent = (
  action: Api.MessageActionPaymentSent,
): MessageActionPaymentSent => {
  return {
    recurringInit: action.recurringInit ?? false,
    recurringUsed: action.recurringUsed ?? false,
    currency: action.currency,
    totalAmount: action.totalAmount.toString(),
    invoiceSlug: action.invoiceSlug,
  };
};

const convertMessageActionPhoneCall = (
  action: Api.MessageActionPhoneCall,
): MessageActionPhoneCall => {
  return {
    video: action.video ?? false,
    callId: action.callId.toString(),
    reason: action.reason as any, // TypePhoneCallDiscardReason conversion would need separate implementation
    duration: action.duration,
  };
};

const convertMessageActionCustomAction = (
  action: Api.MessageActionCustomAction,
): MessageActionCustomAction => {
  return {
    message: action.message,
  };
};

const convertMessageActionBotAllowed = (
  action: Api.MessageActionBotAllowed,
): MessageActionBotAllowed => {
  return {
    attachMenu: action.attachMenu ?? false,
    fromRequest: action.fromRequest ?? false,
    domain: action.domain,
    app: action.app as any, // TypeBotApp conversion would need separate implementation
  };
};

const convertMessageActionSecureValuesSentMe = (
  action: Api.MessageActionSecureValuesSentMe,
): MessageActionSecureValuesSentMe => {
  return {
    values: action.values as any[], // TypeSecureValue conversion would need separate implementation
    credentials: action.credentials as any, // TypeSecureCredentialsEncrypted conversion would need separate implementation
  };
};

const convertMessageActionSecureValuesSent = (
  action: Api.MessageActionSecureValuesSent,
): MessageActionSecureValuesSent => {
  return {
    types: action.types as any[], // TypeSecureValueType conversion would need separate implementation
  };
};

const convertMessageActionContactSignUp = (): TypeMessageAction => {
  return {} as TypeMessageAction;
};

const convertMessageActionGeoProximityReached = (
  action: Api.MessageActionGeoProximityReached,
): MessageActionGeoProximityReached => {
  return {
    fromId: convertTypePeer(action.fromId),
    toId: convertTypePeer(action.toId),
    distance: action.distance,
  };
};

const convertMessageActionGroupCall = (
  action: Api.MessageActionGroupCall,
): MessageActionGroupCall => {
  return {
    call: action.call as any, // TypeInputGroupCall conversion would need separate implementation
    duration: action.duration,
  };
};

const convertMessageActionInviteToGroupCall = (
  action: Api.MessageActionInviteToGroupCall,
): MessageActionInviteToGroupCall => {
  return {
    call: action.call as any, // TypeInputGroupCall conversion would need separate implementation
    users: action.users.map((id) => id.toString()),
  };
};

const convertMessageActionSetMessagesTTL = (
  action: Api.MessageActionSetMessagesTTL,
): MessageActionSetMessagesTTL => {
  return {
    period: action.period,
    autoSettingFrom: action.autoSettingFrom?.toString(),
  };
};

const convertMessageActionGroupCallScheduled = (
  action: Api.MessageActionGroupCallScheduled,
): MessageActionGroupCallScheduled => {
  return {
    call: action.call as any, // TypeInputGroupCall conversion would need separate implementation
    scheduleDate: action.scheduleDate,
  };
};

const convertMessageActionSetChatTheme = (
  action: Api.MessageActionSetChatTheme,
): MessageActionSetChatTheme => {
  const theme = action.theme;
  const emoticon =
    theme instanceof Api.ChatTheme
      ? theme.emoticon
      : typeof theme === 'object' && theme && 'emoticon' in theme
        ? String((theme as { emoticon?: string }).emoticon ?? '')
        : '';
  return { emoticon };
};

const convertMessageActionChatJoinedByRequest = (): TypeMessageAction => {
  return {} as TypeMessageAction;
};

const convertMessageActionWebViewDataSentMe = (
  action: Api.MessageActionWebViewDataSentMe,
): MessageActionWebViewDataSentMe => {
  return {
    text: action.text,
    data: action.data,
  };
};

const convertMessageActionWebViewDataSent = (
  action: Api.MessageActionWebViewDataSent,
): MessageActionWebViewDataSent => {
  return {
    text: action.text,
  };
};

const convertMessageActionGiftPremium = (
  action: Api.MessageActionGiftPremium,
): MessageActionGiftPremium => {
  return {
    currency: action.currency,
    amount: action.amount.toString(),
    months: action.days,
    cryptoCurrency: action.cryptoCurrency,
    cryptoAmount: action.cryptoAmount?.toString(),
  };
};

const convertMessageActionTopicCreate = (
  action: Api.MessageActionTopicCreate,
): MessageActionTopicCreate => {
  return {
    title: action.title,
    iconColor: action.iconColor,
    iconEmojiId: action.iconEmojiId?.toString(),
  };
};

const convertMessageActionTopicEdit = (
  action: Api.MessageActionTopicEdit,
): MessageActionTopicEdit => {
  return {
    title: action.title,
    iconEmojiId: action.iconEmojiId?.toString(),
    closed: action.closed,
    hidden: action.hidden,
  };
};

const convertMessageActionSuggestProfilePhoto = (
  action: Api.MessageActionSuggestProfilePhoto,
): MessageActionSuggestProfilePhoto => {
  return {
    photo: convertTypePhoto(action.photo)!,
  };
};

const convertMessageActionSetChatWallPaper = (
  action: Api.MessageActionSetChatWallPaper,
): MessageActionSetChatWallPaper => {
  return {
    same: action.same ?? false,
    forBoth: action.forBoth ?? false,
    wallpaper: action.wallpaper as any, // TypeWallPaper conversion would need separate implementation
  };
};

const convertMessageActionGiftCode = (action: Api.MessageActionGiftCode): MessageActionGiftCode => {
  return {
    viaGiveaway: action.viaGiveaway ?? false,
    unclaimed: action.unclaimed ?? false,
    boostPeer: action.boostPeer ? convertTypePeer(action.boostPeer) : undefined,
    months: action.days,
    slug: action.slug,
    currency: action.currency,
    amount: action.amount?.toString(),
    cryptoCurrency: action.cryptoCurrency,
    cryptoAmount: action.cryptoAmount?.toString(),
  };
};

const convertMessageActionGiveawayLaunch = (
  action: Api.MessageActionGiveawayLaunch,
): MessageActionGiveawayLaunch => {
  return {
    stars: action.stars?.toString(),
  };
};

const convertMessageActionGiveawayResults = (
  action: Api.MessageActionGiveawayResults,
): MessageActionGiveawayResults => {
  return {
    stars: action.stars ?? false,
    winnersCount: action.winnersCount,
    unclaimedCount: action.unclaimedCount,
  };
};

const convertMessageActionBoostApply = (
  action: Api.MessageActionBoostApply,
): MessageActionBoostApply => {
  return {
    type: 'boostApply',
    boosts: action.boosts,
  };
};

const convertMessageActionRequestedPeerSentMe = (
  action: Api.MessageActionRequestedPeerSentMe,
): MessageActionRequestedPeerSentMe => {
  return {
    buttonId: action.buttonId,
    peers: action.peers.map(convertRequestedPeer),
  };
};

const convertMessageActionRequestedPeer = (
  action: Api.MessageActionRequestedPeer,
): MessageActionRequestedPeer => {
  return {
    buttonId: action.buttonId,
    peers: action.peers.map(convertTypePeer),
  };
};

const convertRequestedPeer = (requestedPeer: Api.TypeRequestedPeer): TypeRequestedPeer => {
  if (requestedPeer instanceof Api.RequestedPeerUser) {
    return {
      userId: buildMarkedPeerIdByType(requestedPeer.userId.toString(), 'user'),
      firstName: requestedPeer.firstName,
      lastName: requestedPeer.lastName,
      username: requestedPeer.username,
      photo: requestedPeer.photo ? convertTypePhoto(requestedPeer.photo) : undefined,
    } as RequestedPeerUser;
  }
  if (requestedPeer instanceof Api.RequestedPeerChat) {
    return {
      chatId: buildMarkedPeerIdByType(requestedPeer.chatId.toString(), 'chat'),
      title: requestedPeer.title,
      photo: requestedPeer.photo ? convertTypePhoto(requestedPeer.photo) : undefined,
    } as RequestedPeerChat;
  }
  if (requestedPeer instanceof Api.RequestedPeerChannel) {
    return {
      channelId: buildMarkedPeerIdByType(requestedPeer.channelId.toString(), 'channel'),
      title: requestedPeer.title,
      username: requestedPeer.username,
      photo: requestedPeer.photo ? convertTypePhoto(requestedPeer.photo) : undefined,
    } as RequestedPeerChannel;
  }
  throw new Error('Invalid requested peer');
};

const convertMessageActionPaymentRefunded = (
  action: Api.MessageActionPaymentRefunded,
): MessageActionPaymentRefunded => {
  return {
    peer: convertTypePeer(action.peer),
    currency: action.currency,
    totalAmount: action.totalAmount.toString(),
    payload: action.payload,
    charge: convertMessageActionPaymentCharge(action.charge),
  };
};

const convertMessageActionGiftStars = (
  action: Api.MessageActionGiftStars,
): MessageActionGiftStars => {
  return {
    currency: action.currency,
    amount: action.amount.toString(),
    stars: action.stars.toString(),
    cryptoCurrency: action.cryptoCurrency,
    cryptoAmount: action.cryptoAmount?.toString(),
  };
};

const convertMessageActionPrizeStars = (
  action: Api.MessageActionPrizeStars,
): MessageActionPrizeStars => {
  return {
    unclaimed: action.unclaimed ?? false,
    stars: action.stars.toString(),
    transactionId: action.transactionId,
    boostPeer: convertTypePeer(action.boostPeer),
    giveawayMsgId: action.giveawayMsgId,
  };
};

const convertMessageActionStarGift = (action: Api.MessageActionStarGift): MessageActionStarGift => {
  return {
    nameHidden: action.nameHidden ?? false,
    saved: action.saved ?? false,
    converted: action.converted ?? false,
    upgraded: (action as any).upgraded ?? false,
    fromId: (action as any).fromId ? convertTypePeer((action as any).fromId) : undefined,
    gift: action.gift as any, // Add required gift property
    // Note: Some properties may not exist on the actual API type
    // toId: action.toId ? convertTypePeer(action.toId) : undefined,
    // stars: action.stars?.toString(),
    // currency: action.currency,
    // amount: action.amount?.toString(),
    // cryptoCurrency: action.cryptoCurrency,
    // cryptoAmount: action.cryptoAmount?.toString(),
    // transactionId: action.transactionId,
  };
};

const convertMessageActionStarGiftUnique = (action: any): MessageActionStarGiftUnique => {
  return {
    upgrade: (action as any).upgrade ?? false,
    transferred: (action as any).transferred ?? false,
    saved: (action as any).saved ?? false,
    refunded: (action as any).refunded ?? false,
    fromId: (action as any).fromId ? convertTypePeer((action as any).fromId) : undefined,
    gift: action.gift as any, // Add required gift property
    // Note: Some properties may not exist on the actual API type
    // toId: action.toId ? convertTypePeer(action.toId) : undefined,
    // stars: action.stars?.toString(),
    // currency: action.currency,
    // amount: action.amount?.toString(),
    // cryptoCurrency: action.cryptoCurrency,
    // cryptoAmount: action.cryptoAmount?.toString(),
    // transactionId: action.transactionId,
  };
};

// Main converter function that delegates to specific converters
const convertMessageAction = (action: Api.TypeMessageAction): TypeMessageAction => {
  if (action instanceof Api.MessageActionEmpty) {
    return {} as TypeMessageAction;
  } else if (action instanceof Api.MessageActionChatCreate) {
    return convertMessageActionChatCreate(action);
  } else if (action instanceof Api.MessageActionChatEditTitle) {
    return convertMessageActionChatEditTitle(action);
  } else if (action instanceof Api.MessageActionChatEditPhoto) {
    return convertMessageActionChatEditPhoto(action);
  } else if (action instanceof Api.MessageActionChatDeletePhoto) {
    return {} as TypeMessageAction;
  } else if (action instanceof Api.MessageActionChatAddUser) {
    return convertMessageActionChatAddUser(action);
  } else if (action instanceof Api.MessageActionChatDeleteUser) {
    return convertMessageActionChatDeleteUser(action);
  } else if (action instanceof Api.MessageActionChatJoinedByLink) {
    return convertMessageActionChatJoinedByLink(action);
  } else if (action instanceof Api.MessageActionChannelCreate) {
    return convertMessageActionChannelCreate(action);
  } else if (action instanceof Api.MessageActionChatMigrateTo) {
    return convertMessageActionChatMigrateTo(action);
  } else if (action instanceof Api.MessageActionChannelMigrateFrom) {
    return convertMessageActionChannelMigrateFrom(action);
  } else if (action instanceof Api.MessageActionPinMessage) {
    return { type: 'pinMessage', isPin: true } as TypeMessageAction;
  } else if (action instanceof Api.MessageActionHistoryClear) {
    return {} as TypeMessageAction;
  } else if (action instanceof Api.MessageActionGameScore) {
    return convertMessageActionGameScore(action);
  } else if (action instanceof Api.MessageActionPaymentSentMe) {
    return convertMessageActionPaymentSentMe(action);
  } else if (action instanceof Api.MessageActionPaymentSent) {
    return convertMessageActionPaymentSent(action);
  } else if (action instanceof Api.MessageActionPhoneCall) {
    return convertMessageActionPhoneCall(action);
  } else if (action instanceof Api.MessageActionScreenshotTaken) {
    return {} as TypeMessageAction;
  } else if (action instanceof Api.MessageActionCustomAction) {
    return convertMessageActionCustomAction(action);
  } else if (action instanceof Api.MessageActionBotAllowed) {
    return convertMessageActionBotAllowed(action);
  } else if (action instanceof Api.MessageActionSecureValuesSentMe) {
    return convertMessageActionSecureValuesSentMe(action);
  } else if (action instanceof Api.MessageActionSecureValuesSent) {
    return convertMessageActionSecureValuesSent(action);
  } else if (action instanceof Api.MessageActionContactSignUp) {
    return convertMessageActionContactSignUp();
  } else if (action instanceof Api.MessageActionGeoProximityReached) {
    return convertMessageActionGeoProximityReached(action);
  } else if (action instanceof Api.MessageActionGroupCall) {
    return convertMessageActionGroupCall(action);
  } else if (action instanceof Api.MessageActionInviteToGroupCall) {
    return convertMessageActionInviteToGroupCall(action);
  } else if (action instanceof Api.MessageActionSetMessagesTTL) {
    return convertMessageActionSetMessagesTTL(action);
  } else if (action instanceof Api.MessageActionGroupCallScheduled) {
    return convertMessageActionGroupCallScheduled(action);
  } else if (action instanceof Api.MessageActionSetChatTheme) {
    return convertMessageActionSetChatTheme(action);
  } else if (action instanceof Api.MessageActionChatJoinedByRequest) {
    return convertMessageActionChatJoinedByRequest();
  } else if (action instanceof Api.MessageActionWebViewDataSentMe) {
    return convertMessageActionWebViewDataSentMe(action);
  } else if (action instanceof Api.MessageActionWebViewDataSent) {
    return convertMessageActionWebViewDataSent(action);
  } else if (action instanceof Api.MessageActionGiftPremium) {
    return convertMessageActionGiftPremium(action);
  } else if (action instanceof Api.MessageActionTopicCreate) {
    return convertMessageActionTopicCreate(action);
  } else if (action instanceof Api.MessageActionTopicEdit) {
    return convertMessageActionTopicEdit(action);
  } else if (action instanceof Api.MessageActionSuggestProfilePhoto) {
    return convertMessageActionSuggestProfilePhoto(action);
  } else if (action instanceof Api.MessageActionRequestedPeer) {
    return convertMessageActionRequestedPeer(action);
  } else if (action instanceof Api.MessageActionSetChatWallPaper) {
    return convertMessageActionSetChatWallPaper(action);
  } else if (action instanceof Api.MessageActionGiftCode) {
    return convertMessageActionGiftCode(action);
  } else if (action instanceof Api.MessageActionGiveawayLaunch) {
    return convertMessageActionGiveawayLaunch(action);
  } else if (action instanceof Api.MessageActionGiveawayResults) {
    return convertMessageActionGiveawayResults(action);
  } else if (action instanceof Api.MessageActionBoostApply) {
    return convertMessageActionBoostApply(action);
  } else if (action instanceof Api.MessageActionRequestedPeerSentMe) {
    return convertMessageActionRequestedPeerSentMe(action);
  } else if (action instanceof Api.MessageActionPaymentRefunded) {
    return convertMessageActionPaymentRefunded(action);
  } else if (action instanceof Api.MessageActionGiftStars) {
    return convertMessageActionGiftStars(action);
  } else if (action instanceof Api.MessageActionPrizeStars) {
    return convertMessageActionPrizeStars(action);
  } else if (action instanceof Api.MessageActionStarGift) {
    return convertMessageActionStarGift(action);
  } else if ((action as any).className === 'MessageActionStarGiftUnique') {
    return convertMessageActionStarGiftUnique(action);
  }

  // Fallback for unknown action types
  return action as any;
};

function documentMediaFlags(document: TypeDocument | undefined) {
  const attributes = document && 'attributes' in document ? document.attributes : [];
  let video = false;
  let round = false;
  let voice = false;
  if (
    document &&
    'mimeType' in document &&
    typeof document.mimeType === 'string' &&
    document.mimeType.toLowerCase().startsWith('video/')
  ) {
    video = true;
  }
  for (const attr of attributes) {
    if (!attr || typeof attr !== 'object') continue;
    if ('voice' in attr && (attr as { voice?: boolean }).voice) voice = true;
    const isVideoAttr =
      'roundMessage' in attr ||
      'supportsStreaming' in attr ||
      'videoCodec' in attr ||
      (attr as { className?: string }).className === 'DocumentAttributeVideo' ||
      ('duration' in attr && ('w' in attr || 'h' in attr) && !('voice' in attr));
    if (isVideoAttr) {
      video = true;
      if ('roundMessage' in attr && (attr as { roundMessage?: boolean }).roundMessage) round = true;
    }
  }
  return { video, round, voice };
}

const convertMessageMedia = (media: Api.TypeMessageMedia): TypeMessageMedia => {
  // Handle different types of message media
  if (media instanceof Api.MessageMediaEmpty) {
    return {} as TypeMessageMedia;
  } else if (media instanceof Api.MessageMediaPhoto) {
    return {
      spoiler: media.spoiler ?? false,
      photo: convertTypePhoto(media.photo),
      ttlSeconds: media.ttlSeconds,
    };
  } else if (media instanceof Api.MessageMediaGeo) {
    return {
      geo: media.geo as any, // TypeGeoPoint conversion would need separate implementation
    };
  } else if (media instanceof Api.MessageMediaContact) {
    return {
      phoneNumber: media.phoneNumber,
      firstName: media.firstName,
      lastName: media.lastName,
      vcard: media.vcard,
      userId: media.userId.toString(),
    };
  } else if (media instanceof Api.MessageMediaUnsupported) {
    return {} as TypeMessageMedia;
  } else if (media instanceof Api.MessageMediaDocument) {
    const document = convertTypeDocument(media.document);
    const flags = documentMediaFlags(document);
    return {
      nopremium: media.nopremium,
      spoiler: media.spoiler ?? false,
      video: Boolean(media.video || flags.video),
      round: Boolean(media.round || flags.round),
      voice: Boolean(media.voice || flags.voice),
      document,
      altDocuments: media.altDocuments
        ?.map((item) => convertTypeDocument(item))
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      videoCover: convertTypePhoto(media.videoCover),
      videoTimestamp: media.videoTimestamp,
      ttlSeconds: media.ttlSeconds,
    };
  } else if (media instanceof Api.MessageMediaWebPage) {
    return {
      forceLargeMedia: media.forceLargeMedia,
      forceSmallMedia: media.forceSmallMedia,
      manual: media.manual,
      safe: media.safe,
      webpage: convertTypeWebPage(media.webpage)!,
    };
  } else if (media instanceof Api.MessageMediaVenue) {
    return {
      geo: media.geo as any, // TypeGeoPoint conversion would need separate implementation
      title: media.title,
      address: media.address,
      provider: media.provider,
      venueId: media.venueId,
      venueType: media.venueType,
    };
  } else if (media instanceof Api.MessageMediaGame) {
    return {
      game: media.game as any, // TypeGame conversion would need separate implementation
    };
  } else if (media instanceof Api.MessageMediaInvoice) {
    return {
      shippingAddressRequested: media.shippingAddressRequested ?? false,
      test: media.test ?? false,
      title: media.title,
      description: media.description,
      photo: media.photo as any, // TypeWebDocument conversion would need separate implementation
      currency: media.currency,
      totalAmount: media.totalAmount.toString(),
      startParam: media.startParam,
      receiptMsgId: media.receiptMsgId,
      extendedMedia: media.extendedMedia as any, // TypeMessageExtendedMedia conversion would need separate implementation
    };
  } else if (media instanceof Api.MessageMediaGeoLive) {
    return {
      geo: media.geo as any, // TypeGeoPoint conversion would need separate implementation
      heading: media.heading,
      period: media.period,
      proximityNotificationRadius: media.proximityNotificationRadius,
    };
  } else if (media instanceof Api.MessageMediaPoll) {
    return {
      poll: media.poll as any, // TypePoll conversion would need separate implementation
      results: media.results as any, // TypePollResults conversion would need separate implementation
    };
  } else if (media instanceof Api.MessageMediaDice) {
    return {
      value: media.value,
      emoticon: media.emoticon,
    };
  } else if (media instanceof Api.MessageMediaStory) {
    return {
      peer: convertTypePeer(media.peer),
      id: media.id,
      story: media.story as any, // TypeStoryItem conversion would need separate implementation
    };
  } else if (media instanceof Api.MessageMediaGiveaway) {
    return {
      onlyNewSubscribers: media.onlyNewSubscribers ?? false,
      channels: media.channels?.map((channel) => channel.toString()) || [], // Add required channels property
      // Note: Some properties may not exist on the actual API type
      // viaGiveaway: media.viaGiveaway ?? false,
      // boostPeer: media.boostPeer ? convertTypePeer(media.boostPeer) : undefined,
      // additionalPeers: media.additionalPeers?.map((peer) => convertTypePeer(peer)),
      countriesIso2: media.countriesIso2,
      // randomId: media.randomId.toString(),
      untilDate: media.untilDate,
      quantity: media.quantity,
      months: media.months,
      // currency: media.currency,
      // amount: media.amount?.toString(),
      // cryptoCurrency: media.cryptoCurrency,
      // cryptoAmount: media.cryptoAmount?.toString(),
      prizeDescription: media.prizeDescription,
    };
  } else if (media instanceof Api.MessageMediaGiveawayResults) {
    return {
      onlyNewSubscribers: media.onlyNewSubscribers ?? false,
      channelId: media.channelId?.toString(), // Add required channelId property
      launchMsgId: media.launchMsgId, // Add required launchMsgId property
      winners: media.winners?.map((winner) => winner.toString()) || [], // Add required winners property
      // Note: Some properties may not exist on the actual API type
      // viaGiveaway: media.viaGiveaway ?? false,
      // boostPeer: media.boostPeer ? convertTypePeer(media.boostPeer) : undefined,
      // additionalPeers: media.additionalPeers?.map((peer) => convertTypePeer(peer)),
      // randomId: media.randomId.toString(),
      untilDate: media.untilDate,
      // quantity: media.quantity,
      months: media.months,
      // currency: media.currency,
      // amount: media.amount?.toString(),
      // cryptoCurrency: media.cryptoCurrency,
      // cryptoAmount: media.cryptoAmount?.toString(),
      prizeDescription: media.prizeDescription,
      winnersCount: media.winnersCount,
      unclaimedCount: media.unclaimedCount,
      // winners: media.winners?.map((winner) => convertTypePeer(winner)),
    };
  } else if (media instanceof Api.MessageMediaPaidMedia) {
    return {
      // Note: Some properties may not exist on the actual API type
      // currency: media.currency,
      // amount: media.amount.toString(),
      // stars: media.stars?.toString(),
      // cryptoCurrency: media.cryptoCurrency,
      // cryptoAmount: media.cryptoAmount?.toString(),
      // media: media.media as any, // TypeMessageMedia conversion would need separate implementation
    };
  }

  // Fallback for unknown media types
  return media as any;
};

const convertReplyMarkup = (markup: Api.TypeReplyMarkup): TypeReplyMarkup => {
  // Handle different types of reply markup
  if (markup instanceof Api.ReplyKeyboardHide) {
    return {
      selective: markup.selective ?? false,
    };
  } else if (markup instanceof Api.ReplyKeyboardForceReply) {
    return {
      singleUse: markup.singleUse ?? false,
      selective: markup.selective ?? false,
      placeholder: markup.placeholder,
    };
  } else if (markup instanceof Api.ReplyKeyboardMarkup) {
    return {
      resize: markup.resize ?? false,
      singleUse: markup.singleUse ?? false,
      selective: markup.selective ?? false,
      persistent: markup.persistent ?? false,
      // personal: markup.personal ?? false, // This property may not exist
      rows: markup.rows.map((row) => ({
        buttons: row.buttons.map((button) => ({
          text: button.text,
          // Map other properties as needed based on button type
        })),
      })),
    };
  } else if (markup instanceof Api.ReplyInlineMarkup) {
    return {
      rows: markup.rows.map((row) => ({
        buttons: row.buttons.map((button) => ({
          text: button.text,
          // Map other properties as needed based on button type
        })),
      })),
    };
  }

  // Fallback for unknown markup types
  return markup as any;
};

export const convertMessageReplies = (replies: Api.TypeMessageReplies): TypeMessageReplies => {
  return {
    comments: replies.comments ?? false,
    replies: replies.replies,
    repliesPts: replies.repliesPts,
    recentRepliers: replies.recentRepliers?.map((peer) => convertTypePeer(peer)),
    channelId: replies.channelId?.toString(),
    maxId: replies.maxId,
    readMaxId: replies.readMaxId,
  };
};

export const convertMessageReactions = (reactions: Api.MessageReactions): TypeMessageReactions => {
  const results = reactions.results.flatMap((result) => {
    const reaction = convertTypeReaction(result.reaction);
    if (!reaction || ('empty' in reaction && reaction.empty)) return [];
    return [
      {
        reaction,
        count: result.count,
        ...(result.chosenOrder != null ? { chosenOrder: result.chosenOrder } : {}),
      },
    ];
  });

  const recentReactions = reactions.recentReactions?.flatMap((recent) => {
    const reaction = convertTypeReaction(recent.reaction);
    if (!reaction || ('empty' in reaction && reaction.empty)) return [];
    return [
      {
        peerId: convertTypePeer(recent.peerId),
        reaction,
        unread: recent.unread ?? false,
        date: recent.date,
        big: recent.big ?? false,
        my: recent.my ?? false,
      },
    ];
  });

  return {
    min: reactions.min ?? false,
    canSeeList: reactions.canSeeList ?? false,
    reactionsAsTags: reactions.reactionsAsTags ?? false,
    results,
    recentReactions: recentReactions?.length ? recentReactions : undefined,
    topReactors: reactions.topReactors?.map((reactor) => ({
      peerId: reactor.peerId ? convertTypePeer(reactor.peerId) : undefined,
      count: reactor.count,
      top: reactor.top ?? false,
      my: reactor.my ?? false,
      anonymous: reactor.anonymous ?? false,
    })),
  };
};

export const convertMessageReactionsList = (
  list: Api.messages.MessageReactionsList,
): MessageReactionsList => {
  const reactions = list.reactions.flatMap((recent) => {
    const reaction = convertTypeReaction(recent.reaction);
    if (!reaction || ('empty' in reaction && reaction.empty)) return [];
    return [
      {
        peerId: convertTypePeer(recent.peerId),
        reaction,
        unread: recent.unread ?? false,
        date: recent.date,
        big: recent.big ?? false,
        my: recent.my ?? false,
      },
    ];
  });

  const chats: Array<Chat | Channel> = [];
  for (const chat of list.chats ?? []) {
    if (chat instanceof Api.Chat) chats.push(convertChat(chat));
    else if (chat instanceof Api.Channel) chats.push(convertChannel(chat));
  }

  return {
    count: list.count,
    reactions,
    chats,
    users: list.users?.map((user) => convertUser(user)) ?? [],
    nextOffset: list.nextOffset,
  };
};

const convertRestrictionReason = (reason: Api.TypeRestrictionReason): TypeRestrictionReason => {
  return {
    platform: reason.platform,
    reason: reason.reason,
    text: reason.text,
  };
};

export type PlainAvailableReaction = {
  emoticon: string;
  title: string;
  inactive?: boolean;
  premium?: boolean;
  staticIconId: string;
};

export function convertAvailableReaction(
  raw: Api.AvailableReaction,
): PlainAvailableReaction | null {
  if (!raw.reaction) return null;
  return {
    emoticon: raw.reaction.replace(/\uFE0F/g, ''),
    title: raw.title,
    inactive: raw.inactive,
    premium: raw.premium,
    staticIconId: raw.staticIcon ? String(raw.staticIcon.id) : '',
  };
}

function emoticonFromApiReaction(reaction: Api.TypeReaction): string | undefined {
  if (reaction instanceof Api.ReactionEmoji && reaction.emoticon) {
    return reaction.emoticon.replace(/\uFE0F/g, '');
  }
  return undefined;
}

export function emoticonsFromApiReactions(reactions: Api.TypeReaction[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const reaction of reactions) {
    const emoticon = emoticonFromApiReaction(reaction);
    if (!emoticon || seen.has(emoticon)) continue;
    seen.add(emoticon);
    out.push(emoticon);
  }
  return out;
}

export const convertMessages = (
  messages: Api.TypeMessage[],
): {
  messages: Message[];
  emptyMessages: MessageEmpty[];
  messageServices: MessageService[];
} => {
  const messagesArray: Message[] = [];
  const emptyMessages: MessageEmpty[] = [];
  const messageServices: MessageService[] = [];

  messages.forEach((message) => {
    if (message instanceof Api.MessageEmpty) {
      emptyMessages.push(convertMessageEmpty(message));
    } else if (message instanceof Api.MessageService) {
      messageServices.push(convertMessageService(message));
    } else if (message instanceof Api.Message) {
      messagesArray.push(convertMessage(message));
    }
  });

  return {
    messages: messagesArray,
    emptyMessages,
    messageServices,
  };
};
