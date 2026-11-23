import type { DialogFilterEntity } from '../../store/types';

/** All Chats — MTProto `dialogFilterDefault`, order id `0`. */
export const ALL_CHATS_FOLDER_ID = '0';

/** Telegram enforces a 12-character limit on folder titles. */
export const MAX_FOLDER_TITLE_LENGTH = 12;

/** Server ids 0 (All Chats) and 1 (Archived) are reserved; custom folders start at 2. */
export const MIN_CUSTOM_FOLDER_ID = 2;
export const MAX_CUSTOM_FOLDER_ID = 255;

export const ALL_CHATS_FOLDER: DialogFilterEntity = {
  id: ALL_CHATS_FOLDER_ID,
  folderId: 0,
  title: 'All Chats',
  isDefault: true,
  isLocal: false,
  isChatlist: false,
  pinnedPeerIds: [],
  includePeerIds: [],
  excludePeerIds: [],
};

/** Always present before any server folder. Unread comes from the server. */
export const DEFAULT_FOLDER_ENTITIES: DialogFilterEntity[] = [ALL_CHATS_FOLDER];

export const DEFAULT_FOLDER_IDS: string[] = DEFAULT_FOLDER_ENTITIES.map((folder) => folder.id);
