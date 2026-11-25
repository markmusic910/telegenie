'use client';

import { useStore } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import { contactsHref, dialogHref, isChatsPathname, isContactsPathname } from '@/lib/utils/dialog-url';
import { MessagesSquare, Settings, UserRound } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Bottom of the left column: Contacts, Chats, and Settings.
 * The calls entry is omitted.
 */
export default function AppNavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const globalStore = useStore('global');

  const contacts = isContactsPathname(pathname);
  const chats = isChatsPathname(pathname);
  const settings = pathname.startsWith('/settings');

  return (
    <nav
      className="flex h-12 shrink-0 items-center justify-around border-t border-border bg-card px-4"
      aria-label="Main"
    >
      <NavItem
        label="Contacts"
        active={contacts}
        onClick={() => router.push(contactsHref(globalStore.nav.selectedDialogId))}
      >
        <UserRound size={20} strokeWidth={1.75} />
      </NavItem>
      <NavItem
        label="Chats"
        active={chats}
        onClick={() => router.push(dialogHref(globalStore.nav.selectedDialogId))}
      >
        <MessagesSquare size={20} strokeWidth={1.75} />
      </NavItem>
      <NavItem label="Settings" active={settings} onClick={() => router.push('/settings/profile')}>
        <Settings size={20} strokeWidth={1.75} />
      </NavItem>
    </nav>
  );
}

function NavItem({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex size-9 items-center justify-center rounded-lg p-2 transition-colors',
        active ? 'text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
