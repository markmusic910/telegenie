'use client';

import { Dialog } from '@telegenie/sdk';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useSDK } from '@/lib/contexts/sdk.context';
import { useSelectDialog } from '@/lib/hooks/use-select-dialog';
import { cn } from '@/lib/utils';
import { parseBioSegments } from './user-profile-bio.utils';

export interface UserProfileBioTextProps {
  text: string;
  className?: string;
}

export default function UserProfileBioText({ text, className }: UserProfileBioTextProps) {
  const sdk = useSDK();
  const selectDialog = useSelectDialog();
  const [resolvingUsername, setResolvingUsername] = useState<string | null>(null);

  const segments = useMemo(() => parseBioSegments(text), [text]);

  const handleMentionClick = useCallback(
    (username: string) => {
      if (!username || resolvingUsername) return;
      setResolvingUsername(username);
      void sdk.user
        .resolveUsername(username)
        .then((resolvedPeerId) => {
          if (!resolvedPeerId) {
            toast.error(`Could not find @${username}`);
            return;
          }
          if (Dialog.peerKindFromId(resolvedPeerId) === 'user') {
            sdk.user.openProfile(resolvedPeerId);
            return;
          }
          sdk.user.closeProfile();
          void selectDialog(resolvedPeerId);
        })
        .catch(() => {
          toast.error(`Could not open @${username}`);
        })
        .finally(() => {
          setResolvingUsername(null);
        });
    },
    [resolvingUsername, sdk.user, selectDialog],
  );

  if (!text) return null;

  return (
    <span className={cn('whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground', className)}>
      {segments.map((segment, index) => {
        if (segment.kind === 'text') {
          return <span key={`text-${index}`}>{segment.value}</span>;
        }
        if (segment.kind === 'url') {
          return (
            <a
              key={`url-${index}`}
              href={segment.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all"
            >
              {segment.value}
            </a>
          );
        }
        if (segment.kind === 'mention') {
          const isBusy = resolvingUsername === segment.username;
          return (
            <button
              key={`mention-${index}`}
              type="button"
              disabled={Boolean(resolvingUsername)}
              aria-busy={isBusy || undefined}
              onClick={() => handleMentionClick(segment.username)}
              className={cn(
                'inline cursor-pointer border-0 bg-transparent p-0 font-normal text-primary hover:underline focus-visible:outline-none focus-visible:underline',
                isBusy && 'opacity-60',
              )}
            >
              {segment.value}
            </button>
          );
        }
        return (
          <span key={`tag-${index}`} className="text-primary">
            {segment.value}
          </span>
        );
      })}
    </span>
  );
}
