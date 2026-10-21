'use client';

import { useSDK } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import { useCallback, useState } from 'react';

type MentionLinkProps = {
  userId?: string;
  username?: string;
  children: React.ReactNode;
  className?: string;
};

function normalizeUsername(username: string): string {
  return username.replace(/^@+/, '').trim();
}

export default function MentionLink({ userId, username, children, className }: MentionLinkProps) {
  const sdk = useSDK();
  const [busy, setBusy] = useState(false);
  const clickable = Boolean(userId || username);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!clickable || busy) return;
      event.preventDefault();
      event.stopPropagation();

      if (userId) {
        void sdk.messageLoad.selectDialog(userId);
        return;
      }

      const normalized = username ? normalizeUsername(username) : '';
      if (!normalized) return;

      setBusy(true);
      void sdk.messageLoad.selectDialogByUsername(normalized).finally(() => {
        setBusy(false);
      });
    },
    [busy, clickable, sdk.messageLoad, userId, username],
  );

  if (!clickable) {
    return (
      <span className={cn('underline decoration-current/60', className)} dir="auto">
        {children}
      </span>
    );
  }

  const href = userId
    ? `#user-${userId}`
    : username
      ? `#@${normalizeUsername(username)}`
      : '#';

  return (
    <a
      href={href}
      onClick={handleClick}
      aria-busy={busy || undefined}
      className={cn(
        'inline cursor-pointer underline decoration-current/60 hover:opacity-80',
        busy && 'pointer-events-none opacity-60',
        className,
      )}
      dir="auto"
    >
      {children}
    </a>
  );
}
