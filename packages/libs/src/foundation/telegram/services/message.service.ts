import { ListRequestDebounce } from '@telegenie/decorators';
import bigint from 'big-integer';
import { Api } from '@telegenie/teleproto';
import { v4 as uuidv4 } from 'uuid';
import { parseFileRefError } from '../file-ref/engine';
import { base64ToFileRef } from '../file-ref/bytes';
import {
  buildInputEntity,
  buildInputPeer,
  buildMtpPeerId,
  buildPeer,
  getEntityTypeById,
  isMessageEmpty,
} from '../helpers';
import { toApiInputPeer } from '../local-db/to-api-input-peer';
import { LocalDb } from '../local-db/local-db';
import type { Channel, Chat, MessageEmpty } from '../types/api-types';
import type { Message, MessageService as ConvertedMessageService } from '../types/message';
import type { User } from '../types/users';
import { shortSentMessageToUpdateNewMessage } from '../update-manager/short-to-update';
import type { UpdateManager } from '../update-manager/update-manager';
import { convertChannel, convertChat } from './converters/chat.converter';
import {
  convertMessage,
  convertMessageReplies,
  convertMessages,
} from './converters/message.converter';
import { resolveInputPeerForRead } from './utils/resolve-input-peer-for-read';
import { convertUser } from './converters/user.converter';
import type { FileService } from './file.service';
import { peerFromInputPeer } from './utils/input-peer.helper';
import { persistPeers } from './utils/persist-peers.helper';
import type { TransportService } from './transport.service';

export type MessagesByIdsResult = {
  messages: Message[];
  messageServices: ConvertedMessageService[];
  emptyMessages: MessageEmpty[];
};

export type LoadHistoryDirection = 'around' | 'backwards' | 'forwards';

export type SendMediaProgressStage = 'uploading_cover' | 'uploading' | 'sending';

export type SendMediaProgressEvent = {
  stage: SendMediaProgressStage;
  progress: number;
};

export type SendMediaOptions = {
  scheduleTime?: number;
  replyToMsgId?: number;
  forceDocument?: boolean;
  spoiler?: boolean;
  invertMedia?: boolean;
  videoCover?: File;
  entities?: CustomEmojiEntity[];
  uploadId?: string;
  width?: number;
  height?: number;
  duration?: number;
  onProgress?: (event: SendMediaProgressEvent) => void;
};

export type SendMultiMediaItem = {
  file: File;
  videoCover?: File;
  spoiler?: boolean;
  uploadId?: string;
  forceDocument?: boolean;
  width?: number;
  height?: number;
  duration?: number;
};

export type SendMultiMediaProgressEvent = {
  uploadId: string;
  stage: SendMediaProgressStage;
  progress: number;
};

export type SendMultiMediaOptions = {
  scheduleTime?: number;
  replyToMsgId?: number;
  invertMedia?: boolean;
  message?: string;
  entities?: CustomEmojiEntity[];
  onProgress?: (event: SendMultiMediaProgressEvent) => void;
};

/** Telegram `random_id` is an int64. A UUID's dashes are not valid base-36 digits. */
export function messageRandomId(uuid: string = uuidv4()) {
  return bigint(uuid.replace(/-/g, '').slice(0, 15), 16);
}

function apiCustomEmoji(entities?: CustomEmojiEntity[]): Api.TypeMessageEntity[] | undefined {
  if (!entities?.length) return undefined;
  return entities.map(
    (entity) =>
      new Api.MessageEntityCustomEmoji({
        offset: entity.offset,
        length: entity.length,
        documentId: bigint(entity.documentId),
      }),
  );
}

/** An existing document sent with `messages.sendMedia` / `InputMediaDocument`. */
export type SendStickerDocument = {
  id: string;
  accessHash: string;
  fileReference: string;
  /** Set identity used to reload `fileReference` once after a file-reference error. */
  setId?: string;
  setAccessHash?: string;
};

/** A custom-emoji span. Offsets are UTF-16, matching Telegram message entities. */
export type CustomEmojiEntity = {
  offset: number;
  length: number;
  documentId: string;
  className?: string;
  _?: string;
};

export type ReloadStickerFileReference = () => Promise<string | undefined>;

export type ForwardMessagesOptions = {
  dropAuthor?: boolean;
  silent?: boolean;
};

export type UpdatePinnedMessageOptions = {
  unpin?: boolean;
  silent?: boolean;
  pmOneside?: boolean;
};

export type LoadHistoryOptions = {
  offsetId?: number;
  direction: LoadHistoryDirection;
  limit?: number;
};

export type LoadHistoryResult = {
  messages: Message[];
  messageServices: ConvertedMessageService[];
  users: User[];
  chats: Chat[];
  channels: Channel[];
  emptyMessages: MessageEmpty[];
  count?: number;
};

export type PinnedMessagesResult = {
  messages: Message[];
  messageServices: ConvertedMessageService[];
  users: User[];
  chats: Chat[];
  channels: Channel[];
  emptyMessages: MessageEmpty[];
  count: number;
};


const EMPTY_LOAD_HISTORY: LoadHistoryResult = {
  messages: [],
  messageServices: [],
  users: [],
  chats: [],
  channels: [],
  emptyMessages: [],
};

const EMPTY_MESSAGES_BY_IDS: MessagesByIdsResult = {
  messages: [],
  messageServices: [],
  emptyMessages: [],
};
const GET_HISTORY_MAX = 100;
const DEFAULT_HISTORY_LIMIT = GET_HISTORY_MAX;
const VIEWS_FETCH_CHUNK_SIZE = GET_HISTORY_MAX;
const VIEWS_MIN_INTERVAL_MS = 10_000;

type ChannelMessageViewEntry = {
  id: number;
  stats: Api.MessageViews;
};

export type MessageViewStatsPatch = {
  id: number;
  views?: number;
  forwards?: number;
};

type MessageServiceOptions = {
  debug?: boolean;
  transportService: TransportService;
  fileService: FileService;
  localDb?: LocalDb;
  updateManager?: UpdateManager;
  onMessageViews?: (peerId: string, patches: MessageViewStatsPatch[]) => void;
};

export class MessageService {
  private debug: boolean;
  private readonly channelsHintByChat = new Map<string, Channel[]>();
  private readonly onMessageViews?: (peerId: string, patches: MessageViewStatsPatch[]) => void;
  private lastViewsFetchAt = 0;
  private viewsFetchInFlight = false;
  transportService: TransportService;
  fileService: FileService;
  localDb: LocalDb | undefined;
  updateManager: UpdateManager | undefined;

  constructor({
    debug,
    transportService,
    fileService,
    localDb,
    updateManager,
    onMessageViews,
  }: MessageServiceOptions) {
    this.transportService = transportService;
    this.fileService = fileService;
    this.localDb = localDb;
    this.updateManager = updateManager;
    this.debug = debug ?? false;
    this.onMessageViews = onMessageViews;
  }

  get client() {
    return this.transportService?.client ?? null;
  }

  getMessages = async (chatId: string): Promise<[Message[], number]> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const resp = await this.client.invoke(
      new Api.messages.GetHistory({
        peer: buildPeer(chatId),
        limit: 100,
      }),
    );
    if (!resp || resp instanceof Api.messages.MessagesNotModified) {
      return [[], 0];
    }
    await this.persistPeersFromMessagesResponse(resp);
    const messages = convertIgnoringEmpty(resp.messages);
    const count = (resp as any).count ?? resp.messages.length;
    return [messages, count];
  };

  /**
   * Channel ids are per-channel (`channels.getMessages`). User/basic-group ids
   * share one space (`messages.getMessages`). Skips `MessageEmpty` (no peer).
   */
  getMessagesByIds = async (peerId: string, ids: number[]): Promise<MessagesByIdsResult> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    if (ids.length === 0) {
      return EMPTY_MESSAGES_BY_IDS;
    }
    const resp = await this.fetchMessagesByIds(peerId, ids);
    if (!resp || resp instanceof Api.messages.MessagesNotModified) {
      return EMPTY_MESSAGES_BY_IDS;
    }
    await this.persistPeersFromMessagesResponse(resp);
    const converted = convertMessages(resp.messages);
    await this.recordFetchedIdCoverage(peerId, ids);
    return {
      messages: converted.messages,
      messageServices: converted.messageServices,
      emptyMessages: converted.emptyMessages,
    };
  };

  findGapInDisplayedRange = async (
    peerId: string,
    from: number,
    to: number,
  ): Promise<[number, number] | null> => {
    if (!this.localDb) return [from, to];
    const boxId = LocalDb.msgIdBoxForPeer(peerId);
    return this.localDb.findGapInDisplayedRange(boxId, from, to);
  };

  loadHistory = async (
    chatId: string,
    opts: LoadHistoryOptions,
  ): Promise<LoadHistoryResult> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const limit = opts.limit ?? DEFAULT_HISTORY_LIMIT;
    const { offsetId, addOffset, sliceSize } = resolveHistoryRequestParams(opts.direction, opts.offsetId, limit);

    const resp = await this.client.invoke(
      new Api.messages.GetHistory({
        peer: buildPeer(chatId),
        offsetId,
        addOffset,
        limit: sliceSize,
      }),
    );
    if (!resp || resp instanceof Api.messages.MessagesNotModified) {
      return EMPTY_LOAD_HISTORY;
    }
    await this.persistPeersFromMessagesResponse(resp);
    const converted = convertMessages(resp.messages);
    const { users, chats, channels } = extractPeersFromMessagesResponse(resp);
    const messages = converted.messages;
    void this.enrichChannelMessageViews(chatId, messages, channels).catch(() => undefined);
    const count = 'count' in resp ? (resp as { count?: number }).count : undefined;
    await this.recordHistoryCoverage(chatId, messages, converted.messageServices);
    return {
      messages,
      messageServices: converted.messageServices,
      users,
      chats,
      channels,
      emptyMessages: converted.emptyMessages,
      count,
    };
  };

  getPinnedMessages = async (
    chatId: string,
    limit: number = 100,
    offsetId: number = 0,
  ): Promise<PinnedMessagesResult> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const peer = await this.resolveInputPeerForRead(chatId);
    const resp = await this.client.invoke(
      new Api.messages.Search({
        peer,
        q: '',
        filter: new Api.InputMessagesFilterPinned(),
        minDate: 0,
        maxDate: 0,
        offsetId,
        addOffset: 0,
        limit,
        maxId: 0,
        minId: 0,
        hash: bigint(0) as any,
      }),
    );

    if (!resp || resp instanceof Api.messages.MessagesNotModified) {
      return {
        messages: [],
        messageServices: [],
        users: [],
        chats: [],
        channels: [],
        emptyMessages: [],
        count: 0,
      };
    }

    await this.persistPeersFromMessagesResponse(resp);
    const converted = convertMessages(resp.messages);
    const { users, chats, channels } = extractPeersFromMessagesResponse(resp);
    const messages = converted.messages;
    const count = 'count' in resp && typeof resp.count === 'number' ? resp.count : messages.length;

    return {
      messages,
      messageServices: converted.messageServices,
      users,
      chats,
      channels,
      emptyMessages: converted.emptyMessages,
      count,
    };
  };

  unpinAllMessages = async (chatId: string): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const peer = await this.resolveInputPeerForRead(chatId);
    await this.client.invoke(
      new Api.messages.UnpinAllMessages({
        peer,
      }),
    );
  };

  private async recordFetchedIdCoverage(peerId: string, ids: number[]): Promise<void> {
    if (!this.localDb || ids.length === 0) return;
    const boxId = LocalDb.msgIdBoxForPeer(peerId);
    await this.localDb.extendRangesFromFetchedIds?.(boxId, ids);
  }

  private async recordHistoryCoverage(
    chatId: string,
    messages: Message[],
    services: ConvertedMessageService[],
  ): Promise<void> {
    if (!this.localDb) return;
    const ids = [...messages, ...services].map((item) => item.id).filter((id) => id > 0);
    if (ids.length === 0) return;
    const boxId = LocalDb.msgIdBoxForPeer(chatId);
    if (getEntityTypeById(chatId) === 'channel') {
      await this.localDb.extendRangesFromSpan?.(boxId, Math.min(...ids), Math.max(...ids));
      return;
    }
    await this.localDb.extendRangesFromFetchedIds?.(boxId, ids);
  }

  /**
   * Supergroup/channel history often omits `views` / `forwards` on each message;
   * Telegram exposes them via `messages.getMessagesViews`.
   */
  private enrichChannelMessageViews = async (
    chatId: string,
    messages: Message[],
    channelsHint: Channel[] = [],
  ): Promise<Message[]> => {
    if (!this.client || getEntityTypeById(chatId) !== 'channel' || messages.length === 0) {
      return messages;
    }

    const ids = messages
      .filter((item) => item.id > 0 && item.views == null)
      .map((item) => item.id);
    if (ids.length === 0) {
      return messages;
    }

    if (channelsHint.length > 0) {
      this.channelsHintByChat.set(chatId, channelsHint);
    }

    try {
      const entries = await this.fetchChannelMessageViewsDebounced(chatId, ids);
      const statsById = new Map(entries.map((entry) => [entry.id, entry.stats]));
      return this.applyViewStatsToMessages(messages, statsById);
    } catch {
      return messages;
    }
  };

  @ListRequestDebounce({ delay: 400, concurrency: 1 })
  private async fetchChannelMessageViewsDebounced(
    chatId: string,
    ids: number[],
  ): Promise<ChannelMessageViewEntry[]> {
    const channelsHint = this.channelsHintByChat.get(chatId) ?? [];
    const statsById = await this.fetchViewsForChat(chatId, ids, channelsHint);
    return [...statsById.entries()].map(([id, stats]) => ({ id, stats }));
  }

  private async fetchViewsForChat(
    chatId: string,
    ids: number[],
    channelsHint: Channel[],
  ): Promise<Map<number, Api.MessageViews>> {
    if (!this.client || ids.length === 0) {
      return new Map();
    }
    if (this.viewsFetchInFlight || Date.now() - this.lastViewsFetchAt < VIEWS_MIN_INTERVAL_MS) {
      return new Map();
    }

    const inputPeer = await this.resolveInputPeerForViews(chatId, channelsHint);
    if (!inputPeer) {
      return new Map();
    }

    this.viewsFetchInFlight = true;
    this.lastViewsFetchAt = Date.now();
    try {
      const statsById = new Map<number, Api.MessageViews>();
      for (let index = 0; index < ids.length; index += VIEWS_FETCH_CHUNK_SIZE) {
        const chunk = ids.slice(index, index + VIEWS_FETCH_CHUNK_SIZE);
        const resp = await this.client.invoke(
          new Api.messages.GetMessagesViews({
            peer: inputPeer,
            id: chunk,
            increment: false,
          }),
        );
        if (!(resp instanceof Api.messages.MessageViews)) {
          continue;
        }

        await this.persistPeersFromMessageViews(resp);

        const viewStats = resp.views ?? [];
        chunk.forEach((id, chunkIndex) => {
          const stats = viewStats[chunkIndex];
          if (stats) {
            statsById.set(id, stats);
          }
        });
      }

      const patches = viewPatchesFromEntries(
        [...statsById.entries()].map(([id, stats]) => ({ id, stats })),
      );
      if (patches.length > 0) {
        this.onMessageViews?.(chatId, patches);
      }

      return statsById;
    } catch {
      this.lastViewsFetchAt = Date.now();
      return new Map();
    } finally {
      this.viewsFetchInFlight = false;
    }
  }

  private applyViewStatsToMessages(
    messages: Message[],
    statsById: Map<number, Api.MessageViews>,
  ): Message[] {
    if (statsById.size === 0) {
      return messages;
    }

    return messages.map((item) => {
      const stats = statsById.get(item.id);
      if (!stats) {
        return item;
      }
      const replies = stats.replies ? convertMessageReplies(stats.replies) : undefined;
      return {
        ...item,
        ...(stats.views != null ? { views: stats.views } : {}),
        ...(stats.forwards != null ? { forwards: stats.forwards } : {}),
        ...(replies
          ? {
              replies: item.replies
                ? { ...item.replies, ...replies }
                : replies,
            }
          : {}),
      };
    });
  };

  private async resolveInputPeerForViews(
    chatId: string,
    channelsHint: Channel[],
  ): Promise<Api.TypeInputPeer | undefined> {
    const fromHint = channelsHint.find((channel) => channel.id === chatId);
    if (fromHint?.accessHash) {
      return buildInputPeer(chatId, fromHint.accessHash);
    }

    const resolved = await this.localDb?.resolveInputPeer(chatId);
    if (resolved) {
      return toApiInputPeer(resolved);
    }

    if (getEntityTypeById(chatId) === 'chat') {
      return new Api.InputPeerChat({
        chatId: buildMtpPeerId(chatId, 'chat'),
      });
    }

    return undefined;
  }

  markMentionsRead = async (peerId: string, messageIds: number[]): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    if (messageIds.length === 0) return;

    const peerType = getEntityTypeById(peerId);
    if (peerType === 'channel') {
      const resolved = await this.localDb?.resolveInputPeer(peerId);
      if (!resolved || resolved.type !== 'channel') {
        throw new Error(`Cannot resolve channel peer: ${peerId}`);
      }
      await this.client.invoke(
        new Api.channels.ReadMessageContents({
          channel: new Api.InputChannel({
            channelId: buildMtpPeerId(resolved.channelId, 'channel'),
            accessHash: bigint(resolved.accessHash),
          }),
          id: messageIds,
        }),
      );
      return;
    }

    await this.client.invoke(
      new Api.messages.ReadMessageContents({
        id: messageIds,
      }),
    );
  };

  getUnreadMentions = async (
    peerId: string,
    opts?: { offsetId?: number; limit?: number },
  ): Promise<LoadHistoryResult & { messageIds: string[] }> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const peer = await this.resolveInputPeerForRead(peerId);
    const resp = await this.client.invoke(
      new Api.messages.GetUnreadMentions({
        peer,
        offsetId: opts?.offsetId ?? 0,
        addOffset: 0,
        limit: opts?.limit ?? 100,
        maxId: 0,
        minId: 0,
      }),
    );

    if (!resp || resp instanceof Api.messages.MessagesNotModified) {
      return { ...EMPTY_LOAD_HISTORY, messageIds: [] };
    }

    await this.persistPeersFromMessagesResponse(resp);
    const converted = convertMessages(resp.messages);
    const { users, chats, channels } = extractPeersFromMessagesResponse(resp);
    const messages = converted.messages;
    void this.enrichChannelMessageViews(peerId, messages, channels).catch(() => undefined);
    const messageIds = messages.map((message) => String(message.id));
    return {
      messages,
      messageServices: converted.messageServices,
      users,
      chats,
      channels,
      emptyMessages: converted.emptyMessages,
      messageIds,
    };
  };

  readAllMentions = async (peerId: string): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const peer = await this.resolveInputPeerForRead(peerId);
    for (;;) {
      const result = await this.client.invoke(
        new Api.messages.ReadMentions({
          peer,
        }),
      );
      if (!result || !(result instanceof Api.messages.AffectedHistory)) {
        break;
      }
      if (!result.offset) {
        break;
      }
    }
  };

  markMessageListRead = async (chatId: string, maxId: number): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const peerType = getEntityTypeById(chatId);
    if (peerType === 'channel') {
      const resolved = await this.localDb?.resolveInputPeer(chatId);
      if (!resolved || resolved.type !== 'channel') {
        throw new Error(`Cannot resolve channel peer: ${chatId}`);
      }
      await this.client.invoke(
        new Api.channels.ReadHistory({
          channel: new Api.InputChannel({
            channelId: buildMtpPeerId(resolved.channelId, 'channel'),
            accessHash: bigint(resolved.accessHash),
          }),
          maxId,
        }),
      );
      return;
    }

    const inputPeer = await this.resolveInputPeerForRead(chatId);
    await this.client.invoke(
      new Api.messages.ReadHistory({
        peer: inputPeer,
        maxId,
      }),
    );
  };

  private readonly activeUploads = new Map<string, { cancel: () => void }>();

  cancelSendMedia = (uploadId: string): boolean => {
    const active = this.activeUploads.get(uploadId);
    if (active) {
      active.cancel();
      this.activeUploads.delete(uploadId);
      return true;
    }
    return false;
  };

  sendMedia = async (
    peer: Api.TypeInputPeer,
    file: File,
    message: string,
    scheduleTime?: number,
    replyToMsgId?: number,
    forceDocument?: boolean,
  ): Promise<number> => {
    return this.sendMediaWithOptions(peer, file, message, {
      scheduleTime,
      replyToMsgId,
      forceDocument,
    });
  };

  sendMediaWithOptions = async (
    peer: Api.TypeInputPeer,
    file: File,
    message: string,
    options: SendMediaOptions = {},
  ): Promise<number> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const scheduleTime = options.scheduleTime;
    const replyTo = options.replyToMsgId;
    const isForceDocument = options.forceDocument ?? false;
    const spoiler = options.spoiler ?? false;
    const invertMedia = options.invertMedia ?? false;

    let isCanceled = false;
    const cancel = () => {
      isCanceled = true;
    };
    if (options.uploadId) {
      this.activeUploads.set(options.uploadId, { cancel });
    }

    try {
      let media: Api.TypeInputMedia;
      const isImage = file.type.startsWith('image');
      const isVideo = file.type.startsWith('video');

      if (!isForceDocument && isImage) {
        options.onProgress?.({ stage: 'uploading', progress: 0 });
        const onProgressCb = (p: number) => {
          if (isCanceled) throw new Error('USER_CANCELED');
          options.onProgress?.({ stage: 'uploading', progress: Math.min(Math.round(p * 100), 100) });
          console.log(p);
        };
        (onProgressCb as any).isCanceled = isCanceled;

        const [uploaded] = await this.fileService.uploadFiles([
          {
            file,
            onProgress: onProgressCb,
          },
        ]);
        if (isCanceled) throw new Error('USER_CANCELED');
        media = new Api.InputMediaUploadedPhoto({
          file: uploaded,
          spoiler,
        });
      } else if (!isForceDocument && isVideo) {
        let uploadedCover: Api.InputFile | Api.InputFileBig | undefined;
        let itemVideoCover: Api.InputPhoto | undefined;
        if (options.videoCover) {
          options.onProgress?.({ stage: 'uploading_cover', progress: 0 });
          const onCoverProgress = (p: number) => {
            if (isCanceled) throw new Error('USER_CANCELED');
            options.onProgress?.({
              stage: 'uploading_cover',
              progress: Math.min(Math.round(p * 100), 100),
            });
          };
          (onCoverProgress as any).isCanceled = isCanceled;
          const [coverResult] = await this.fileService.uploadFiles([
            {
              file: options.videoCover,
              onProgress: onCoverProgress,
            },
          ]);
          uploadedCover = coverResult;

          if (uploadedCover) {
            const coverMedia = await this.client.invoke(
              new Api.messages.UploadMedia({
                peer,
                media: new Api.InputMediaUploadedPhoto({ file: uploadedCover }),
              }),
            );
            if (coverMedia instanceof Api.MessageMediaPhoto && coverMedia.photo instanceof Api.Photo) {
              itemVideoCover = new Api.InputPhoto({
                id: coverMedia.photo.id,
                accessHash: coverMedia.photo.accessHash,
                fileReference: coverMedia.photo.fileReference,
              });
            }
          }
        }

        if (isCanceled) throw new Error('USER_CANCELED');
        options.onProgress?.({ stage: 'uploading', progress: 0 });
        const onProgressCb = (p: number) => {
          if (isCanceled) throw new Error('USER_CANCELED');
          options.onProgress?.({ stage: 'uploading', progress: Math.min(Math.round(p * 100), 100) });
        };
        (onProgressCb as any).isCanceled = isCanceled;

        const [uploaded] = await this.fileService.uploadFiles([
          {
            file,
            onProgress: onProgressCb,
          },
        ]);
        if (isCanceled) throw new Error('USER_CANCELED');
        media = new Api.InputMediaUploadedDocument({
          file: uploaded,
          thumb: uploadedCover,
          videoCover: itemVideoCover,
          mimeType: file.type || 'video/mp4',
          attributes: [
            new Api.DocumentAttributeVideo({
              duration: Math.round(options.duration ?? 0),
              w: options.width ?? 0,
              h: options.height ?? 0,
              supportsStreaming: true,
            }),
            new Api.DocumentAttributeFilename({ fileName: file.name }),
          ],
          spoiler,
        });
      } else {
        options.onProgress?.({ stage: 'uploading', progress: 0 });
        const onProgressCb = (p: number) => {
          if (isCanceled) throw new Error('USER_CANCELED');
          options.onProgress?.({ stage: 'uploading', progress: Math.min(Math.round(p * 100), 100) });
        };
        (onProgressCb as any).isCanceled = isCanceled;

        const [uploaded] = await this.fileService.uploadFiles([
          {
            file,
            onProgress: onProgressCb,
          },
        ]);
        if (isCanceled) throw new Error('USER_CANCELED');
        media = new Api.InputMediaUploadedDocument({
          file: uploaded,
          mimeType: file.type || 'application/octet-stream',
          attributes: [new Api.DocumentAttributeFilename({ fileName: file.name })],
          spoiler,
        });
      }

      if (isCanceled) throw new Error('USER_CANCELED');
      options.onProgress?.({ stage: 'sending', progress: 100 });

      const customEmoji = apiCustomEmoji(options.entities);
      const updates = await this.client.invoke(
        new Api.messages.SendMedia({
          peer,
          media,
          message,
          randomId: messageRandomId(),
          noforwards: true,
          clearDraft: true,
          scheduleDate: scheduleTime,
          invertMedia,
          ...(customEmoji ? { entities: customEmoji } : {}),
          ...(replyTo != null && replyTo > 0
            ? { replyTo: new Api.InputReplyToMessage({ replyToMsgId: replyTo }) }
            : {}),
        }),
      );

      return this.finishSend(updates, peer, message, replyTo);
    } finally {
      if (options.uploadId) {
        this.activeUploads.delete(options.uploadId);
      }
    }
  };

  private buildInputMediaFromUpload = async (
    peer: Api.TypeInputPeer,
    uploadedMedia: Api.InputMediaUploadedPhoto | Api.InputMediaUploadedDocument,
  ): Promise<Api.InputMediaPhoto | Api.InputMediaDocument | undefined> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const messageMedia = await this.client.invoke(
      new Api.messages.UploadMedia({
        peer,
        media: uploadedMedia,
      }),
    );
    const isSpoiler = Boolean((uploadedMedia as any).spoiler);

    if (
      messageMedia instanceof Api.MessageMediaPhoto &&
      messageMedia.photo &&
      messageMedia.photo instanceof Api.Photo
    ) {
      const { id, accessHash, fileReference } = messageMedia.photo;
      return new Api.InputMediaPhoto({
        id: new Api.InputPhoto({ id, accessHash, fileReference }),
        spoiler: isSpoiler,
      });
    }

    if (
      messageMedia instanceof Api.MessageMediaDocument &&
      messageMedia.document &&
      messageMedia.document instanceof Api.Document
    ) {
      const { id, accessHash, fileReference } = messageMedia.document;
      return new Api.InputMediaDocument({
        id: new Api.InputDocument({ id, accessHash, fileReference }),
        spoiler: isSpoiler,
        videoCover: (uploadedMedia as any).videoCover,
      });
    }

    return undefined;
  };

  sendMultiMedia = async (
    peer: Api.TypeInputPeer,
    items: SendMultiMediaItem[],
    options: SendMultiMediaOptions = {},
  ): Promise<number[]> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    if (items.length === 0) return [];
    if (items.length === 1) {
      const single = items[0];
      const id = await this.sendMediaWithOptions(peer, single.file, options.message ?? '', {
        scheduleTime: options.scheduleTime,
        replyToMsgId: options.replyToMsgId,
        forceDocument: single.forceDocument,
        spoiler: single.spoiler,
        invertMedia: options.invertMedia,
        videoCover: single.videoCover,
        entities: options.entities,
        uploadId: single.uploadId,
        width: single.width,
        height: single.height,
        duration: single.duration,
        onProgress: options.onProgress
          ? (event) =>
              options.onProgress?.({
                uploadId: single.uploadId ?? '',
                stage: event.stage,
                progress: event.progress,
              })
          : undefined,
      });
      return [id];
    }

    const multiMedia: Api.InputSingleMedia[] = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const uploadId = item.uploadId ?? `item_${index}`;
      let isCanceled = false;
      const cancel = () => {
        isCanceled = true;
      };
      this.activeUploads.set(uploadId, { cancel });

      try {
        const isImage = item.file.type.startsWith('image');
        const isVideo = item.file.type.startsWith('video');
        let uploadedMedia: Api.InputMediaUploadedPhoto | Api.InputMediaUploadedDocument;

        let itemVideoCover: Api.InputPhoto | undefined;
        if (!item.forceDocument && isImage) {
          options.onProgress?.({ uploadId, stage: 'uploading', progress: 0 });
          const onProgressCb = (p: number) => {
            if (isCanceled) throw new Error('USER_CANCELED');
            options.onProgress?.({
              uploadId,
              stage: 'uploading',
              progress: Math.min(Math.round(p * 100), 100),
            });
          };
          const [uploaded] = await this.fileService.uploadFiles([
            { file: item.file, onProgress: onProgressCb },
          ]);
          if (isCanceled) throw new Error('USER_CANCELED');
          uploadedMedia = new Api.InputMediaUploadedPhoto({
            file: uploaded,
            spoiler: item.spoiler,
          });
        } else if (!item.forceDocument && isVideo) {
          let uploadedCover: Api.InputFile | Api.InputFileBig | undefined;
          let itemVideoCover: Api.InputPhoto | undefined;
          if (item.videoCover) {
            options.onProgress?.({ uploadId, stage: 'uploading_cover', progress: 0 });
            const onCoverProgress = (p: number) => {
              if (isCanceled) throw new Error('USER_CANCELED');
              options.onProgress?.({
                uploadId,
                stage: 'uploading_cover',
                progress: Math.min(Math.round(p * 100), 100),
              });
            };
            const [coverResult] = await this.fileService.uploadFiles([
              { file: item.videoCover, onProgress: onCoverProgress },
            ]);
            uploadedCover = coverResult;

            if (uploadedCover) {
              const coverMedia = await this.client.invoke(
                new Api.messages.UploadMedia({
                  peer,
                  media: new Api.InputMediaUploadedPhoto({ file: uploadedCover }),
                }),
              );
              if (coverMedia instanceof Api.MessageMediaPhoto && coverMedia.photo instanceof Api.Photo) {
                itemVideoCover = new Api.InputPhoto({
                  id: coverMedia.photo.id,
                  accessHash: coverMedia.photo.accessHash,
                  fileReference: coverMedia.photo.fileReference,
                });
              }
            }
          }
          if (isCanceled) throw new Error('USER_CANCELED');
          options.onProgress?.({ uploadId, stage: 'uploading', progress: 0 });
          const onProgressCb = (p: number) => {
            if (isCanceled) throw new Error('USER_CANCELED');
            options.onProgress?.({
              uploadId,
              stage: 'uploading',
              progress: Math.min(Math.round(p * 100), 100),
            });
          };
          const [uploaded] = await this.fileService.uploadFiles([
            { file: item.file, onProgress: onProgressCb },
          ]);
          if (isCanceled) throw new Error('USER_CANCELED');
          uploadedMedia = new Api.InputMediaUploadedDocument({
            file: uploaded,
            thumb: uploadedCover,
            videoCover: itemVideoCover,
            mimeType: item.file.type || 'video/mp4',
            attributes: [
              new Api.DocumentAttributeVideo({
                duration: Math.round(item.duration ?? 0),
                w: item.width ?? 0,
                h: item.height ?? 0,
                supportsStreaming: true,
              }),
              new Api.DocumentAttributeFilename({ fileName: item.file.name }),
            ],
            spoiler: item.spoiler,
          });
        } else {
          options.onProgress?.({ uploadId, stage: 'uploading', progress: 0 });
          const onProgressCb = (p: number) => {
            if (isCanceled) throw new Error('USER_CANCELED');
            options.onProgress?.({
              uploadId,
              stage: 'uploading',
              progress: Math.min(Math.round(p * 100), 100),
            });
          };
          const [uploaded] = await this.fileService.uploadFiles([
            { file: item.file, onProgress: onProgressCb },
          ]);
          if (isCanceled) throw new Error('USER_CANCELED');
          uploadedMedia = new Api.InputMediaUploadedDocument({
            file: uploaded,
            mimeType: item.file.type || 'application/octet-stream',
            attributes: [new Api.DocumentAttributeFilename({ fileName: item.file.name })],
            spoiler: item.spoiler,
          });
        }

        options.onProgress?.({ uploadId, stage: 'sending', progress: 100 });
        const inputMedia = await this.buildInputMediaFromUpload(peer, uploadedMedia);
        if (!inputMedia) {
          throw new Error('Failed to convert uploaded media to input media');
        }

        const isCaptionItem = multiMedia.length === 0;
        const customEmoji = isCaptionItem ? apiCustomEmoji(options.entities) : undefined;
        multiMedia.push(
          new Api.InputSingleMedia({
            media: inputMedia,
            randomId: messageRandomId(),
            message: isCaptionItem ? (options.message ?? '') : '',
            entities: customEmoji,
          }),
        );
      } catch (err) {
        if (isCanceled || (err instanceof Error && err.message === 'USER_CANCELED')) {
          continue;
        }
        throw err;
      } finally {
        this.activeUploads.delete(uploadId);
      }
    }

    if (multiMedia.length === 0) {
      return [];
    }

    const updates = await this.client.invoke(
      new Api.messages.SendMultiMedia({
        peer,
        multiMedia,
        clearDraft: true,
        noforwards: true,
        scheduleDate: options.scheduleTime,
        invertMedia: options.invertMedia,
        ...(options.replyToMsgId != null && options.replyToMsgId > 0
          ? { replyTo: new Api.InputReplyToMessage({ replyToMsgId: options.replyToMsgId }) }
          : {}),
      }),
    );

    if (this.updateManager) {
      await this.updateManager.process(updates, 'rpc');
    }

    const messageIds: number[] = [];
    if (updates instanceof Api.Updates || updates instanceof Api.UpdatesCombined) {
      for (const update of updates.updates) {
        if (
          update instanceof Api.UpdateNewMessage ||
          update instanceof Api.UpdateNewChannelMessage
        ) {
          if (update.message instanceof Api.Message) {
            messageIds.push(update.message.id);
          }
        }
      }
    }
    return messageIds;
  };

  sendMessage = async (
    peer: Api.TypeInputPeer,
    message: string,
    scheduleTime?: number,
    replyToMsgId?: number,
    entities?: CustomEmojiEntity[],
  ): Promise<number> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const customEmoji = apiCustomEmoji(entities);
    const updates = await this.client.invoke(
      new Api.messages.SendMessage({
        peer: peer,
        message: message,
        randomId: messageRandomId(),
        noforwards: true,
        clearDraft: true,
        scheduleDate: scheduleTime,
        ...(customEmoji ? { entities: customEmoji } : {}),
        ...(replyToMsgId != null && replyToMsgId > 0
          ? { replyTo: new Api.InputReplyToMessage({ replyToMsgId }) }
          : {}),
      }),
    );
    return this.finishSend(updates, peer, message, replyToMsgId);
  };

  editMessage = async (peer: Api.TypeInputPeer, id: number, message: string): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const updates = await this.client.invoke(
      new Api.messages.EditMessage({
        peer,
        id,
        message,
      }),
    );
    if (this.updateManager) {
      await this.updateManager.process(updates, 'rpc');
    }
  };

  forwardMessages = async (
    fromPeer: Api.TypeInputPeer,
    toPeer: Api.TypeInputPeer,
    ids: number[],
    options?: ForwardMessagesOptions,
  ): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    if (ids.length === 0) return;
    const updates = await this.client.invoke(
      new Api.messages.ForwardMessages({
        fromPeer,
        toPeer,
        id: ids,
        randomId: ids.map(() => messageRandomId()),
        dropAuthor: options?.dropAuthor,
        silent: options?.silent,
      }),
    );
    if (this.updateManager) {
      await this.updateManager.process(updates, 'rpc');
    }
  };

  /**
   * Channels and supergroups use `channels.deleteMessages` (always for everyone).
   * Other chats use `messages.deleteMessages`, where `revoke` deletes for the other side.
   * The result is affected history, not message updates.
   */
  deleteMessages = async (
    peerId: string,
    ids: number[],
    revoke: boolean,
    accessHash?: string,
  ): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    if (ids.length === 0) return;
    if (getEntityTypeById(peerId) === 'channel') {
      await this.client.invoke(
        new Api.channels.DeleteMessages({
          channel: buildInputEntity(peerId, accessHash) as Api.InputChannel,
          id: ids,
        }),
      );
      return;
    }
    await this.client.invoke(
      new Api.messages.DeleteMessages({
        id: ids,
        revoke,
      }),
    );
  };

  updatePinnedMessage = async (
    peer: Api.TypeInputPeer,
    messageId: number,
    options?: UpdatePinnedMessageOptions,
  ): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const updates = await this.client.invoke(
      new Api.messages.UpdatePinnedMessage({
        peer,
        id: messageId,
        unpin: options?.unpin,
        silent: options?.silent,
        pmOneside: options?.pmOneside,
      }),
    );
    if (this.updateManager) {
      await this.updateManager.process(updates, 'rpc');
    }
  };

  sendSticker = async (
    peer: Api.TypeInputPeer,
    document: SendStickerDocument,
    replyToMsgId?: number,
    reloadFileReference?: ReloadStickerFileReference,
  ): Promise<number> => {
    try {
      return await this.invokeSendDocument(peer, document, replyToMsgId);
    } catch (err) {
      if (!reloadFileReference || !parseFileRefError(err)) throw err;
      const fileReference = await reloadFileReference();
      if (!fileReference) throw err;
      return this.invokeSendDocument(peer, { ...document, fileReference }, replyToMsgId);
    }
  };

  sendGifResult = async (
    peer: Api.TypeInputPeer,
    queryId: string,
    resultId: string,
    replyToMsgId?: number,
  ): Promise<number> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const updates = await this.client.invoke(
      new Api.messages.SendInlineBotResult({
        peer,
        queryId: bigint(queryId),
        id: resultId,
        randomId: messageRandomId(),
        clearDraft: true,
        ...(replyToMsgId != null && replyToMsgId > 0
          ? { replyTo: new Api.InputReplyToMessage({ replyToMsgId }) }
          : {}),
      }),
    );
    return this.finishSend(updates, peer, '', replyToMsgId);
  };

  private invokeSendDocument = async (
    peer: Api.TypeInputPeer,
    document: SendStickerDocument,
    replyToMsgId?: number,
  ): Promise<number> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const updates = await this.client.invoke(
      new Api.messages.SendMedia({
        peer,
        media: new Api.InputMediaDocument({
          id: new Api.InputDocument({
            id: bigint(document.id),
            accessHash: bigint(document.accessHash),
            fileReference: base64ToFileRef(document.fileReference),
          }),
        }),
        message: '',
        randomId: messageRandomId(),
        clearDraft: true,
        ...(replyToMsgId != null && replyToMsgId > 0
          ? { replyTo: new Api.InputReplyToMessage({ replyToMsgId }) }
          : {}),
      }),
    );
    return this.finishSend(updates, peer, '', replyToMsgId);
  };

  private finishSend = async (
    updates: Api.TypeUpdates,
    peer: Api.TypeInputPeer,
    message: string,
    replyToMsgId?: number,
  ): Promise<number> => {
    if (updates instanceof Api.UpdateShortSentMessage) {
      // Private chats and basic groups ack with no peer and no body. Rebuild the
      // outgoing message so the list can show it; the raw ack would be stored empty.
      if (this.updateManager) {
        const apiPeer = peerFromInputPeer(peer);
        await this.updateManager.process(
          apiPeer
            ? shortSentMessageToUpdateNewMessage(updates, apiPeer, message, replyToMsgId)
            : updates,
          'rpc',
        );
      }
      return updates.id;
    }
    if (this.updateManager) {
      await this.updateManager.process(updates, 'rpc');
    }
    if (updates instanceof Api.Updates || updates instanceof Api.UpdatesCombined) {
      for (const update of updates.updates) {
        if (update instanceof Api.UpdateMessageID) {
          return update.id;
        }
      }
      for (const update of updates.updates) {
        if (
          update instanceof Api.UpdateNewMessage ||
          update instanceof Api.UpdateNewChannelMessage
        ) {
          const sent = update.message;
          if (sent instanceof Api.Message || sent instanceof Api.MessageService) {
            return sent.id;
          }
        }
      }
    }
    return -1;
  };

  saveDraft = async (
    peer: Api.TypeInputPeer,
    message: string,
    replyToMsgId?: number,
    entities?: CustomEmojiEntity[],
  ): Promise<void> => {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const replyTo =
      message && replyToMsgId != null && replyToMsgId > 0
        ? new Api.InputReplyToMessage({ replyToMsgId })
        : undefined;
    const customEmoji = message ? apiCustomEmoji(entities) : undefined;
    await this.client.invoke(
      new Api.messages.SaveDraft({
        peer,
        message,
        ...(replyTo ? { replyTo } : {}),
        ...(customEmoji ? { entities: customEmoji } : {}),
      }),
    );
  };

  private async fetchMessagesByIds(
    peerId: string,
    ids: number[],
  ): Promise<Api.messages.TypeMessages | undefined> {
    const inputIds = ids.map((id) => new Api.InputMessageID({ id }));
    if (getEntityTypeById(peerId) !== 'channel') {
      return this.client!.invoke(new Api.messages.GetMessages({ id: inputIds }));
    }

    const resolved = await this.localDb?.resolveInputPeer(peerId);
    if (!resolved || resolved.type !== 'channel') {
      return undefined;
    }

    try {
      return await this.client!.invoke(
        new Api.channels.GetMessages({
          channel: new Api.InputChannel({
            channelId: buildMtpPeerId(resolved.channelId, 'channel'),
            accessHash: bigint(resolved.accessHash),
          }),
          id: inputIds,
        }),
      );
    } catch (err) {
      if (isRpcErrorMessage(err, 'MESSAGE_IDS_EMPTY')) {
        return undefined;
      }
      throw err;
    }
  }

  private resolveInputPeerForRead(chatId: string): Promise<Api.TypeInputPeer> {
    return resolveInputPeerForRead(chatId, this.transportService, this.localDb);
  }

  private async persistPeersFromMessagesResponse(
    resp: Api.messages.TypeMessages,
  ): Promise<void> {
    if (!this.localDb) return;
    const { users, chats, channels } = extractPeersFromMessagesResponse(resp);
    await persistPeers(this.localDb, { users, chats, channels });
  }

  private async persistPeersFromMessageViews(
    resp: Api.messages.MessageViews,
  ): Promise<void> {
    if (!this.localDb) return;
    const users = (resp.users ?? [])
      .filter((user): user is Api.User => user instanceof Api.User)
      .map(convertUser);
    const chats: Chat[] = [];
    const channels: Channel[] = [];
    for (const chat of resp.chats ?? []) {
      if (chat instanceof Api.Chat) chats.push(convertChat(chat));
      else if (chat instanceof Api.Channel) channels.push(convertChannel(chat));
    }
    await persistPeers(this.localDb, { users, chats, channels });
  }
}

export function resolveHistoryRequestParams(
  direction: LoadHistoryDirection,
  offsetId: number | undefined,
  limit: number,
): { offsetId?: number; addOffset?: number; sliceSize: number } {
  let addOffset: number | undefined;
  let sliceSize = limit;

  switch (direction) {
    case 'backwards':
      if (offsetId != null) {
        addOffset = -1;
        sliceSize += 1;
      }
      break;
    case 'around':
      addOffset = -(Math.round(limit / 2) + 1);
      break;
    case 'forwards':
      addOffset = -(limit + 1);
      if (offsetId != null) {
        sliceSize += 1;
      }
      break;
  }

  return { offsetId, addOffset, sliceSize: Math.min(sliceSize, GET_HISTORY_MAX) };
}

function viewPatchesFromEntries(entries: ChannelMessageViewEntry[]): MessageViewStatsPatch[] {
  const patches: MessageViewStatsPatch[] = [];
  for (const entry of entries) {
    const patch: MessageViewStatsPatch = { id: entry.id };
    if (entry.stats.views != null) patch.views = entry.stats.views;
    if (entry.stats.forwards != null) patch.forwards = entry.stats.forwards;
    if (patch.views != null || patch.forwards != null) {
      patches.push(patch);
    }
  }
  return patches;
}

function extractPeersFromMessagesResponse(resp: Api.messages.TypeMessages): {
  users: User[];
  chats: Chat[];
  channels: Channel[];
} {
  if (!('users' in resp) || !('chats' in resp)) {
    return { users: [], chats: [], channels: [] };
  }
  const users = (resp.users ?? [])
    .filter((u): u is Api.User => u instanceof Api.User)
    .map(convertUser);
  const chats: Chat[] = [];
  const channels: Channel[] = [];
  for (const chat of resp.chats ?? []) {
    if (chat instanceof Api.Chat) chats.push(convertChat(chat));
    else if (chat instanceof Api.Channel) channels.push(convertChannel(chat));
  }
  return { users, chats, channels };
}

function convertIgnoringEmpty(messages: Api.TypeMessage[]): Message[] {
  return messages.flatMap((msg) => (isMessageEmpty(msg) ? [] : [convertMessage(msg as Api.Message)]));
}

function isRpcErrorMessage(err: unknown, message: string): boolean {
  return (
    typeof err === 'object' &&
    err != null &&
    'errorMessage' in err &&
    (err as { errorMessage?: string }).errorMessage === message
  );
}
