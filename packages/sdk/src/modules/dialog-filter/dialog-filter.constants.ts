import type { DialogFilterEntity } from '../../store/types';

/** All Chats — MTProto `dialogFilterDefault`, order id `0`. */
export const ALL_CHATS_FOLDER_ID = '0';

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
