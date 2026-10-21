'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { observer } from 'mobx-react-lite';

import FolderItem from './folder.item';
import { cn } from '@/lib/utils';

interface FolderSortableItemProps {
  folderId: string;
}

const FolderSortableItem = observer(({ folderId }: FolderSortableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folderId,
  });

  return (
    <FolderItem
      ref={setNodeRef}
      folderId={folderId}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging ? 'z-10 cursor-grabbing opacity-40' : 'cursor-grab')}
      {...attributes}
      {...listeners}
      role="listitem"
    />
  );
});

export default FolderSortableItem;
