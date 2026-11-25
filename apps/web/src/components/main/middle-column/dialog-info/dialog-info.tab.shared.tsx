'use client';

import type { DialogProfileSearchTab } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useState } from 'react';

import { useSDK } from '@/lib/contexts/sdk.context';

import DialogInfoTabContent from './dialog-info.tab.content';

export interface DialogInfoTabSharedProps {
  peerId: string;
  tab: Exclude<DialogProfileSearchTab, never>;
}

const DialogInfoTabShared = observer(function DialogInfoTabShared({
  peerId,
  tab,
}: DialogInfoTabSharedProps) {
  const sdk = useSDK();
  const [messageIds, setMessageIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadPage = useCallback(
    async (offsetId: number, append: boolean) => {
      setLoading(true);
      try {
        const result = await sdk.dialogInfo.searchProfileTab(peerId, tab, offsetId, 50);
        const ids = result.messages.map((m) => String(m.id));
        setMessageIds((prev) => (append ? [...prev, ...ids] : ids));
        setHasMore(ids.length >= 50);
        if (ids.length > 0) {
          const minId = Math.min(...ids.map((id) => Number(id)));
          setNextOffset(minId);
        }
      } finally {
        setLoading(false);
      }
    },
    [peerId, sdk.dialogInfo, tab],
  );

  useEffect(() => {
    setMessageIds([]);
    setNextOffset(0);
    setHasMore(true);
    void loadPage(0, false);
  }, [loadPage, peerId, tab]);

  if (!loading && messageIds.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">No items found.</p>;
  }

  return (
    <DialogInfoTabContent
      peerId={peerId}
      tab={tab}
      messageIds={messageIds}
      loading={loading}
      hasMore={hasMore}
      onLoadMore={() => void loadPage(nextOffset, true)}
    />
  );
});

export default DialogInfoTabShared;