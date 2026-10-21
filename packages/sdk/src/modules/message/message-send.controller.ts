import { Controller, Method, RequestLog } from '@telegenie/decorators';
import type {
  CustomEmojiEntity,
  ForwardMessagesOptions,
  SendStickerDocument,
  UpdatePinnedMessageOptions,
} from '@telegenie/libs/foundation/telegram/services/message.service';
import { readPeerAccessHash } from '@telegenie/libs/foundation/telegram/utils';
import type {
  SendMediaWorkerPayload,
  SendMediaWorkerProgressEvent,
  SendMultiMediaWorkerItem,
  SendMultiMediaWorkerPayload,
  SendMultiMediaWorkerProgressEvent,
  TelegramWorkerClient,
  WorkerFilePayload,
} from '@telegenie/libs/foundation/telegram/worker';
import type { Dialog } from '../../store/entity/models/dialog.model';
import type GlobalStore from '../../store/global/global.store';
import { MAIN_THREAD_ID } from '../../store/global/models/thread.state';
import type StoreManager from '../../store/store.manager';
import type { PeerType } from '../../store/types/common';
import type { MessageEntity } from '../../store/types/message';
import type { MessageStore } from '../../store/types/store';
import type { MessageDraftController } from './message-draft.controller';
import { customEmojiEntities } from './message-draft.utils';

export type SendFileOptions = {
  forceDocument?: boolean;
  threadId?: string;
  spoiler?: boolean;
  invertMedia?: boolean;
  videoCover?: File;
  entities?: CustomEmojiEntity[];
  uploadId?: string;
  width?: number;
  height?: number;
  duration?: number;
  onProgress?: (event: SendMediaWorkerProgressEvent) => void;
  abortSignal?: AbortSignal;
};

export type SendMediaGroupItem = {
  file: File;
  spoiler?: boolean;
  videoCover?: File;
  invertMedia?: boolean;
  uploadId?: string;
  abortSignal?: AbortSignal;
  forceDocument?: boolean;
  width?: number;
  height?: number;
  duration?: number;
};

export type SendMediaGroupOptions = {
  threadId?: string;
  caption?: string;
  entities?: CustomEmojiEntity[];
  invertMedia?: boolean;
  onProgress?: (event: SendMultiMediaWorkerProgressEvent) => void;
  abortSignal?: AbortSignal;
};

export type SendTextResult = { ok: true; messageId: number } | { ok: false };

type ActiveUploadEntry = {
  peerId: string;
  threadId: string;
  mockIds: string[];
  abort: () => void;
};

type MessageSendControllerOptions = {
  worker: TelegramWorkerClient;
  sm: StoreManager;
  globalStore: GlobalStore;
  drafts: MessageDraftController;
  jumpToBottom: (peerId: string, threadId?: string) => Promise<void>;
  /** Delete RPCs return affected history, so the caller removes the messages locally. */
  applyLocalDelete?: (peerId: string, ids: number[]) => void;
  ensureMessageStore?: (peerId: string) => MessageStore;
  ensureListedIdsCached?: (peerId: string, threadId?: string) => Promise<void>;
};

/** Outbound message RPCs. */
@Controller
export class MessageSendController {
  private readonly activeUploads = new Map<string, ActiveUploadEntry>();

  constructor(private readonly options: MessageSendControllerOptions) {}

  @RequestLog()
  @Method()
  sendMessage(
    chatId: string,
    message: string,
    accessHash?: string,
    scheduleTime?: number,
    replyToMsgId?: number,
    entities?: ReturnType<typeof customEmojiEntities>,
  ): Promise<number> {
    if (entities) {
      return this.options.worker.call('message.sendMessage', [
        chatId,
        message,
        accessHash,
        scheduleTime,
        replyToMsgId,
        entities,
      ]);
    }
    return this.options.worker.call('message.sendMessage', [
      chatId,
      message,
      accessHash,
      scheduleTime,
      replyToMsgId,
    ]);
  }

  @RequestLog()
  @Method()
  async sendText(
    peerId: string,
    text: string,
    threadId: string = MAIN_THREAD_ID,
  ): Promise<SendTextResult> {
    const accessHash = readPeerAccessHash(this.options.sm, peerId);
    const replyRaw = this.options.globalStore.getThreadUI(peerId, threadId)?.replyingToId;
    const replyNum = replyRaw != null ? Number(replyRaw) : Number.NaN;
    const replyToMsgId = Number.isInteger(replyNum) && replyNum > 0 ? replyNum : undefined;
    const saveInFlight = this.options.drafts.overlappingSave(peerId, threadId);
    const entities = customEmojiEntities(
      this.options.globalStore.getThreadUI(peerId, threadId)?.draft?.entities,
    );

    let messageId: number;
    try {
      messageId = await this.sendMessage(
        peerId,
        text,
        accessHash,
        undefined,
        replyToMsgId,
        entities,
      );
    } catch {
      return { ok: false };
    }
    if (!Number.isInteger(messageId) || messageId <= 0) {
      return { ok: false };
    }

    return this.finishOutbound(peerId, threadId, messageId, saveInFlight);
  }

  @RequestLog()
  @Method()
  async editText(
    peerId: string,
    messageId: string,
    text: string,
    threadId: string = MAIN_THREAD_ID,
  ): Promise<SendTextResult> {
    const id = Number(messageId);
    if (!Number.isInteger(id) || id <= 0) return { ok: false };
    const accessHash = readPeerAccessHash(this.options.sm, peerId);
    try {
      await this.options.worker.call('message.editMessage', [peerId, id, text, accessHash]);
    } catch {
      return { ok: false };
    }
    this.options.drafts.cancelEditing(peerId, threadId);
    return { ok: true, messageId: id };
  }

  @RequestLog()
  @Method()
  async deleteMessages(
    peerId: string,
    ids: number[],
    options?: { revoke?: boolean },
  ): Promise<SendTextResult> {
    const numeric = positiveIds(ids);
    if (numeric.length === 0) return { ok: false };
    const accessHash = readPeerAccessHash(this.options.sm, peerId);
    try {
      await this.options.worker.call('message.deleteMessages', [
        peerId,
        numeric,
        options?.revoke === true,
        accessHash,
      ]);
    } catch {
      return { ok: false };
    }
    this.options.applyLocalDelete?.(peerId, numeric);
    return { ok: true, messageId: numeric[0] };
  }

  @RequestLog()
  @Method()
  async updatePinnedMessage(
    peerId: string,
    messageId: number,
    options?: UpdatePinnedMessageOptions,
  ): Promise<SendTextResult> {
    if (!Number.isInteger(messageId) || messageId <= 0) return { ok: false };
    const accessHash = readPeerAccessHash(this.options.sm, peerId);
    try {
      await this.options.worker.call('message.updatePinnedMessage', [
        peerId,
        messageId,
        options,
        accessHash,
      ]);
    } catch {
      return { ok: false };
    }
    return { ok: true, messageId };
  }

  /** Saved Messages: forward now, silently, without opening the composer. */
  @RequestLog()
  @Method()
  async forwardToSavedMessages(fromPeerId: string, messageId: string): Promise<SendTextResult> {
    const selfId = this.options.globalStore.auth.currentUser?.id;
    if (!selfId) return { ok: false };
    return this.forwardMessages(fromPeerId, selfId, [messageId], { silent: true });
  }

  /** Send the forward staged on `toPeerId` and clear it. */
  @RequestLog()
  @Method()
  async forwardStaged(
    toPeerId: string,
    threadId: string = MAIN_THREAD_ID,
  ): Promise<SendTextResult> {
    const staged = this.options.globalStore.getThreadUI(toPeerId, threadId)?.forwarding;
    if (!staged) return { ok: false };
    const result = await this.forwardMessages(staged.fromPeerId, toPeerId, [staged.messageId], {
      dropAuthor: staged.dropAuthor,
    });
    if (!result.ok) return result;
    this.options.drafts.clearForward(toPeerId, threadId);
    await this.revealNewest(toPeerId, threadId);
    return result;
  }

  private async forwardMessages(
    fromPeerId: string,
    toPeerId: string,
    messageIds: string[],
    options?: ForwardMessagesOptions,
  ): Promise<SendTextResult> {
    const ids = positiveIds(messageIds.map(Number));
    if (ids.length === 0) return { ok: false };
    const fromAccessHash = readPeerAccessHash(this.options.sm, fromPeerId);
    const toAccessHash = readPeerAccessHash(this.options.sm, toPeerId);
    try {
      await this.options.worker.call('message.forwardMessages', [
        fromPeerId,
        toPeerId,
        ids,
        fromAccessHash,
        toAccessHash,
        options,
      ]);
    } catch {
      return { ok: false };
    }
    return { ok: true, messageId: ids[0] };
  }

  @RequestLog()
  @Method()
  async sendSticker(
    peerId: string,
    document: SendStickerDocument,
    threadId: string = MAIN_THREAD_ID,
  ): Promise<SendTextResult> {
    return this.sendOutbound(peerId, threadId, (accessHash, replyToMsgId) =>
      this.options.worker.call('message.sendSticker', [
        peerId,
        document,
        accessHash,
        replyToMsgId,
      ]),
    );
  }

  @RequestLog()
  @Method()
  async sendGifResult(
    peerId: string,
    queryId: string,
    resultId: string,
    threadId: string = MAIN_THREAD_ID,
  ): Promise<SendTextResult> {
    return this.sendOutbound(peerId, threadId, (accessHash, replyToMsgId) =>
      this.options.worker.call('message.sendGifResult', [
        peerId,
        queryId,
        resultId,
        accessHash,
        replyToMsgId,
      ]),
    );
  }

  private async sendOutbound(
    peerId: string,
    threadId: string,
    send: (accessHash: string | undefined, replyToMsgId: number | undefined) => Promise<number>,
  ): Promise<SendTextResult> {
    const accessHash = readPeerAccessHash(this.options.sm, peerId);
    const replyRaw = this.options.globalStore.getThreadUI(peerId, threadId)?.replyingToId;
    const replyNum = replyRaw != null ? Number(replyRaw) : Number.NaN;
    const replyToMsgId = Number.isInteger(replyNum) && replyNum > 0 ? replyNum : undefined;
    const saveInFlight = this.options.drafts.overlappingSave(peerId, threadId);

    let messageId: number;
    try {
      messageId = await send(accessHash, replyToMsgId);
    } catch {
      return { ok: false };
    }
    return this.finishOutbound(peerId, threadId, messageId, saveInFlight);
  }

  private async finishOutbound(
    peerId: string,
    threadId: string,
    messageId: number,
    saveInFlight: ReturnType<MessageDraftController['overlappingSave']>,
  ): Promise<SendTextResult> {
    if (!Number.isInteger(messageId) || messageId <= 0) {
      return { ok: false };
    }
    await this.options.drafts.clearAfterSend(peerId, threadId, saveInFlight);
    await this.revealNewest(peerId, threadId);
    return { ok: true, messageId };
  }

  private async revealNewest(peerId: string, threadId: string): Promise<void> {
    const thread = this.options.globalStore.getThreadUI(peerId, threadId);
    if (thread && (!thread.listedFollowsNewest || !thread.pinToBottom)) {
      try {
        await this.options.jumpToBottom(peerId, threadId);
      } catch {
        // The RPC already succeeded. A scroll failure must not look like a failed send.
      }
    }
  }

  @RequestLog()
  @Method()
  async cancelUpload(uploadId: string): Promise<boolean> {
    const entry = this.activeUploads.get(uploadId);
    if (entry) {
      entry.abort();
      return true;
    }
    return this.options.worker.call('message.cancelSendMedia', [uploadId]);
  }

  @RequestLog()
  @Method()
  async sendMedia(
    chatId: string,
    file: File,
    message: string = '',
    accessHash?: string,
    scheduleTime?: number,
    replyToMsgId?: number,
    forceDocument?: boolean,
  ): Promise<number> {
    const buffer = await file.arrayBuffer();
    return this.options.worker.call(
      'message.sendMedia',
      [
        chatId,
        { name: file.name, type: file.type, buffer },
        message,
        accessHash,
        scheduleTime,
        replyToMsgId,
        forceDocument,
      ],
      { transfer: [buffer] },
    );
  }

  @RequestLog()
  @Method()
  async sendMediaWithProgress(
    chatId: string,
    file: File,
    options: Omit<SendFileOptions, 'threadId'> = {},
    caption: string = '',
    accessHash?: string,
    replyToMsgId?: number,
  ): Promise<number> {
    const buffer = await file.arrayBuffer();
    const transfer: Transferable[] = [buffer];
    let videoCoverPayload: WorkerFilePayload | undefined;

    if (options.videoCover) {
      const coverBuffer = await options.videoCover.arrayBuffer();
      transfer.push(coverBuffer);
      videoCoverPayload = {
        name: options.videoCover.name,
        type: options.videoCover.type,
        buffer: coverBuffer,
      };
    }

    const uploadId =
      options.uploadId ??
      `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const payload: SendMediaWorkerPayload = {
      peerId: chatId,
      file: { name: file.name, type: file.type, buffer },
      message: caption,
      accessHash,
      replyToMsgId,
      forceDocument: options.forceDocument,
      spoiler: options.spoiler,
      invertMedia: options.invertMedia,
      videoCover: videoCoverPayload,
      entities: options.entities,
      uploadId,
      width: options.width,
      height: options.height,
      duration: options.duration,
    };

    if (options.abortSignal) {
      if (options.abortSignal.aborted) {
        throw new Error('Upload aborted');
      }
      options.abortSignal.addEventListener(
        'abort',
        () => {
          void this.cancelUpload(uploadId);
        },
        { once: true },
      );
    }

    let resultMessageId = 0;
    for await (const ev of this.options.worker.stream(
      'message.sendMediaProgress',
      [payload],
      { transfer },
    )) {
      options.onProgress?.(ev);
      if (ev.stage === 'done') {
        resultMessageId = ev.messageId;
      }
    }

    if (!resultMessageId) {
      throw new Error('Upload was cancelled or failed to produce message ID');
    }

    return resultMessageId;
  }

  @RequestLog()
  @Method()
  async sendFile(
    peerId: string,
    file: File,
    caption: string = '',
    options?: SendFileOptions,
  ): Promise<SendTextResult> {
    const threadId = options?.threadId ?? MAIN_THREAD_ID;
    const hasAdvancedOptions = Boolean(
      options?.onProgress ||
        options?.videoCover ||
        options?.spoiler ||
        options?.invertMedia ||
        options?.entities ||
        options?.uploadId ||
        options?.abortSignal ||
        options?.width != null ||
        options?.height != null ||
        options?.duration != null,
    );

    if (hasAdvancedOptions) {
      return this.sendOutbound(peerId, threadId, (accessHash, replyToMsgId) =>
        this.sendMediaWithProgress(
          peerId,
          file,
          options ?? {},
          caption,
          accessHash,
          replyToMsgId,
        ),
      );
    }

    const forceDocument = options?.forceDocument;
    return this.sendOutbound(peerId, threadId, (accessHash, replyToMsgId) =>
      this.sendMedia(peerId, file, caption, accessHash, undefined, replyToMsgId, forceDocument),
    );
  }

  @RequestLog()
  @Method()
  async sendMediaGroup(
    peerId: string,
    items: SendMediaGroupItem[],
    options?: SendMediaGroupOptions,
  ): Promise<SendTextResult> {
    if (!items || items.length === 0) return { ok: false };

    const threadId = options?.threadId ?? MAIN_THREAD_ID;
    const thread = this.options.globalStore.getOrCreateThreadUI(peerId, threadId);
    const saveInFlight = this.options.drafts.overlappingSave(peerId, threadId);
    const replyRaw = thread?.replyingToId;
    const replyNum = replyRaw != null ? Number(replyRaw) : Number.NaN;
    const replyToMsgId = Number.isInteger(replyNum) && replyNum > 0 ? replyNum : undefined;
    const accessHash = readPeerAccessHash(this.options.sm, peerId);

    const messageStore = this.options.ensureMessageStore
      ? this.options.ensureMessageStore(peerId)
      : this.options.sm.has(`message_${peerId}`)
        ? (this.options.sm.get(`message_${peerId}`) as MessageStore)
        : undefined;

    let maxNumericId = 0;
    if (messageStore) {
      for (const key of messageStore.getAllData().keys()) {
        const n = Number(key);
        if (Number.isFinite(n) && n > maxNumericId) maxNumericId = Math.floor(n);
      }
    }
    if (maxNumericId === 0) {
      const dialog = this.options.sm.has('dialog')
        ? (this.options.sm.get('dialog').get(peerId) as Dialog | undefined)
        : undefined;
      const topId = dialog?.topMessageId ? Number(dialog.topMessageId) : 0;
      if (Number.isFinite(topId) && topId > 0) maxNumericId = Math.floor(topId);
      else maxNumericId = 1000;
    }

    const dialog = this.options.sm.has('dialog')
      ? (this.options.sm.get('dialog').get(peerId) as Dialog | undefined)
      : undefined;
    const peerType: PeerType =
      dialog?.peerKind === 'channel'
        ? 'channel'
        : dialog?.peerKind === 'chat'
          ? 'group'
          : 'user';

    const groupedId = items.length > 1 ? `mock_group_${Date.now()}` : undefined;
    const mockEntities: MessageEntity[] = [];
    const uploadIds: string[] = [];
    const mockIds: string[] = [];
    const blobUrls: string[] = [];
    const abortedUploadIds = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const uploadId =
        item.uploadId ?? `upload_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`;
      const mockNumericId = maxNumericId + (i + 1) / 1000;
      const mockId = String(mockNumericId);
      const isPhoto = item.file.type.startsWith('image/');

      let localBlobUrl = '';
      if (typeof URL !== 'undefined' && URL.createObjectURL) {
        try {
          localBlobUrl = URL.createObjectURL(item.file);
          blobUrls.push(localBlobUrl);
        } catch {
          console.warn('Failed to create blob URL for item:', item);
        }
      }

      let localCoverBlobUrl: string | undefined;
      if (item.videoCover && typeof URL !== 'undefined' && URL.createObjectURL) {
        try {
          localCoverBlobUrl = URL.createObjectURL(item.videoCover);
          blobUrls.push(localCoverBlobUrl);
        } catch {
          console.warn('Failed to create blob URL for item:', item);
        }
      }

      const mockEntity: MessageEntity = {
        kind: 'message',
        id: mockId,
        peerId,
        peerType,
        out: true,
        date: Math.floor(Date.now() / 1000),
        message: i === 0 ? (options?.caption ?? '') : '',
        invertMedia: options?.invertMedia ?? item.invertMedia,
        entities: (i === 0 && options?.entities
          ? options.entities.map((e: any) => ({
              ...e,
              className: e.className ?? 'MessageEntityCustomEmoji',
              _: e._ ?? 'messageEntityCustomEmoji',
              offset: e.offset,
              length: e.length,
              documentId: String(e.documentId),
            }))
          : undefined) as any,
        groupedId,
        isEmpty: false,
        sendingState: 'pending',
        uploadProgress: 0,
        uploadId,
        localBlobUrl,
        localCoverBlobUrl,
        media: isPhoto
          ? ({
              _: 'messageMediaPhoto',
              photo: {
                _: 'photo',
                id: '0',
                accessHash: 'local',
                sizes: [
                  {
                    _: 'photoSize',
                    type: 'y',
                    w: item.width ?? 800,
                    h: item.height ?? 800,
                    size: item.file.size,
                  },
                ],
                isLocal: true,
              },
              spoiler: item.spoiler,
            } as any)
          : ({
              _: 'messageMediaDocument',
              document: {
                _: 'document',
                id: '0',
                accessHash: 'local',
                mimeType: item.file.type || 'video/mp4',
                size: item.file.size,
                attributes: [
                  {
                    _: 'documentAttributeVideo',
                    duration: item.duration ?? 0,
                    w: item.width ?? 800,
                    h: item.height ?? 800,
                    supportsStreaming: true,
                  },
                ],
                isLocal: true,
              },
              video: true,
              spoiler: item.spoiler,
            } as any),
      };

      mockEntities.push(mockEntity);
      uploadIds.push(uploadId);
      mockIds.push(mockId);
    }

    if (messageStore) {
      messageStore.update(mockEntities);
    }
    for (const mid of mockIds) {
      thread.appendLiveMessage(mid);
    }
    await this.options.drafts.clearAfterSend(peerId, threadId, saveInFlight);
    await this.revealNewest(peerId, threadId);

    const abortController = new AbortController();
    let isCleanedUp = false;
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      for (const url of blobUrls) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
      if (messageStore) {
        messageStore.deleteByIds(mockIds);
      }
      thread.dropListedIds(mockIds);
      for (const uid of uploadIds) {
        this.activeUploads.delete(uid);
      }
    };

    const abortItem = (index: number) => {
      const uid = uploadIds[index];
      if (!uid || abortedUploadIds.has(uid)) return;
      abortedUploadIds.add(uid);

      void this.options.worker.call('message.cancelSendMedia', [uid]);

      const mid = mockIds[index];
      if (mid) {
        if (messageStore) {
          messageStore.deleteByIds([mid]);
        }
        thread.dropListedIds([mid]);
      }

      const url = blobUrls[index];
      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }

      this.activeUploads.delete(uid);

      if (abortedUploadIds.size === items.length) {
        abortController.abort();
        cleanup();
      }
    };

    for (let i = 0; i < uploadIds.length; i++) {
      const uid = uploadIds[i];
      const mid = mockIds[i];
      this.activeUploads.set(uid, {
        peerId,
        threadId,
        mockIds: [mid],
        abort: () => {
          abortItem(i);
        },
      });

      const item = items[i];
      if (item.abortSignal) {
        if (item.abortSignal.aborted) {
          abortItem(i);
        } else {
          item.abortSignal.addEventListener('abort', () => abortItem(i), { once: true });
        }
      }
    }

    if (options?.abortSignal) {
      if (options.abortSignal.aborted) {
        for (let i = 0; i < items.length; i++) abortItem(i);
        return { ok: false };
      }
      options.abortSignal.addEventListener(
        'abort',
        () => {
          for (let i = 0; i < items.length; i++) abortItem(i);
        },
        { once: true },
      );
    }

    try {
      const workerItems: SendMultiMediaWorkerItem[] = [];
      const transfer: Transferable[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (abortedUploadIds.has(uploadIds[i])) continue;
        const buf = await item.file.arrayBuffer();
        transfer.push(buf);
        let coverPayload: WorkerFilePayload | undefined;
        if (item.videoCover) {
          const coverBuf = await item.videoCover.arrayBuffer();
          transfer.push(coverBuf);
          coverPayload = {
            name: item.videoCover.name,
            type: item.videoCover.type,
            buffer: coverBuf,
          };
        }
        workerItems.push({
          file: { name: item.file.name, type: item.file.type, buffer: buf },
          spoiler: item.spoiler,
          videoCover: coverPayload,
          uploadId: uploadIds[i],
          forceDocument: item.forceDocument,
          width: item.width,
          height: item.height,
          duration: item.duration,
        });
      }

      if (workerItems.length === 0) {
        cleanup();
        return { ok: false };
      }

      const payload: SendMultiMediaWorkerPayload = {
        peerId,
        items: workerItems,
        message: options?.caption,
        entities: options?.entities,
        invertMedia: options?.invertMedia,
        accessHash,
        replyToMsgId,
      };

      let lastDoneMessageId = 0;
      for await (const ev of this.options.worker.stream(
        'message.sendMultiMediaProgress',
        [payload],
        { transfer },
      )) {
        if (abortController.signal.aborted) break;
        options?.onProgress?.(ev);
        if (ev.stage === 'done') {
          lastDoneMessageId = ev.messageIds[0] ?? 0;
          // Synchronously remove all optimistic mock messages
          cleanup();

          if (ev.messageIds.length > 0) {
            for (const mid of ev.messageIds) {
              thread.ingestLiveMessage(String(mid));
            }
            if (this.options.ensureListedIdsCached) {
              await this.options.ensureListedIdsCached(peerId, threadId);
            }
          }
        } else if (ev.uploadId && !abortedUploadIds.has(ev.uploadId)) {
          const idx = uploadIds.indexOf(ev.uploadId);
          if (idx >= 0 && mockEntities[idx]) {
            const updated = {
              ...mockEntities[idx],
              uploadProgress: ev.progress > 1 ? ev.progress / 100 : ev.progress,
            };
            mockEntities[idx] = updated;
            messageStore?.update([updated]);
          }
        }
      }

      cleanup();

      if (!lastDoneMessageId) {
        return { ok: false };
      }

      return this.finishOutbound(peerId, threadId, lastDoneMessageId, saveInFlight);
    } catch (err) {
      cleanup();
      throw err;
    }
  }
}

function positiveIds(ids: number[]): number[] {
  return ids.filter((id) => Number.isInteger(id) && id > 0);
}
