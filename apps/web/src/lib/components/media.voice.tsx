'use client';

import { claimMediaPlayback, releaseMediaPlayback } from '@/lib/media-playback';
import { cn } from '@/lib/utils';
import type { Document } from '@telegenie/libs/foundation/telegram/types/file';
import { buildDownloadUrl } from '@telegenie/sdk';
import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const WAVE_HEIGHT = 23;
const SPIKE_STEP_PX = 4;

let activeAudio: HTMLAudioElement | null = null;

function interpolateSpikes(data: number[], fitCount: number): { data: number[]; peak: number } {
  let peak = 0;
  const springFactor = data.length / fitCount;
  const left = data[0] ?? 0;
  const right = data[data.length - 1] ?? 0;
  const next = new Array<number>(fitCount);
  for (let i = 0; i < fitCount; i++) {
    const idx = Math.floor(i * springFactor);
    const value = ((data[idx - 1] ?? left) + (data[idx] ?? left) + (data[idx + 1] ?? right)) / 3;
    next[i] = value;
    if (value > peak) peak = value;
  }
  return { data: next, peak };
}

function spikeHeights(samples: number[], count: number): number[] {
  const fitCount = Math.max(16, count);
  if (samples.length === 0) {
    return Array.from({ length: fitCount }, () => 2);
  }
  const { data, peak } = interpolateSpikes(samples, fitCount);
  const scale = Math.max(1, peak);
  return data.map((value) => Math.max(2, Math.round(WAVE_HEIGHT * (value / scale))));
}

function formatVoiceDuration(seconds?: number): string {
  const total = Math.max(0, Math.round(seconds ?? 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const audioStops = new WeakMap<HTMLAudioElement, () => void>();

function claimAudio(audio: HTMLAudioElement) {
  let stop = audioStops.get(audio);
  if (!stop) {
    stop = () => {
      audio.pause();
      if (activeAudio === audio) activeAudio = null;
    };
    audioStops.set(audio, stop);
  }
  activeAudio = audio;
  claimMediaPlayback(stop);
}

export interface MediaVoiceProps {
  document: Document;
  waveform?: number[];
  duration?: number;
  isOutgoing?: boolean;
  isUnread?: boolean;
  peerId?: string;
  messageId?: number;
  onPlaybackStart?: () => void;
  className?: string;
}

type PlaybackPhase = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export default function MediaVoice({
  document,
  waveform = [],
  duration,
  isOutgoing = false,
  isUnread = false,
  peerId,
  messageId,
  onPlaybackStart,
  className,
}: MediaVoiceProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const onPlaybackStartRef = useRef(onPlaybackStart);
  onPlaybackStartRef.current = onPlaybackStart;

  const trackRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<PlaybackPhase>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [knownDuration, setKnownDuration] = useState(duration ?? 0);
  const [spikeCount, setSpikeCount] = useState(40);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const update = () => {
      const next = Math.max(16, Math.floor(track.clientWidth / SPIKE_STEP_PX));
      setSpikeCount((prev) => (prev === next ? prev : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const fileSize = Number(document.size);
  const downloadUrl = buildDownloadUrl({
    fileId: `d:${document.id}`,
    accessHash: document.accessHash,
    dcId: document.dcId,
    mimeType: document.mimeType || 'audio/ogg',
    fileSize: Number.isFinite(fileSize) ? fileSize : undefined,
    peerId,
    messageId,
  });

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        const stop = audioStops.get(audio);
        if (stop) releaseMediaPlayback(stop);
        audio.pause();
        if (activeAudio === audio) activeAudio = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const total = knownDuration || duration || 0;
  const progress = total > 0 ? Math.min(1, currentTime / total) : 0;
  const bars = spikeHeights(waveform, spikeCount);
  const shownTime = phase === 'playing' || phase === 'paused' ? currentTime : (duration ?? total);

  const markStarted = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    onPlaybackStartRef.current?.();
  };

  const bindAudio = (audio: HTMLAudioElement) => {
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setKnownDuration(audio.duration);
      }
    };
    audio.onplaying = () => {
      setPhase('playing');
      markStarted();
    };
    audio.onpause = () => {
      if (!audio.ended) setPhase('paused');
    };
    audio.onended = () => {
      setPhase('idle');
      setCurrentTime(0);
    };
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
  };

  const handleToggle = async () => {
    if (phase === 'loading') return;

    const existing = audioRef.current;
    if (existing && phase === 'playing') {
      existing.pause();
      setPhase('paused');
      return;
    }
    if (existing && (phase === 'paused' || (phase === 'idle' && existing.src))) {
      claimAudio(existing);
      try {
        await existing.play();
      } catch {
        setPhase('error');
      }
      return;
    }

    setPhase('loading');
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Voice download failed');
      const blob = await response.blob();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      bindAudio(audio);
      claimAudio(audio);
      await audio.play();
    } catch {
      setPhase('error');
    }
  };

  const label =
    phase === 'playing'
      ? 'Pause voice message'
      : phase === 'error'
        ? 'Retry voice message'
        : 'Play voice message';

  return (
    <div className={cn('flex w-full items-center gap-2.5 py-0.5', className)}>
      <button
        type="button"
        aria-label={label}
        disabled={phase === 'loading'}
        onClick={() => {
          void handleToggle();
        }}
        className={cn(
          'flex size-14 shrink-0 items-center justify-center rounded-full transition-opacity',
          isOutgoing ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground',
          phase === 'loading' && 'opacity-70',
        )}
      >
        {phase === 'playing' ? (
          <Pause className="size-12 fill-current" aria-hidden />
        ) : (
          <Play className="size-12 fill-current" aria-hidden />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          ref={trackRef}
          className="flex h-[23px] w-full items-center justify-between"
          aria-hidden
        >
          {bars.map((height, index) => {
            const played = progress > 0 && index / bars.length < progress;
            return (
              <span
                key={index}
                className={cn(
                  'w-0.5 shrink-0 rounded-full',
                  played
                    ? isOutgoing
                      ? 'bg-primary-foreground'
                      : 'bg-primary'
                    : isOutgoing
                      ? 'bg-primary-foreground/45'
                      : isUnread
                        ? 'bg-primary/70'
                        : 'bg-foreground/35',
                )}
                style={{ height: `${height}px` }}
              />
            );
          })}
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[11px] tabular-nums leading-none',
            isUnread
              ? isOutgoing
                ? 'font-semibold text-primary-foreground'
                : 'font-semibold text-primary'
              : isOutgoing
                ? 'text-primary-foreground/80'
                : 'text-muted-foreground',
          )}
        >
          {phase === 'error' ? 'Could not play' : formatVoiceDuration(shownTime)}
          {isUnread && (
            <span
              className={cn(
                'size-1.5 rounded-full',
                isOutgoing ? 'bg-primary-foreground' : 'bg-primary',
              )}
            />
          )}
        </span>
      </div>
    </div>
  );
}
