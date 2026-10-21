'use client';

import AppNavBar from '@/components/main/app-nav.bar';
import RecentReactionsDialog from '@/components/settings/recent-reactions.dialog';
import StickerSetDialog from '@/components/settings/sticker-set.dialog';
import PeerAvatar from '@/lib/components/peer.avatar';
import { Button } from '@/lib/components/ui/button';
import { ScrollArea } from '@/lib/components/ui/scroll-area';
import { useSDK, useStore } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import { emojiPresentation } from '@/lib/utils/emoji';
import type { PlainAvailableReaction } from '@telegenie/libs/foundation/telegram/services/converters/message.converter';
import type { InstalledStickerSet } from '@telegenie/libs/foundation/telegram/services/sticker.service';
import { fallbackPeerDisplay, peerProfileDisplay } from '@telegenie/sdk';
import { ChevronRight, Settings2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type SettingsSection = 'profile' | 'stickers';

export interface SettingsPageProps {
  section: SettingsSection;
}

const PLACEHOLDER_ROWS = [
  'Suggest emoji',
  'Loop animated stickers',
  'Trending stickers',
  'Archived stickers',
  'Custom emoji',
  'Dynamic pack order',
] as const;

/**
 * Telegram-style settings: list column plus detail pane, reached from the folder rail.
 */
const SettingsPage = observer(function SettingsPage({ section }: SettingsPageProps) {
  const router = useRouter();
  const sdk = useSDK();
  const globalStore = useStore('global');
  const userStore = useStore('user');
  const self = globalStore.auth.currentUser;
  const selfEntity = self?.id ? userStore.get(self.id) : undefined;
  const display = selfEntity ? peerProfileDisplay(selfEntity) : fallbackPeerDisplay(self?.id ?? '');

  const [defaultReaction, setDefaultReaction] = useState('👍');
  const [catalog, setCatalog] = useState<PlainAvailableReaction[]>([]);
  const [stickerSets, setStickerSets] = useState<InstalledStickerSet[]>([]);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);

  useEffect(() => {
    void sdk.messageReaction.getDefaultReaction().then(setDefaultReaction);
    void sdk.messageReaction.loadAvailableReactionsCatalog().then(setCatalog);
  }, [sdk.messageReaction]);

  useEffect(() => {
    if (section !== 'stickers') return;
    setLoadingStickers(true);
    void sdk.sticker
      .getInstalledSets()
      .then(setStickerSets)
      .catch(() => setStickerSets([]))
      .finally(() => setLoadingStickers(false));
  }, [section, sdk.sticker]);

  const onChooseDefault = useCallback(
    (emoticon: string) => {
      void sdk.messageReaction.setDefaultReaction({ emoticon }).then(() => setDefaultReaction(emoticon));
    },
    [sdk.messageReaction],
  );

  const onRemoveStickerSet = useCallback(
    (set: InstalledStickerSet) => {
      void sdk.sticker.uninstallSet(set.id, set.accessHash).then(() => {
        setStickerSets((prev) => prev.filter((row) => row.id !== set.id));
      });
    },
    [sdk.sticker],
  );

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-full max-w-sm flex-col border-r border-border bg-card md:w-80">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <Settings2 className="size-5 text-muted-foreground" aria-hidden />
          <span className="text-sm font-semibold">Settings</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex items-center gap-3 border-b border-border px-4 py-4">
            <PeerAvatar
              peerId={self?.id}
              display={display}
              photo={selfEntity?.photo}
              className="size-12"
            />
            <div className="min-w-0">
              <p className="truncate font-medium">{display.name}</p>
              {self?.phone ? (
                <p className="truncate text-xs text-muted-foreground">{self.phone}</p>
              ) : null}
              {self?.username ? (
                <p className="truncate text-xs text-muted-foreground">@{self.username}</p>
              ) : null}
            </div>
          </div>
          <nav className="flex flex-col p-2" aria-label="Settings sections">
            <SettingsNavRow
              label="My Profile"
              active={section === 'profile'}
              onClick={() => router.push('/settings/profile')}
            />
            <SettingsNavRow
              label="Stickers and Emoji"
              active={section === 'stickers'}
              onClick={() => router.push('/settings/stickers')}
            />
          </nav>
        </ScrollArea>
        <AppNavBar />
      </aside>

      <main className="min-w-0 flex-1 bg-background">
        <ScrollArea className="h-full">
          {section === 'profile' ? (
            <ProfileDetail
              display={display}
              username={self?.username}
              phone={self?.phone}
              peerId={self?.id}
              photo={selfEntity?.photo}
            />
          ) : (
            <StickersDetail
              defaultReaction={defaultReaction}
              catalog={catalog.filter((row) => !row.inactive && !row.premium)}
              stickerSets={stickerSets}
              loadingStickers={loadingStickers}
              onChooseDefault={onChooseDefault}
              onOpenRecent={() => setRecentOpen(true)}
              onRemoveStickerSet={onRemoveStickerSet}
            />
          )}
        </ScrollArea>
      </main>
      <RecentReactionsDialog open={recentOpen} onOpenChange={setRecentOpen} />
    </div>
  );
});

function SettingsNavRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm',
        active ? 'bg-accent font-medium' : 'hover:bg-accent/60',
      )}
    >
      {label}
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </button>
  );
}

function ProfileDetail({
  display,
  username,
  phone,
  peerId,
  photo,
}: {
  display: ReturnType<typeof peerProfileDisplay>;
  username?: string;
  phone?: string;
  peerId?: string;
  photo?: Parameters<typeof PeerAvatar>[0]['photo'];
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <PeerAvatar peerId={peerId} display={display} photo={photo} className="size-28 text-2xl" />
        <div>
          <h1 className="text-xl font-semibold">{display.name}</h1>
          <p className="text-sm text-muted-foreground">online</p>
        </div>
      </div>
      <dl className="divide-y divide-border rounded-xl border border-border">
        <InfoRow label="Username" value={username ? `@${username}` : '—'} />
        <InfoRow label="Phone" value={phone ?? '—'} />
        <InfoRow label="Peer id" value={peerId ?? '—'} />
      </dl>
      <section>
        <h2 className="mb-2 text-sm font-semibold">Gifts</h2>
        <div className="min-h-16 rounded-xl border border-dashed border-border/70 bg-muted/30" />
      </section>
    </div>
  );
}

function StickerSetIcon({ title, thumbDataUri }: { title: string; thumbDataUri?: string }) {
  if (!thumbDataUri) {
    return <span className="size-10 shrink-0 rounded-md bg-muted" aria-hidden />;
  }
  return (
    <img
      src={thumbDataUri}
      alt=""
      title={title}
      className="size-10 shrink-0 rounded-md bg-muted object-contain"
    />
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

function StickersDetail({
  defaultReaction,
  catalog,
  stickerSets,
  loadingStickers,
  onChooseDefault,
  onOpenRecent,
  onRemoveStickerSet,
}: {
  defaultReaction: string;
  catalog: PlainAvailableReaction[];
  stickerSets: InstalledStickerSet[];
  loadingStickers: boolean;
  onChooseDefault: (emoticon: string) => void;
  onOpenRecent: () => void;
  onRemoveStickerSet: (set: InstalledStickerSet) => void;
}) {
  const [openSet, setOpenSet] = useState<InstalledStickerSet | null>(null);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8 px-6 py-8">
      <section>
        <div className="mb-3 flex min-w-0 items-center gap-3">
          <span className="text-4xl leading-none" aria-hidden>
            {emojiPresentation(defaultReaction)}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Quick Reaction</h2>
            <p className="text-xs text-muted-foreground">Long-press a message to send this emoji.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {catalog.map((row) => (
            <button
              key={row.emoticon}
              type="button"
              className={cn(
                'flex size-10 items-center justify-center rounded-full text-xl',
                defaultReaction === row.emoticon ? 'bg-primary/15 ring-2 ring-primary' : 'bg-muted',
              )}
              aria-pressed={defaultReaction === row.emoticon}
              onClick={() => onChooseDefault(row.emoticon)}
            >
              {emojiPresentation(row.emoticon)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left hover:bg-accent"
          onClick={onOpenRecent}
        >
          <span className="text-sm font-semibold">Recent Reactions</span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </button>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Sticker sets</h2>
        {loadingStickers ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : stickerSets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sticker sets installed.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {stickerSets.map((set) => (
              <li key={set.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => setOpenSet(set)}
                >
                  <StickerSetIcon title={set.title} thumbDataUri={set.thumbDataUri} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{set.title}</span>
                    <span className="block text-xs text-muted-foreground">{set.count} stickers</span>
                  </span>
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRemoveStickerSet(set)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <StickerSetDialog set={openSet} onOpenChange={(open) => !open && setOpenSet(null)} />
      </section>

      <section className="space-y-2 opacity-60">
        {PLACEHOLDER_ROWS.map((row) => (
          <div
            key={row}
            className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground"
          >
            {row}
          </div>
        ))}
      </section>
    </div>
  );
}

export default SettingsPage;
