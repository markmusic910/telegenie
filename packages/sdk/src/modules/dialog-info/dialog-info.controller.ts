import { Controller, Method, RequestLog } from '@telegenie/decorators';
import { getEntityTypeById } from '@telegenie/libs/foundation/telegram/helpers';
import type {
  DialogProfileSearchTab,
  PinnedMessagesResult,
} from '@telegenie/libs/foundation/telegram/services/message.service';
import type { TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';
import type GlobalStore from '../../store/global/global.store';
import { User } from '../../store/entity/models/user.model';
import type { MessageStore } from '../../store/types';
import type StoreManager from '../../store/store.manager';
import type { MiddleOverlayFrame } from '../../store/global/models/nav.state';
import { ConversionService } from '../common/services/convert.service';
import { stampMessagesForStore } from '../common/stamp-reply-verification';
import { updateMessagesByPeer } from '../common/update-messages-by-peer';

export type { DialogProfileSearchTab };

type DialogInfoControllerOptions = {
  sm: StoreManager;
  globalStore: GlobalStore;
  debug?: boolean;
  worker: TelegramWorkerClient;
  ensureMessageStore: (peerId: string) => MessageStore;
  getChannelsByIds: (ids: string[]) => Promise<unknown>;
  getFullChannelByIds: (
    options: { id: string; accessHash: string }[],
  ) => Promise<unknown>;
  getChatsByIds: (ids: string[]) => Promise<unknown>;
  getFullChatByIds: (ids: string[], options?: { forceRefresh?: boolean }) => Promise<unknown>;
};

@Controller
export class DialogInfoController {
  worker: TelegramWorkerClient;
  sm: StoreManager;
  private readonly globalStore: GlobalStore;
  converter: ConversionService;
  private readonly ensureMessageStore: (peerId: string) => MessageStore;
  private readonly getChannelsByIds: (ids: string[]) => Promise<unknown>;
  private readonly getFullChannelByIds: (
    options: { id: string; accessHash: string }[],
  ) => Promise<unknown>;
  private readonly getChatsByIds: (ids: string[]) => Promise<unknown>;
  private readonly getFullChatByIds: (
    ids: string[],
    options?: { forceRefresh?: boolean },
  ) => Promise<unknown>;

  constructor({
    sm,
    globalStore,
    debug,
    worker,
    ensureMessageStore,
    getChannelsByIds,
    getFullChannelByIds,
    getChatsByIds,
    getFullChatByIds,
  }: DialogInfoControllerOptions) {
    this.converter = new ConversionService({ debug: debug ?? false });
    this.worker = worker;
    this.sm = sm;
    this.globalStore = globalStore;
    this.ensureMessageStore = ensureMessageStore;
    this.getChannelsByIds = getChannelsByIds;
    this.getFullChannelByIds = getFullChannelByIds;
    this.getChatsByIds = getChatsByIds;
    this.getFullChatByIds = getFullChatByIds;
  }

  private prefetchPeer(peerId: string): void {
    const kind = getEntityTypeById(peerId);
    if (kind === 'channel') {
      void this.getChannelsByIds([peerId]).then(() => {
        const channel = this.sm.has('channel')
          ? (this.sm.get('channel').get(peerId) as Channel | undefined)
          : undefined;
        if (channel?.accessHash) {
          void this.getFullChannelByIds([{ id: peerId, accessHash: channel.accessHash }]).catch(
            () => undefined,
          );
        }
      });
      return;
    }
    if (kind === 'chat') {
      void this.getChatsByIds([peerId]);
      void this.getFullChatByIds([peerId], { forceRefresh: false }).catch(() => undefined);
    }
  }

  @RequestLog()
  @Method()
  open(peerId: string): boolean {
    const trimmed = peerId.trim();
    if (!trimmed) return false;
    try {
      const kind = getEntityTypeById(trimmed);
      if (kind !== 'channel' && kind !== 'chat') return false;
    } catch {
      return false;
    }

    this.globalStore.nav.pushMiddleOverlay({ kind: 'dialog', peerId: trimmed });
    this.prefetchPeer(trimmed);
    return true;
  }

  @RequestLog()
  @Method()
  pop(): MiddleOverlayFrame | undefined {
    return this.globalStore.nav.popMiddleOverlay();
  }

  @RequestLog()
  @Method()
  async searchProfileTab(
    peerId: string,
    tab: DialogProfileSearchTab,
    offsetId = 0,
    limit = 50,
  ): Promise<PinnedMessagesResult> {
    const result = await this.worker.call('message.searchInPeer', [peerId, tab, offsetId, limit]);

    if (result.users?.length && this.sm.has('user')) {
      this.sm
        .get('user')
        .update(this.converter.convertUsers(result.users).map((entity) => new User(entity)));
    }
    if (result.chats?.length && this.sm.has('chat')) {
      this.sm.get('chat').update(result.chats.map((chat) => this.converter.convertChat(chat)));
    }
    if (result.channels?.length && this.sm.has('channel')) {
      this.sm
        .get('channel')
        .update(result.channels.map((channel) => this.converter.convertChannel(channel)));
    }

    const messageEntities = [
      ...this.converter.convertMessages(result.messages),
      ...this.converter.convertServiceMessages(result.messageServices ?? []),
    ];
    const stamped = stampMessagesForStore(messageEntities, this.ensureMessageStore);
    updateMessagesByPeer(this.ensureMessageStore, stamped);

    return result;
  }
}