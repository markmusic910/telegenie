/** Persistable nav fields (no computeds, no store refs). */
export type NavSnapshot = {
  selectedDialogId?: string;
  sortedDialogIds?: string[];
  sortedDialogIdsWithArchived?: string[];
  selectedFolderId?: string;
  sortedFolderIds?: string[];
};

/** Selected chat, folder rail, and dialog-list order. No actions. */
export interface NavState {
  /** Currently selected dialog id (Bot API / TDLib peer id). */
  readonly selectedDialogId: string | undefined;
  /**
   * Dialog list order from the Telegram SharedWorker (`dialogOrder` event).
   * Tabs display this as-is; they do not re-sort locally.
   */
  readonly sortedDialogIds: readonly string[];
  /**
   * `allIds` from the same event: main list plus archive, ranked together.
   * Used by folders that do not set `excludeArchived`.
   */
  readonly sortedDialogIdsWithArchived: readonly string[];
  /** Selected folder (dialog filter) id. `'0'` = All Chats. */
  readonly selectedFolderId: string;
  /** Folder rail order from the server; refreshed by `dialogFilter.getAll`. */
  readonly sortedFolderIds: readonly string[];
}
