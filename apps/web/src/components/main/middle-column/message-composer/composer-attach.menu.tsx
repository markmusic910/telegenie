'use client';

import { File, Image, Paperclip } from 'lucide-react';
import { type ChangeEvent, useRef } from 'react';
import { Button } from '@/lib/components/ui/button';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '@/lib/components/ui/menu';
import { cn } from '@/lib/utils';

export interface ComposerAttachMenuProps {
  disabled?: boolean;
  className?: string;
  onSendFiles: (files: FileList | File[], forceDocument: boolean) => void;
}

export default function ComposerAttachMenu({
  disabled,
  className,
  onSendFiles,
}: ComposerAttachMenuProps) {
  const photoVideoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onSendFiles(files, false);
    }
    e.target.value = '';
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onSendFiles(files, true);
    }
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={photoVideoInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        tabIndex={-1}
        onChange={handlePhotoVideoChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        tabIndex={-1}
        onChange={handleFileChange}
      />
      <Menu>
        <MenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Attach"
              disabled={disabled}
              className={cn('text-muted-foreground', className)}
            />
          }
        >
          <Paperclip aria-hidden />
        </MenuTrigger>
        <MenuPopup side="top" align="start" sideOffset={8} className="w-48 p-1">
          <MenuItem
            onClick={() => photoVideoInputRef.current?.click()}
            className="cursor-pointer gap-2.5 py-1.5"
          >
            <Image aria-hidden />
            <span>Photo Or Video</span>
          </MenuItem>
          <MenuItem
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer gap-2.5 py-1.5"
          >
            <File aria-hidden />
            <span>File</span>
          </MenuItem>
        </MenuPopup>
      </Menu>
    </>
  );
}
