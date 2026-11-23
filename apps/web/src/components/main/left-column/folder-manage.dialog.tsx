'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ALL_CHATS_FOLDER_ID, type DialogFilterEntity } from '@telegenie/sdk';
import { ChevronRight, FolderKanban, Lock, Pencil, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useRef, useState } from 'react';

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
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuTrigger,
} from '@/lib/components/ui/context-menu';
import { Dialog, DialogHeader, DialogPopup, DialogTitle } from '@/lib/components/ui/dialog';
import { ScrollArea } from '@/lib/components/ui/scroll-area';
import { Switch } from '@/lib/components/ui/switch';
import { toastManager } from '@/lib/components/ui/toast';
import { useSDK, useStore } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import FolderDetailView from './folder-detail.view';
import {
  extractControllerError,
  FolderGlyph,
  FolderTitleText,
  formatFolderErrorMessage,
  getFolderColor,
} from './folder.meta';

type DialogView =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; folderId: string };

interface FolderManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function asId(value: UniqueIdentifier): string {
  return String(value);
}

const SortableFolderRow = observer(function SortableFolderRow({
  filter,
  canDrag,
  onEdit,
  onRequestDelete,
}: {
  filter: DialogFilterEntity;
  canDrag: boolean;
  onEdit: (folderId: string) => void;
  onRequestDelete: (filter: DialogFilterEntity) => void;
}) {
  const isDefault = filter.id === ALL_CHATS_FOLDER_ID || filter.isDefault;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: filter.id,
    disabled: !canDrag,
  });

  const colorMeta = getFolderColor(filter.color);

  const rowButton = (
    <button
      type="button"
      disabled={isDefault}
      onClick={() => {
        if (!isDefault) onEdit(filter.id);
      }}
      className={cn(
        'flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors outline-none',
        !isDefault && 'hover:bg-accent focus-visible:bg-accent',
        isDefault && 'cursor-default text-muted-foreground',
        canDrag && (isDragging ? 'cursor-grabbing' : 'cursor-grab'),
      )}
    >
      <FolderGlyph filter={filter} className="size-5 shrink-0 text-muted-foreground" />
      <span className={cn('min-w-0 flex-1 truncate text-sm', !isDefault && 'font-medium text-foreground')}>
        <FolderTitleText
          title={filter.title}
          entities={filter.titleEntities}
          emojiSize={16}
        />
      </span>
      {colorMeta ? (
        <span
          className={cn('size-3 shrink-0 rounded-full', colorMeta.swatchClass)}
          aria-label={`${colorMeta.label} tag color`}
        />
      ) : null}
      {!isDefault ? (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
      ) : null}
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && 'relative z-10 rounded-lg bg-card opacity-80 shadow-md')}
      {...(canDrag ? attributes : {})}
      {...(canDrag ? listeners : {})}
    >
      {isDefault ? (
        rowButton
      ) : (
        <ContextMenu>
          <ContextMenuTrigger render={<div className="w-full" />}>{rowButton}</ContextMenuTrigger>
          <ContextMenuPopup>
            <ContextMenuItem onClick={() => onEdit(filter.id)}>
              <Pencil className="size-4" />
              Edit Folder
            </ContextMenuItem>
            <ContextMenuItem variant="destructive" onClick={() => onRequestDelete(filter)}>
              <Trash2 className="size-4" />
              Delete Folder
            </ContextMenuItem>
          </ContextMenuPopup>
        </ContextMenu>
      )}
    </li>
  );
});

const FolderManageDialog = observer(function FolderManageDialog({
  open,
  onOpenChange,
}: FolderManageDialogProps) {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const filterStore = useStore('dialogFilter');

  const [view, setView] = useState<DialogView>({ kind: 'list' });
  const [deleteTarget, setDeleteTarget] = useState<DialogFilterEntity | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingTags, setTogglingTags] = useState(false);

  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const dragOrderRef = useRef<string[] | null>(null);
  const startOrderRef = useRef<string[]>([]);

  useEffect(() => {
    if (!open) {
      setView({ kind: 'list' });
      setDeleteTarget(null);
      setDragOrder(null);
      dragOrderRef.current = null;
    }
  }, [open]);

  const isPremium = Boolean(globalStore.auth.currentUser?.premium);
  const filters = filterStore.getAllData();
  const sortedIds = globalStore.nav.sortedFolderIds;
  const orderedIds = (sortedIds.length > 0 ? sortedIds : Array.from(filters.keys())).filter((id) =>
    filters.has(id),
  );
  const displayIds = dragOrder ?? orderedIds;

  const orderedIdsRef = useRef(orderedIds);
  orderedIdsRef.current = orderedIds;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const ids = orderedIdsRef.current;
    // Do not drag All Chats for non-Premium accounts.
    if (!isPremium && asId(event.active.id) === ALL_CHATS_FOLDER_ID) return;
    dragOrderRef.current = ids;
    startOrderRef.current = ids;
    setDragOrder(ids);
  }, [isPremium]);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeId = asId(active.id);
      const overId = asId(over.id);

      // Non-Premium accounts must keep All Chats at index 0.
      if (!isPremium && (activeId === ALL_CHATS_FOLDER_ID || overId === ALL_CHATS_FOLDER_ID)) {
        return;
      }

      setDragOrder((prev) => {
        const current = prev ?? orderedIdsRef.current;
        const oldIndex = current.indexOf(activeId);
        const newIndex = current.indexOf(overId);
        if (oldIndex < 0 || newIndex < 0) return current;
        if (!isPremium && newIndex === 0 && current[0] === ALL_CHATS_FOLDER_ID) return current;
        const next = arrayMove(current, oldIndex, newIndex);
        dragOrderRef.current = next;
        return next;
      });
    },
    [isPremium],
  );

  const handleDragEnd = useCallback(async () => {
    const next = dragOrderRef.current ?? orderedIdsRef.current;
    const start = startOrderRef.current;
    const unchanged = next.length === start.length && next.every((id, i) => id === start[i]);

    if (unchanged) {
      dragOrderRef.current = null;
      setDragOrder(null);
      return;
    }

    try {
      const result = await sdk.dialogFilter.reorder(next);
      const err = extractControllerError(result);
      if (err) {
        toastManager.add({ title: formatFolderErrorMessage(err), type: 'error' });
      }
    } catch (err) {
      toastManager.add({
        title: formatFolderErrorMessage(
          err instanceof Error ? err.message : 'Failed to reorder folders',
        ),
        type: 'error',
      });
    } finally {
      dragOrderRef.current = null;
      setDragOrder(null);
    }
  }, [sdk]);

  const handleDragCancel = useCallback(() => {
    dragOrderRef.current = null;
    setDragOrder(null);
  }, []);

  const handleToggleTags = async (checked: boolean) => {
    if (!isPremium || togglingTags) return;
    setTogglingTags(true);
    try {
      const result = await sdk.dialogFilter.setTagsEnabled(checked);
      const err = extractControllerError(result);
      if (err) {
        toastManager.add({ title: formatFolderErrorMessage(err), type: 'error' });
      }
    } catch (err) {
      toastManager.add({
        title: formatFolderErrorMessage(
          err instanceof Error ? err.message : 'Failed to update folder tags',
        ),
        type: 'error',
      });
    } finally {
      setTogglingTags(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const result = await sdk.dialogFilter.delete(deleteTarget.id);
      const err = extractControllerError(result);
      if (err) {
        toastManager.add({ title: formatFolderErrorMessage(err), type: 'error' });
        return;
      }
      setDeleteTarget(null);
    } catch (err) {
      toastManager.add({
        title: formatFolderErrorMessage(
          err instanceof Error ? err.message : 'Failed to delete folder',
        ),
        type: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  const editingFolder =
    view.kind === 'edit' ? (filters.get(view.folderId) ?? null) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup
        className="flex h-[min(640px,85vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        showCloseButton={view.kind === 'list'}
      >
        {view.kind === 'list' ? (
          <>
            <DialogHeader className="border-b border-border px-5 py-3.5">
              <DialogTitle className="text-base">Chat Folders</DialogTitle>
            </DialogHeader>

            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-5 p-5">
                {/* Banner */}
                <div className="flex flex-col items-center gap-2.5 py-2 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <FolderKanban className="size-7" />
                  </div>
                  <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                    Create folders for different groups of chats and quickly switch between them.
                  </p>
                </div>

                {/* FOLDERS list */}
                <section className="flex flex-col gap-1.5">
                  <div className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Folders
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      modifiers={[restrictToVerticalAxis]}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragEnd={() => {
                        void handleDragEnd();
                      }}
                      onDragCancel={handleDragCancel}
                    >
                      <SortableContext items={displayIds} strategy={verticalListSortingStrategy}>
                        <ul className="divide-y divide-border/60" role="list" aria-label="Chat folders">
                          {displayIds.map((folderId) => {
                            const filter = filters.get(folderId);
                            if (!filter) return null;
                            const isDefault =
                              filter.id === ALL_CHATS_FOLDER_ID || filter.isDefault;
                            return (
                              <SortableFolderRow
                                key={folderId}
                                filter={filter}
                                canDrag={!isDefault || isPremium}
                                onEdit={(id) => setView({ kind: 'edit', folderId: id })}
                                onRequestDelete={(target) => setDeleteTarget(target)}
                              />
                            );
                          })}
                        </ul>
                      </SortableContext>
                    </DndContext>

                    <button
                      type="button"
                      onClick={() => setView({ kind: 'create' })}
                      className="flex w-full items-center justify-between border-t border-border/60 px-3.5 py-2.5 text-left text-sm font-medium text-primary transition-colors hover:bg-accent"
                    >
                      <span>Add a Custom Folder</span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
                    </button>
                  </div>
                  <p className="px-1 text-xs text-muted-foreground">
                    Drag and drop folders to change order. Right click to remove.
                  </p>
                </section>

                {/* SHOW FOLDER TAGS (Telegram Premium) */}
                <section className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Show Folder Tags</span>
                      {!isPremium ? (
                        <Badge variant="outline" size="sm" className="gap-1 text-[10px]">
                          <Lock className="size-2.5" />
                          Premium
                        </Badge>
                      ) : null}
                    </div>
                    <Switch
                      checked={isPremium && globalStore.nav.folderTagsEnabled}
                      disabled={!isPremium || togglingTags}
                      aria-label="Show Folder Tags"
                      onCheckedChange={(checked) => {
                        void handleToggleTags(checked);
                      }}
                    />
                  </div>
                  <p className="px-1 text-xs text-muted-foreground">
                    {isPremium
                      ? 'Display folder names for each chat in the chat list.'
                      : 'Folder tags require Telegram Premium.'}
                  </p>
                </section>
              </div>
            </ScrollArea>
          </>
        ) : (
          <FolderDetailView
            key={view.kind === 'edit' ? view.folderId : 'create'}
            folder={editingFolder}
            onBack={() => setView({ kind: 'list' })}
            onSaved={() => setView({ kind: 'list' })}
            onDeleted={() => setView({ kind: 'list' })}
          />
        )}
      </DialogPopup>

      {/* Right-click Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the folder &ldquo;{deleteTarget?.title}&rdquo;. Your chats and
              messages will not be affected.
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
              onClick={() => void handleConfirmDelete()}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </Dialog>
  );
});

export default FolderManageDialog;
