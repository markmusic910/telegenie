/**
 * A chat folder. Telegram exposes folders as rule sets, never as chat lists —
 * membership is derived from these fields against the loaded dialogs.
 *
 * @see https://core.telegram.org/constructor/dialogFilter
 */
export type DialogFilterEntity = {
  /** Stringified {@link folderId} — the entity store keys on strings. */
  id: string;
  /** `0` = All Chats; other ids come from the server (`messages.getDialogFilters`). */
  folderId: number;
  title: string;
  emoticon?: string;
  color?: number;
  /** The default All Chats folder (`dialogFilterDefault`). */
  isDefault: boolean;
  /** Reserved; all folders come from the server. */
  isLocal: boolean;
  /** `dialogFilterChatlist` (shared folder link) — explicit peer lists only. */
  isChatlist: boolean;
  contacts?: boolean;
  nonContacts?: boolean;
  groups?: boolean;
  broadcasts?: boolean;
  bots?: boolean;
  excludeMuted?: boolean;
  excludeRead?: boolean;
  excludeArchived?: boolean;
  pinnedPeerIds: string[];
  includePeerIds: string[];
  excludePeerIds: string[];
};
