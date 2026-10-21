'use client';

import { Progress, ProgressIndicator, ProgressTrack, ProgressValue } from '@/lib/components/ui/progress';
import { Spinner } from '@/lib/components/ui/spinner';
import { cn } from '@/lib/utils';
import { formatFileSize, getFileExtension } from '@/lib/utils/format';
import type {
  Document,
  DocumentAttributeFilename,
} from '@telegenie/libs/foundation/telegram/types/file';
import { buildDownloadUrl } from '@telegenie/sdk';
import { CheckCircle2, Download, FileArchive, FileCode, FileText, Music, Sheet } from 'lucide-react';
import { useState } from 'react';

export interface MediaDocumentProps {
  document: Document;
  isOutgoing?: boolean;
  className?: string;
  peerId?: string;
  messageId?: number;
  variant?: 'card' | 'stack';
}

function StackDocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1 7V3.5L18.5 7H15z" />
    </svg>
  );
}

type DownloadPhase = 'idle' | 'downloading' | 'complete' | 'error';

function getFileColorAndIcon(ext: string) {
  switch (ext) {
    case 'pdf':
      return {
        icon: FileText,
        badgeClass: 'bg-rose-500/20 text-rose-500 border-rose-500/30',
      };
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return {
        icon: FileArchive,
        badgeClass: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
      };
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'm4a':
    case 'ogg':
      return {
        icon: Music,
        badgeClass: 'bg-violet-500/20 text-violet-500 border-violet-500/30',
      };
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'json':
    case 'py':
    case 'html':
    case 'css':
    case 'md':
      return {
        icon: FileCode,
        badgeClass: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
      };
    case 'xls':
    case 'xlsx':
    case 'csv':
      return {
        icon: Sheet,
        badgeClass: 'bg-teal-500/20 text-teal-500 border-teal-500/30',
      };
    default:
      return {
        icon: FileText,
        badgeClass: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
      };
  }
}

async function fetchBlobWithProgress(
  url: string,
  fallbackTotalBytes: number | undefined,
  onProgress: (percent: number) => void,
  onTotalKnown: (totalBytes: number) => void,
): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const contentLengthHeader = response.headers.get('Content-Length');
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;
  const totalBytes =
    contentLength && Number.isFinite(contentLength) && contentLength > 0
      ? contentLength
      : fallbackTotalBytes && Number.isFinite(fallbackTotalBytes) && fallbackTotalBytes > 0
        ? fallbackTotalBytes
        : undefined;

  if (totalBytes) {
    onTotalKnown(totalBytes);
  }

  if (!response.body) {
    const blob = await response.blob();
    if (totalBytes) {
      onProgress(100);
    }
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    chunks.push(value);
    loaded += value.byteLength;

    if (totalBytes) {
      onProgress(Math.min(100, Math.round((loaded / totalBytes) * 100)));
    }
  }

  if (totalBytes) {
    onProgress(100);
  }

  const mimeType = response.headers.get('Content-Type') ?? 'application/octet-stream';
  return new Blob(chunks, { type: mimeType });
}

export default function MediaDocument({
  document,
  isOutgoing = false,
  className,
  peerId,
  messageId,
  variant = 'card',
}: MediaDocumentProps) {
  const [downloadPhase, setDownloadPhase] = useState<DownloadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [knownTotalBytes, setKnownTotalBytes] = useState<number | undefined>(undefined);

  const filenameAttr = document.attributes?.find(
    (a): a is DocumentAttributeFilename =>
      typeof a === 'object' && a !== null && 'fileName' in a && Boolean(a.fileName),
  );
  const fileName = filenameAttr?.fileName || `file_${document.id}`;
  const extension = getFileExtension(fileName);
  const fileSize = Number(document.size);
  const { icon: FileIcon, badgeClass } = getFileColorAndIcon(extension);
  const hasKnownTotal = knownTotalBytes != null && knownTotalBytes > 0;
  const isPreparing = downloadPhase === 'downloading' && progress === 0;
  const isDownloading = downloadPhase === 'downloading' && progress > 0;

  const downloadUrl = buildDownloadUrl({
    fileId: `d:${document.id}`,
    accessHash: document.accessHash,
    dcId: document.dcId,
    mimeType: document.mimeType || 'application/octet-stream',
    fileSize: Number.isFinite(fileSize) ? fileSize : undefined,
    filename: fileName,
    peerId,
    messageId,
  });

  const resetDownloadState = () => {
    setDownloadPhase('idle');
    setProgress(0);
    setKnownTotalBytes(undefined);
  };

  const handleDownload = async () => {
    if (downloadPhase !== 'idle') {
      return;
    }

    const fallbackTotalBytes = Number.isFinite(fileSize) && fileSize > 0 ? fileSize : undefined;

    setDownloadPhase('downloading');
    setProgress(0);
    setKnownTotalBytes(fallbackTotalBytes);

    try {
      const blob = await fetchBlobWithProgress(
        downloadUrl,
        fallbackTotalBytes,
        setProgress,
        setKnownTotalBytes,
      );

      const blobUrl = URL.createObjectURL(blob);
      try {
        const link = window.document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        link.click();
      } finally {
        URL.revokeObjectURL(blobUrl);
      }

      setProgress(100);
      setDownloadPhase('complete');
      window.setTimeout(resetDownloadState, 1500);
    } catch (error) {
      console.error('[MediaDocument] Download failed:', error);
      setDownloadPhase('error');
      window.setTimeout(resetDownloadState, 1500);
    }
  };

  return (
    <div
      onClick={() => {
        if (downloadPhase === 'idle') {
          void handleDownload();
        }
      }}
      className={cn(
        'relative overflow-hidden flex items-center gap-3 transition-colors select-none shrink-0 cursor-pointer',
        variant === 'stack'
          ? cn(
              'rounded-xl p-1.5 min-w-[220px] max-w-[360px]',
              isOutgoing
                ? 'text-primary-foreground hover:bg-white/10'
                : 'text-foreground hover:bg-black/5 dark:hover:bg-white/5',
            )
          : cn(
              'rounded-xl p-2.5 mb-1 min-h-[3.5rem] min-w-[220px] max-w-[340px]',
              isOutgoing
                ? 'bg-black/15 text-primary-foreground'
                : 'bg-muted/80 text-foreground border border-border/40',
            ),
        className,
      )}
    >
      {/* File Icon Badge */}
      {variant === 'stack' ? (
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full shadow-2xs',
            isOutgoing
              ? 'bg-white text-primary'
              : 'bg-primary/10 text-primary border border-primary/20',
          )}
        >
          <StackDocumentIcon className="size-5" />
        </div>
      ) : (
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl border font-bold text-xs uppercase shadow-2xs',
            isOutgoing
              ? 'bg-primary-foreground/20 text-primary-foreground border-primary-foreground/20'
              : badgeClass,
          )}
        >
          {extension ? (
            <span className="text-[10px] tracking-tight">{extension.slice(0, 4)}</span>
          ) : (
            <FileIcon className="size-5" />
          )}
        </div>
      )}

      {/* File Details */}
      <div className="flex flex-col min-w-0 flex-1">
        <span
          className={cn(
            'truncate leading-tight',
            variant === 'stack' ? 'font-medium text-[13px]' : 'font-semibold text-xs',
          )}
          title={fileName}
        >
          {fileName}
        </span>
        <span className="text-[11px] opacity-75 mt-0.5">{formatFileSize(fileSize)}</span>
      </div>

      {/* Download Action Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void handleDownload();
        }}
        disabled={downloadPhase !== 'idle'}
        aria-label={`Download ${fileName}`}
        aria-busy={downloadPhase === 'downloading' || downloadPhase === 'complete'}
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full border-0 p-0 outline-none transition-colors',
          'focus:outline-none focus-visible:outline-none hover:border-transparent',
          'disabled:pointer-events-none disabled:opacity-60',
          variant === 'stack'
            ? isOutgoing
              ? 'bg-white/20 text-white hover:bg-white/30'
              : 'bg-primary/10 text-primary hover:bg-primary/20'
            : isOutgoing
              ? 'bg-primary-foreground/25 text-primary-foreground'
              : 'bg-primary/10 text-primary',
        )}
      >
        <Download className="size-4" />
      </button>

      {downloadPhase !== 'idle' && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/60 px-4 backdrop-blur-sm"
          aria-live="polite"
        >
          {downloadPhase === 'error' ? (
            <span className="text-xs font-medium text-white">Download failed</span>
          ) : downloadPhase === 'complete' ? (
            <>
              <CheckCircle2 className="size-6 text-emerald-400" />
              <span className="text-xs font-medium text-white">Download succeeded</span>
            </>
          ) : isPreparing ? (
            <>
              <Spinner className="size-5 text-white" />
              <span className="text-xs text-white/90">Preparing download…</span>
            </>
          ) : isDownloading && hasKnownTotal ? (
            <Progress value={progress} className="w-full max-w-[180px] gap-1.5">
              <ProgressTrack className="bg-white/20">
                <ProgressIndicator className="bg-white" />
              </ProgressTrack>
              <ProgressValue className="text-center text-xs text-white/90" />
            </Progress>
          ) : (
            <>
              <Spinner className="size-5 text-white" />
              <span className="text-xs text-white/90">Downloading…</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
