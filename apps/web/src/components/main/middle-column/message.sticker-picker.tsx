'use client';

import CustomEmojiCell from '@/lib/components/custom-emoji.cell';
import CustomEmojiSurface from '@/lib/components/custom-emoji.surface';
import MediaSticker from '@/lib/components/media.sticker';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/lib/components/ui/alert-dialog';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Skeleton } from '@/lib/components/ui/skeleton';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/lib/components/ui/tabs';
import { useSDK } from '@/lib/contexts/sdk.context';
import { useIntersectionObserver, type ObserveFn } from '@/lib/hooks/use-intersection-observer';
import { cn } from '@/lib/utils';
import { EMOJI_CATEGORIES, filterEmoji, type EmojiEntry } from '@/lib/utils/emoji.catalog';
import { readFrequentEmoji, rememberFrequentEmoji } from '@/lib/utils/emoji.frequent';
import type {
  Document,
  FeaturedStickerSet,
  GifSearchHit,
  SendStickerDocument,
} from '@telegenie/sdk';
import { Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';

type PickerTab = 'emoji' | 'stickers' | 'gifs';

type StickerSection = {
  id: string;
  accessHash: string;
  title: string;
  documents: Document[];
};

export interface MessageStickerPickerProps {
  peerId: string;
  canSendStickers: boolean;
  canSendGifs: boolean;
  sending: boolean;
  onInsertEmoji: (emoji: string) => void;
  onInsertCustomEmoji: (document: Document, alt: string) => void;
  onSendSticker: (document: SendStickerDocument) => void;
  onSendGifResult: (queryId: string, resultId: string) => void;
}

function stickerEmoji(document: Document): string | undefined {
  for (const attr of document.attributes) {
    if ('alt' in attr && attr.alt) return attr.alt;
  }
  return undefined;
}

function previewThumb(document: Document): string | undefined {
  const thumb = document.thumbs?.find(
    (size) => 'bytes' in size && typeof size.bytes === 'string' && size.bytes.startsWith('data:'),
  );
  return thumb && 'bytes' in thumb && typeof thumb.bytes === 'string' ? thumb.bytes : undefined;
}

function stickerSetOf(document: Document): { setId: string; setAccessHash: string } | undefined {
  for (const attr of document.attributes) {
    if (!('stickerset' in attr)) continue;
    const set = attr.stickerset;
    if (set && 'id' in set && 'accessHash' in set && set.id && set.accessHash) {
      return { setId: set.id, setAccessHash: set.accessHash };
    }
  }
  return undefined;
}

function sendPayload(
  document: Document,
  set?: { id: string; accessHash: string },
): SendStickerDocument {
  const fromDocument = stickerSetOf(document);
  return {
    id: document.id,
    accessHash: document.accessHash,
    fileReference: document.fileReference,
    setId: set?.id ?? fromDocument?.setId,
    setAccessHash: set?.accessHash ?? fromDocument?.setAccessHash,
  };
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="px-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

function StatusLine({ children }: { children: string }) {
  return <p className="px-1 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function EmojiGrid({
  entries,
  onPick,
}: {
  entries: EmojiEntry[];
  onPick: (emoji: string) => void;
}) {
  return (
    <ul className="grid grid-cols-8 gap-1">
      {entries.map((entry) => (
        <li key={entry.emoji}>
          <button
            type="button"
            className="flex size-8 items-center justify-center overflow-hidden rounded-none border border-transparent p-0 text-lg leading-none hover:border-transparent hover:bg-accent focus:outline-none focus-visible:outline-none"
            aria-label={entry.name}
            onClick={() => onPick(entry.emoji)}
          >
            {entry.emoji}
          </button>
        </li>
      ))}
    </ul>
  );
}

const EMOJI_PLAY_THROTTLE_MS = 200;
const EMOJI_PLAY_MARGIN = '100px';

/** Nearest ancestor that scrolls vertically; animated cells start playing relative to it. */
function useScrollParent(ref: RefObject<HTMLElement | null>): HTMLElement | null {
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let node = ref.current?.parentElement ?? null;
    while (node) {
      const { overflowY } = window.getComputedStyle(node);
      if (overflowY === 'auto' || overflowY === 'scroll') break;
      node = node.parentElement;
    }
    setScrollParent(node);
  }, [ref]);
  return scrollParent;
}

/**
 * Sticker box inside a grid cell. The grid column is ~62-66px wide, so the box
 * must stay below that or neighbouring cells overlap.
 */
const STICKER_CELL_PX = 60;

function StickerCell({
  document,
  interactive,
  disabled,
  onSend,
  observe,
  set,
}: {
  document: Document;
  interactive: boolean;
  disabled: boolean;
  onSend: (document: SendStickerDocument) => void;
  observe?: ObserveFn;
  set?: { id: string; accessHash: string };
}) {
  const emoji = stickerEmoji(document);
  const animated = document.mimeType === 'application/x-tgsticker';
  const video = document.mimeType.startsWith('video/');
  // Animated `.tgs` stickers play on the shared `CustomEmojiSurface` canvas, not as per-cell SVG.
  const sticker = animated ? (
    <CustomEmojiCell
      document={document}
      size={STICKER_CELL_PX}
      observe={observe}
      className="pointer-events-none"
    />
  ) : (
    <MediaSticker
      document={document}
      emoji={emoji}
      isVideo={video}
      previewThumbDataUri={previewThumb(document)}
      maxSize={STICKER_CELL_PX}
      className="pointer-events-none max-h-full max-w-full"
    />
  );
  const cellClassName = 'flex size-full items-center justify-center overflow-hidden rounded-md';
  if (!interactive) {
    return <div className={cellClassName}>{sticker}</div>;
  }
  return (
    <button
      type="button"
      className={cn(cellClassName, 'p-0 hover:bg-accent disabled:opacity-64')}
      aria-label={emoji ? `Send ${emoji} sticker` : 'Send sticker'}
      disabled={disabled}
      onClick={() => onSend(sendPayload(document, set))}
    >
      {sticker}
    </button>
  );
}

function StickerGrid({
  documents,
  interactive,
  disabled,
  onSend,
  set,
}: {
  documents: Document[];
  interactive: boolean;
  disabled: boolean;
  onSend: (document: SendStickerDocument) => void;
  set?: { id: string; accessHash: string };
}) {
  const gridRef = useRef<HTMLUListElement>(null);
  const scrollParent = useScrollParent(gridRef);
  const { observe } = useIntersectionObserver({
    rootRef: gridRef,
    root: scrollParent,
    isDisabled: !scrollParent,
    throttleMs: EMOJI_PLAY_THROTTLE_MS,
    rootMargin: EMOJI_PLAY_MARGIN,
  });
  return (
    <CustomEmojiSurface>
      <ul ref={gridRef} className="grid grid-cols-5 gap-1">
        {documents.map((document) => (
          <li key={document.id} className="aspect-square min-w-0">
            <StickerCell
              document={document}
              interactive={interactive}
              disabled={disabled}
              onSend={onSend}
              observe={observe}
              set={set}
            />
          </li>
        ))}
      </ul>
    </CustomEmojiSurface>
  );
}

function GifCell({
  label,
  thumbUrl,
  document,
  interactive,
  disabled,
  onClick,
}: {
  label: string;
  thumbUrl?: string;
  document?: Document;
  interactive: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const thumb = (document ? previewThumb(document) : undefined) ?? thumbUrl;
  const preview = thumb ? (
    <img src={thumb} alt="" className="size-full object-cover" />
  ) : document ? (
    <MediaSticker
      document={document}
      isVideo={document.mimeType.startsWith('video/')}
      isAnimated={document.mimeType === 'application/x-tgsticker'}
      maxSize={96}
      className="pointer-events-none"
    />
  ) : (
    <span className="text-xs text-muted-foreground">GIF</span>
  );
  const className =
    'flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-muted disabled:opacity-64';
  if (!interactive) {
    return <div className={className}>{preview}</div>;
  }
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {preview}
    </button>
  );
}

const FEATURED_CELL_PX = 28;
const FEATURED_SKELETON_COUNT = 20;

type StripSet = FeaturedStickerSet & { installed: boolean };

function FeaturedStrip({
  sets,
  loading,
  installingId,
  selectedId,
  onInstall,
  onSelect,
}: {
  sets: StripSet[];
  loading: boolean;
  installingId?: string;
  selectedId?: string;
  onInstall: (set: FeaturedStickerSet) => void;
  onSelect: (set: FeaturedStickerSet) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { observe } = useIntersectionObserver({
    rootRef: scrollRef,
    throttleMs: EMOJI_PLAY_THROTTLE_MS,
    rootMargin: EMOJI_PLAY_MARGIN,
  });

  return (
    <CustomEmojiSurface className="h-9 w-full">
      <div
        ref={scrollRef}
        className="flex h-full gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sets.map((set) => {
          const selected = set.id === selectedId;
          const cover = set.cover ? (
            <CustomEmojiCell
              document={set.cover}
              size={FEATURED_CELL_PX}
              observe={observe}
              className="pointer-events-none !size-full"
            />
          ) : set.thumbDataUri ? (
            <img src={set.thumbDataUri} alt="" className="size-full object-contain" />
          ) : (
            <span className="block size-full" title={set.title} />
          );
          return (
            <div key={set.id} className="size-7 shrink-0">
              <div className="relative size-7">
                {set.installed ? (
                  <button
                    type="button"
                    className={cn(
                      'flex size-full items-center justify-center overflow-hidden rounded-lg border border-transparent p-0 outline-none hover:border-transparent focus:outline-none focus-visible:outline-none',
                      selected ? 'bg-muted' : 'hover:bg-accent',
                    )}
                    aria-pressed={selected}
                    aria-label={set.title}
                    onClick={() => onSelect(set)}
                  >
                    {cover}
                  </button>
                ) : (
                  <div className="flex size-full items-center justify-center overflow-hidden">
                    {cover}
                  </div>
                )}
                {set.installed ? null : (
                  <button
                    type="button"
                    className="absolute end-0 top-0 z-20 flex size-3 items-center justify-center bg-foreground p-0 text-background"
                    aria-label={`Add ${set.title}`}
                    disabled={installingId === set.id}
                    onClick={() => onInstall(set)}
                  >
                    <Plus className="size-2" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {loading
          ? Array.from({ length: FEATURED_SKELETON_COUNT }, (_, index) => (
              <div key={`loading-${index}`} className="size-7 shrink-0" aria-hidden>
                <Skeleton className="size-7 rounded-none" />
              </div>
            ))
          : null}
      </div>
    </CustomEmojiSurface>
  );
}

function CustomEmojiSetList({
  documents,
  onPick,
}: {
  documents: Document[];
  onPick: (document: Document) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { observe } = useIntersectionObserver({
    rootRef: scrollRef,
    throttleMs: EMOJI_PLAY_THROTTLE_MS,
    rootMargin: EMOJI_PLAY_MARGIN,
  });
  return (
    <CustomEmojiSurface className="h-full min-h-0 w-full">
      <div ref={scrollRef} className="h-full w-full overflow-y-auto">
        <ul className="grid grid-cols-8 gap-1">
          {documents.map((document) => {
            const emoji = stickerEmoji(document);
            return (
              <li key={document.id}>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center overflow-hidden p-0 hover:bg-accent"
                  aria-label={emoji ? `Insert ${emoji}` : 'Insert emoji'}
                  onClick={() => onPick(document)}
                >
                  <CustomEmojiCell
                    document={document}
                    size={32}
                    observe={observe}
                    className="pointer-events-none !size-full"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </CustomEmojiSurface>
  );
}

function CustomEmojiGrid({
  documents,
  onPick,
}: {
  documents: Document[];
  onPick: (document: Document) => void;
}) {
  const gridRef = useRef<HTMLUListElement>(null);
  const scrollParent = useScrollParent(gridRef);
  const { observe } = useIntersectionObserver({
    rootRef: gridRef,
    root: scrollParent,
    isDisabled: !scrollParent,
    throttleMs: EMOJI_PLAY_THROTTLE_MS,
    rootMargin: EMOJI_PLAY_MARGIN,
  });
  return (
    <CustomEmojiSurface>
      <ul ref={gridRef} className="grid grid-cols-8 gap-1">
        {documents.map((document) => {
          const emoji = stickerEmoji(document);
          return (
            <li key={document.id}>
              <button
                type="button"
                className="flex size-8 items-center justify-center overflow-hidden rounded-none border border-transparent p-0 hover:border-transparent hover:bg-accent focus:outline-none focus-visible:outline-none"
                aria-label={emoji ? `Insert ${emoji}` : 'Insert emoji'}
                onClick={() => onPick(document)}
              >
                <CustomEmojiCell
                  document={document}
                  size={32}
                  observe={observe}
                  className="pointer-events-none"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </CustomEmojiSurface>
  );
}

export default function MessageStickerPicker({
  peerId,
  canSendStickers,
  canSendGifs,
  sending,
  onInsertEmoji,
  onInsertCustomEmoji,
  onSendSticker,
  onSendGifResult,
}: MessageStickerPickerProps) {
  const sdk = useSDK();
  const [tab, setTab] = useState<PickerTab>('emoji');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [frequent, setFrequent] = useState<string[]>(() => readFrequentEmoji());
  const [emojiHits, setEmojiHits] = useState<Document[]>([]);
  const [emojiSearchLoading, setEmojiSearchLoading] = useState(false);
  const [featured, setFeatured] = useState<FeaturedStickerSet[]>([]);
  const [installedEmoji, setInstalledEmoji] = useState<FeaturedStickerSet[]>([]);
  const [installedIds, setInstalledIds] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedSetId, setSelectedSetId] = useState<string>();
  const [selectedDocuments, setSelectedDocuments] = useState<Document[]>([]);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [installingId, setInstallingId] = useState<string>();
  const [recent, setRecent] = useState<Document[]>([]);
  const [sections, setSections] = useState<StickerSection[]>([]);
  const [stickerHits, setStickerHits] = useState<Document[]>([]);
  const [stickersLoading, setStickersLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [savedGifs, setSavedGifs] = useState<Document[]>([]);
  const [gifHits, setGifHits] = useState<GifSearchHit[]>([]);
  const [gifsLoading, setGifsLoading] = useState(false);
  const [stickerCatalogVersion, setStickerCatalogVersion] = useState(0);
  const installedEmojiRef = useRef(installedEmoji);
  installedEmojiRef.current = installedEmoji;

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (tab !== 'emoji' || !debounced) {
      setEmojiHits([]);
      setEmojiSearchLoading(false);
      return;
    }
    let cancelled = false;
    setEmojiSearchLoading(true);
    void sdk.sticker
      .searchEmoji(debounced)
      .then((documents) => {
        if (cancelled) return;
        sdk.sticker.rememberCustomEmoji(documents);
        setEmojiHits(documents);
        setEmojiSearchLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEmojiHits([]);
        setEmojiSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sdk, tab, debounced]);

  useEffect(() => {
    if (tab === 'gifs') {
      setFeatured([]);
      setFeaturedLoading(false);
      return;
    }
    let cancelled = false;
    const kind = tab === 'emoji' ? 'emoji' : 'stickers';
    const cached = sdk.globalStore.stickers.freshFeatured(kind);
    if (cached) {
      setFeatured(cached);
      setFeaturedLoading(false);
    } else {
      setFeatured([]);
      setFeaturedLoading(true);
    }
    void sdk.sticker
      .getFeaturedSets(kind)
      .then((sets) => {
        if (!cancelled) setFeatured(sets);
      })
      .catch(() => {
        if (!cancelled) setFeatured([]);
      })
      .finally(() => {
        if (!cancelled) setFeaturedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sdk, tab]);

  useEffect(() => {
    if (tab !== 'emoji') return;
    let cancelled = false;
    void sdk.sticker
      .getInstalledEmojiSets()
      .then((sets) => {
        if (cancelled) return;
        const loaded: FeaturedStickerSet[] = sets.map((set) => ({
          id: set.id,
          accessHash: set.accessHash,
          title: set.title,
          thumbDataUri: set.thumbDataUri,
        }));
        setInstalledEmoji((current) => {
          const ids = new Set(loaded.map((set) => set.id));
          return [...current.filter((set) => !ids.has(set.id)), ...loaded];
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sdk, tab, stickerCatalogVersion]);

  useEffect(() => {
    if (tab !== 'emoji' || !selectedSetId) {
      setSelectedDocuments([]);
      setSelectedLoading(false);
      return;
    }
    const set = installedEmojiRef.current.find((item) => item.id === selectedSetId);
    if (!set) return;
    let cancelled = false;
    setSelectedLoading(true);
    void sdk.sticker
      .getSet(set.id, set.accessHash)
      .then((contents) => {
        if (cancelled) return;
        sdk.sticker.rememberCustomEmoji(contents.documents);
        setSelectedDocuments(contents.documents);
        setSelectedLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedDocuments([]);
        setSelectedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sdk, tab, selectedSetId]);

  useEffect(() => {
    if (tab !== 'stickers') return;
    let cancelled = false;
    setStickersLoading(true);
    if (debounced) {
      void sdk.sticker
        .searchStickers(debounced)
        .then((documents) => {
          if (cancelled) return;
          setStickerHits(documents);
          setStickersLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setStickerHits([]);
          setStickersLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
    void Promise.all([sdk.sticker.getRecentStickers(), sdk.sticker.getInstalledSets()])
      .then(async ([recentDocuments, installed]) => {
        const loaded = await Promise.all(
          installed.map(async (set) => {
            try {
              const contents = await sdk.sticker.getSet(set.id, set.accessHash);
              return {
                id: set.id,
                accessHash: set.accessHash,
                title: set.title,
                documents: contents.documents,
              };
            } catch {
              return { id: set.id, accessHash: set.accessHash, title: set.title, documents: [] };
            }
          }),
        );
        if (cancelled) return;
        setRecent(recentDocuments);
        setSections(loaded);
        setStickerHits([]);
        setStickersLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRecent([]);
        setSections([]);
        setStickersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sdk, tab, debounced, stickerCatalogVersion]);

  useEffect(() => {
    if (tab !== 'gifs') return;
    let cancelled = false;
    setGifsLoading(true);
    const load = debounced
      ? sdk.sticker.searchGifs(peerId, debounced).then((hits) => {
          if (cancelled) return;
          setGifHits(hits);
          setGifsLoading(false);
        })
      : sdk.sticker.getSavedGifs().then((gifs) => {
          if (cancelled) return;
          setSavedGifs(gifs);
          setGifHits([]);
          setGifsLoading(false);
        });
    void load.catch(() => {
      if (cancelled) return;
      setGifHits([]);
      setSavedGifs([]);
      setGifsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sdk, tab, debounced, peerId]);

  const pickEmoji = (emoji: string) => {
    setFrequent(rememberFrequentEmoji(emoji));
    onInsertEmoji(emoji);
  };

  const pickCustomEmoji = (document: Document) => {
    const alt = stickerEmoji(document) ?? '⭐';
    sdk.sticker.rememberCustomEmoji([document]);
    onInsertCustomEmoji(document, alt);
  };

  const install = (set: FeaturedStickerSet) => {
    if (installingId) return;
    const emojiSet = tab === 'emoji';
    setInstallingId(set.id);
    void sdk.sticker
      .installSet(set.id, set.accessHash)
      .then(() => {
        setInstalledIds((current) => new Set(current).add(set.id));
        if (emojiSet) {
          setInstalledEmoji((current) =>
            current.some((item) => item.id === set.id) ? current : [set, ...current],
          );
        }
        setFeatured((current) => current.filter((item) => item.id !== set.id));
        setStickerCatalogVersion((version) => version + 1);
      })
      .catch(() => undefined)
      .finally(() => setInstallingId(undefined));
  };

  const clearRecent = () => {
    setClearing(true);
    void sdk.sticker
      .clearRecentStickers()
      .then(() => {
        setRecent([]);
        setConfirmClear(false);
      })
      .catch(() => undefined)
      .finally(() => setClearing(false));
  };

  const stickerSendsDisabled = sending;
  const gifSendsDisabled = sending;
  const emojiQuery = query.trim();
  const emojiMatches = emojiQuery ? filterEmoji(emojiQuery) : [];
  const frequentEntries = frequent.map((emoji) => ({ emoji, name: emoji }));
  const installedEmojiIds = new Set(installedEmoji.map((set) => set.id));
  const stripSets: StripSet[] =
    tab === 'emoji'
      ? [
          ...installedEmoji.map((set) => ({ ...set, installed: true as const })),
          ...featured
            .filter((set) => !installedIds.has(set.id) && !installedEmojiIds.has(set.id))
            .map((set) => ({ ...set, installed: false as const })),
        ]
      : featured
          .filter((set) => !installedIds.has(set.id))
          .map((set) => ({ ...set, installed: false as const }));
  const selectedSet = installedEmoji.find((set) => set.id === selectedSetId);
  const showSelectedSet = tab === 'emoji' && !emojiQuery && Boolean(selectedSet);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        if (value !== 'emoji' && value !== 'stickers' && value !== 'gifs') return;
        setTab(value);
        setQuery('');
        setDebounced('');
        setSelectedSetId(undefined);
      }}
      className="flex h-[36rem] w-[24rem] min-w-0 flex-col gap-0 overflow-hidden"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 px-3 pt-3">
        {tab === 'gifs' ? null : (
          <FeaturedStrip
            sets={stripSets}
            loading={featuredLoading}
            installingId={installingId}
            selectedId={selectedSetId}
            onInstall={install}
            onSelect={(set) => {
              setQuery('');
              setDebounced('');
              setSelectedSetId((current) =>
                emojiQuery ? set.id : current === set.id ? undefined : set.id,
              );
            }}
          />
        )}
        <Input
          type="search"
          size="sm"
          aria-label="Search"
          placeholder="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div
          className={`min-h-0 min-w-0 flex-1 overflow-x-hidden ${
            showSelectedSet ? 'flex flex-col overflow-hidden' : 'overflow-y-auto pb-4'
          }`}
        >
          <TabsPanel
            value="emoji"
            className={showSelectedSet ? 'flex min-h-0 flex-1 flex-col' : undefined}
          >
            {emojiQuery ? (
              emojiMatches.length === 0 && emojiHits.length === 0 ? (
                emojiSearchLoading || emojiQuery !== debounced ? (
                  <StatusLine>Loading…</StatusLine>
                ) : (
                  <StatusLine>No emoji</StatusLine>
                )
              ) : (
                <div className="flex flex-col gap-3">
                  {emojiMatches.length > 0 ? (
                    <EmojiGrid entries={emojiMatches} onPick={pickEmoji} />
                  ) : null}
                  {emojiHits.length > 0 ? (
                    <CustomEmojiGrid documents={emojiHits} onPick={pickCustomEmoji} />
                  ) : null}
                </div>
              )
            ) : showSelectedSet && selectedSet ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <SectionTitle>{selectedSet.title}</SectionTitle>
                {selectedLoading ? (
                  <StatusLine>Loading…</StatusLine>
                ) : selectedDocuments.length === 0 ? (
                  <StatusLine>No emoji</StatusLine>
                ) : (
                  <div className="min-h-0 flex-1">
                    <CustomEmojiSetList documents={selectedDocuments} onPick={pickCustomEmoji} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {frequentEntries.length > 0 ? (
                  <section>
                    <SectionTitle>Frequently used emoji</SectionTitle>
                    <EmojiGrid entries={frequentEntries} onPick={pickEmoji} />
                  </section>
                ) : null}
                {EMOJI_CATEGORIES.map((category) => (
                  <section key={category.id}>
                    <SectionTitle>{category.title}</SectionTitle>
                    <EmojiGrid entries={category.emoji} onPick={pickEmoji} />
                  </section>
                ))}
              </div>
            )}
          </TabsPanel>
          <TabsPanel value="stickers">
            {debounced ? (
              stickersLoading ? (
                <StatusLine>Loading…</StatusLine>
              ) : stickerHits.length === 0 ? (
                <StatusLine>No stickers</StatusLine>
              ) : (
                <StickerGrid
                  documents={stickerHits}
                  interactive={canSendStickers}
                  disabled={stickerSendsDisabled}
                  onSend={onSendSticker}
                />
              )
            ) : stickersLoading ? (
              <StatusLine>Loading…</StatusLine>
            ) : (
              <div className="flex flex-col gap-3">
                {recent.length > 0 ? (
                  <section>
                    <div className="flex items-center justify-between">
                      <SectionTitle>Recent</SectionTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Clear recent stickers"
                        onClick={() => setConfirmClear(true)}
                      >
                        <X aria-hidden />
                      </Button>
                    </div>
                    <StickerGrid
                      documents={recent}
                      interactive={canSendStickers}
                      disabled={stickerSendsDisabled}
                      onSend={onSendSticker}
                    />
                  </section>
                ) : null}
                {sections.length === 0 ? (
                  <StatusLine>No sticker sets</StatusLine>
                ) : (
                  sections.map((section) => (
                    <section key={section.id}>
                      <SectionTitle>{section.title}</SectionTitle>
                      <StickerGrid
                        documents={section.documents}
                        interactive={canSendStickers}
                        disabled={stickerSendsDisabled}
                        onSend={onSendSticker}
                        set={{ id: section.id, accessHash: section.accessHash }}
                      />
                    </section>
                  ))
                )}
              </div>
            )}
          </TabsPanel>
          <TabsPanel value="gifs">
            {gifsLoading ? (
              <StatusLine>Loading…</StatusLine>
            ) : debounced ? (
              gifHits.length === 0 ? (
                <StatusLine>No GIFs</StatusLine>
              ) : (
                <ul className="grid grid-cols-3 gap-1">
                  {gifHits.map((hit) => (
                    <li key={hit.id}>
                      <GifCell
                        label="Send GIF"
                        thumbUrl={hit.thumbUrl}
                        document={hit.document}
                        interactive={canSendGifs}
                        disabled={gifSendsDisabled}
                        onClick={() => onSendGifResult(hit.queryId, hit.id)}
                      />
                    </li>
                  ))}
                </ul>
              )
            ) : savedGifs.length === 0 ? (
              <StatusLine>No GIFs</StatusLine>
            ) : (
              <ul className="grid grid-cols-3 gap-1">
                {savedGifs.map((document) => (
                  <li key={document.id}>
                    <GifCell
                      label="Send GIF"
                      document={document}
                      interactive={canSendGifs}
                      disabled={gifSendsDisabled}
                      onClick={() => onSendSticker(sendPayload(document))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </TabsPanel>
        </div>
      </div>
      <TabsList className="mx-3 mt-2 mb-3 self-center">
        <TabsTab className="h-7 px-2 text-xs sm:h-7 sm:text-xs" value="emoji">
          Emoji
        </TabsTab>
        <TabsTab className="h-7 px-2 text-xs sm:h-7 sm:text-xs" value="stickers">
          Stickers
        </TabsTab>
        <TabsTab className="h-7 px-2 text-xs sm:h-7 sm:text-xs" value="gifs">
          GIFs
        </TabsTab>
      </TabsList>
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear recent stickers?</AlertDialogTitle>
            <AlertDialogDescription>This removes every sticker in Recent.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </AlertDialogClose>
            <Button type="button" variant="destructive" loading={clearing} onClick={clearRecent}>
              Clear
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </Tabs>
  );
}
