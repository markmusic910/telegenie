'use client';

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { observer } from 'mobx-react-lite';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import { Virtualizer, type CustomContainerComponentProps } from 'virtua';

import { ALL_CHATS_FOLDER_ID, ARCHIVE_FOLDER_ID, isUnreadFolder, type DialogFilterEntity } from '@telegenie/sdk';
import { SquarePen } from 'lucide-react';

import { ScrollArea } from '@/lib/components/ui/scroll-area';
import { Skeleton } from '@/lib/components/ui/skeleton';
import { useSDK, useStore } from '@/lib/contexts/sdk.context';
import { useFolderDialogIds } from '@/lib/hooks/use-folder-dialog-ids';
import { Menu, MenuTrigger, MenuPopup, MenuItem } from '@/components/ui/menu';
import AppNavBar from '@/components/main/app-nav.bar';
import CreateGroupDialog from './create-group.dialog';
import CreateChannelDialog from './create-channel.dialog';
import DialogItem, { DIALOG_ITEM_ESTIMATE_PX } from './dialog.item';
import DialogSortableItem from './dialog.sortable-item';

const AutoAnimateRefContext = createContext<((node: Element | null) => void) | null>(null);

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

const AnimatedDialogList = forwardRef<HTMLUListElement, CustomContainerComponentProps>(
  function AnimatedDialogList({ style, children }, ref) {
    const animationParent = useContext(AutoAnimateRefContext);
    const latest = useRef({ ref, animationParent });
    latest.current = { ref, animationParent };
    const nodeRef = useRef<HTMLUListElement | null>(null);

    const setRef = useCallback((node: HTMLUListElement | null) => {
      if (nodeRef.current === node) return;
      nodeRef.current = node;
      assignRef(latest.current.ref, node);
      latest.current.animationParent?.(node);
    }, []);

    return (
      <ul
        ref={setRef}
        style={style}
        className="flex flex-col gap-px p-2"
        role="list"
        aria-label="Dialog list"
      >
        {children}
      </ul>
    );
  },
);

function DialogListSkeleton() {
  return (
    <div className="flex flex-col gap-px px-3 py-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function pinnedPrefixIds(ids: readonly string[], isPinned: (id: string) => boolean): string[] {
  const pinned: string[] = [];
  for (const id of ids) {
    if (isPinned(id)) pinned.push(id);
    else break;
  }
  return pinned;
}

function asId(value: UniqueIdentifier): string {
  return String(value);
}

/** Extra pixels mounted above/below the viewport so fast scroll does not flash blanks. */
const DIALOG_LIST_BUFFER_PX = 800;

/**
 * Pin order inside a custom folder lives on the filter itself
 * (`messages.updateDialogFilter`), which is out of scope, so pinned
 * drag-and-drop is only offered for the two default folders.
 */
function supportsPinnedDrag(filter: DialogFilterEntity | null): boolean {
  if (!filter) return false;
  if (filter.id === ALL_CHATS_FOLDER_ID) return true;
  return isUnreadFolder(filter);
}

const DialogContainer = observer(() => {
  const sdk = useSDK();
  const dialogStore = useStore('dialog');
  const globalStore = useStore('global');
  const filterStore = useStore('dialogFilter');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef(false);
  const dragOrderRef = useRef<string[] | null>(null);
  const startPinnedRef = useRef<string[]>([]);
  const [animationParent, enableAnimation] = useAutoAnimate();

  const allDialogs = dialogStore.getAllData();
  const selectedFolderId = globalStore.nav.selectedFolderId;
  const folder = filterStore.getAllData().get(selectedFolderId) ?? null;
  const { ids: orderedIds } = useFolderDialogIds(folder);
  const displayIds = dragOrder ?? orderedIds;

  const canDragPinned = supportsPinnedDrag(folder);
  const pinnedIds = canDragPinned
    ? pinnedPrefixIds(orderedIds, (id) => Boolean(allDialogs.get(id)?.pinned))
    : [];
  const pinnedIdSet = new Set(pinnedIds);
  const displayPinnedIds = displayIds.filter((id) => pinnedIdSet.has(id));
  const keepMounted = useMemo(
    () => Array.from({ length: pinnedIds.length }, (_, index) => index),
    [pinnedIds.length],
  );

  const orderedIdsRef = useRef(orderedIds);
  orderedIdsRef.current = orderedIds;
  const pinnedIdSetRef = useRef(pinnedIdSet);
  pinnedIdSetRef.current = pinnedIdSet;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pinned = args.droppableContainers.filter((container) =>
      pinnedIdSetRef.current.has(asId(container.id)),
    );
    return closestCenter({ ...args, droppableContainers: pinned });
  }, []);

  const setAnimationEnabled = useCallback(
    (enabled: boolean) => {
      enableAnimation(enabled);
    },
    [enableAnimation],
  );

  const handleScroll = useCallback(() => {
    if (scrollingRef.current) return;
    scrollingRef.current = true;
    setAnimationEnabled(false);
  }, [setAnimationEnabled]);

  const handleScrollEnd = useCallback(() => {
    scrollingRef.current = false;
    if (!activeId) setAnimationEnabled(true);
  }, [activeId, setAnimationEnabled]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const ids = orderedIdsRef.current;
      dragOrderRef.current = ids;
      startPinnedRef.current = ids.filter((id) => pinnedIdSetRef.current.has(id));
      setActiveId(asId(event.active.id));
      setDragOrder(ids);
      setAnimationEnabled(false);
    },
    [setAnimationEnabled],
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (!pinnedIdSetRef.current.has(asId(over.id))) return;

    setDragOrder((prev) => {
      const current = prev ?? orderedIdsRef.current;
      const oldIndex = current.indexOf(asId(active.id));
      const newIndex = current.indexOf(asId(over.id));
      if (oldIndex < 0 || newIndex < 0) return current;
      const maxPin = pinnedIdSetRef.current.size - 1;
      if (oldIndex > maxPin) return current;
      const next = arrayMove(current, oldIndex, Math.min(newIndex, maxPin));
      dragOrderRef.current = next;
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(async () => {
    const next = dragOrderRef.current ?? orderedIdsRef.current;
    const nextPinned = next.filter((id) => pinnedIdSetRef.current.has(id));
    const startPinned = startPinnedRef.current;
    const unchanged =
      nextPinned.length === startPinned.length &&
      nextPinned.every((id, index) => id === startPinned[index]);

    setActiveId(null);
    if (!scrollingRef.current) setAnimationEnabled(true);

    if (unchanged) {
      dragOrderRef.current = null;
      setDragOrder(null);
      return;
    }

    try {
      await sdk.dialog.reorderPinned(nextPinned);
    } finally {
      dragOrderRef.current = null;
      setDragOrder(null);
    }
  }, [sdk, setAnimationEnabled]);

  const handleDragCancel = useCallback(() => {
    dragOrderRef.current = null;
    setActiveId(null);
    setDragOrder(null);
    if (!scrollingRef.current) setAnimationEnabled(true);
  }, [setAnimationEnabled]);

  useEffect(() => {
    if (!activeId) return;
    document.documentElement.setAttribute('data-dialog-dragging', '');
    return () => {
      document.documentElement.removeAttribute('data-dialog-dragging');
    };
  }, [activeId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        let firstBatch = true;

        for await (const page of sdk.dialog.getAllDialogs()) {
          if (cancelled) break;
          void page;
          if (firstBatch) {
            setLoading(false);
            firstBatch = false;
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dialogs');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Archive comes second so the main list paints before it starts paging.
      // Folders that allow archived chats need it; a failure must not break them.
      if (cancelled) return;
      try {
        for await (const page of sdk.dialog.getAllDialogs(ARCHIVE_FOLDER_ID)) {
          if (cancelled) break;
          void page;
        }
      } catch (err) {
        console.warn('[DialogContainer] failed to load archived dialogs', err);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sdk]);

  return (
    <div className="flex h-full min-w-0 w-full flex-1 flex-col overflow-x-hidden">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {folder?.title || 'All Chats'}
          </h2>
          <span className="text-xs text-muted-foreground">
            {!loading && orderedIds.length > 0 ? `${orderedIds.length}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Compose dropdown menu */}
          <Menu>
            <MenuTrigger className="p-1.5 hover:bg-accent rounded-md cursor-pointer transition-colors duration-100 outline-none flex items-center justify-center">
              <SquarePen className="size-5 text-muted-foreground hover:text-foreground" />
            </MenuTrigger>
            <MenuPopup align="end" className="w-48">
              <MenuItem onClick={() => setCreateGroupOpen(true)}>
                <span>New Group</span>
              </MenuItem>
              <MenuItem disabled className="opacity-50 cursor-not-allowed">
                <span>New Secret Chat</span>
              </MenuItem>
              <MenuItem onClick={() => setCreateChannelOpen(true)}>
                <span>New Channel</span>
              </MenuItem>
            </MenuPopup>
          </Menu>
        </div>
      </div>

      <CreateGroupDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen} />
      <CreateChannelDialog open={createChannelOpen} onOpenChange={setCreateChannelOpen} />

      {loading && orderedIds.length === 0 ? (
        <DialogListSkeleton />
      ) : error && orderedIds.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
          <span className="text-sm text-destructive">{error}</span>
          <span className="text-xs text-muted-foreground">Please try reloading.</span>
        </div>
      ) : orderedIds.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
          <span className="text-sm text-muted-foreground">No conversations yet.</span>
        </div>
      ) : (
        <AutoAnimateRefContext.Provider value={animationParent}>
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={() => {
              void handleDragEnd();
            }}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={displayPinnedIds} strategy={verticalListSortingStrategy}>
              <ScrollArea
                className="flex-1 overflow-x-hidden px-2 py-2"
                wrapContent={false}
                viewportRef={viewportRef}
                viewportClassName="overflow-x-hidden [overflow-anchor:none]"
              >
                <Virtualizer
                  scrollRef={viewportRef}
                  as={AnimatedDialogList}
                  itemSize={DIALOG_ITEM_ESTIMATE_PX}
                  bufferSize={DIALOG_LIST_BUFFER_PX}
                  keepMounted={keepMounted}
                  onScroll={handleScroll}
                  onScrollEnd={handleScrollEnd}
                >
                  {displayIds.map((dialogId) =>
                    pinnedIdSet.has(dialogId) ? (
                      <DialogSortableItem key={dialogId} dialogId={dialogId} />
                    ) : (
                      <DialogItem key={dialogId} dialogId={dialogId} />
                    ),
                  )}
                </Virtualizer>
              </ScrollArea>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeId ? (
                <ul className="m-0 list-none p-0">
                  <DialogItem dialogId={activeId} className="cursor-grabbing bg-card shadow-md" />
                </ul>
              ) : null}
            </DragOverlay>
          </DndContext>
        </AutoAnimateRefContext.Provider>
      )}
      <AppNavBar />
    </div>
  );
});

export default DialogContainer;
