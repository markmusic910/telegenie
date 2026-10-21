import { toJS } from 'mobx';
import { ALL_CHATS_FOLDER_ID } from '../../../modules/dialog-filter/dialog-filter.constants';
import type { GlobalStore } from '../global.store';
import { GlobalStoreSlice } from '../global-store.slice';
import type { NavSnapshot, NavState } from './nav.state';

function stringIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((id): id is string => typeof id === 'string');
}

/** Selected chat, folder rail, and dialog-list order. */
export class NavSlice extends GlobalStoreSlice implements NavState {
  /** Currently selected dialog id (Bot API / TDLib peer id). */
  selectedDialogId: string | undefined = undefined;

  /**
   * Dialog list order from the Telegram SharedWorker (`dialogOrder` event).
   * Tabs display this as-is; they do not re-sort locally.
   */
  sortedDialogIds: string[] = [];

  /**
   * `allIds` from the same event: main list plus archive, ranked together.
   * Used by folders that do not set `excludeArchived`.
   */
  sortedDialogIdsWithArchived: string[] = [];

  /** Selected folder (dialog filter) id. `'0'` = All Chats. */
  selectedFolderId: string = ALL_CHATS_FOLDER_ID;

  /** Folder rail order from the server; refreshed by `dialogFilter.getAll`. */
  sortedFolderIds: string[] = [];

  private readonly globalStore: GlobalStore;

  constructor(globalStore: GlobalStore) {
    super();
    this.globalStore = globalStore;
    this.observe({ globalStore: false });
  }

  setSelectedDialogId = (dialogId: string | undefined) => {
    if (this.selectedDialogId && this.selectedDialogId !== dialogId) {
      const prevDialog = this.globalStore.dialogs.get(this.selectedDialogId);
      if (prevDialog) {
        for (const thread of prevDialog.threads.values()) {
          thread.clearReplyStack();
          // Selection mode does not follow the user to another chat.
          thread.clearSelection();
        }
      }
    }
    this.selectedDialogId = dialogId;
  };

  /**
   * Apply a `dialogOrder` payload. `allIds` defaults to `ids` so callers that
   * only know the main list cannot leave a stale archive-inclusive order behind.
   */
  setSortedDialogIds = (ids: string[], allIds: string[] = ids) => {
    this.sortedDialogIds = ids;
    this.sortedDialogIdsWithArchived = allIds;
  };

  setSelectedFolderId = (folderId: string) => {
    this.selectedFolderId = folderId;
  };

  setSortedFolderIds = (ids: string[]) => {
    this.sortedFolderIds = ids;
  };

  hydrateFromSnapshot = (snapshot: Record<string, unknown> | undefined) => {
    if (!snapshot) return;
    if (typeof snapshot.selectedDialogId === 'string') {
      this.selectedDialogId = snapshot.selectedDialogId;
    } else if (snapshot.selectedDialogId === undefined || snapshot.selectedDialogId === null) {
      this.selectedDialogId = undefined;
    }
    const sortedDialogIds = stringIds(snapshot.sortedDialogIds);
    if (sortedDialogIds) {
      this.sortedDialogIds = sortedDialogIds;
    }
    const withArchived = stringIds(snapshot.sortedDialogIdsWithArchived);
    if (withArchived) {
      this.sortedDialogIdsWithArchived = withArchived;
    }
    if (typeof snapshot.selectedFolderId === 'string') {
      this.selectedFolderId = snapshot.selectedFolderId;
    }
    const sortedFolderIds = stringIds(snapshot.sortedFolderIds);
    if (sortedFolderIds) {
      this.sortedFolderIds = sortedFolderIds;
    }
  };

  toSnapshot(): NavSnapshot {
    return {
      selectedDialogId: this.selectedDialogId,
      sortedDialogIds: toJS(this.sortedDialogIds),
      sortedDialogIdsWithArchived: toJS(this.sortedDialogIdsWithArchived),
      selectedFolderId: this.selectedFolderId,
      sortedFolderIds: toJS(this.sortedFolderIds),
    };
  }

  toJS(): Record<string, unknown> {
    return this.toSnapshot();
  }
}
