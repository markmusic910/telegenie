'use client';

import PeerAvatar, { type PeerAvatarPhoto } from '@/lib/components/peer.avatar';
import { cn } from '@/lib/utils';
import type { User } from '@telegenie/sdk';
import { useEffect, useRef } from 'react';
import { getMainUsername } from './mention.utils';

export interface MentionSuggestProps {
  users: User[];
  selectedIndex: number;
  onSelect: (user: User) => void;
  onHover: (index: number) => void;
  onDismiss: () => void;
}

function userAvatarPhoto(user: User): PeerAvatarPhoto | undefined {
  const photo = user.photo;
  if (photo && 'photoId' in photo) return photo;
  return undefined;
}

export default function MentionSuggest({
  users,
  selectedIndex,
  onSelect,
  onHover,
  onDismiss,
}: MentionSuggestProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [onDismiss]);

  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (users.length === 0) return null;

  return (
    <div
      ref={rootRef}
      role="listbox"
      aria-label="Mention user suggestions"
      className="absolute bottom-full start-0 z-30 mb-2 max-h-60 w-72 max-w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-md"
    >
      <ul className="flex flex-col gap-0.5">
        {users.map((user, index) => {
          const isSelected = index === selectedIndex;
          const username = getMainUsername(user);
          return (
            <li key={user.id} role="option" aria-selected={isSelected}>
              <button
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                onMouseEnter={() => onHover(index)}
                onMouseDown={(event) => {
                  // Prevent textarea blur before applying the mention
                  event.preventDefault();
                }}
                onClick={() => onSelect(user)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-start transition-colors',
                  isSelected
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground hover:bg-accent/60',
                )}
              >
                <PeerAvatar
                  peerId={user.id}
                  display={user.display}
                  photo={userAvatarPhoto(user)}
                  className="size-8 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium leading-tight">
                    {user.display.name}
                  </div>
                  {username ? (
                    <div className="truncate text-xs leading-tight text-muted-foreground">
                      @{username}
                    </div>
                  ) : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
