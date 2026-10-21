'use client';

import { ChevronRight, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/lib/components/ui/button';
import { ScrollArea } from '@/lib/components/ui/scroll-area';
import { useGlobalStoreDialog, useSDK, useStore } from '@/lib/contexts/sdk.context';
import { emojiPresentation } from '@/lib/utils/emoji';
import { getEntityTypeById } from '@telegenie/libs/foundation/telegram/helpers';
import type { PlainAvailableReaction } from '@telegenie/libs/foundation/telegram/services/converters/message.converter';
import type { ApiChatReactions } from '@telegenie/libs/foundation/telegram/types';
import { canConfigureDialog } from './dialog-config.access';
import ReactionSettingsDialog, {
  reactionModeFromAvailable,
  reactionModeLabel,
  selectedReactionEmoticons,
  type ReactionSettingsDraft,
} from './reaction-settings.dialog';

interface DialogConfigContainerProps {
  onClose: () => void;
}

/**
 * Dialog info side panel — reaction policy for admins on groups and channels.
 */
const DialogConfigContainer = observer(function DialogConfigContainer({
  onClose,
}: DialogConfigContainerProps) {
  const sdk = useSDK();
  const globalStore = useStore('global');
  const peerId = globalStore.nav.selectedDialogId;
  const dialogUI = useGlobalStoreDialog(peerId);
  const chatStore = useStore('chat');
  const channelStore = useStore('channel');
  const chatFullStore = useStore('chatFull');
  const channelFullStore = useStore('channelFull');

  const entityKind = peerId ? getEntityTypeById(peerId) : undefined;
  const chat = peerId && entityKind === 'chat' ? chatStore.get(peerId) : undefined;
  const channel = peerId && entityKind === 'channel' ? channelStore.get(peerId) : undefined;
  const chatFull =
    peerId && entityKind === 'chat' ? chatFullStore.getAllData().get(peerId) : undefined;
  const channelFull =
    peerId && entityKind === 'channel' ? channelFullStore.getAllData().get(peerId) : undefined;

  const chatFullLoaded = Boolean(chatFull?.notifySettings);
  const channelFullLoaded = Boolean(channelFull?.notifySettings);

  useEffect(() => {
    if (!peerId) return;
    if (entityKind === 'chat' && !chatFullLoaded) {
      void sdk.chat.getFullChatByIds([peerId]).catch((error: unknown) => {
        console.error('Failed to load chatFull', error);
      });
      return;
    }
    if (entityKind === 'channel' && !channelFullLoaded && channel?.accessHash) {
      void sdk.channel
        .getFullChannelByIds([{ id: peerId, accessHash: channel.accessHash }])
        .catch((error: unknown) => {
          console.error('Failed to load channelFull', error);
        });
    }
  }, [
    channel?.accessHash,
    channelFullLoaded,
    chatFullLoaded,
    entityKind,
    peerId,
    sdk.channel,
    sdk.chat,
  ]);

  const canAdmin = canConfigureDialog({ chat, channel });
  const available = chatFull?.availableReactions ?? channelFull?.availableReactions;
  const reactionsLimit = chatFull?.reactionsLimit ?? channelFull?.reactionsLimit ?? 11;
  const mode = reactionModeFromAvailable(available);
  const allowed = selectedReactionEmoticons(available);

  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [catalog, setCatalog] = useState<PlainAvailableReaction[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canAdmin) return;
    void sdk.messageReaction.loadAvailableReactionsCatalog().then(setCatalog);
  }, [canAdmin, sdk.messageReaction]);

  const activeCatalog = useMemo(
    () => catalog.filter((row) => !row.inactive && !row.premium),
    [catalog],
  );

  const save = useCallback(
    async (draft: ReactionSettingsDraft) => {
      if (!peerId) return;
      setSaving(true);
      try {
        let payload: ApiChatReactions | 'none' = 'none';
        if (draft.mode === 'all') {
          payload = { type: 'all', areCustomAllowed: true };
        } else if (draft.mode === 'some') {
          payload = {
            type: 'some',
            allowed: draft.selected.map((emoticon) => ({ type: 'emoji' as const, emoticon })),
          };
        }
        await sdk.chat.setAvailableReactions({
          peerId,
          availableReactions: payload,
          reactionsLimit: entityKind === 'channel' ? draft.reactionsLimit : undefined,
        });
      } finally {
        setSaving(false);
      }
    },
    [entityKind, peerId, sdk.chat],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <span className="text-sm font-semibold text-foreground">Dialog Info</span>
        <Button
          id="close-dialog-config"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close dialog info panel"
          className="ml-auto shrink-0"
        >
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {!peerId ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Select a conversation to see details here.
            </p>
          </div>
        ) : canAdmin && (entityKind === 'chat' || entityKind === 'channel') ? (
          <div className="px-4 py-6">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left hover:bg-accent"
              onClick={() => setReactionsOpen(true)}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Reactions</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{reactionModeLabel(mode)}</span>
                  {mode === 'some' && allowed.length > 0 ? (
                    <span className="truncate" aria-hidden>
                      {allowed.map((emoticon) => emojiPresentation(emoticon)).join(' ')}
                    </span>
                  ) : null}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
            <ReactionSettingsDialog
              open={reactionsOpen}
              onOpenChange={setReactionsOpen}
              available={available}
              reactionsLimit={reactionsLimit}
              showLimit={entityKind === 'channel'}
              catalog={activeCatalog}
              saving={saving}
              onSave={save}
            />
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {dialogUI ? 'No configurable options for this chat.' : 'Loading…'}
          </div>
        )}
      </ScrollArea>
    </div>
  );
});

export default DialogConfigContainer;
