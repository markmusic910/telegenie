'use client';

import { cn } from '@/lib/utils';
import { MessagesSquare, Settings, UserRound } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Bottom of the left column: Contacts, Chats, and Settings.
 * The calls entry is omitted.
 */
export default function AppNavBar() {
  const router = useRouter();
  const pathname = usePathname();

  const contacts = pathname.startsWith('/contacts');
  const chats = pathname === '/';
  const settings = pathname.startsWith('/settings');

  return (
    <nav
      className="flex h-16 shrink-0 items-center justify-around border-t border-border bg-card px-4"
      aria-label="Main"
    >
      <NavItem label="Contacts" active={contacts} onClick={() => router.push('/contacts')}>
        <UserRound size={40} strokeWidth={1.75} />
      </NavItem>
      <NavItem label="Chats" active={chats} onClick={() => router.push('/')}>
        <MessagesSquare size={40} strokeWidth={1.75} />
      </NavItem>
      <NavItem label="Settings" active={settings} onClick={() => router.push('/settings/profile')}>
        <Settings size={40} strokeWidth={1.75} />
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
        'flex size-12 items-center justify-center rounded-xl p-3 transition-colors',
        active ? 'text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
