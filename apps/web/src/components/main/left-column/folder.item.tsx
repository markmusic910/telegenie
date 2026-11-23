'use client';

import { observer } from 'mobx-react-lite';
import { usePathname, useRouter } from 'next/navigation';
import { forwardRef, type CSSProperties, type HTMLAttributes } from 'react';

import { Badge } from '@/lib/components/ui/badge';
import { useSDK, useStore } from '@/lib/contexts/sdk.context';
import { useFolderDialogIds } from '@/lib/hooks/use-folder-dialog-ids';
import { cn } from '@/lib/utils';
import { FolderGlyph, FolderTitleText } from './folder.meta';

export const FOLDER_ITEM_ESTIMATE_PX = 64;

interface FolderItemProps extends HTMLAttributes<HTMLLIElement> {
  folderId: string;
  style?: CSSProperties;
}

const FolderItem = observer(
  forwardRef<HTMLLIElement, FolderItemProps>(function FolderItem(
    { folderId, style, className, ...liProps },
    ref,
  ) {
    const sdk = useSDK();
    const router = useRouter();
    const pathname = usePathname();
    const globalStore = useStore('global');
    const filterStore = useStore('dialogFilter');
    const filter = filterStore.getAllData().get(folderId);
    const { unreadCount } = useFolderDialogIds(filter ?? null);

    if (!filter?.title) {
      return <li ref={ref} style={style} className={className} aria-hidden {...liProps} />;
    }

    const selected = folderId === globalStore.nav.selectedFolderId;

    return (
      <li ref={ref} style={style} className={className} {...liProps}>
        <button
          type="button"
          aria-current={selected ? 'true' : undefined}
          title={filter.title}
          onClick={() => {
            sdk.dialogFilter.selectFolder(folderId);
            if (pathname.startsWith('/settings')) {
              router.push('/');
            }
          }}
          className={cn(
            'group relative flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2',
            'text-muted-foreground transition-colors duration-100 outline-none',
            'hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground',
            selected && 'bg-accent text-foreground',
          )}
        >
          <span className="relative flex items-center justify-center">
            <FolderGlyph filter={filter} />
            {unreadCount > 0 ? (
              <Badge
                size="sm"
                variant="default"
                className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full px-1 tabular-nums"
                aria-label={`${unreadCount} unread chats`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            ) : null}
          </span>
          <span className="w-full truncate text-center text-[0.625rem] leading-tight">
            <FolderTitleText
              title={filter.title}
              entities={filter.titleEntities}
              emojiSize={12}
            />
          </span>
        </button>
      </li>
    );
  }),
);

FolderItem.displayName = 'FolderItem';

export default FolderItem;
