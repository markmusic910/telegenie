'use client';

import { Button } from '@/lib/components/ui/button';
import { Calendar } from '@/lib/components/ui/calendar';
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
import { useDialogPeer, useSDK, useStore } from '@/lib/contexts/sdk.context';
import { Calendar as CalendarIcon, History, Sparkles } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { toast } from 'sonner';

export interface MemorySyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peerId: string;
  onSyncStarted?: () => void;
  onSyncError?: () => void;
}

const TELEGRAM_EPOCH = new Date('2013-08-14T00:00:00Z');

export const MemorySyncDialog = observer(function MemorySyncDialog({
  open,
  onOpenChange,
  peerId,
  onSyncStarted,
  onSyncError
}: MemorySyncDialogProps) {
  const sdk = useSDK();
  const peer = useDialogPeer(peerId);
  const chatStore = useStore('chat');
  const channelStore = useStore('channel');

  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(
    () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    [],
  );

  // Compute creation date boundary: channels and groups have date in seconds
  const creationDate = useMemo(() => {
    const channel = channelStore.get(peerId);
    if (channel?.date) {
      return new Date(channel.date * 1000);
    }
    const chat = chatStore.get(peerId);
    if (chat?.date) {
      return new Date(chat.date * 1000);
    }
    // For 1-on-1 private chats, fallback to 1 year ago for date-picker boundaries
    return new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  }, [peerId, channelStore, chatStore]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: defaultFrom,
    to: today,
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectAll = () => {
    const channel = channelStore.get(peerId);
    const chat = chatStore.get(peerId);
    const earliestDate =
      channel?.date ? new Date(channel.date * 1000) : chat?.date ? new Date(chat.date * 1000) : TELEGRAM_EPOCH;

    setDateRange({
      from: earliestDate,
      to: new Date(),
    });
  };

  const handleConfirmSync = async () => {
    if (!dateRange?.from) return;
    const fromMs = dateRange.from.getTime();
    const toMs = (dateRange.to ?? dateRange.from).getTime();

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      onSyncStarted?.();
      onOpenChange(false);
      await sdk.agent.syncDialogMemory(peerId, {
        fromDate: Math.min(fromMs, toMs),
        toDate: Math.max(fromMs, toMs),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start memory sync';
      setErrorMessage(msg);
      toast.error('Memory sync failed', {
        description: msg,
      });
      onSyncError?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedRange = useMemo(() => {
    if (!dateRange?.from) return 'Please select a date range';
    const fromStr = dateRange.from.toLocaleDateString();
    const toStr = (dateRange.to ?? dateRange.from).toLocaleDateString();
    return fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`;
  }, [dateRange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="max-w-md w-full flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Sync Dialog Memory
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select message date range for {peer?.display?.name || 'this conversation'}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
            {/* Quick action buttons */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <CalendarIcon className="size-3.5 text-muted-foreground" />
                <span>Selected: {formattedRange}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="text-xs h-7 gap-1 px-2.5"
              >
                <History className="size-3" />
                <span>All Messages</span>
              </Button>
            </div>

            {/* Calendar Range Picker */}
            <div className="rounded-xl border border-border/80 bg-card/40 p-2 flex justify-center">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                disabled={(date) => date > today || date < creationDate}
                className="text-xs"
              />
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Messages will be scanned local-first to prevent Telegram rate limits. Facts, preferences, and commitments will be extracted in the background.
            </p>

            {errorMessage && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                {errorMessage}
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
            <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button
              size="sm"
              onClick={handleConfirmSync}
              disabled={isSubmitting || !dateRange?.from}
              className="min-w-[90px]"
            >
              {isSubmitting ? 'Starting…' : 'Start Sync'}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
});

export default MemorySyncDialog;

