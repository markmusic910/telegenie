'use client';

import { MemorySyncDialog } from '@/components/genie/memory-sync.dialog';
import TeleGenieTabsNav from '@/components/settings/telegenie-tabs.nav';
import PeerAvatar from '@/lib/components/peer.avatar';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { Input } from '@/lib/components/ui/input';
import { Switch } from '@/lib/components/ui/switch';
import { useDialogPeer, useSDK, useStore } from '@/lib/contexts/sdk.context';
import type { DialogMemorySync } from '@telegenie/agent';
import {
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useMemo, useState } from 'react';

const SyncedDialogItem = observer(function SyncedDialogItem({
  sync,
  onSyncClick,
  onToggleIncremental,
}: {
  sync: DialogMemorySync;
  onSyncClick: (peerId: string) => void;
  onToggleIncremental: (peerId: string, enabled: boolean) => void;
}) {
  const sdk = useSDK();
  const peer = useDialogPeer(sync.peerId);
  const isSyncing = sdk.agent.isSyncing(sync.peerId);

  const formattedDateRange = useMemo(() => {
    if (!sync.fromDate || !sync.toDate) return 'No range recorded';
    const fromStr = new Date(sync.fromDate).toLocaleDateString();
    const toStr = new Date(sync.toDate).toLocaleDateString();
    return fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`;
  }, [sync.fromDate, sync.toDate]);

  const formattedLastSync = useMemo(() => {
    if (!sync.lastSyncAt) return 'Never';
    const date = new Date(sync.lastSyncAt);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }, [sync.lastSyncAt]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-card/40 hover:bg-card/70 transition-colors">
      <div className="flex items-center gap-3.5 min-w-0">
        <PeerAvatar
          peerId={sync.peerId}
          display={peer?.display}
          className="size-10 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">
              {peer?.display?.name || `Dialog ${sync.peerId}`}
            </span>
            {isSyncing ? (
              <Badge variant="outline" className="gap-1 text-[10px] text-primary border-primary/30 bg-primary/5">
                <Loader2 className="size-2.5 animate-spin" />
                Syncing…
              </Badge>
            ) : sync.status === 'failed' ? (
              <Badge variant="destructive" className="text-[10px]">
                Failed
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 text-[10px] text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                <CheckCircle2 className="size-2.5" />
                Synced
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3 text-muted-foreground/80" />
              <span>{formattedDateRange}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="size-3 text-muted-foreground/80" />
              <span>Last sync: {formattedLastSync}</span>
            </span>
            <span>•</span>
            <span>{sync.syncedMessageCount} msgs</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
        <div className="flex items-center gap-2 pr-1 border-r border-border/60">
          <span className="text-[11px] text-muted-foreground">Auto-sync</span>
          <Switch
            checked={sync.incrementalSync ?? false}
            onCheckedChange={(checked) => onToggleIncremental(sync.peerId, checked)}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSyncClick(sync.peerId)}
          disabled={isSyncing}
          className="text-xs h-8 gap-1.5"
        >
          {isSyncing ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              <span>Syncing…</span>
            </>
          ) : (
            <>
              <RefreshCw className="size-3" />
              <span>Re-sync</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
});

const DialogPickerModal = observer(function DialogPickerModal({
  open,
  onOpenChange,
  onSelectPeer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPeer: (peerId: string) => void;
}) {
  const globalStore = useStore('global');
  const dialogStore = useStore('dialog');
  const [search, setSearch] = useState('');

  const dialogs = dialogStore.getAllData();
  const sortedIds =
    globalStore.nav.sortedDialogIds.length > 0
      ? globalStore.nav.sortedDialogIds
      : Array.from(dialogs.keys());

  const peerIds = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();
    for (const id of sortedIds) {
      const d = dialogs.get(id);
      if (d?.isFolder || !d?.peerId || seen.has(d.peerId)) continue;
      seen.add(d.peerId);
      list.push(d.peerId);
    }
    return list;
  }, [sortedIds, dialogs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="max-w-md w-full flex flex-col max-h-[85vh]">
          <DialogHeader className="px-6 pt-5 pb-3 shrink-0">
            <DialogTitle className="text-base font-semibold">
              Select Dialog to Sync
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-2 shrink-0">
            <div className="relative">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-2 divide-y divide-border/60">
            {peerIds.map((peerId) => (
              <DialogPickerRow
                key={peerId}
                peerId={peerId}
                query={search.trim().toLowerCase()}
                onSelect={(id) => {
                  onSelectPeer(id);
                  onOpenChange(false);
                }}
              />
            ))}
          </div>

          <DialogFooter className="px-6 py-3 border-t border-border shrink-0">
            <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
          </DialogFooter>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
});

const DialogPickerRow = observer(function DialogPickerRow({
  peerId,
  query,
  onSelect,
}: {
  peerId: string;
  query: string;
  onSelect: (peerId: string) => void;
}) {
  const peer = useDialogPeer(peerId);
  const name = peer?.display?.name || `Dialog ${peerId}`;

  if (query && !name.toLowerCase().includes(query)) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(peerId)}
      className="flex w-full items-center gap-3 p-2.5 rounded-lg hover:bg-accent/60 transition-colors text-left cursor-pointer"
    >
      <PeerAvatar peerId={peerId} display={peer?.display} className="size-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="text-xs font-semibold text-foreground truncate block">
          {name}
        </span>
        <span className="text-[11px] text-muted-foreground truncate block">
          ID: {peerId}
        </span>
      </div>
    </button>
  );
});

export const TeleGenieMemoryDetail = observer(function TeleGenieMemoryDetail() {
  const sdk = useSDK();
  const [syncs, setSyncs] = useState<DialogMemorySync[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchPickerOpen, setSearchPickerOpen] = useState(false);
  const [targetPeerId, setTargetPeerId] = useState<string | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  const loadSyncs = useCallback(async () => {
    try {
      const list = await sdk.agent.getAllDialogMemorySyncs();
      setSyncs(list);
    } catch (err) {
      console.warn('[TeleGenieMemoryDetail] Failed to load memory syncs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sdk.agent]);

  useEffect(() => {
    void loadSyncs();

    const unsubProgress = sdk.agent.onMemorySyncProgress(() => {
      void loadSyncs();
    });
    const unsubComplete = sdk.agent.onMemorySyncComplete(() => {
      void loadSyncs();
    });

    return () => {
      unsubProgress();
      unsubComplete();
    };
  }, [loadSyncs, sdk.agent]);

  const handleToggleIncremental = async (peerId: string, enabled: boolean) => {
    try {
      const updated = await sdk.agent.setIncrementalMemorySync(peerId, enabled);
      setSyncs((prev) =>
        prev.map((s) => (s.peerId === peerId ? { ...s, incrementalSync: updated.incrementalSync } : s)),
      );
    } catch (err) {
      console.warn('[TeleGenieMemoryDetail] Failed to set incremental sync:', err);
    }
  };

  const handleOpenSyncModal = (peerId: string) => {
    setTargetPeerId(peerId);
    setSyncModalOpen(true);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <TeleGenieTabsNav activeTab="memory" />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Brain className="size-5 text-primary" />
            <span>Conversation Memory</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Historical memories, facts, and commitments extracted across your conversations.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setSearchPickerOpen(true)}
          className="gap-1.5 shrink-0"
        >
          <Plus className="size-3.5" />
          <span>Sync Dialog</span>
        </Button>
      </div>

      {/* Synced dialogs list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            Loading synced dialogs…
          </div>
        ) : syncs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 p-8 text-center flex flex-col items-center gap-3">
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">No synced conversations yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Sync full conversation history to extract background context, preferences, and commitments for the agent.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchPickerOpen(true)}
              className="mt-2 text-xs"
            >
              Select Dialog to Sync
            </Button>
          </div>
        ) : (
          syncs.map((sync) => (
            <SyncedDialogItem
              key={sync.peerId}
              sync={sync}
              onSyncClick={handleOpenSyncModal}
              onToggleIncremental={handleToggleIncremental}
            />
          ))
        )}
      </div>

      {/* Dialog search modal */}
      <DialogPickerModal
        open={searchPickerOpen}
        onOpenChange={setSearchPickerOpen}
        onSelectPeer={(peerId) => {
          handleOpenSyncModal(peerId);
        }}
      />

      {/* Memory sync range modal */}
      {targetPeerId && (
        <MemorySyncDialog
          open={syncModalOpen}
          onOpenChange={(open) => {
            setSyncModalOpen(open);
            if (!open) void loadSyncs();
          }}
          peerId={targetPeerId}
          onSyncStarted={() => {
            void loadSyncs();
          }}
        />
      )}
    </div>
  );
});

export default TeleGenieMemoryDetail;
