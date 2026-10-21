import { Api, TelegramClient } from '@telegenie/teleproto';
import type {
  Channel,
  ChannelForbidden,
  Chat,
  ChatEmpty,
  ChatForbidden,
  Dialog,
  DialogFolder,
  MessageEmpty,
  User,
} from '../types/api-types';
import type { Message, MessageService } from '../types/message';
import { convertTypeChat } from './converters/chat.converter';
import { convertDialog, convertDialogFolder } from './converters/common.converter';
import { convertUser } from './converters/user.converter';
import { convertMessages } from './converters/message.converter';

type ConversionServiceOptions = {
  debug?: boolean;
};

/**
 * ConversionService
 */
export class ConversionService {
  private debug: boolean;
  private log: (...args: unknown[]) => void;
  client: TelegramClient | null = null;

  constructor({ debug }: ConversionServiceOptions = {}) {
    this.debug = debug ?? false;
    this.log = (...args: unknown[]) => {
      if (this.debug) {
        console.info('[ConversionService]', ...args);
      }
    };
  }

  convertDialogResponse = (
    resp: Api.messages.TypeDialogs,
  ): {
    dialogs: Dialog[];
    dialogFolders: DialogFolder[];
    users: User[];
    chats: Chat[];
    channels: Channel[];
    forbiddenChats: ChatForbidden[];
    forbiddenChannels: ChannelForbidden[];
    emptyChats: ChatEmpty[];
    messages: Message[];
    emptyMessages: MessageEmpty[];
    messageServices: MessageService[];
    count: number;
  } => {
    const respJSON = resp.toJSON() as {
      dialogs: Api.TypeDialog[];
      messages: Api.TypeMessage[];
      chats: Api.TypeChat[];
      users: Api.TypeUser[];
      count: number;
    };
    const { dialogs: tgDialogs, messages: tgMessages, chats: tgChats, users: tgUsers } = respJSON;
    if (tgDialogs.length === 0) {
      return {
        count: 0,
        users: [],
        dialogs: [],
        dialogFolders: [],
        chats: [],
        channels: [],
        forbiddenChats: [],
        forbiddenChannels: [],
        emptyChats: [],
        messages: [],
        emptyMessages: [],
        messageServices: [],
      };
    }
    let count = tgDialogs.length;
    if (resp instanceof Api.messages.DialogsSlice) {
      count = resp.count ?? 0;
    }
    const { chats, channels, forbiddenChats, forbiddenChannels, emptyChats } =
      convertTypeChat(tgChats);
    const { messages: convertedMessages, emptyMessages, messageServices } =
      convertMessages(tgMessages);

    return {
      dialogs: tgDialogs
        .filter((dialog) => dialog instanceof Api.Dialog)
        .map((dialog) => convertDialog(dialog)),
      dialogFolders: tgDialogs
        .filter((dialog) => dialog instanceof Api.DialogFolder)
        .map((dialog) => convertDialogFolder(dialog)),
      users: tgUsers.map((user) => convertUser(user)),
      count,
      chats,
      channels,
      forbiddenChats,
      forbiddenChannels,
      emptyChats,
      messages: convertedMessages,
      emptyMessages,
      messageServices,
    };
  };
}
