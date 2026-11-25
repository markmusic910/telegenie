'use client';

import type { DialogProfileSearchTab } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import DialogInfoTabMembers from './dialog-info.tab.members';
import DialogInfoTabShared from './dialog-info.tab.shared';

export type DialogInfoTabId = 'members' | DialogProfileSearchTab;

export interface DialogInfoTabsProps {
  peerId: string;
  peerKind: 'channel' | 'chat';
  showMembers: boolean;
}

const SEARCH_TABS: { id: DialogProfileSearchTab; label: string }[] = [
  { id: 'media', label: 'Media' },
  { id: 'files', label: 'Files' },
  { id: 'links', label: 'Links' },
  { id: 'voice', label: 'Voice' },
  { id: 'gifs', label: 'GIFs' },
];

const DialogInfoTabs = observer(function DialogInfoTabs({
  peerId,
  peerKind,
  showMembers,
}: DialogInfoTabsProps) {
  const tabs: { id: DialogInfoTabId; label: string }[] = [
    ...(showMembers ? [{ id: 'members' as const, label: 'Members' }] : []),
    ...SEARCH_TABS,
  ];
  const [active, setActive] = useState<DialogInfoTabId>(showMembers ? 'members' : 'media');

  useEffect(() => {
    setActive(showMembers ? 'members' : 'media');
  }, [peerId, showMembers]);

  if (tabs.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex gap-1 overflow-x-auto border-b border-border px-1 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'members' ? (
        <DialogInfoTabMembers peerId={peerId} />
      ) : (
        <DialogInfoTabShared peerId={peerId} tab={active} />
      )}
    </section>
  );
});

export default DialogInfoTabs;