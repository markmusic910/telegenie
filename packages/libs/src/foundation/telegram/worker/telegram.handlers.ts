import { CustomFile } from '@telegenie/teleproto/client/uploads';
import { RpcError, type RpcHandlers } from '../../worker-rpc';
import { buildInputPeer } from '../helpers/index';
import { SessionPasswordNeededError } from '../services/auth.service';
import { Telegram } from '../telegram';
import {
  SESSION_PASSWORD_NEEDED_CODE,
  type SendMediaWorkerProgressEvent,
  type SendMultiMediaWorkerProgressEvent,
  type TelegramWorkerApi,
  type WorkerFilePayload,
} from './telegram.api';

function fileFromPayload(file: WorkerFilePayload): File {
  return new File([file.buffer], file.name, { type: file.type });
}

function rethrowAuthError(err: unknown): never {
  if (err instanceof SessionPasswordNeededError) {
    throw new RpcError(SESSION_PASSWORD_NEEDED_CODE, SESSION_PASSWORD_NEEDED_CODE, err.name);
  }
  throw err;
}

/**
 * Build flat RPC handlers that own a single in-worker {@link Telegram} instance.
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

    'dialog.getAllDialogs': async function* (folderId) {
      const dialogService = tg.getDialogService();
      const scope = folderId ?? 0;
      let first = true;
      for await (const batch of dialogService.getAllDialogs(scope)) {
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

    'chat.getChatsByIds': async (ids) => {
      return tg.getChatService().getChatsByIds(ids);
    },
    'chat.getFullChatByIds': async (ids) => {
      return tg.getChatService().getFullChatByIds(ids);
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

    'user.getMe': async () => {
      return tg.getUserService().getMe();
    },
    'user.getContacts': async () => {
      return tg.getUserService().getContacts();
    },
    'user.getUsers': async (options) => {
      return tg.getUserService().getUsers(options);
    },
    'user.getUsersByIds': async (ids) => {
      return tg.getUserService().getUsersByIds(ids);
    },
    'user.getFullUsers': async (options) => {
      return tg.getUserService().getFullUsers(options);
    },
    'user.getFullUsersByIds': async (ids) => {
      return tg.getUserService().getFullUsersByIds(ids);
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
      const peer = buildInputPeer(peerId, accessHash);
      return tg
        .getMessageService()
        .sendMessage(peer, message, scheduleTime, replyToMsgId, entities);
    },
    'message.editMessage': async (peerId, messageId, message, accessHash) => {
      const peer = buildInputPeer(peerId, accessHash);
      await tg.getMessageService().editMessage(peer, messageId, message);
    },
    'message.forwardMessages': async (
      fromPeerId,
      toPeerId,
      ids,
      fromAccessHash,
      toAccessHash,
      options,
    ) => {
      await tg.getMessageService().forwardMessages(
        buildInputPeer(fromPeerId, fromAccessHash),
        buildInputPeer(toPeerId, toAccessHash),
        ids,
        options,
      );
    },
    'message.deleteMessages': async (peerId, ids, revoke, accessHash) => {
      await tg.getMessageService().deleteMessages(peerId, ids, revoke, accessHash);
    },
    'message.updatePinnedMessage': async (peerId, messageId, options, accessHash) => {
      await tg
        .getMessageService()
        .updatePinnedMessage(buildInputPeer(peerId, accessHash), messageId, options);
    },
    'message.sendSticker': async (peerId, document, accessHash, replyToMsgId) => {
      const peer = buildInputPeer(peerId, accessHash);
      const { setId, setAccessHash } = document;
      const reload =
        setId && setAccessHash
          ? () => tg.getStickerService().freshFileReference(setId, setAccessHash, document.id)
          : undefined;
      return tg.getMessageService().sendSticker(peer, document, replyToMsgId, reload);
    },
    'message.sendGifResult': async (peerId, queryId, resultId, accessHash, replyToMsgId) => {
      const peer = buildInputPeer(peerId, accessHash);
      return tg.getMessageService().sendGifResult(peer, queryId, resultId, replyToMsgId);
    },
    'message.saveDraft': async (peerId, message, accessHash, replyToMsgId, entities) => {
      const peer = buildInputPeer(peerId, accessHash);
      await tg.getMessageService().saveDraft(peer, message, replyToMsgId, entities);
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
      const peer = buildInputPeer(peerId, accessHash);
      return tg
        .getMessageService()
        .sendMedia(
          peer,
          fileFromPayload(file),
          message,
          scheduleTime,
          replyToMsgId,
          forceDocument,
        );
    },
    'message.sendMediaProgress': async function* (payload) {
      const peer = buildInputPeer(payload.peerId, payload.accessHash);
      const queue: SendMediaWorkerProgressEvent[] = [];
      let notify: (() => void) | undefined;
      let finished = false;
      let sendError: unknown;

      const onProgress = (event: {
        stage: 'uploading_cover' | 'uploading' | 'sending';
        progress: number;
      }) => {
        queue.push(event);
        notify?.();
      };

      const sendPromise = tg
        .getMessageService()
        .sendMediaWithOptions(peer, fileFromPayload(payload.file), payload.message, {
          scheduleTime: payload.scheduleTime,
          replyToMsgId: payload.replyToMsgId,
          forceDocument: payload.forceDocument,
          spoiler: payload.spoiler,
          invertMedia: payload.invertMedia,
          videoCover: payload.videoCover ? fileFromPayload(payload.videoCover) : undefined,
          entities: payload.entities,
          uploadId: payload.uploadId,
          width: payload.width,
          height: payload.height,
          duration: payload.duration,
          onProgress,
        })
        .then((messageId) => {
          queue.push({ stage: 'done', messageId });
          finished = true;
          notify?.();
        })
        .catch((err) => {
          sendError = err;
          finished = true;
          notify?.();
        });

      while (!finished || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          await new Promise<void>((resolve) => {
            notify = resolve;
          });
        }
      }

      await sendPromise;
      if (sendError) throw sendError;
    },
    'message.sendMultiMediaProgress': async function* (payload) {
      const peer = buildInputPeer(payload.peerId, payload.accessHash);
      const queue: SendMultiMediaWorkerProgressEvent[] = [];
      let notify: (() => void) | undefined;
      let finished = false;
      let sendError: unknown;

      const onProgress = (event: {
        uploadId: string;
        stage: 'uploading_cover' | 'uploading' | 'sending';
        progress: number;
      }) => {
        queue.push(event);
        notify?.();
      };

      const sendPromise = tg
        .getMessageService()
        .sendMultiMedia(
          peer,
          payload.items.map((item) => ({
            file: fileFromPayload(item.file),
            videoCover: item.videoCover ? fileFromPayload(item.videoCover) : undefined,
            spoiler: item.spoiler,
            uploadId: item.uploadId,
            forceDocument: item.forceDocument,
            width: item.width,
            height: item.height,
            duration: item.duration,
          })),
          {
            message: payload.message,
            scheduleTime: payload.scheduleTime,
            replyToMsgId: payload.replyToMsgId,
            invertMedia: payload.invertMedia,
            entities: payload.entities,
            onProgress,
          },
        )
        .then((messageIds) => {
          queue.push({ stage: 'done', messageIds });
          finished = true;
          notify?.();
        })
        .catch((err) => {
          sendError = err;
          finished = true;
          notify?.();
        });

      while (!finished || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          await new Promise<void>((resolve) => {
            notify = resolve;
          });
        }
      }

      await sendPromise;
      if (sendError) throw sendError;
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
      const peer = buildInputPeer(peerId, accessHash);
      return tg.getStickerService().searchGifs(peer, query);
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
      const peer = buildInputPeer(peerId, accessHash);
      const customFile = new CustomFile(
        file.name,
        file.buffer.byteLength,
        '',
        Buffer.from(file.buffer),
      );
      await tg.transportService.client.editPhoto(peer, customFile);
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
