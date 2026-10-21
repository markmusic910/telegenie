'use client';

import React from 'react';
import { MoreVertical, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '@/lib/components/ui/button';
import {
  Menu,
  MenuTrigger,
  MenuPopup,
  MenuItem,
} from '@/lib/components/ui/menu';
import { cn } from '@/lib/utils';

export interface MediaSendItemActionsProps {
  isSpoiler: boolean;
  onToggleSpoiler: () => void;
  onDelete: () => void;
  className?: string;
}

export default function MediaSendItemActions({
  isSpoiler,
  onToggleSpoiler,
  onDelete,
  className,
}: MediaSendItemActionsProps) {
  return (
    <div
      className={cn(
        'absolute bottom-2 right-2 z-20 select-none',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Menu>
        <MenuTrigger
          render={
            <Button
              type="button"
              size="icon-xs"
              aria-label="Media options"
              className={cn(
                'size-7 rounded-full border-0 shadow-md backdrop-blur-xs cursor-pointer transition-all',
                isSpoiler
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-black/60 hover:bg-black/80 text-white',
              )}
            />
          }
        >
          <MoreVertical className="size-4 text-white" />
        </MenuTrigger>
        <MenuPopup side="top" align="end" className="w-48 p-1">
          {/* Configure spoiler */}
          <MenuItem
            onClick={onToggleSpoiler}
            className="cursor-pointer gap-2 py-1.5 text-xs justify-between"
          >
            <div className="flex items-center gap-2">
              <EyeOff className="size-4" />
              <span>Hide with Spoiler</span>
            </div>
            <span
              className={cn(
                'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded',
                isSpoiler
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {isSpoiler ? 'On' : 'Off'}
            </span>
          </MenuItem>

          {/* Delete item */}
          <MenuItem
            onClick={onDelete}
            className="cursor-pointer gap-2 py-1.5 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
            <span>Delete</span>
          </MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  );
}
