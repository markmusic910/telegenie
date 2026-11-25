'use client';

import type { DialogProfileSearchTab } from '@telegenie/sdk';
import type { Message } from '@telegenie/sdk';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useMemo } from 'react';

import MediaDocument from '@/lib/components/media.document';
import MediaVoice from '@/lib/components/media.voice';
import { Button } from '@/lib/components/ui/button';
import { useSDK } from '@/lib/contexts/sdk.context';
import { formatFileSize } from '@/lib/utils/format';

import DialogInfoLinkRow from './dialog-info.link-row';
import DialogInfoMediaTile from './dialog-info.media-tile';
import { formatSharedItemDate, groupMessagesByMonth } from './dialog-info.tab-content.utils';

export interface DialogInfoTabContentProps {
  peerId: string;
  tab: DialogProfileSearchTab;
  messageIds: string[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

const GRID_TABS: DialogProfileSearchTab[] = ['media', 'gifs'];

const DialogInfoTabContent = observer(function DialogInfoTabContent({
  peerId,
  tab,
  messageIds,
  loading,
  hasMore,
  onLoadMore,
}: DialogInfoTabContentProps) {
  const sdk = useSDK();
  const messageStore = sdk.getMessageStore(peerId);

  const messages: Message[] = [];
  for (const id of messageIds) {
    const message = messageStore.get(id);
    if (message && !message.isEmpty) {
      messages.push(message);
    }
  }

  useEffect(() => {
    const missing = messageIds.filter((id) => !messageStore.get(id));
    if (missing.length > 0) {
      void sdk.messageLoad.getMessagesByIds(peerId, missing).catch(() => undefined);
    }
  }, [messageIds, messageStore, peerId, sdk.messageLoad]);

  const sections = useMemo(() => groupMessagesByMonth(messages), [messages]);

  const openMessage = useCallback(
    (messageId: string) => {
      sdk.dialogInfo.pop();
      void sdk.messageLoad.focusMessage(peerId, { messageId });
    },
    [peerId, sdk.dialogInfo, sdk.messageLoad],
  );

  if (messageIds.length > 0 && messages.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  const loadMoreButton =
    hasMore || loading ? (
      <div className="px-4 pt-3 pb-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={onLoadMore}
          className="w-full"
        >
          {loading ? 'Loading…' : 'Load more'}
        </Button>
      </div>
    ) : null;

  if (GRID_TABS.includes(tab)) {
    return (
      <div className="flex flex-col gap-4 pb-2">
        {sections.map((section) => (
          <section key={section.key} className="flex flex-col gap-2">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-primary">
              {section.label}
            </h3>
            <div className="grid grid-cols-4 gap-0.5 overflow-hidden rounded-lg">
              {section.messages.map((message) => (
                <DialogInfoMediaTile
                  key={message.id}
                  message={message}
                  peerId={peerId}
                  forceGif={tab === 'gifs'}
                  onShowMessage={() => openMessage(String(message.id))}
                />
              ))}
            </div>
          </section>
        ))}
        {loadMoreButton}
      </div>
    );
  }

  if (tab === 'files') {
    return (
      <div className="flex flex-col gap-4 pb-2">
        {sections.map((section) => (
          <section key={section.key} className="flex flex-col gap-2">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-primary">
              {section.label}
            </h3>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card divide-y divide-border/50">
              {section.messages.map((message) => (
                <ProfileFileRow key={message.id} message={message} peerId={peerId} />
              ))}
            </div>
          </section>
        ))}
        {loadMoreButton}
      </div>
    );
  }

  if (tab === 'links') {
    return (
      <div className="flex flex-col gap-4 pb-2">
        {sections.map((section) => (
          <section key={section.key} className="flex flex-col gap-2">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-primary">
              {section.label}
            </h3>
            <div className="flex flex-col gap-2">
              {section.messages.map((message) => (
                <DialogInfoLinkRow key={message.id} message={message} peerId={peerId} />
              ))}
            </div>
          </section>
        ))}
        {loadMoreButton}
      </div>
    );
  }

  if (tab === 'voice') {
    return (
      <div className="flex flex-col gap-4 pb-2">
        {sections.map((section) => (
          <section key={section.key} className="flex flex-col gap-2">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-primary">
              {section.label}
            </h3>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card divide-y divide-border/50">
              {section.messages.map((message) => (
                <ProfileVoiceRow key={message.id} message={message} peerId={peerId} />
              ))}
            </div>
          </section>
        ))}
        {loadMoreButton}
      </div>
    );
  }

  return null;
});

function ProfileFileRow({ message, peerId }: { message: Message; peerId: string }) {
  const doc = message.fileDocument;
  if (!doc) return null;

  return (
    <div className="px-2 py-2">
      <MediaDocument
        document={doc}
        peerId={peerId}
        messageId={Number(message.id)}
        variant="card"
        className="mb-0 w-full max-w-none"
      />
      <p className="mt-1 px-1 text-[11px] text-primary">
        ↓ {formatFileSize(message.mediaFileSize)} · {formatSharedItemDate(message.date)}
      </p>
    </div>
  );
}

function ProfileVoiceRow({ message, peerId }: { message: Message; peerId: string }) {
  const doc = message.voiceDocument;
  if (!doc) return null;

  return (
    <div className="px-3 py-3">
      <MediaVoice
        document={doc}
        waveform={message.voiceWaveform}
        duration={message.voiceDuration}
        peerId={peerId}
        messageId={Number(message.id)}
        className="w-full max-w-none"
      />
      <p className="mt-1 text-[11px] text-muted-foreground">{formatSharedItemDate(message.date)}</p>
    </div>
  );
}

export default DialogInfoTabContent;