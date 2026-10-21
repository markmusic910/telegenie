'use client';

import MediaSpoiler from '@/lib/components/media.spoiler';
import { Button } from '@/lib/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from '@/lib/components/ui/menu';
import { useSDK } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/utils/format';
import { convertCoverToJpeg } from '@/lib/utils/image.util';
import { AlbumRectPart, calculateAlbumLayout } from '@/lib/utils/media-layout';
import type { CustomEmojiEntity, MessageAlbum } from '@telegenie/sdk';
import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  Image as ImageIcon,
  MoreVertical,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import MediaSendCaptionComposer from './media-send-caption.composer';
import MediaSendItemActions from './media-send-item.actions';

export interface MediaSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file?: File | null;
  files?: File[];
  peerId: string;
  threadId?: string;
  initialCaption?: string;
  initialEntities?: CustomEmojiEntity[];
  onSent?: () => void;
}

const EMPTY_ENTITIES: CustomEmojiEntity[] = [];

function getCornerRounding(sides: number) {
  return cn(
    sides & AlbumRectPart.Top && sides & AlbumRectPart.Left && 'rounded-tl-2xl',
    sides & AlbumRectPart.Top && sides & AlbumRectPart.Right && 'rounded-tr-2xl',
    sides & AlbumRectPart.Bottom && sides & AlbumRectPart.Left && 'rounded-bl-2xl',
    sides & AlbumRectPart.Bottom && sides & AlbumRectPart.Right && 'rounded-br-2xl',
  );
}

export default function MediaSendDialog({
  open,
  onOpenChange,
  file,
  files,
  peerId,
  threadId,
  initialCaption = '',
  initialEntities = EMPTY_ENTITIES,
  onSent,
}: MediaSendDialogProps) {
  const sdk = useSDK();

  const fileList = useMemo(() => {
    if (files && files.length > 0) return files;
    if (file) return [file];
    return [];
  }, [files, file]);

  // Modifiable list of files for deletion support
  const [items, setItems] = useState<File[]>(fileList);
  const [activeIndex, setActiveIndex] = useState(0);
  const [caption, setCaption] = useState(initialCaption);
  const [entities, setEntities] = useState<CustomEmojiEntity[]>(initialEntities);
  const [invertMedia, setInvertMedia] = useState(false);

  // Per-file spoilers and video covers
  const [spoilers, setSpoilers] = useState<Record<number, boolean>>({});
  const [videoCover, setVideoCover] = useState<File | null>(null);
  const [autoCovers, setAutoCovers] = useState<Record<number, File>>({});

  // Media dimensions and durations
  const [mediaMetas, setMediaMetas] = useState<
    Record<number, { width: number; height: number; duration?: number }>
  >({});

  // Track open transition with ref to avoid infinite re-render loop
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setItems(fileList);
      setCaption(initialCaption);
      setEntities(initialEntities ?? EMPTY_ENTITIES);
      setInvertMedia(false);
      setSpoilers({});
      setVideoCover(null);
      setAutoCovers({});
      setActiveIndex(0);
    }
    prevOpenRef.current = open;
  }, [open, fileList, initialCaption, initialEntities]);

  const activeFile = items[activeIndex] || null;
  const isVideo = Boolean(activeFile?.type.startsWith('video/'));
  const isImage = Boolean(activeFile?.type.startsWith('image/'));

  // Blob preview URLs for each file
  const previewUrls = useMemo(() => {
    return items.map((f) => URL.createObjectURL(f));
  }, [items]);

  useEffect(() => {
    return () => {
      for (const url of previewUrls) URL.revokeObjectURL(url);
    };
  }, [previewUrls]);

  const activePreviewUrl = previewUrls[activeIndex] || null;

  // Video count check: only allow video covers if there is exactly 1 video
  const singleVideoIndex = items.findIndex((f) => f.type.startsWith('video/'));
  const videoCount = items.filter((f) => f.type.startsWith('video/')).length;
  const canUploadCover = videoCount === 1;
  const hasVideoCover = canUploadCover && Boolean(videoCover);

  // Video cover preview URL (for the single video)
  const videoCoverUrl = useMemo(() => {
    if (!videoCover) return null;
    return URL.createObjectURL(videoCover);
  }, [videoCover]);

  useEffect(() => {
    return () => {
      if (videoCoverUrl) {
        URL.revokeObjectURL(videoCoverUrl);
      }
    };
  }, [videoCoverUrl]);

  const coverPreviewUrl = canUploadCover && activeIndex === singleVideoIndex ? videoCoverUrl : null;

  // Read metadata (width, height, duration) for each file
  useEffect(() => {
    items.forEach((f, idx) => {
      const url = previewUrls[idx];
      if (!url) return;

      if (f.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
          setMediaMetas((prev) => {
            const w = img.naturalWidth || 400;
            const h = img.naturalHeight || 400;
            if (prev[idx]?.width === w && prev[idx]?.height === h) return prev;
            return { ...prev, [idx]: { width: w, height: h } };
          });
        };
        img.src = url;
      } else if (f.type.startsWith('video/')) {
        const vid = document.createElement('video');
        vid.preload = 'auto';
        vid.muted = true;
        vid.playsInline = true;
        vid.onloadedmetadata = () => {
          const w = vid.videoWidth || 400;
          const h = vid.videoHeight || 400;
          const dur =
            vid.duration && !Number.isNaN(vid.duration) ? vid.duration : undefined;
          setMediaMetas((prev) => {
            if (
              prev[idx]?.width === w &&
              prev[idx]?.height === h &&
              prev[idx]?.duration === dur
            ) {
              return prev;
            }
            return { ...prev, [idx]: { width: w, height: h, duration: dur } };
          });
          vid.currentTime = Math.min(vid.duration && !Number.isNaN(vid.duration) ? vid.duration : 1, 1);
        };
        vid.onseeked = () => {
          if (vid.videoWidth && vid.videoHeight) {
            const canvas = document.createElement('canvas');
            canvas.width = vid.videoWidth;
            canvas.height = vid.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(vid, 0, 0);
              canvas.toBlob((blob) => {
                if (blob) {
                  const autoCoverFile = new File([blob], `${f.name.replace(/\.[^/.]+$/, '')}_thumb.jpg`, {
                    type: 'image/jpeg',
                  });
                  setAutoCovers((prev) => ({ ...prev, [idx]: autoCoverFile }));
                }
              }, 'image/jpeg', 0.85);
            }
          }
        };
        vid.src = url;
      }
    });
  }, [items, previewUrls]);

  // Synthetic album for calculating responsive layout for >= 2 media items
  const syntheticAlbum = useMemo<MessageAlbum>(() => {
    return {
      albumId: 'preview-album',
      albumType: 'media',
      messages: items.map((f, idx) => {
        const meta = mediaMetas[idx];
        const isVid = f.type.startsWith('video/');
        return {
          id: String(idx),
          peerId,
          mediaDimensions:
            meta && meta.width > 0 && meta.height > 0
              ? { width: meta.width, height: meta.height }
              : { width: 400, height: 400 },
          isPhoto: !isVid,
          isVideo: isVid,
        } as any;
      }),
    } as MessageAlbum;
  }, [items, mediaMetas, peerId]);

  const albumMaxWidth = 420;
  const { layout: albumItemsLayout, containerStyle: albumContainerStyle } = useMemo(() => {
    if (items.length <= 1) {
      return { layout: [], containerStyle: { width: albumMaxWidth, height: 0 } };
    }
    return calculateAlbumLayout(syntheticAlbum, albumMaxWidth);
  }, [syntheticAlbum, items.length]);

  // File picker ref for video cover
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Send action: closes immediately and dispatches sendMediaGroup in background
  const handleSend = () => {
    if (items.length === 0) return;

    const groupItems = items.map((f, idx) => {
      const isVid = f.type.startsWith('video/');
      const cover = isVid
        ? (canUploadCover && idx === singleVideoIndex && videoCover
            ? videoCover
            : autoCovers[idx] || undefined)
        : undefined;
      const meta = mediaMetas[idx];
      return {
        file: f,
        spoiler: Boolean(spoilers[idx]),
        videoCover: cover,
        width: meta?.width,
        height: meta?.height,
        duration: meta?.duration,
      };
    });

    onOpenChange(false);
    onSent?.();
    void sdk.messageSend.sendMediaGroup(peerId, groupItems, {
      threadId,
      caption: caption || undefined,
      entities: entities.length ? entities : undefined,
      invertMedia,
    });
  };

  const triggerCoverUpload = () => {
    if (!canUploadCover) return;
    if (coverInputRef.current) {
      coverInputRef.current.value = '';
      coverInputRef.current.click();
    }
  };

  const handleCoverSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFiles = e.target.files;
    if (pickedFiles && pickedFiles[0]) {
      const jpegCover = await convertCoverToJpeg(pickedFiles[0]);
      setVideoCover(jpegCover);
    }
    e.target.value = '';
  };

  const toggleItemSpoiler = (idx: number) => {
    setSpoilers((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const deleteItem = (indexToDelete: number) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== indexToDelete);
      if (next.length === 0) {
        onOpenChange(false);
      }
      return next;
    });

    setSpoilers((prev) => {
      const next: Record<number, boolean> = {};
      Object.entries(prev).forEach(([key, val]) => {
        const k = Number(key);
        if (k < indexToDelete) {
          next[k] = val;
        } else if (k > indexToDelete) {
          next[k - 1] = val;
        }
      });
      return next;
    });

    if (items[indexToDelete]?.type.startsWith('video/')) {
      setVideoCover(null);
    }

    setAutoCovers((prev) => {
      const next: Record<number, File> = {};
      Object.entries(prev).forEach(([key, val]) => {
        const k = Number(key);
        if (k < indexToDelete) {
          next[k] = val;
        } else if (k > indexToDelete) {
          next[k - 1] = val;
        }
      });
      return next;
    });

    setMediaMetas((prev) => {
      const next: Record<number, { width: number; height: number; duration?: number }> = {};
      Object.entries(prev).forEach(([key, val]) => {
        const k = Number(key);
        if (k < indexToDelete) {
          next[k] = val;
        } else if (k > indexToDelete) {
          next[k - 1] = val;
        }
      });
      return next;
    });

    setActiveIndex((prev) => (prev >= indexToDelete ? Math.max(0, prev - 1) : prev));
  };

  // Header menu: toggle spoiler for ALL items (overwriting individual config)
  const allSpoilers = items.length > 0 && items.every((_, idx) => spoilers[idx]);
  const toggleAllSpoilers = () => {
    if (allSpoilers) {
      setSpoilers({});
    } else {
      const next: Record<number, boolean> = {};
      items.forEach((_, idx) => {
        next[idx] = true;
      });
      setSpoilers(next);
    }
  };

  if (items.length === 0) return null;

  const hasAnySpoiler = items.some((_, idx) => spoilers[idx]);
  const hasAnyCover = canUploadCover && hasVideoCover;

  const captionComposer = (
    <MediaSendCaptionComposer
      peerId={peerId}
      caption={caption}
      onCaptionChange={setCaption}
      entities={entities}
      onEntitiesChange={setEntities}
      invertMedia={invertMedia}
      hasAnySpoiler={hasAnySpoiler}
      allSpoilers={allSpoilers}
      hasAnyCover={hasAnyCover}
      onSend={handleSend}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(740px,94vh)] flex-col gap-0 p-0 sm:max-w-[460px] overflow-hidden"
        showCloseButton={false}
      >
        {/* Hidden file input for video cover */}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleCoverSelected}
        />

        {/* Modal Header */}
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-4 py-3 space-y-0">
          <DialogTitle className="text-base font-semibold text-foreground">
            {items.length > 1
              ? `Send ${items.length} Files`
              : isVideo
                ? 'Send Video'
                : isImage
                  ? 'Send Photo'
                  : 'Send File'}
          </DialogTitle>

          <div className="flex items-center gap-1">
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                  />
                }
              >
                <MoreVertical className="size-4" />
              </MenuTrigger>
              <MenuPopup side="bottom" align="end" className="w-52 p-1">
                {/* Video cover option if exactly 1 video is present */}
                {canUploadCover && (
                  <>
                    <MenuItem
                      onClick={triggerCoverUpload}
                      className="cursor-pointer gap-2 py-1.5 text-xs"
                    >
                      <ImageIcon className="size-4" />
                      <span>{hasVideoCover ? 'Change Video Cover' : 'Upload Video Cover'}</span>
                    </MenuItem>
                    {hasVideoCover && (
                      <MenuItem
                        onClick={() => setVideoCover(null)}
                        className="cursor-pointer gap-2 py-1.5 text-xs text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                        <span>Remove Video Cover</span>
                      </MenuItem>
                    )}
                  </>
                )}

                {/* Hide with spoiler for ALL items (overwriting individual config) */}
                <MenuItem
                  onClick={toggleAllSpoilers}
                  className="cursor-pointer gap-2 py-1.5 text-xs justify-between"
                >
                  <div className="flex items-center gap-2">
                    <EyeOff className="size-4" />
                    <span>Hide with Spoiler</span>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded',
                      allSpoilers
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {allSpoilers ? 'On' : 'Off'}
                  </span>
                </MenuItem>

                {/* Move caption up/down */}
                <MenuItem
                  onClick={() => setInvertMedia((prev) => !prev)}
                  className="cursor-pointer gap-2 py-1.5 text-xs justify-between"
                >
                  <div className="flex items-center gap-2">
                    {invertMedia ? <ArrowDown className="size-4" /> : <ArrowUp className="size-4" />}
                    <span>{invertMedia ? 'Move Caption Down' : 'Move Caption Up'}</span>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded',
                      invertMedia
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {invertMedia ? 'Top' : 'Bottom'}
                  </span>
                </MenuItem>
              </MenuPopup>
            </Menu>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Caption above media if invertMedia is true */}
        {invertMedia && captionComposer}

        {/* Media Preview: Album layout if >= 2 files, single preview if 1 file */}
        <div className="p-4 flex flex-col items-center justify-center min-h-0 flex-1 overflow-y-auto">
          {items.length > 1 ? (
            <div
              className="relative overflow-hidden rounded-2xl select-none mx-auto bg-muted/40 border border-border/50 shrink-0"
              style={{
                width: `${albumContainerStyle.width}px`,
                height: `${albumContainerStyle.height}px`,
              }}
            >
              {items.map((f, idx) => {
                const itemLayout = albumItemsLayout[idx];
                if (!itemLayout) return null;
                const { dimensions, sides } = itemLayout;
                const isItemVideo = f.type.startsWith('video/');
                const previewUrl = previewUrls[idx];
                const coverUrl = canUploadCover && idx === singleVideoIndex ? videoCoverUrl : null;
                const isItemSpoiler = Boolean(spoilers[idx]);
                const duration = mediaMetas[idx]?.duration;
                const isSelected = idx === activeIndex;

                return (
                  <div
                    key={`${f.name}-${idx}`}
                    onClick={() => setActiveIndex(idx)}
                    className={cn(
                      'absolute overflow-hidden cursor-pointer bg-muted select-none group transition-all',
                      getCornerRounding(sides),
                      isSelected && 'ring-2 ring-primary ring-inset z-10',
                    )}
                    style={{
                      left: `${dimensions.x}px`,
                      top: `${dimensions.y}px`,
                      width: `${dimensions.width}px`,
                      height: `${dimensions.height}px`,
                    }}
                  >
                    {isItemVideo ? (
                      coverUrl ? (
                        <img src={coverUrl} alt="Cover" className="size-full object-cover" />
                      ) : (
                        <video
                          src={previewUrl}
                          preload="metadata"
                          muted
                          playsInline
                          className="size-full object-cover pointer-events-none"
                        />
                      )
                    ) : (
                      <img
                        src={previewUrl}
                        alt={`File ${idx + 1}`}
                        className="size-full object-cover"
                      />
                    )}

                    {/* Duration badge for video */}
                    {isItemVideo && duration != null && duration > 0 && (
                      <div className="absolute top-2 left-2 z-10 rounded-full bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[11px] font-medium text-white shadow-xs pointer-events-none">
                        {formatDuration(duration)}
                      </div>
                    )}

                    {/* Spoiler overlay if active */}
                    {isItemSpoiler && (
                      <MediaSpoiler
                        isVisible={true}
                        label="Spoiler"
                        thumbUri={coverUrl || previewUrl || undefined}
                        className="pointer-events-none"
                      />
                    )}

                    {/* Floating icons at bottom-right corner: spoiler, delete */}
                    <MediaSendItemActions
                      isSpoiler={Boolean(spoilers[idx])}
                      onToggleSpoiler={() => toggleItemSpoiler(idx)}
                      onDelete={() => deleteItem(idx)}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="relative flex items-center justify-center rounded-2xl overflow-hidden bg-muted/30 min-h-[220px] max-h-[380px] w-full border border-border select-none">
              {isImage && activePreviewUrl && (
                <img
                  src={activePreviewUrl}
                  alt="Preview"
                  className="max-h-[360px] w-full object-contain"
                />
              )}

              {isVideo && (
                <div className="relative w-full h-full flex items-center justify-center">
                  {coverPreviewUrl ? (
                    <img
                      src={coverPreviewUrl}
                      alt="Custom cover"
                      className="max-h-[360px] w-full object-contain"
                    />
                  ) : (
                    <video
                      src={activePreviewUrl || undefined}
                      controls
                      className="max-h-[360px] w-full object-contain"
                    />
                  )}

                  {/* Duration Badge */}
                  {mediaMetas[0]?.duration != null && mediaMetas[0].duration > 0 && (
                    <div className="absolute top-2.5 left-2.5 z-10 rounded-full bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[11px] font-medium text-white shadow-xs pointer-events-none">
                      {formatDuration(mediaMetas[0].duration)}
                    </div>
                  )}
                </div>
              )}

              {/* Live MediaSpoiler Preview if toggled */}
              {Boolean(spoilers[0]) && (
                <MediaSpoiler
                  isVisible={true}
                  label="Spoiler Enabled"
                  thumbUri={coverPreviewUrl || activePreviewUrl || undefined}
                  className="pointer-events-none"
                />
              )}

              {/* Floating icons at bottom-right corner: spoiler, delete */}
              <MediaSendItemActions
                isSpoiler={Boolean(spoilers[0])}
                onToggleSpoiler={() => toggleItemSpoiler(0)}
                onDelete={() => deleteItem(0)}
              />
            </div>
          )}
        </div>

        {/* Caption below media if invertMedia is false */}
        {!invertMedia && captionComposer}
      </DialogContent>
    </Dialog>
  );
}
