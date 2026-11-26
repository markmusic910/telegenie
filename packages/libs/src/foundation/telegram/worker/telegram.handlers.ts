import { RpcError, type RpcHandlers } from '../../worker-rpc';
import { buildInputPeer } from '../helpers/index';
import { SessionPasswordNeededError } from '../services/auth.service';
import { Telegram } from '../telegram';
import { SESSION_PASSWORD_NEEDED_CODE, type TelegramWorkerApi } from './telegram.api';

function rethrowAuthError(err: unknown): never {
  if (err instanceof SessionPasswordNeededError) {
    throw new RpcError(SESSION_PASSWORD_NEEDED_CODE, SESSION_PASSWORD_NEEDED_CODE, err.name);
  }
  throw err;
}

/**
 * Build flat RPC handlers that wire each endpoint directly to its owning service.
 */
export function createTelegramWorkerHandlers(
  tg: Telegram,
): RpcHandlers<TelegramWorkerApi> {
  return {
    'account.open': async (options) => {
      await tg.openAccount(options);
    },
    'account.close': async () => {
      await tg.closeAccount();
    },
    'updates.start': async () => {
      await tg.startUpdates();
    },
    'updates.stop': async () => {
      tg.stopUpdates();
    },

    'auth.configure': async (credentials) => {
      tg.getAuthService().configure(credentials);
    },
    'auth.prepareClient': async (session) => {
      await tg.getAuthService().prepareClient(session ?? '');
    },
    'auth.isAuthorized': async () => {
      return tg.getAuthService().isAuthorized();
    },
    'auth.sendCode': async (phone) => {
      const result = await tg.getAuthService().sendCode(phone);
      return {
        phoneCodeHash: result.phoneCodeHash,
        isCodeViaApp: result.isCodeViaApp,
      };
    },
    'auth.signIn': async (phone, phoneCodeHash, phoneCode) => {
      try {
        return await tg.getAuthService().signIn(phone, phoneCodeHash, phoneCode);
      } catch (err) {
        rethrowAuthError(err);
      }
    },
    'auth.signInWithPassword': async (password) => {
      return tg.getAuthService().signInWithPassword(password);
    },
    'auth.getPasswordHint': async () => {
      return tg.getAuthService().getPasswordHint();
    },
    'auth.getSessionString': async () => {
      return tg.getAuthService().getSessionString();
    },
    'auth.startBot': async (botUsername, startParam) => {
      return tg.startBot(botUsername, startParam);
    },

    'dialog.getAllDialogs': async function* (folderId) {
      const scope = folderId ?? 0;
      let first = true;
      for await (const batch of tg.getDialogService().getAllDialogs(scope)) {
        // Only the main-list pass may reset; the archive pass must keep its ranks.
        tg.ingestDialogPage(batch, { reset: first && scope === 0, folderId: scope });
        first = false;
        yield batch;
      }
    },
    'dialog.reorderPinned': async (peerIds, folderId) => {
      await tg.getDialogService().reorderPinnedDialogs(peerIds, folderId ?? 0);
    },

    'dialogFilter.getAll': async () => {
      return tg.getDialogFilterService().getDialogFilters();
    },
    'dialogFilter.reorder': async (order) => {
      await tg.getDialogFilterService().reorderDialogFilters(order);
    },
    'dialogFilter.save': async (filter) => {
      await tg.getDialogFilterService().saveDialogFilter(filter);
    },
    'dialogFilter.delete': async (id) => {
      await tg.getDialogFilterService().deleteDialogFilter(id);
    },
    'dialogFilter.toggleTags': async (enabled) => {
      await tg.getDialogFilterService().toggleDialogFilterTags(enabled);
    },

    'chat.getChatsByIds': async (ids) => {
      return tg.getChatService().getChatsByIds(ids);
    },
    'chat.getFullChatByIds': async (ids, options) => {
      return tg.getChatService().getFullChatByIds(ids, options);
    },
    'chat.createBasicGroup': async (title, users) => {
      return tg.getChatService().createBasicGroup(title, users);
    },
    'chat.setAvailableReactions': async (peerId, availableReactions, reactionsLimit, accessHash) => {
      await tg
        .getChatService()
        .setAvailableReactions(peerId, availableReactions, reactionsLimit, accessHash);
    },

    'channel.getChannelsByIds': async (ids) => {
      return tg.getChannelService().getChannelsByIds(ids);
    },
    'channel.getFullChannelByIds': async (options) => {
      return tg.getChannelService().getFullChannelByIds(options);
    },
    'channel.createGroup': async (title, about, users) => {
      return tg.getChannelService().createGroup(title, about, users);
    },
    'channel.createChannel': async (title, about, options, users) => {
      return tg.getChannelService().createChannel(title, about, options, users);
    },
    'channel.exportInviteLink': async (channelId, accessHash) => {
      return tg.getChannelService().exportInviteLink(channelId, accessHash);
    },
    'channel.getParticipants': async (channelId, options) => {
      return tg.getChannelService().getParticipants(channelId, options);
    },
    'channel.joinChannel': async (channelId, accessHash) => {
      await tg.getChannelService().joinChannel(channelId, accessHash);
    },
    'channel.leaveChannel': async (channelId, accessHash) => {
      await tg.getChannelService().leaveChannel(channelId, accessHash);
    },
    'channel.inviteMembers': async (channelId, userIds, accessHash) => {
      await tg.getChannelService().inviteMembers(channelId, userIds, accessHash);
    },

    'user.getMe': async () => {
      return tg.getUserService().getMe();
    },
    'user.getContacts': async () => {
      return tg.getUserService().getContacts();
    },
    'user.getTopInlineBots': async (limit) => {
      return tg.getUserService().getTopInlineBots(limit);
    },
    'user.searchContacts': async (q, limit) => {
      return tg.getUserService().searchContacts(q, limit);
    },
    'user.getUsers': async (options) => {
      return tg.getUserService().getUsers(options);
    },
    'user.getUsersByIds': async (ids) => {
      return tg.getUserService().getUsersByIds(ids);
    },
    'user.getFullUsers': async (options, fetchOptions) => {
      return tg.getUserService().getFullUsers(options, fetchOptions);
    },
    'user.getFullUsersByIds': async (ids, fetchOptions) => {
      return tg.getUserService().getFullUsersByIds(ids, fetchOptions);
    },
    'user.addContact': async (input) => {
      return tg.getUserService().addContact(input);
    },
    'user.deleteContact': async (input) => {
      return tg.getUserService().deleteContact(input);
    },
    'user.setBlocked': async (input) => {
      return tg.getUserService().setBlocked(input);
    },
    'user.setPeerMuted': async (input) => {
      return tg.getUserService().setPeerMuted(input);
    },
    'user.resolveUsername': async (username) => {
      return tg.getUserService().resolveUsername(username);
    },

    'message.getMessages': async (chatId) => {
      return tg.getMessageService().getMessages(chatId);
    },
    'message.getMessagesByIds': async (peerId, ids) => {
      return tg.getMessageService().getMessagesByIds(peerId, ids);
    },
    'message.loadHistory': async (chatId, opts) => {
      return tg.getMessageService().loadHistory(chatId, opts);
    },
    'message.getPinnedMessages': async (peerId, limit, offsetId) => {
      return tg.getMessageService().getPinnedMessages(peerId, limit, offsetId);
    },
    'message.searchInPeer': async (peerId, tab, offsetId, limit) => {
      return tg
        .getMessageService()
        .searchPeerMessages(peerId, tab, offsetId ?? 0, limit ?? 50);
    },
    'message.unpinAllMessages': async (peerId) => {
      return tg.getMessageService().unpinAllMessages(peerId);
    },
    'message.findGapInDisplayedRange': async (peerId, from, to) => {
      return tg.getMessageService().findGapInDisplayedRange(peerId, from, to);
    },
    'message.markMessageListRead': async (chatId, maxId) => {
      await tg.getMessageService().markMessageListRead(chatId, maxId);
    },
    'message.markMentionsRead': async (peerId, messageIds) => {
      await tg.getMessageService().markMentionsRead(peerId, messageIds);
    },
    'message.getUnreadMentions': async (peerId, opts) => {
      return tg.getMessageService().getUnreadMentions(peerId, opts);
    },
    'message.readAllMentions': async (peerId) => {
      await tg.getMessageService().readAllMentions(peerId);
    },
    'message.sendMessage': async (
      peerId,
      message,
      accessHash,
      scheduleTime,
      replyToMsgId,
      entities,
    ) => {
      return tg
        .getMessageService()
        .sendMessageByPeerId(peerId, message, accessHash, scheduleTime, replyToMsgId, entities);
    },
    'message.editMessage': async (peerId, messageId, message, accessHash, entities) => {
      await tg
        .getMessageService()
        .editMessageByPeerId(peerId, messageId, message, accessHash, entities);
    },
    'message.forwardMessages': async (
      fromPeerId,
      toPeerId,
      ids,
      fromAccessHash,
      toAccessHash,
      options,
    ) => {
      await tg
        .getMessageService()
        .forwardMessagesByPeerId(fromPeerId, toPeerId, ids, fromAccessHash, toAccessHash, options);
    },
    'message.deleteMessages': async (peerId, ids, revoke, accessHash) => {
      await tg.getMessageService().deleteMessages(peerId, ids, revoke, accessHash);
    },
    'message.updatePinnedMessage': async (peerId, messageId, options, accessHash) => {
      await tg
        .getMessageService()
        .updatePinnedMessageByPeerId(peerId, messageId, options, accessHash);
    },
    'message.sendSticker': async (peerId, document, accessHash, replyToMsgId) => {
      const { setId, setAccessHash } = document;
      const reload =
        setId && setAccessHash
          ? () => tg.getStickerService().freshFileReference(setId, setAccessHash, document.id)
          : undefined;
      return tg
        .getMessageService()
        .sendStickerByPeerId(peerId, document, accessHash, replyToMsgId, reload);
    },
    'message.sendGifResult': async (peerId, queryId, resultId, accessHash, replyToMsgId) => {
      return tg
        .getMessageService()
        .sendGifResultByPeerId(peerId, queryId, resultId, accessHash, replyToMsgId);
    },
    'message.saveDraft': async (peerId, message, accessHash, replyToMsgId, entities) => {
      await tg
        .getMessageService()
        .saveDraftByPeerId(peerId, message, accessHash, replyToMsgId, entities);
    },
    'message.sendMedia': async (
      peerId,
      file,
      message,
      accessHash,
      scheduleTime,
      replyToMsgId,
      forceDocument,
    ) => {
      return tg
        .getMessageService()
        .sendMediaByPeerId(peerId, file, message, accessHash, scheduleTime, replyToMsgId, forceDocument);
    },
    'message.sendMediaProgress': async function* (payload) {
      yield* tg.getMessageService().streamSendMedia(payload);
    },
    'message.sendMultiMediaProgress': async function* (payload) {
      yield* tg.getMessageService().streamSendMultiMedia(payload);
    },
    'message.cancelSendMedia': async (uploadId) => {
      return tg.getMessageService().cancelSendMedia(uploadId);
    },
    'message.sendReaction': async (peerId, messageId, reactions, accessHash, addToRecent) => {
      await tg
        .getMessageReactionService()
        .sendReaction(peerId, messageId, reactions, accessHash, addToRecent);
    },
    'message.refreshReactions': async (peerId, messageIds) => {
      await tg.getMessageReactionService().refreshReactions(peerId, messageIds);
    },
    'message.getDefaultReaction': async () => {
      return tg.getMessageReactionService().getDefaultReaction();
    },
    'message.getMessageReactionsList': async (peerId, messageId, accessHash, options) => {
      return tg
        .getMessageReactionService()
        .getMessageReactionsList(peerId, messageId, accessHash, options);
    },
    'message.getUnreadReactions': async (peerId, opts) => {
      return tg.getMessageReactionService().getUnreadReactions(peerId, opts);
    },
    'message.readAllReactions': async (peerId) => {
      await tg.getMessageReactionService().readAllReactions(peerId);
    },
    'message.emitNotification': async (payload) => {
      tg.emitMessageNotification(payload);
    },
    'message.getAvailableReactions': async () => {
      return tg.getMessageReactionService().getAvailableReactions();
    },
    'message.getTopReactions': async (limit) => {
      return tg.getMessageReactionService().getTopReactions(limit);
    },
    'message.getRecentReactions': async (limit) => {
      return tg.getMessageReactionService().getRecentReactions(limit);
    },
    'message.clearRecentReactions': async () => {
      await tg.getMessageReactionService().clearRecentReactions();
    },
    'message.setDefaultReaction': async (emoticon) => {
      await tg.getMessageReactionService().setDefaultReaction(emoticon);
    },

    'sticker.getInstalledSets': async () => {
      return tg.getStickerService().getInstalledSets();
    },
    'sticker.getInstalledEmojiSets': async () => {
      return tg.getStickerService().getInstalledEmojiSets();
    },
    'sticker.getSet': async (id, accessHash) => {
      return tg.getStickerService().getSet(id, accessHash);
    },
    'sticker.uninstallSet': async (id, accessHash) => {
      await tg.getStickerService().uninstallSet(id, accessHash);
    },
    'sticker.getRecentStickers': async () => {
      return tg.getStickerService().getRecentStickers();
    },
    'sticker.clearRecentStickers': async () => {
      await tg.getStickerService().clearRecentStickers();
    },
    'sticker.getFeaturedSets': async (kind) => {
      return tg.getStickerService().getFeaturedSets(kind);
    },
    'sticker.installSet': async (id, accessHash) => {
      await tg.getStickerService().installSet(id, accessHash);
    },
    'sticker.searchStickers': async (query) => {
      return tg.getStickerService().searchStickers(query);
    },
    'sticker.searchEmoji': async (query) => {
      return tg.getStickerService().searchEmoji(query);
    },
    'sticker.getSavedGifs': async () => {
      return tg.getStickerService().getSavedGifs();
    },
    'sticker.searchGifs': async (peerId, query, accessHash) => {
      return tg.getStickerService().searchGifs(buildInputPeer(peerId, accessHash), query);
    },
    'sticker.getStickersForEmoji': async (emoticon) => {
      return tg.getStickerService().getStickersForEmoji(emoticon);
    },
    'sticker.searchCustomEmoji': async (emoticon) => {
      return tg.getStickerService().searchCustomEmoji(emoticon);
    },
    'sticker.getCustomEmojiDocuments': async (ids) => {
      return tg.getStickerService().getCustomEmojiDocuments(ids);
    },

    'peers.resolveInputPeer': async (peerId) => {
      return tg.resolveInputPeer(peerId);
    },
    'peers.editPhoto': async (peerId, file, accessHash) => {
      await tg.editPeerPhoto(peerId, file, accessHash);
    },

    'encryptedChat.create': async (userId, accessHash) => {
      return tg.getEncryptedChatService().create(userId, accessHash);
    },
    'encryptedChat.accept': async (chatId) => {
      return tg.getEncryptedChatService().accept(chatId);
    },

    'file.getPart': async (params) => {
      return tg.getFileService().getPart(params);
    },
    'file.downloadFiles': async (items) => {
      return tg.getFileService().downloadFiles(items);
    },
    'file.downloadPeerPhotos': async (items) => {
      return tg.getFileService().downloadPeerPhotos(items);
    },

    'debug.deleteLocalEntity': async (store, id) => {
      await tg.debugDeleteLocalEntity(store, id);
    },
  };
}
