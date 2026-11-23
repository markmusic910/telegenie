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
import { SlidersHorizontal } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ScrollArea } from '@/lib/components/ui/scroll-area';
import { useSDK, useStore } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import FolderItem from './folder.item';
import FolderManageDialog from './folder-manage.dialog';
import FolderSortableItem from './folder.sortable-item';

function asId(value: UniqueIdentifier): string {
  return String(value);
}

/**
 * Vertical folder rail at the left edge of the left column.
 *
 * Unlike the dialog list, every entry is draggable and the list is short, so
 * there is no pinned-prefix constraint and no virtualization.
 */
const FolderRail = observer(() => {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const filterStore = useStore('dialogFilter');

  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const dragOrderRef = useRef<string[] | null>(null);
  const startOrderRef = useRef<string[]>([]);

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
    dragOrderRef.current = ids;
    startOrderRef.current = ids;
    setActiveId(asId(event.active.id));
    setDragOrder(ids);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDragOrder((prev) => {
      const current = prev ?? orderedIdsRef.current;
      const oldIndex = current.indexOf(asId(active.id));
      const newIndex = current.indexOf(asId(over.id));
      if (oldIndex < 0 || newIndex < 0) return current;
      const next = arrayMove(current, oldIndex, newIndex);
      dragOrderRef.current = next;
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(async () => {
    const next = dragOrderRef.current ?? orderedIdsRef.current;
    const start = startOrderRef.current;
    const unchanged = next.length === start.length && next.every((id, i) => id === start[i]);

    setActiveId(null);
    if (unchanged) {
      dragOrderRef.current = null;
      setDragOrder(null);
      return;
    }

    try {
      await sdk.dialogFilter.reorder(next);
    } finally {
      dragOrderRef.current = null;
      setDragOrder(null);
    }
  }, [sdk]);

  const handleDragCancel = useCallback(() => {
    dragOrderRef.current = null;
    setActiveId(null);
    setDragOrder(null);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    document.documentElement.setAttribute('data-folder-dragging', '');
    return () => {
      document.documentElement.removeAttribute('data-folder-dragging');
    };
  }, [activeId]);

  if (orderedIds.length === 0) return null;

  return (
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
      <div className="flex h-full w-[68px] min-w-[68px] max-w-[68px] shrink-0 flex-col overflow-hidden border-r border-border">
        <SortableContext items={displayIds} strategy={verticalListSortingStrategy}>
          <ScrollArea className="min-h-0 flex-1" viewportClassName="[overflow-anchor:none]">
            <ul className="flex flex-col gap-px p-1.5" role="list" aria-label="Chat folders">
              {displayIds.map((folderId) => (
                <FolderSortableItem key={folderId} folderId={folderId} />
              ))}
            </ul>
          </ScrollArea>
        </SortableContext>
        <div className="flex h-12 shrink-0 items-center justify-center border-t border-border bg-card p-1.5">
          <button
            type="button"
            title="Manage folders"
            aria-label="Manage folders"
            onClick={() => setManageOpen(true)}
            className={cn(
              'flex size-9 items-center justify-center rounded-lg p-2',
              'text-muted-foreground transition-colors duration-100 outline-none',
              'hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground',
              manageOpen && 'bg-accent text-foreground',
            )}
          >
            <SlidersHorizontal size={20} strokeWidth={1.75} className="shrink-0" />
          </button>
        </div>
      </div>
      <FolderManageDialog open={manageOpen} onOpenChange={setManageOpen} />
      <DragOverlay dropAnimation={null}>
        {activeId ? (
          <ul className="m-0 w-[68px] list-none p-1.5">
            <FolderItem
              folderId={activeId}
              className="cursor-grabbing rounded-lg bg-card shadow-md"
            />
          </ul>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});

export default FolderRail;
