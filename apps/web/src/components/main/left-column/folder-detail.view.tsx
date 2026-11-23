'use client';

import {
  fallbackPeerDisplay,
  MAX_FOLDER_TITLE_LENGTH,
  peerProfileDisplay,
  type CustomEmojiEntity,
  type DialogFilterEntity,
  type Document,
  type SaveFolderFilterInput,
} from '@telegenie/sdk';
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Lock,
  Plus,
  Smile,
  Trash2,
  X,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { type ReactNode, useMemo, useRef, useState } from 'react';

import MessageStickerPicker from '@/components/main/middle-column/message.sticker-picker';
import ChatPickerDialog, { type ChatPickerTypeOption } from '@/lib/components/chat-picker.dialog';
import CustomEmoji from '@/lib/components/custom.emoji';
import PeerAvatar from '@/lib/components/peer.avatar';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/lib/components/ui/alert-dialog';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Popover, PopoverPopup, PopoverTrigger } from '@/lib/components/ui/popover';
import { ScrollArea } from '@/lib/components/ui/scroll-area';
import { toastManager } from '@/lib/components/ui/toast';
import { useDialogPeer, useSDK, useStore } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import { rebaseEntities } from '@/lib/utils/emoji.grapheme';
import FolderIconPicker from './folder-icon.picker';
import {
  EXCLUDE_CHAT_TYPE_OPTIONS,
  extractControllerError,
  FOLDER_COLORS,
  FolderTitleText,
  formatFolderErrorMessage,
  getFolderColor,
  INCLUDE_CHAT_TYPE_OPTIONS,
} from './folder.meta';

const COLLAPSED_CHAT_LIMIT = 8;

type IncludeTypeKey = (typeof INCLUDE_CHAT_TYPE_OPTIONS)[number]['id'];
type ExcludeTypeKey = (typeof EXCLUDE_CHAT_TYPE_OPTIONS)[number]['id'];

interface FolderDetailViewProps {
  /** Existing folder to edit, or `null` to create a new custom folder. */
  folder: DialogFilterEntity | null;
  onBack: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

const SelectedPeerRow = observer(function SelectedPeerRow({
  peerId,
  selfId,
  onRemove,
  disabled,
}: {
  peerId: string;
  selfId: string | undefined;
  onRemove: (peerId: string) => void;
  disabled: boolean;
}) {
  const peer = useDialogPeer(peerId);
  const base = peer?.display ?? (peer ? peerProfileDisplay(peer) : fallbackPeerDisplay(peerId));
  const display =
    selfId && peerId === selfId ? { ...base, name: 'Saved Messages', isSavedMessages: true } : base;

  return (
    <li className="group flex items-center gap-3 px-3 py-2">
      <PeerAvatar peerId={peerId} display={display} photo={peer?.photo} className="size-8" />
      <span className="min-w-0 flex-1 truncate text-sm">{display.name}</span>
      <button
        type="button"
        disabled={disabled}
        aria-label={`Remove ${display.name}`}
        onClick={() => onRemove(peerId)}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-70 transition-colors hover:bg-accent hover:text-foreground hover:opacity-100 disabled:opacity-40"
      >
        <X className="size-4" />
      </button>
    </li>
  );
});

const FolderDetailView = observer(function FolderDetailView({
  folder,
  onBack,
  onSaved,
  onDeleted,
}: FolderDetailViewProps) {
  const sdk = useSDK();
  const globalStore = useStore('global');

  const isEditing = folder !== null;
  const isChatlist = Boolean(folder?.isChatlist);
  const isPremium = Boolean(globalStore.auth.currentUser?.premium);
  const selfId = globalStore.auth.currentUser?.id;

  const [title, setTitle] = useState(folder?.title ?? '');
  const [titleEntities, setTitleEntities] = useState<CustomEmojiEntity[]>(
    () => folder?.titleEntities ?? [],
  );
  const [titleNoanimate, setTitleNoanimate] = useState(Boolean(folder?.titleNoanimate));
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [emoticon, setEmoticon] = useState<string | undefined>(folder?.emoticon);
  const [color, setColor] = useState<number | undefined>(folder?.color);

  const [includeTypes, setIncludeTypes] = useState<IncludeTypeKey[]>(() => {
    if (!folder) return [];
    const active: IncludeTypeKey[] = [];
    if (folder.contacts) active.push('contacts');
    if (folder.nonContacts) active.push('nonContacts');
    if (folder.groups) active.push('groups');
    if (folder.broadcasts) active.push('broadcasts');
    if (folder.bots) active.push('bots');
    return active;
  });

  const [excludeTypes, setExcludeTypes] = useState<ExcludeTypeKey[]>(() => {
    if (!folder) return [];
    const active: ExcludeTypeKey[] = [];
    if (folder.excludeMuted) active.push('excludeMuted');
    if (folder.excludeRead) active.push('excludeRead');
    if (folder.excludeArchived) active.push('excludeArchived');
    return active;
  });

  // Merge pinned + included peers for editing while preserving pinnedPeerIds on save.
  const [includePeerIds, setIncludePeerIds] = useState<string[]>(() => {
    if (!folder) return [];
    return Array.from(new Set([...folder.pinnedPeerIds, ...folder.includePeerIds]));
  });
  const [excludePeerIds, setExcludePeerIds] = useState<string[]>(() =>
    folder ? [...folder.excludePeerIds] : [],
  );

  const [showAllIncluded, setShowAllIncluded] = useState(false);
  const [showAllExcluded, setShowAllExcluded] = useState(false);
  const [pickerMode, setPickerMode] = useState<'include' | 'exclude' | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const includeTypeOptions: ChatPickerTypeOption[] = useMemo(
    () =>
      isChatlist
        ? []
        : INCLUDE_CHAT_TYPE_OPTIONS.map(({ id, label, Icon }) => ({
            id,
            label,
            icon: <Icon className="size-4" />,
          })),
    [isChatlist],
  );

  const excludeTypeOptions: ChatPickerTypeOption[] = useMemo(
    () =>
      EXCLUDE_CHAT_TYPE_OPTIONS.map(({ id, label, Icon }) => ({
        id,
        label,
        icon: <Icon className="size-4" />,
      })),
    [],
  );

  const remainingChars = Math.max(0, MAX_FOLDER_TITLE_LENGTH - title.length);
  const trimmedTitle = title.trim();
  const hasIncluded = includeTypes.length > 0 || includePeerIds.length > 0;
  const canSave = Boolean(trimmedTitle) && hasIncluded && !saving && !deleting;

  const selectedColorMeta = getFolderColor(color);

  const handleTitleChange = (rawNext: string) => {
    const next = rawNext.slice(0, MAX_FOLDER_TITLE_LENGTH);
    setTitleEntities((prev) => rebaseEntities(title, next, prev));
    setTitle(next);
    setErrorMessage(null);
  };

  const handleInsertEmoji = (emoji: string) => {
    const input = titleInputRef.current;
    const current = input?.value ?? title;
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? start;
    const candidate = `${current.slice(0, start)}${emoji}${current.slice(end)}`;
    if (candidate.length > MAX_FOLDER_TITLE_LENGTH) {
      toastManager.add({
        title: `Folder name can be at most ${MAX_FOLDER_TITLE_LENGTH} characters.`,
        type: 'info',
      });
      return;
    }
    setTitleEntities((prev) => rebaseEntities(current, candidate, prev));
    setTitle(candidate);
    setErrorMessage(null);
    const caret = start + emoji.length;
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(caret, caret);
    });
  };

  const handleInsertCustomEmoji = (document: Document, alt: string) => {
    sdk.sticker.rememberCustomEmoji([document]);
    if (!isPremium) {
      toastManager.add({
        title: 'Animated custom emojis in folder names require Telegram Premium.',
        type: 'info',
      });
      handleInsertEmoji(alt);
      return;
    }

    const input = titleInputRef.current;
    const current = input?.value ?? title;
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? start;
    const candidate = `${current.slice(0, start)}${alt}${current.slice(end)}`;
    if (candidate.length > MAX_FOLDER_TITLE_LENGTH) {
      toastManager.add({
        title: `Folder name can be at most ${MAX_FOLDER_TITLE_LENGTH} characters.`,
        type: 'info',
      });
      return;
    }
    const delta = alt.length - (end - start);
    setTitleEntities((prev) => {
      const shifted = prev.flatMap((entity) => {
        if (entity.offset >= end) return [{ ...entity, offset: entity.offset + delta }];
        if (entity.offset + entity.length <= start) return [entity];
        return [];
      });
      shifted.push({ offset: start, length: alt.length, documentId: document.id });
      return shifted;
    });
    setTitle(candidate);
    setErrorMessage(null);
    const caret = start + alt.length;
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(caret, caret);
    });
  };

  const titleMirrorNodes = useMemo(() => {
    if (!titleEntities.length) return null;
    const nodes: ReactNode[] = [];
    let cursor = 0;
    for (const span of [...titleEntities].sort((a, b) => a.offset - b.offset)) {
      if (span.offset < cursor || span.offset + span.length > title.length) continue;
      if (span.offset > cursor) nodes.push(title.slice(cursor, span.offset));
      const fallback = title.slice(span.offset, span.offset + span.length);
      nodes.push(
        <span key={`${span.offset}:${span.documentId}`} className="relative inline-block">
          <span className="invisible">{fallback}</span>
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center [&>*]:shrink-0"
          >
            <CustomEmoji
              documentId={span.documentId}
              fallback={fallback}
              size={18}
              placeholder={false}
            />
          </span>
        </span>,
      );
      cursor = span.offset + span.length;
    }
    if (cursor < title.length) nodes.push(title.slice(cursor));
    return nodes;
  }, [title, titleEntities]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setErrorMessage(null);

    try {
      const includeTypeSet = new Set(includeTypes);
      const excludeTypeSet = new Set(excludeTypes);
      const includedSet = new Set(includePeerIds);
      const preservedPinned = (folder?.pinnedPeerIds ?? []).filter((id) => includedSet.has(id));
      const pinnedSet = new Set(preservedPinned);
      const nonPinnedIncluded = includePeerIds.filter((id) => !pinnedSet.has(id));

      // Non-Premium accounts cannot set a new folder color; preserve existing color untouched if any.
      const effectiveColor = isPremium ? color : folder?.color;

      // Rebase custom emoji entities if leading/trailing whitespace was trimmed.
      const trimmedEntities = rebaseEntities(title, trimmedTitle, titleEntities);

      const baseInput: Omit<SaveFolderFilterInput, 'id'> = {
        title: trimmedTitle,
        titleEntities: trimmedEntities.length > 0 ? trimmedEntities : undefined,
        titleNoanimate: trimmedEntities.length > 0 && titleNoanimate ? true : undefined,
        emoticon: emoticon || undefined,
        color: effectiveColor,
        isChatlist,
        contacts: includeTypeSet.has('contacts') || undefined,
        nonContacts: includeTypeSet.has('nonContacts') || undefined,
        groups: includeTypeSet.has('groups') || undefined,
        broadcasts: includeTypeSet.has('broadcasts') || undefined,
        bots: includeTypeSet.has('bots') || undefined,
        excludeMuted: !isChatlist && excludeTypeSet.has('excludeMuted') ? true : undefined,
        excludeRead: !isChatlist && excludeTypeSet.has('excludeRead') ? true : undefined,
        excludeArchived: !isChatlist && excludeTypeSet.has('excludeArchived') ? true : undefined,
        pinnedPeerIds: preservedPinned,
        includePeerIds: nonPinnedIncluded,
        excludePeerIds: isChatlist ? [] : excludePeerIds,
      };

      const result = isEditing
        ? await sdk.dialogFilter.update({ ...baseInput, id: folder.folderId })
        : await sdk.dialogFilter.create(baseInput);

      const err = extractControllerError(result);
      if (err) {
        const friendly = formatFolderErrorMessage(err);
        setErrorMessage(friendly);
        toastManager.add({ title: friendly, type: 'error' });
        return;
      }

      onSaved();
    } catch (err) {
      const friendly = formatFolderErrorMessage(
        err instanceof Error ? err.message : 'Failed to save folder',
      );
      setErrorMessage(friendly);
      toastManager.add({ title: friendly, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!folder || deleting) return;
    setDeleting(true);
    try {
      const result = await sdk.dialogFilter.delete(folder.id);
      const err = extractControllerError(result);
      if (err) {
        const friendly = formatFolderErrorMessage(err);
        toastManager.add({ title: friendly, type: 'error' });
        return;
      }
      setDeleteConfirmOpen(false);
      onDeleted();
    } catch (err) {
      const friendly = formatFolderErrorMessage(
        err instanceof Error ? err.message : 'Failed to delete folder',
      );
      toastManager.add({ title: friendly, type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const totalIncludedCount = includeTypes.length + includePeerIds.length;
  const visibleIncludePeers = showAllIncluded
    ? includePeerIds
    : includePeerIds.slice(0, Math.max(0, COLLAPSED_CHAT_LIMIT - includeTypes.length));
  const hiddenIncludedCount = includePeerIds.length - visibleIncludePeers.length;

  const visibleExcludePeers = showAllExcluded
    ? excludePeerIds
    : excludePeerIds.slice(0, Math.max(0, COLLAPSED_CHAT_LIMIT - excludeTypes.length));
  const hiddenExcludedCount = excludePeerIds.length - visibleExcludePeers.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving || deleting}
          onClick={onBack}
          className="-ml-2 gap-1 text-primary hover:text-primary"
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>

        <h2 className="text-sm font-semibold">{isEditing ? 'Folder' : 'New Folder'}</h2>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canSave}
          onClick={() => void handleSave()}
          className="-mr-2 font-semibold text-primary hover:text-primary"
        >
          {saving ? 'Saving…' : isEditing ? 'Done' : 'Create'}
        </Button>
      </div>

      {/* Scrollable body */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-5">
          {errorMessage ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorMessage}
            </div>
          ) : null}

          {/* FOLDER NAME */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <label
                htmlFor="folder-name-input"
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Folder Name
              </label>
              {titleEntities.length > 0 && isPremium ? (
                <button
                  type="button"
                  disabled={saving || deleting}
                  onClick={() => setTitleNoanimate((prev) => !prev)}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {titleNoanimate ? 'enable animations' : 'disable animations'}
                </button>
              ) : null}
            </div>
            <div className="relative flex h-10 items-center rounded-lg border border-input bg-background shadow-xs/5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/24">
              <div className="relative flex h-full min-w-0 flex-1 items-center">
                {titleMirrorNodes ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-10 flex items-center overflow-hidden whitespace-pre px-3 text-sm text-foreground"
                  >
                    {titleMirrorNodes}
                  </div>
                ) : null}
                <input
                  ref={titleInputRef}
                  id="folder-name-input"
                  type="text"
                  value={title}
                  maxLength={MAX_FOLDER_TITLE_LENGTH}
                  placeholder="Folder name"
                  disabled={saving || deleting}
                  onChange={(event) => handleTitleChange(event.target.value)}
                  className={cn(
                    'h-full w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/72 disabled:opacity-64',
                    titleMirrorNodes && 'text-transparent caret-foreground selection:bg-primary/25',
                  )}
                />
              </div>
              <div className="flex shrink-0 items-center gap-0.5 pr-2.5">
                <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={saving || deleting}
                        aria-label="Insert emoji"
                        title="Insert emoji"
                        className="text-muted-foreground hover:text-foreground"
                      />
                    }
                  >
                    <Smile className="size-4.5" />
                  </PopoverTrigger>
                  <PopoverPopup
                    align="end"
                    sideOffset={8}
                    className="w-auto [&_[data-slot=popover-viewport]]:p-0"
                  >
                    <MessageStickerPicker
                      emojiOnly
                      onInsertEmoji={handleInsertEmoji}
                      onInsertCustomEmoji={handleInsertCustomEmoji}
                    />
                  </PopoverPopup>
                </Popover>
                <FolderIconPicker
                  value={emoticon}
                  onChange={setEmoticon}
                  disabled={saving || deleting}
                />
                <span
                  className="min-w-4 text-right text-xs tabular-nums text-muted-foreground"
                  aria-label={`${remainingChars} characters remaining`}
                >
                  {remainingChars}
                </span>
              </div>
            </div>
          </section>

          {/* INCLUDED CHATS */}
          <section className="flex flex-col gap-1.5">
            <div className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Included Chats
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <button
                type="button"
                disabled={saving || deleting}
                onClick={() => setPickerMode('include')}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-primary transition-colors hover:bg-accent disabled:opacity-50"
              >
                <Plus className="size-4.5 shrink-0" />
                <span>Add Chats</span>
              </button>

              {totalIncludedCount > 0 ? (
                <ul className="divide-y divide-border/60 border-t border-border/60" role="list">
                  {includeTypes.map((typeKey) => {
                    const option = INCLUDE_CHAT_TYPE_OPTIONS.find((item) => item.id === typeKey);
                    if (!option) return null;
                    const Icon = option.Icon;
                    return (
                      <li key={typeKey} className="flex items-center gap-3 px-3 py-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">{option.label}</span>
                        <button
                          type="button"
                          disabled={saving || deleting}
                          aria-label={`Remove ${option.label}`}
                          onClick={() =>
                            setIncludeTypes((prev) => prev.filter((item) => item !== typeKey))
                          }
                          className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-70 transition-colors hover:bg-accent hover:text-foreground hover:opacity-100"
                        >
                          <X className="size-4" />
                        </button>
                      </li>
                    );
                  })}

                  {visibleIncludePeers.map((peerId) => (
                    <SelectedPeerRow
                      key={peerId}
                      peerId={peerId}
                      selfId={selfId}
                      disabled={saving || deleting}
                      onRemove={(id) =>
                        setIncludePeerIds((prev) => prev.filter((item) => item !== id))
                      }
                    />
                  ))}
                </ul>
              ) : null}

              {hiddenIncludedCount > 0 || (showAllIncluded && includePeerIds.length > COLLAPSED_CHAT_LIMIT) ? (
                <button
                  type="button"
                  onClick={() => setShowAllIncluded((prev) => !prev)}
                  className="flex w-full items-center gap-2 border-t border-border/60 px-3 py-2.5 text-left text-sm text-primary transition-colors hover:bg-accent"
                >
                  {showAllIncluded ? (
                    <>
                      <ChevronUp className="size-4" />
                      <span>Show Fewer Chats</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-4" />
                      <span>
                        Show {hiddenIncludedCount} More {hiddenIncludedCount === 1 ? 'Chat' : 'Chats'}
                      </span>
                    </>
                  )}
                </button>
              ) : null}
            </div>
            <p className="px-1 text-xs text-muted-foreground">
              Choose chats or types of chats that will appear in this folder.
            </p>
          </section>

          {/* EXCLUDED CHATS */}
          {!isChatlist ? (
            <section className="flex flex-col gap-1.5">
              <div className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Excluded Chats
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <button
                  type="button"
                  disabled={saving || deleting}
                  onClick={() => setPickerMode('exclude')}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-primary transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <Plus className="size-4.5 shrink-0" />
                  <span>Add Chats</span>
                </button>

                {excludeTypes.length > 0 || excludePeerIds.length > 0 ? (
                  <ul className="divide-y divide-border/60 border-t border-border/60" role="list">
                    {excludeTypes.map((typeKey) => {
                      const option = EXCLUDE_CHAT_TYPE_OPTIONS.find((item) => item.id === typeKey);
                      if (!option) return null;
                      const Icon = option.Icon;
                      return (
                        <li key={typeKey} className="flex items-center gap-3 px-3 py-2">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">{option.label}</span>
                          <button
                            type="button"
                            disabled={saving || deleting}
                            aria-label={`Remove ${option.label}`}
                            onClick={() =>
                              setExcludeTypes((prev) => prev.filter((item) => item !== typeKey))
                            }
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-70 transition-colors hover:bg-accent hover:text-foreground hover:opacity-100"
                          >
                            <X className="size-4" />
                          </button>
                        </li>
                      );
                    })}

                    {visibleExcludePeers.map((peerId) => (
                      <SelectedPeerRow
                        key={peerId}
                        peerId={peerId}
                        selfId={selfId}
                        disabled={saving || deleting}
                        onRemove={(id) =>
                          setExcludePeerIds((prev) => prev.filter((item) => item !== id))
                        }
                      />
                    ))}
                  </ul>
                ) : null}

                {hiddenExcludedCount > 0 ||
                (showAllExcluded && excludePeerIds.length > COLLAPSED_CHAT_LIMIT) ? (
                  <button
                    type="button"
                    onClick={() => setShowAllExcluded((prev) => !prev)}
                    className="flex w-full items-center gap-2 border-t border-border/60 px-3 py-2.5 text-left text-sm text-primary transition-colors hover:bg-accent"
                  >
                    {showAllExcluded ? (
                      <>
                        <ChevronUp className="size-4" />
                        <span>Show Fewer Chats</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="size-4" />
                        <span>
                          Show {hiddenExcludedCount} More{' '}
                          {hiddenExcludedCount === 1 ? 'Chat' : 'Chats'}
                        </span>
                      </>
                    )}
                  </button>
                ) : null}
              </div>
              <p className="px-1 text-xs text-muted-foreground">
                Choose chats or types of chats that will not appear in this folder.
              </p>
            </section>
          ) : (
            <p className="px-1 text-xs text-muted-foreground">
              Shared folders only support explicitly included chats.
            </p>
          )}

          {/* FOLDER COLOR (Telegram Premium) */}
          <section className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Folder Color
              </span>
              {selectedColorMeta ? (
                <span
                  className={cn(
                    'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-none',
                    selectedColorMeta.tagClass,
                  )}
                >
                  {trimmedTitle ? (
                    <FolderTitleText
                      title={trimmedTitle}
                      entities={rebaseEntities(title, trimmedTitle, titleEntities)}
                      emojiSize={12}
                    />
                  ) : (
                    'Folder'
                  )}
                </span>
              ) : null}
              {!isPremium ? (
                <Badge variant="outline" size="sm" className="ml-auto gap-1 text-[10px]">
                  <Lock className="size-2.5" />
                  Premium
                </Badge>
              ) : null}
            </div>
            <div
              className={cn(
                'overflow-hidden rounded-xl border border-border bg-card',
                !isPremium && 'opacity-60',
              )}
            >
              <div className="flex items-center gap-3 px-3.5 py-3">
                {FOLDER_COLORS.map((swatch) => {
                  const active = color === swatch.id;
                  return (
                    <button
                      key={swatch.id}
                      type="button"
                      disabled={!isPremium || saving || deleting}
                      title={isPremium ? swatch.label : 'Folder colors require Telegram Premium'}
                      aria-label={swatch.label}
                      aria-pressed={active}
                      onClick={() => setColor(swatch.id)}
                      className={cn(
                        'size-7 rounded-full transition-transform',
                        swatch.swatchClass,
                        isPremium && 'hover:scale-110',
                        active && 'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                        !isPremium && 'cursor-not-allowed',
                      )}
                    />
                  );
                })}
              </div>
              {color !== undefined ? (
                <button
                  type="button"
                  disabled={!isPremium || saving || deleting}
                  onClick={() => setColor(undefined)}
                  className="w-full border-t border-border/60 px-3.5 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reset Color
                </button>
              ) : null}
            </div>
            <p className="px-1 text-xs text-muted-foreground">
              {isPremium
                ? "This color will be used for the folder's tag in the chat list."
                : 'Folder colors require Telegram Premium.'}
            </p>
          </section>

          {/* DELETE FOLDER */}
          {isEditing ? (
            <section className="pt-1">
              <Button
                type="button"
                variant="destructive-outline"
                disabled={saving || deleting}
                onClick={() => setDeleteConfirmOpen(true)}
                className="w-full justify-center gap-2"
              >
                <Trash2 className="size-4" />
                Delete Folder
              </Button>
            </section>
          ) : null}
        </div>
      </ScrollArea>

      {/* Shared Chat Picker Dialog for Included / Excluded chats */}
      <ChatPickerDialog
        open={pickerMode !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPickerMode(null);
        }}
        title={pickerMode === 'exclude' ? 'Exclude Chats' : 'Include Chats'}
        mode="multiple"
        includeSavedMessages
        includeArchived
        chatTypes={pickerMode === 'exclude' ? excludeTypeOptions : includeTypeOptions}
        selectedChatTypes={pickerMode === 'exclude' ? excludeTypes : includeTypes}
        selectedPeerIds={pickerMode === 'exclude' ? excludePeerIds : includePeerIds}
        disabledPeerIds={pickerMode === 'exclude' ? includePeerIds : excludePeerIds}
        confirmLabel="Done"
        onConfirmMultiple={({ peerIds, chatTypes }) => {
          if (pickerMode === 'exclude') {
            setExcludePeerIds(peerIds);
            setExcludeTypes(chatTypes as ExcludeTypeKey[]);
          } else if (pickerMode === 'include') {
            setIncludePeerIds(peerIds);
            setIncludeTypes(chatTypes as IncludeTypeKey[]);
          }
          setErrorMessage(null);
        }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the folder &ldquo;{folder?.title}&rdquo;. Your chats and messages
              will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button type="button" variant="ghost" />}>
              Cancel
            </AlertDialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
});

export default FolderDetailView;
