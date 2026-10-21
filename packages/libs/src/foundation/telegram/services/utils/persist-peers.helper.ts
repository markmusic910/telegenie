import type { LocalDb } from '../../local-db/local-db';
import type {
  Channel,
  ChannelForbidden,
  ChannelFull,
  Chat,
  ChatEmpty,
  ChatForbidden,
  ChatFull,
  TypeEncryptedChat,
} from '../../types/api-types';
import type { User, UserEmpty, UserFull } from '../../types/users';

export type PersistPeersInput = {
  users?: Array<User | UserEmpty>;
  chats?: Array<Chat | ChatEmpty | ChatForbidden>;
  channels?: Array<Channel | ChannelForbidden>;
  userFulls?: UserFull[];
  chatFulls?: ChatFull[];
  channelFulls?: ChannelFull[];
  encryptedChats?: TypeEncryptedChat[];
};

/** Write peer / full entities into LocalDb when available. */
export async function persistPeers(
  localDb: LocalDb | undefined,
  input: PersistPeersInput,
): Promise<void> {
  if (!localDb) return;
  if (input.users?.length) await localDb.putUsers(input.users);
  if (input.chats?.length) await localDb.putChats(input.chats);
  if (input.channels?.length) await localDb.putChannels(input.channels);
  if (input.userFulls?.length) {
    for (const full of input.userFulls) {
      await localDb.putUserFull(full);
    }
  }
  if (input.chatFulls?.length) {
    for (const full of input.chatFulls) {
      await localDb.putChatFull(full);
    }
  }
  if (input.channelFulls?.length) {
    for (const full of input.channelFulls) {
      await localDb.putChannelFull(full);
    }
  }
  if (input.encryptedChats?.length) {
    await localDb.putEncryptedChats(input.encryptedChats);
  }
}
