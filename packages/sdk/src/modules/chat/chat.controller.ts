import { Controller, Method, RequestLog } from '@telegenie/decorators';
import { getEntityTypeById } from '@telegenie/libs/foundation/telegram/helpers';
import type { ApiChatReactions } from '@telegenie/libs/foundation/telegram/types';
import type { MissingInvitee } from '@telegenie/libs/foundation/telegram/types/api-types';
import type { PeerIdAccessHash, TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';
import { isChannelId } from '@telegenie/libs/foundation/telegram/utils';
import { Channel } from '@telegenie/sdk/store/entity/models/channel.model';
import { Chat } from '@telegenie/sdk/store/entity/models/chat.model';
import { ChatFull } from '@telegenie/sdk/store/entity/models/chat-full.model';
import { User } from '@telegenie/sdk/store/entity/models/user.model';
import type StoreManager from '@telegenie/sdk/store/store.manager';
import { ConversionService } from '../common/services/convert.service';

type ChatControllerOptions = {
  sm: StoreManager;
  debug?: boolean;
  worker: TelegramWorkerClient;
};

@Controller
export class ChatController {
  worker: TelegramWorkerClient;
  sm: StoreManager;
  converter: ConversionService;

  constructor({ sm, debug, worker }: ChatControllerOptions) {
    this.converter = new ConversionService({
      debug: debug ?? false,
    });
    this.worker = worker;
    this.sm = sm;
  }

  @RequestLog()
  @Method()
  async getChatsByIds(ids: string[]): Promise<Chat[]> {
    const chatsRecord = await this.worker.call('chat.getChatsByIds', [ids]);
    const chatEntities = Object.values(chatsRecord).map((chat) => this.converter.convertChat(chat));
    this.sm.get('chat').update(chatEntities);
    return chatEntities.map((entity) => new Chat(entity));
  }

  @RequestLog()
  @Method()
  async getFullChatByIds(ids: string[]): Promise<Chat[]> {
    const { fullChats, chats, channels, users } = await this.worker.call('chat.getFullChatByIds', [
      ids,
    ]);
    const chatFullEntities = Object.values(fullChats).map((full) =>
      this.converter.convertChatFull(full),
    );
    const chatEntities = Object.values(chats).map((chat) => this.converter.convertChat(chat));
    const channelEntities = Object.values(channels).map((channel) =>
      this.converter.convertChannel(channel),
    );

    if (chatFullEntities.length > 0 && this.sm.has('chatFull')) {
      this.sm.get('chatFull').update(chatFullEntities.map((entity) => new ChatFull(entity)));
    }
    if (chatEntities.length > 0) {
      this.sm.get('chat').update(chatEntities.map((entity) => new Chat(entity)));
    }
    if (channelEntities.length > 0) {
      this.sm.get('channel').update(channelEntities.map((entity) => new Channel(entity)));
    }
    if (Object.keys(users).length > 0) {
      this.sm
        .get('user')
        .update(this.converter.convertUsers(Object.values(users)).map((entity) => new User(entity)));
    }

    return chatEntities.map((entity) => new Chat(entity));
  }

  @RequestLog()
  @Method()
  async createBasicGroup(
    title: string,
    users: PeerIdAccessHash[],
  ): Promise<{ chat: Chat; missingInvitees: MissingInvitee[] }> {
    const result = await this.worker.call('chat.createBasicGroup', [title, users]);
    const chatEntity = this.converter.convertChat(result.chat);
    this.sm.get('chat').update([chatEntity]);
    return { chat: new Chat(chatEntity), missingInvitees: result.missingInvitees };
  }

  @RequestLog()
  @Method()
  async editPhoto(peerId: string, file: File, accessHash?: string): Promise<void> {
    const buffer = await file.arrayBuffer();
    const payload = {
      name: file.name,
      type: file.type,
      buffer,
    };
    await this.worker.call('peers.editPhoto', [peerId, payload, accessHash]);

    // Fetch and update the entity in MobX store reactively
    const isChannel = isChannelId(peerId);
    if (isChannel) {
      const channelsRecord = await this.worker.call('channel.getChannelsByIds', [[peerId]]);
      const channelEntities = Object.values(channelsRecord).map((channel) =>
        this.converter.convertChannel(channel),
      );
      this.sm.get('channel').update(channelEntities);
    } else {
      await this.getChatsByIds([peerId]);
    }
  }

  @RequestLog()
  @Method()
  async setAvailableReactions(input: {
    peerId: string;
    availableReactions: ApiChatReactions | 'none';
    reactionsLimit?: number;
  }): Promise<void> {
    const accessHash =
      getEntityTypeById(input.peerId) === 'channel'
        ? (this.sm.get('channel').getAllData().get(input.peerId) as { accessHash?: string } | undefined)
            ?.accessHash
        : undefined;
    await this.worker.call('chat.setAvailableReactions', [
      input.peerId,
      input.availableReactions,
      input.reactionsLimit,
      accessHash,
    ]);
  }
}
