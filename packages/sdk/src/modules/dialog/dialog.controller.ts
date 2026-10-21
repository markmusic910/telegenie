import { Controller, Method, RequestLog } from '@telegenie/decorators';
import type { TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';
import { Dialog } from '@telegenie/sdk/store/entity/models/dialog.model';
import type StoreManager from '@telegenie/sdk/store/store.manager';
import type { MessageStore } from '@telegenie/sdk/store/types';
import { ConversionService } from '../common/services/convert.service';
import { writeStampedMessages } from '../common/stamp-reply-verification';

type DialogControllerOptions = {
  sm: StoreManager;
  debug?: boolean;
  worker: TelegramWorkerClient;
  ensureMessageStore: (peerId: string) => MessageStore;
};

function uniqById<T extends { id: any }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = String(item.id);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Fetches all dialogs and writes related entities directly into entity stores.
 */
@Controller
export class DialogController {
  worker: TelegramWorkerClient;
  sm: StoreManager;
  converter: ConversionService;
  private readonly ensureMessageStore: (peerId: string) => MessageStore;

  constructor({ sm, debug, worker, ensureMessageStore }: DialogControllerOptions) {
    this.converter = new ConversionService({
      debug: debug ?? false,
    });
    this.worker = worker;
    this.sm = sm;
    this.ensureMessageStore = ensureMessageStore;
  }

  /**
   * Page through a Telegram folder: 0 (default) is the main list, 1 the archive.
   *
   * @yields Dialog[] - Only non-folder dialog entries per page.
   */
  @RequestLog()
  @Method()
  async *getAllDialogs(folderId = 0): AsyncGenerator<Dialog[]> {
    for await (const batch of this.worker.stream('dialog.getAllDialogs', [folderId])) {
      const {
        dialogs,
        dialogFolders,
        users,
        chats,
        channels,
        forbiddenChats,
        forbiddenChannels,
        emptyChats,
        messages,
        emptyMessages,
        messageServices,
      } = batch;

      // Rows from a scoped query do not reliably repeat their folder, so fall
      // back to the queried scope — the folder matcher relies on this field.
      const scope = batch.folderId ?? folderId;
      const dialogEntities = uniqById([
        ...this.converter.convertDialogs(dialogs).map((entity) => ({
          ...entity,
          folderId: entity.folderId ?? scope,
        })),
        ...this.converter.convertDialogFolders(dialogFolders),
      ]);
      if (dialogEntities.length > 0) {
        this.sm.get('dialog').update(dialogEntities);
      }

      const chatEntities = uniqById([
        ...chats.map((c) => this.converter.convertChat(c)),
        ...forbiddenChats.map((c) => this.converter.convertForbiddenChat(c)),
        ...emptyChats.map((c) => this.converter.convertEmptyChat(c)),
      ]);
      if (chatEntities.length > 0) {
        this.sm.get('chat').update(chatEntities);
      }

      const channelEntities = uniqById([
        ...channels.map((c) => this.converter.convertChannel(c)),
        ...forbiddenChannels.map((c) => this.converter.convertForbiddenChannel(c)),
      ]);
      if (channelEntities.length > 0) {
        this.sm.get('channel').update(channelEntities);
      }

      const userEntities = uniqById(this.converter.convertUsers(users));
      if (userEntities.length > 0) {
        this.sm.get('user').update(userEntities);
      }

      const messageEntities = uniqById([
        ...this.converter.convertMessages(messages),
        ...this.converter.convertServiceMessages(messageServices),
        ...this.converter.convertEmptyMessages(emptyMessages),
      ]);
      writeStampedMessages(this.ensureMessageStore, messageEntities);

      yield dialogEntities.filter((e) => !e.isFolder).map((entity) => new Dialog(entity));
    }
  }

  /**
   * Persist a new pinned-dialog order for a folder (main list is `folderId` 0).
   * The SharedWorker applies the order immediately and fans it out via `dialogOrder`.
   */
  @RequestLog()
  @Method()
  async reorderPinned(peerIds: string[], folderId = 0): Promise<void> {
    await this.worker.call('dialog.reorderPinned', [peerIds, folderId]);
  }
}
