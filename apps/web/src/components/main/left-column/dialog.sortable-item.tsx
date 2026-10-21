'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { observer } from 'mobx-react-lite';

import DialogItem from './dialog.item';
import { cn } from '@/lib/utils';

interface DialogSortableItemProps {
  dialogId: string;
}

const DialogSortableItem = observer(({ dialogId }: DialogSortableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dialogId,
  });

  return (
    <DialogItem
      ref={setNodeRef}
      dialogId={dialogId}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        isDragging ? 'z-10 cursor-grabbing opacity-40' : 'cursor-grab',
      )}
      {...attributes}
      {...listeners}
      role="listitem"
    />
  );
});

export default DialogSortableItem;
