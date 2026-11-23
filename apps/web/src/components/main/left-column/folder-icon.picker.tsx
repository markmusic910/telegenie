'use client';

import { useState } from 'react';

import { Button } from '@/lib/components/ui/button';
import { Popover, PopoverPopup, PopoverTrigger } from '@/lib/components/ui/popover';
import { cn } from '@/lib/utils';
import { FOLDER_ICON_PRESETS, FolderGlyph } from './folder.meta';

interface FolderIconPickerProps {
  value: string | undefined;
  onChange: (emoticon: string | undefined) => void;
  disabled?: boolean;
}

export function FolderIconPicker({ value, onChange, disabled }: FolderIconPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label="Choose folder icon"
            title="Choose folder icon"
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <FolderGlyph emoticon={value} className="size-4.5" />
      </PopoverTrigger>
      <PopoverPopup align="end" sideOffset={8} className="w-64 p-2.5">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-medium text-muted-foreground">Folder Icon</span>
          {value ? (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              Default
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-6 gap-1">
          {FOLDER_ICON_PRESETS.map(({ emoticon, label, Icon }) => {
            const active = value === emoticon;
            return (
              <button
                key={emoticon}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={active}
                onClick={() => {
                  onChange(emoticon);
                  setOpen(false);
                }}
                className={cn(
                  'flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors',
                  'hover:bg-accent hover:text-foreground',
                  active && 'bg-primary/15 text-primary ring-1 ring-primary/40',
                )}
              >
                <Icon className="size-4.5" />
              </button>
            );
          })}
        </div>
      </PopoverPopup>
    </Popover>
  );
}

export default FolderIconPicker;
