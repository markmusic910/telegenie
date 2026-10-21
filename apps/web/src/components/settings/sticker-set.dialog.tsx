'use client';

import MediaSticker from '@/lib/components/media.sticker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { useSDK } from '@/lib/contexts/sdk.context';
import type { InstalledStickerSet, StickerSetContents } from '@telegenie/libs/foundation/telegram/services/sticker.service';
import type { Document } from '@telegenie/sdk';
import { useEffect, useState } from 'react';

export interface StickerSetDialogProps {
  set: InstalledStickerSet | null;
  onOpenChange: (open: boolean) => void;
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

/**
 * Installed sticker set, opened from settings. Shows every sticker in the set.
 */
export default function StickerSetDialog({ set, onOpenChange }: StickerSetDialogProps) {
  const sdk = useSDK();
  const [state, setState] = useState<{
    id: string;
    contents: StickerSetContents | null;
    loading: boolean;
  } | null>(null);

  useEffect(() => {
    if (!set) return;
    let cancelled = false;
    setState({ id: set.id, contents: null, loading: true });
    void sdk.sticker
      .getSet(set.id, set.accessHash)
      .then((next) => {
        if (cancelled) return;
        setState({
          id: set.id,
          contents: next && Array.isArray(next.documents) ? next : null,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ id: set.id, contents: null, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [set, sdk.sticker]);

  const visible = state?.id === set?.id ? state : null;
  const loading = Boolean(set) && (!visible || visible.loading);
  const contents = visible && !visible.loading ? visible.contents : null;
  const documents = contents?.documents ?? [];

  return (
    <Dialog open={set != null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="truncate pe-8 text-center">{set?.title}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="min-w-0 overflow-x-clip">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !contents ? (
            <p className="text-sm text-muted-foreground">Could not load this sticker set.</p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">This set has no stickers.</p>
          ) : (
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {documents.map((document) => {
                const emoji = stickerEmoji(document);
                const animated = document.mimeType === 'application/x-tgsticker';
                const video = document.mimeType.startsWith('video/');
                return (
                  <li key={document.id} className="flex min-w-0 items-center justify-center overflow-hidden">
                    <MediaSticker
                      document={document}
                      emoji={emoji}
                      isAnimated={animated}
                      isVideo={video}
                      previewThumbDataUri={previewThumb(document)}
                      maxSize={72}
                      className="cursor-default"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </DialogPanel>
      </DialogContent>
    </Dialog>
  );
}
