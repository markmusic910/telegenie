'use client';

import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/lib/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/lib/components/ui/radio-group';
import { Switch } from '@/lib/components/ui/switch';
import { emojiPresentation } from '@/lib/utils/emoji';
import type { PlainAvailableReaction } from '@telegenie/libs/foundation/telegram/services/converters/message.converter';
import type { TypeChatReactions } from '@telegenie/libs/foundation/telegram/types/api-types';

export type ReactionMode = 'all' | 'some' | 'none';

const MODE_OPTIONS: { value: ReactionMode; label: string }[] = [
  { value: 'all', label: 'All Reactions' },
  { value: 'some', label: 'Some Reactions' },
  { value: 'none', label: 'No Reactions' },
];

export function reactionModeFromAvailable(available?: TypeChatReactions): ReactionMode {
  if (available == null || Object.keys(available).length === 0) return 'none';
  if ('allowCustom' in available) return 'all';
  if ('reactions' in available && Array.isArray(available.reactions)) return 'some';
  return 'none';
}

export function reactionModeLabel(mode: ReactionMode): string {
  return MODE_OPTIONS.find((option) => option.value === mode)?.label ?? 'Reactions';
}

export function selectedReactionEmoticons(available?: TypeChatReactions): string[] {
  if (!available || !('reactions' in available) || !Array.isArray(available.reactions)) return [];
  const emoticons: string[] = [];
  for (const reaction of available.reactions) {
    if ('emoticon' in reaction && reaction.emoticon) emoticons.push(reaction.emoticon);
  }
  return emoticons;
}

export interface ReactionSettingsDraft {
  mode: ReactionMode;
  selected: string[];
  reactionsLimit: number;
}

interface ReactionSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  available?: TypeChatReactions;
  reactionsLimit: number;
  showLimit: boolean;
  catalog: PlainAvailableReaction[];
  saving: boolean;
  onSave: (draft: ReactionSettingsDraft) => Promise<void>;
}

export default function ReactionSettingsDialog({
  open,
  onOpenChange,
  available,
  reactionsLimit,
  showLimit,
  catalog,
  saving,
  onSave,
}: ReactionSettingsDialogProps) {
  const [mode, setMode] = useState<ReactionMode>(() => reactionModeFromAvailable(available));
  const [limit, setLimit] = useState(reactionsLimit);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) return;
    setMode(reactionModeFromAvailable(available));
    setLimit(reactionsLimit);
    setSelected(new Set(selectedReactionEmoticons(available).map((emoticon) => emoticon.replace(/\uFE0F/g, ''))));
  }, [available, open, reactionsLimit]);

  const saveDisabled = saving || (mode === 'some' && selected.size === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(640px,90vh)] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reactions</DialogTitle>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          <RadioGroup
            value={mode}
            onValueChange={(value) => setMode(value as ReactionMode)}
            aria-label="Reaction mode"
            className="gap-0 overflow-hidden rounded-xl border border-border"
          >
            {MODE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
              >
                <span className="min-w-0 flex-1">{option.label}</span>
                <RadioGroupItem value={option.value} className="sr-only" />
                {mode === option.value ? (
                  <Check className="size-4 text-primary" aria-hidden />
                ) : (
                  <span className="size-4" aria-hidden />
                )}
              </label>
            ))}
          </RadioGroup>
          <p className="px-1 text-xs text-muted-foreground">
            Allow members to react to group messages.
          </p>

          {mode === 'some' ? (
            <ul className="overflow-hidden rounded-xl border border-border">
              {catalog.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted-foreground">Loading reactions…</li>
              ) : (
                catalog.map((row) => (
                  <li key={row.emoticon} className="border-b border-border last:border-b-0">
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5">
                      <span className="w-7 shrink-0 text-center text-xl leading-none" aria-hidden>
                        {emojiPresentation(row.emoticon)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{row.title || row.emoticon}</span>
                      <Switch
                        checked={selected.has(row.emoticon)}
                        onCheckedChange={(checked) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(row.emoticon);
                            else next.delete(row.emoticon);
                            return next;
                          });
                        }}
                        aria-label={row.title || row.emoticon}
                      />
                    </label>
                  </li>
                ))
              )}
            </ul>
          ) : null}

          {showLimit ? (
            <label className="block px-1 text-xs text-muted-foreground">
              Unique reactions limit ({limit})
              <input
                type="range"
                min={1}
                max={11}
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="mt-2 w-full"
              />
            </label>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button
            type="button"
            disabled={saveDisabled}
            onClick={() => {
              void onSave({
                mode,
                selected: [...selected],
                reactionsLimit: limit,
              })
                .then(() => onOpenChange(false))
                .catch((error: unknown) => {
                  console.error('Failed to save reaction settings', error);
                });
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
