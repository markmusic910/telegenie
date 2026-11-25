'use client';

import CopyButton from '@/lib/components/copy.button';
import { toast } from 'sonner';

export interface DialogInfoDetailsCardProps {
  about?: string;
  username?: string;
  extraUsernames?: string[];
  peerId: string;
}

export default function DialogInfoDetailsCard({
  about,
  username,
  extraUsernames = [],
  peerId,
}: DialogInfoDetailsCardProps) {
  return (
    <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60 bg-card">
      {about?.trim() ? (
        <div className="px-4 py-3">
          <p className="text-xs text-primary">info</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{about.trim()}</p>
        </div>
      ) : null}

      {username ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-primary">share link</p>
            <p className="mt-0.5 truncate text-sm text-primary">@{username}</p>
            {extraUsernames.length > 0 ? (
              <p className="mt-0.5 truncate text-sm text-primary">
                also {extraUsernames.map((u) => `@${u}`).join(', ')}
              </p>
            ) : null}
          </div>
          <CopyButton
            value={[username, ...extraUsernames].map((u) => `@${u}`).join('\n')}
            aria-label="Copy share link"
            onCopyError={() => toast.error('Failed to copy link')}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-primary">PEER ID</p>
          <p className="mt-0.5 truncate font-mono text-sm text-foreground">{peerId}</p>
        </div>
        <CopyButton
          value={peerId}
          aria-label="Copy peer ID"
          onCopyError={() => toast.error('Failed to copy peer ID')}
        />
      </div>
    </div>
  );
}