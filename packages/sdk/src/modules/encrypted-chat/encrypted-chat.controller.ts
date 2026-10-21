import { Controller, Method, RequestLog } from '@telegenie/decorators';
import type { TelegramWorkerClient } from '@telegenie/libs/foundation/telegram/worker';
import type { TypeEncryptedChat } from '@telegenie/libs/foundation/telegram/types/api-types';
import type StoreManager from '../../store/store.manager';
import { ConversionService } from '../common/services/convert.service';
import { EncryptedChat } from '../../store/entity/models/encrypted-chat.model';

type EncryptedChatControllerOptions = {
  sm: StoreManager;
  debug?: boolean;
  worker: TelegramWorkerClient;
};

@Controller
export class EncryptedChatController {
  worker: TelegramWorkerClient;
  sm: StoreManager;
  converter: ConversionService;

  constructor({ sm, debug, worker }: EncryptedChatControllerOptions) {
    this.converter = new ConversionService({
      debug: debug ?? false,
    });
    this.worker = worker;
    this.sm = sm;
  }

  @RequestLog()
  @Method()
  async create(userId: string, accessHash?: string): Promise<EncryptedChat> {
    const chat = await this.worker.call('encryptedChat.create', [userId, accessHash]);
    return this.upsert(chat);
  }

  @RequestLog()
  @Method()
  async accept(chatId: number): Promise<EncryptedChat> {
    const chat = await this.worker.call('encryptedChat.accept', [chatId]);
    return this.upsert(chat);
  }

  private upsert(chat: TypeEncryptedChat): EncryptedChat {
    const entity = this.converter.convertEncryptedChat(chat);
    this.sm.get('encryptedChat').update([entity]);
    return new EncryptedChat(entity);
  }
}
