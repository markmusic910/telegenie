'use client';

import { getInstalledSkills } from '@/components/genie/genie-skills.storage';
import { BUILTIN_TONES } from '@/components/genie/genie-tones.constants';
import { MemorySyncDialog } from '@/components/genie/memory-sync.dialog';
import { Button } from '@/lib/components/ui/button';
import { Checkbox } from '@/lib/components/ui/checkbox';
import { Switch } from '@/lib/components/ui/switch';
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
import { Label } from '@/lib/components/ui/label';
import { Textarea } from '@/lib/components/ui/textarea';
import { useSDK, useStore } from '@/lib/contexts/sdk.context';
import { cn } from '@/lib/utils';
import type { DialogMemorySync, GenieSkill } from '@telegenie/agent';
import { Brain, Check, ExternalLink, Loader2, RefreshCw, Settings } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export interface GenieConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peerId?: string;
}

const GenieConfigDialog = observer(function GenieConfigDialog({
  open,
  onOpenChange,
  peerId: propPeerId,
}: GenieConfigDialogProps) {
  const router = useRouter();
  const sdk = useSDK();
  const globalStore = useStore('global');
  const activePeerId = propPeerId || globalStore.nav.selectedDialogId;

  const [background, setBackground] = useState('');
  const [tone, setTone] = useState('default');
  const [customTonePrompt, setCustomTonePrompt] = useState('');
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [installedSkills, setInstalledSkills] = useState<GenieSkill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Memory sync state
  const [dialogSync, setDialogSync] = useState<DialogMemorySync | undefined>(undefined);
  const [incrementalExtraction, setIncrementalExtraction] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ processed: number } | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInstalledSkills(getInstalledSkills());
    setIsSaved(false);

    if (activePeerId) {
      setIsLoading(true);
      void Promise.all([
        sdk.agent.getDialogPreset(activePeerId).then((preset) => {
          if (preset) {
            setBackground(preset.background || '');
            setTone(preset.tone || 'default');
            setCustomTonePrompt(preset.tone === 'custom' ? preset.tonePrompt || '' : '');
            setSelectedSkillIds(preset.skills || []);
          } else {
            setBackground('');
            setTone('default');
            setCustomTonePrompt('');
            setSelectedSkillIds([]);
          }
        }),
        sdk.agent.getDialogMemorySync(activePeerId).then((sync) => {
          setDialogSync(sync);
          setIncrementalExtraction(sync?.incrementalSync ?? false);
          setIsSyncing(sdk.agent.isSyncing(activePeerId));
        }),
      ])
        .catch((err) => {
          console.warn('[GenieConfigDialog] Failed to load dialog configuration:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, activePeerId, sdk.agent]);

  // Listen for background sync updates
  useEffect(() => {
    if (!open || !activePeerId) return;

    setIsSyncing(sdk.agent.isSyncing(activePeerId));

    const unsubProgress = sdk.agent.onMemorySyncProgress((payload) => {
      if (String(payload.peerId) === String(activePeerId)) {
        setIsSyncing(payload.status === 'syncing');
        setSyncProgress({ processed: payload.processed });
      }
    });

    const unsubComplete = sdk.agent.onMemorySyncComplete((payload) => {
      if (String(payload.peerId) === String(activePeerId)) {
        setIsSyncing(false);
        setSyncProgress(null);
        void sdk.agent.getDialogMemorySync(activePeerId).then((sync) => {
          setDialogSync(sync);
          setIsSyncing(sdk.agent.isSyncing(activePeerId));
        });
      }
    });

    return () => {
      unsubProgress();
      unsubComplete();
    };
  }, [open, activePeerId, sdk.agent]);

  const handleToggleIncremental = async (checked: boolean) => {
    setIncrementalExtraction(checked);
    if (activePeerId) {
      try {
        const updated = await sdk.agent.setIncrementalMemorySync(activePeerId, checked);
        setDialogSync(updated);
      } catch (err) {
        console.warn('[GenieConfigDialog] Failed to update incremental sync:', err);
      }
    }
  };

  const handleToggleSkill = (skillId: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId],
    );
  };

  const handleSave = async () => {
    if (!activePeerId) return;

    const selectedToneOption = BUILTIN_TONES.find((t) => t.id === tone);
    const resolvedTonePrompt =
      tone === 'custom'
        ? customTonePrompt.trim()
        : selectedToneOption?.promptDirective || undefined;

    try {
      await sdk.agent.setDialogPreset({
        peerId: activePeerId,
        background: background.trim() || undefined,
        tone,
        tonePrompt: resolvedTonePrompt,
        skills: selectedSkillIds,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.warn('[GenieConfigDialog] Failed to save dialog preset:', e);
    }

    setIsSaved(true);
    setTimeout(() => {
      onOpenChange(false);
    }, 450);
  };

  const handleOpenSettingsSkills = () => {
    onOpenChange(false);
    router.push('/settings/telegenie/skills');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="max-w-lg w-full max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Settings className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Agent Config
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure background context, tone directives, and skills for this conversation.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-5">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Loading dialog configuration…
              </div>
            ) : (
              <>
                {/* 1. Background context textarea */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="dialog-background" className="text-xs font-semibold">
                      Background Context
                    </Label>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      Basic context for the agent
                    </span>
                  </div>
                  <Textarea
                    id="dialog-background"
                    placeholder="e.g. This is a family chat with parents and siblings, or: Client support for Acme Corp - prioritize urgency and technical clarity."
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    rows={3}
                    className="text-xs leading-relaxed"
                  />
                </div>

                {/* 2. Tone selector */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="dialog-tone" className="text-xs font-semibold">
                      Agent Tone
                    </Label>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      Response persona style
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {BUILTIN_TONES.map((option) => {
                      const isSelected = tone === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setTone(option.id)}
                          className={cn(
                            'flex flex-col items-start p-2.5 rounded-lg border text-left transition-all cursor-pointer',
                            isSelected
                              ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                              : 'border-border/70 bg-card/40 hover:bg-accent/50 text-muted-foreground',
                          )}
                        >
                          <span className={cn('text-xs font-semibold', isSelected && 'text-primary')}>
                            {option.label}
                          </span>
                          <span className="text-[10px] leading-tight line-clamp-2 mt-0.5 opacity-80">
                            {option.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom tone prompt textarea if 'custom' is selected */}
                  {tone === 'custom' && (
                    <div className="flex flex-col gap-1.5 mt-1 p-3 rounded-lg bg-muted/30 border border-border/80">
                      <Label htmlFor="custom-tone-prompt" className="text-xs font-medium text-foreground">
                        Custom Tone Instructions
                      </Label>
                      <Textarea
                        id="custom-tone-prompt"
                        placeholder="Define how the agent should speak, e.g.: 'Respond in an upbeat, warm, and highly analytical tone with concise analogies.'"
                        value={customTonePrompt}
                        onChange={(e) => setCustomTonePrompt(e.target.value)}
                        rows={2}
                        className="text-xs leading-relaxed bg-background"
                      />
                    </div>
                  )}
                </div>

                {/* 3. Skills multi-selector */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-semibold">Enabled Skills</Label>
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-medium text-primary">
                        {selectedSkillIds.length} active
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenSettingsSkills}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
                    >
                      <span>Manage Skills</span>
                      <ExternalLink className="size-3" />
                    </button>
                  </div>

                  {installedSkills.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/80 p-4 text-center">
                      <p className="text-xs text-muted-foreground">No skills installed.</p>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={handleOpenSettingsSkills}
                        className="text-xs h-auto p-0 mt-1"
                      >
                        Create skills in Settings
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card/30 overflow-hidden max-h-48 overflow-y-auto">
                      {installedSkills.map((skill) => {
                        const isChecked = selectedSkillIds.includes(skill.id);
                        return (
                          <label
                            key={skill.id}
                            className={cn(
                              'flex items-start gap-3 p-3 text-left transition-colors cursor-pointer select-none',
                              isChecked ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-accent/40',
                            )}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => handleToggleSkill(skill.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-foreground truncate">
                                  {skill.title}
                                </span>
                                {isChecked && (
                                  <span className="size-1.5 rounded-full bg-primary" />
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                {skill.description || skill.content}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4. Memory Section */}
                <div className="flex flex-col gap-2.5 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Brain className="size-4 text-primary" />
                      <Label className="text-xs font-semibold">Conversation Memory</Label>
                    </div>
                    {isSyncing ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                        <Loader2 className="size-3 animate-spin" />
                        <span>Syncing… {syncProgress?.processed ? `(${syncProgress.processed} msgs)` : ''}</span>
                      </span>
                    ) : dialogSync?.status === 'failed' ? (
                      <span className="text-[11px] text-destructive font-medium" title={dialogSync.error}>
                        Sync failed
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground font-normal">
                        {dialogSync?.lastSyncAt
                          ? `Last synced: ${new Date(dialogSync.lastSyncAt).toLocaleDateString()} ${new Date(dialogSync.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : 'Never synced'}
                      </span>
                    )}
                  </div>

                  {/* Incremental Extraction Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-card/40">
                    <div className="flex flex-col gap-0.5 pr-2">
                      <span className="text-xs font-medium text-foreground">Incremental Memory Extraction</span>
                      <span className="text-[11px] text-muted-foreground">
                        Automatically extract memories from new messages sent or received in this chat
                      </span>
                    </div>
                    <Switch
                      checked={incrementalExtraction}
                      onCheckedChange={handleToggleIncremental}
                    />
                  </div>

                  {/* Covered Range & Full Sync trigger */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-card/40">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-foreground">Full History Sync</span>
                      <span
                        className={cn(
                          'text-[11px]',
                          dialogSync?.status === 'failed'
                            ? 'text-destructive'
                            : 'text-muted-foreground',
                        )}
                      >
                        {dialogSync?.status === 'failed' && dialogSync.error
                          ? `Failed: ${dialogSync.error}`
                          : dialogSync?.fromDate && dialogSync?.toDate
                            ? `Covered: ${new Date(dialogSync.fromDate).toLocaleDateString()} – ${new Date(dialogSync.toDate).toLocaleDateString()} (${dialogSync.syncedMessageCount ?? 0} msgs)`
                            : 'Extract facts, preferences, and events from message history'}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSyncModalOpen(true)}
                      disabled={isSyncing || !activePeerId}
                      className="text-xs h-7 gap-1.5 shrink-0"
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          <span>Syncing…</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="size-3" />
                          <span>Sync Memory</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
            <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isLoading || !activePeerId}
              className="gap-1.5 min-w-[80px]"
            >
              {isSaved ? (
                <>
                  <Check className="size-3.5 text-emerald-500" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save</span>
              )}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
    {activePeerId && (
      <MemorySyncDialog
        open={syncModalOpen}
        onOpenChange={setSyncModalOpen}
        peerId={activePeerId}
        onSyncStarted={() => {
          setIsSyncing(true);
        }}
        onSyncError={() => {
          setIsSyncing(sdk.agent.isSyncing(activePeerId));
        }}
      />
    )}
  </>
  );
});

export default GenieConfigDialog;
