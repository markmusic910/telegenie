import { Api } from '@telegenie/teleproto';
import { buildMarkedPeerIdByType } from '../../helpers';
import type {
  ChatPhoto,
  Dialog,
  DialogFolder,
  DraftMessage,
  Folder,
  InputPeerSelf,
  InputReplyToMessage,
  InputReplyToStory,
  PeerChannel,
  PeerChat,
  PeerUser,
  TypeInputPeer,
  TypeInputReplyTo,
  TypeNotificationSound,
  TypePeerNotifySettings,
} from '../../types/api-types';
import { convertTypeInputMedia } from './input.converter';
import { buildStrippedThumbDataUri } from './thumbnail.converter';

export const convertTypePeer = (
  peer: Api.TypePeer | Api.InputPeerEmpty | null | undefined,
): PeerUser | PeerChat | PeerChannel => {
  if (peer == null || typeof peer !== 'object') {
    throw new Error('Invalid peer');
  }
  if ('userId' in peer) {
    return {
      userId: buildMarkedPeerIdByType(peer?.userId.toString(), 'user'),
    };
  }
  if ('chatId' in peer) {
    return {
      chatId: buildMarkedPeerIdByType(peer?.chatId.toString(), 'chat'),
    };
  }
  if ('channelId' in peer) {
    return {
      channelId: buildMarkedPeerIdByType(peer?.channelId.toString(), 'channel'),
    };
  }
  throw new Error('Invalid peer');
};

export const convertTypeInputPeer = (inputPeer?: Api.TypeInputPeer): TypeInputPeer | undefined => {
  if (!inputPeer) {
    return undefined;
  }
  if (inputPeer instanceof Api.InputPeerEmpty) {
    return undefined;
  }
  if (inputPeer instanceof Api.InputPeerSelf) {
    return {
      self: true,
    };
  }
  if (inputPeer instanceof Api.InputPeerChat) {
    return {
      chatId: buildMarkedPeerIdByType(inputPeer.chatId?.toString(), 'chat'),
    };
  }
  if (inputPeer instanceof Api.InputPeerUser) {
    return {
      userId: buildMarkedPeerIdByType(inputPeer.userId?.toString(), 'user'),
      accessHash: inputPeer.accessHash?.toString(),
    };
  }
  if (inputPeer instanceof Api.InputPeerChannel) {
    return {
      channelId: buildMarkedPeerIdByType(inputPeer.channelId?.toString(), 'channel'),
      accessHash: inputPeer.accessHash?.toString(),
    };
  }
  if (inputPeer instanceof Api.InputPeerUserFromMessage) {
    if (!inputPeer.peer || inputPeer.peer instanceof Api.InputPeerEmpty) {
      return undefined;
    }
    return {
      // @ts-expect-error fix later
      peer: convertTypePeer(inputPeer.peer),
      msgId: inputPeer.msgId,
      userId: buildMarkedPeerIdByType(inputPeer.userId?.toString(), 'user'),
    };
  }
  if (inputPeer instanceof Api.InputPeerChannelFromMessage) {
    if (!inputPeer.peer || inputPeer.peer instanceof Api.InputPeerEmpty) {
      return undefined;
    }
    return {
      peer: convertTypePeer(inputPeer.peer as any) as Exclude<TypeInputPeer, InputPeerSelf>,
      msgId: inputPeer.msgId,
      channelId: buildMarkedPeerIdByType(inputPeer.channelId?.toString(), 'channel'),
    };
  }
};

export const convertTypeInputPeerExcludeSelf = (
  peer: Api.TypeInputPeer,
): Exclude<TypeInputPeer, InputPeerSelf> => {
  const result = convertTypeInputPeer(peer);
  if (!result) {
    throw new Error('Failed to convert TypeInputPeer');
  }

  // Handle InputPeerSelf case which is not in the input.ts TypeInputPeer union
  if ('self' in result && result.self === true) {
    throw new Error('InputPeerSelf is not supported in this context');
  }

  return result as Exclude<TypeInputPeer, InputPeerSelf>;
};

export const convertTypeChatPhoto = (chatPhoto?: Api.TypeChatPhoto): ChatPhoto | undefined => {
  if (!chatPhoto) {
    return undefined;
  }
  if (chatPhoto instanceof Api.ChatPhotoEmpty) {
    return undefined;
  }
  return {
    hasVideo: chatPhoto?.hasVideo ?? false,
    photoId: chatPhoto?.photoId?.toString(),
    strippedThumb: buildStrippedThumbDataUri(chatPhoto?.strippedThumb),
    dcId: chatPhoto?.dcId ?? 0,
  };
};

export const convertFolder = (folder: Api.Folder): Folder => {
  return {
    autofillNewBroadcasts: folder?.autofillNewBroadcasts ?? false,
    autofillPublicGroups: folder?.autofillPublicGroups ?? false,
    autofillNewCorrespondents: folder?.autofillNewCorrespondents ?? false,
    id: folder?.id ?? 0,
    title: folder?.title ?? '',
    photo: convertTypeChatPhoto(folder?.photo),
  };
};

export const convertDialogFolder = (dialogFolder: Api.DialogFolder): DialogFolder => {
  return {
    pinned: dialogFolder.pinned ?? false,
    folder: convertFolder(dialogFolder.folder),
    peer: convertTypePeer(dialogFolder.peer),
    topMessage: dialogFolder.topMessage ?? 0,
    unreadMutedPeersCount: dialogFolder.unreadMutedPeersCount ?? 0,
    unreadUnmutedPeersCount: dialogFolder.unreadUnmutedPeersCount ?? 0,
    unreadMutedMessagesCount: dialogFolder.unreadMutedMessagesCount ?? 0,
    unreadUnmutedMessagesCount: dialogFolder.unreadUnmutedMessagesCount ?? 0,
  };
};

export const convertInputReplyToMessage = (
  replyTo?: Api.InputReplyToMessage,
): InputReplyToMessage | undefined => {
  if (!replyTo) {
    return undefined;
  }
  return {
    replyToMsgId: replyTo.replyToMsgId,
    topMsgId: replyTo.topMsgId,
    replyToPeerId: replyTo.replyToPeerId ? convertTypeInputPeer(replyTo.replyToPeerId) : undefined,
    quoteText: replyTo.quoteText,
    quoteEntities: replyTo.quoteEntities,
    quoteOffset: replyTo.quoteOffset,
  };
};

export const convertInputReplyToStory = (
  replyTo?: Api.InputReplyToStory,
): InputReplyToStory | undefined => {
  if (!replyTo) {
    return undefined;
  }
  return {
    peer: convertTypeInputPeer(replyTo.peer)!,
    storyId: replyTo.storyId,
  };
};

export const convertInputReplyTo = (
  replyTo?: Api.TypeInputReplyTo,
): TypeInputReplyTo | undefined => {
  if (!replyTo) {
    return undefined;
  }
  if (replyTo instanceof Api.InputReplyToMessage) {
    return convertInputReplyToMessage(replyTo);
  }
  if (replyTo instanceof Api.InputReplyToStory) {
    return convertInputReplyToStory(replyTo);
  }
  throw new Error('Invalid replyTo');
};

export const convertDraftMessage = (
  draftMessage?: Api.TypeDraftMessage,
): DraftMessage | undefined => {
  if (!draftMessage) {
    return undefined;
  }
  if (draftMessage instanceof Api.DraftMessageEmpty) {
    return undefined;
  }
  return {
    noWebpage: draftMessage.noWebpage ?? false,
    invertMedia: draftMessage.invertMedia ?? false,
    replyTo: convertInputReplyTo(draftMessage.replyTo),
    message: draftMessage.message ?? '',
    entities: draftMessage.entities ?? [],
    media: convertTypeInputMedia(draftMessage.media)!,
    date: draftMessage.date ?? 0,
    effect: draftMessage.effect?.toString() ?? '',
  };
};

export const convertDialog = (dialog: Api.Dialog): Dialog => {
  return {
    peer: convertTypePeer(dialog.peer),
    unreadCount: dialog.unreadCount ?? 0,
    topMessage: dialog.topMessage ?? 0,
    folderId: dialog.folderId ?? 0,
    pinned: dialog.pinned ?? false,
    unreadMark: dialog.unreadMark ?? false,
    viewForumAsMessages: dialog.viewForumAsMessages ?? false,
    notifySettings: convertTypePeerNotifySettings(dialog.notifySettings),
    pts: dialog.pts ?? 0,
    draft: convertDraftMessage(dialog.draft),
    ttlPeriod: dialog.ttlPeriod ?? 0,
    readInboxMaxId: dialog.readInboxMaxId ?? 0,
    readOutboxMaxId: dialog.readOutboxMaxId ?? 0,
    unreadMentionsCount: dialog.unreadMentionsCount ?? 0,
    unreadReactionsCount: dialog.unreadReactionsCount ?? 0,
  };
};

// Helper function for notification sound conversion
export const convertTypeNotificationSound = (
  sound?: Api.TypeNotificationSound,
): TypeNotificationSound | undefined => {
  if (!sound) {
    return undefined;
  }

  if (sound instanceof Api.NotificationSoundDefault) {
    // NotificationSoundDefault is an empty type
    return {} as TypeNotificationSound;
  }

  if (sound instanceof Api.NotificationSoundNone) {
    // NotificationSoundNone is an empty type
    return {} as TypeNotificationSound;
  }

  if (sound instanceof Api.NotificationSoundLocal) {
    return {
      title: sound.title,
      data: sound.data,
    } as TypeNotificationSound;
  }

  if (sound instanceof Api.NotificationSoundRingtone) {
    return {
      id: sound.id.toString(),
    } as TypeNotificationSound;
  }

  throw new Error('Invalid notification sound');
};

// Helper function for notify settings - this needs to be implemented
export const convertTypePeerNotifySettings = (
  notifySettings: Api.TypePeerNotifySettings,
): TypePeerNotifySettings => {
  if (!notifySettings) {
    return {
      showPreviews: false,
      silent: false,
      muteUntil: 0,
      storiesMuted: false,
      storiesHideSender: false,
    };
  }

  if (notifySettings instanceof Api.PeerNotifySettings) {
    return {
      showPreviews: notifySettings.showPreviews ?? false,
      silent: notifySettings.silent ?? false,
      muteUntil: notifySettings.muteUntil ?? 0,
      iosSound: convertTypeNotificationSound(notifySettings.iosSound),
      androidSound: convertTypeNotificationSound(notifySettings.androidSound),
      otherSound: convertTypeNotificationSound(notifySettings.otherSound),
      storiesMuted: notifySettings.storiesMuted ?? false,
      storiesHideSender: notifySettings.storiesHideSender ?? false,
      storiesIosSound: convertTypeNotificationSound(notifySettings.storiesIosSound),
      storiesAndroidSound: convertTypeNotificationSound(notifySettings.storiesAndroidSound),
      storiesOtherSound: convertTypeNotificationSound(notifySettings.storiesOtherSound),
    };
  }

  return notifySettings as unknown as TypePeerNotifySettings;
};
