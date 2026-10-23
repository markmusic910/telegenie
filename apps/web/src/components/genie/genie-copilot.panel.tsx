'use client';

import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
} from '@assistant-ui/react';
import {
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Maximize2,
  Settings,
  SquarePen,
  X,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import {
  DEFAULT_MODEL_ID,
  MODEL_PROVIDERS,
  SUPPORTED_MODELS,
  getModelProvider,
} from '@/components/genie/genie-models.constants';
import { useGenieRuntime } from '@/components/genie/genie-runtime.adapter';
import GenieConfigDialog from '@/components/genie/genie-config.dialog';
import { Button } from '@/lib/components/ui/button';
import { useDialogPeer } from '@/lib/contexts/sdk.context';
import { fallbackPeerDisplay } from '@telegenie/sdk';
import { BUILTIN_PRESETS } from '@telegenie/agent';

export interface GenieCopilotPanelProps {
  peerId?: string;
  onClose?: () => void;
  onExpandGlobal?: () => void;
  onSwitchToConfig?: () => void;
}

function safeExtractReasoningText(content: unknown): string {
  if (!content) return '';
  if (Array.isArray(content)) {
    return content
      .map((p: any) => {
        if (p && typeof p === 'object' && p.type === 'reasoning') {
          if (typeof p.text === 'string') return p.text;
          if (p.text && typeof p.text === 'object') return JSON.stringify(p.text);
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }
  return '';
}

function safeExtractContentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!content) return '';
  if (Array.isArray(content)) {
    return content
      .map((p: any) => {
        if (!p) return '';
        if (typeof p === 'string') return p;
        if (typeof p === 'object') {
          // Explicitly ignore reasoning / thought parts
          if (p.type === 'reasoning') return '';
          if (p.type === 'text') {
            if (typeof p.text === 'string') return p.text;
            if (p.text && typeof p.text === 'object') return JSON.stringify(p.text);
          }
          if (typeof p.text === 'string' && !p.type) return p.text;
          if (typeof p.content === 'string') return p.content;
        }
        return '';
      })
      .filter(Boolean)
      .join('');
  }
  if (typeof content === 'object') {
    if ((content as any).type === 'reasoning') return '';
    if ('text' in (content as Record<string, unknown>)) {
      const t = (content as Record<string, unknown>).text;
      return typeof t === 'string' ? t : JSON.stringify(t);
    }
    return JSON.stringify(content);
  }
  return String(content);
}

export const GenieCopilotPanel = observer(function GenieCopilotPanel({
  peerId,
  onClose,
  onExpandGlobal,
  onSwitchToConfig,
}: GenieCopilotPanelProps) {
  // Reactively track dialog context
  const [clearedPeerId, setClearedPeerId] = useState<string | null>(null);
  const activePeerId = clearedPeerId === peerId ? undefined : peerId;

  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_ID);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);

  const [sessionKey, setSessionKey] = useState(0);

  const currentModelName =
    SUPPORTED_MODELS.find((m) => m.id === selectedModel || m.name === selectedModel)?.name ??
    selectedModel;

  const currentPresetName =
    BUILTIN_PRESETS.find((p) => p.id === selectedPreset)?.name ?? 'Default Persona';

  // Look up dialog & peer display details for the context chip
  const peer = useDialogPeer(activePeerId);
  const peerName =
    peer?.display?.name ||
    (activePeerId ? fallbackPeerDisplay(activePeerId).name : undefined);

  const runtime = useGenieRuntime({
    peerId: activePeerId,
    model: selectedModel,
    presetId: selectedPreset || undefined,
  });

  return (
    <AssistantRuntimeProvider key={sessionKey} runtime={runtime}>
      <div className="flex h-full w-full flex-col overflow-hidden bg-card text-card-foreground">
        {/* Top Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="font-semibold text-sm truncate max-w-[200px]"
              title={peerName || 'Genie'}
            >
              {peerName || 'Genie'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Settings"
              onClick={() => setIsConfigDialogOpen(true)}
            >
              <Settings className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
              title="New Chat"
              onClick={() => {
                setSessionKey((prev) => prev + 1);
              }}
            >
              <SquarePen className="size-4" />
            </Button>

            {onExpandGlobal && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                title="Expand to Global View"
                onClick={onExpandGlobal}
              >
                <Maximize2 className="size-4" />
              </Button>
            )}

            {onSwitchToConfig ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                title="Switch to Dialog Info"
                onClick={onSwitchToConfig}
              >
                <X className="size-4" />
              </Button>
            ) : onClose ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                title="Close Genie"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>

        {/* Messages Stream */}
        <ThreadPrimitive.Root className="flex flex-1 flex-col overflow-hidden">
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ThreadPrimitive.Empty>
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground pt-12">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                  <Bot className="size-6" />
                </div>
                <h3 className="font-medium text-foreground text-sm">How can I help you?</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                  Ask questions about your chat, summarize messages, or request assistance.
                </p>
              </div>
            </ThreadPrimitive.Empty>

            <ThreadPrimitive.Messages>
              {({ message }) => {
                const isUser = message.role === 'user';
                const text = safeExtractContentText(message.content);
                const thought = safeExtractReasoningText(message.content);

                if (isUser) {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl bg-primary px-3.5 py-2 text-primary-foreground text-xs leading-relaxed shadow-sm break-words [overflow-wrap:anywhere]">
                        {text}
                      </div>
                    </div>
                  );
                }

                return (
                  <AssistantMessageItem key={message.id} text={text} thought={thought} />
                );
              }}
            </ThreadPrimitive.Messages>
          </ThreadPrimitive.Viewport>

          {/* Bottom Composer Area */}
          <div className="shrink-0 border-t border-border p-3 space-y-2">
            {/* Context Pill */}
            {activePeerId && (
              <div className="flex items-center gap-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/70 px-2.5 py-0.5 text-xs text-foreground">
                  <span className="flex size-3.5 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-500">
                    {peerName?.[0]?.toUpperCase() || 'C'}
                  </span>
                  <span className="max-w-[120px] truncate">{peerName}</span>
                  <button
                    type="button"
                    onClick={() => setClearedPeerId(peerId ?? null)}
                    className="ml-0.5 rounded-full hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Remove context"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Composer Box */}
            <ComposerPrimitive.Root className="relative flex flex-col rounded-xl border border-border bg-background focus-within:border-primary/50 transition-colors shadow-sm">
              <ComposerPrimitive.Input
                placeholder="Ask TeleGenie..."
                minRows={2}
                maxRows={5}
                className="w-full resize-none bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none max-h-28 overflow-y-auto"
              />

              {/* Controls bar */}
              <div className="flex items-center justify-between border-t border-border/40 px-2 py-1.5">
                <div className="flex items-center gap-1">
                  {/* Model Selector */}
                  <div className="group relative inline-flex items-center">
                    <div className="flex items-center gap-1 rounded px-1.5 py-0.5 font-sans text-[11px] font-normal text-muted-foreground group-hover:text-foreground group-hover:bg-muted/70 transition-colors pointer-events-none select-none">
                      <span>{currentModelName}</span>
                      <ChevronDown className="size-3 text-muted-foreground/70" />
                    </div>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer font-sans text-xs text-foreground"
                      aria-label="Select Model"
                    >
                      {MODEL_PROVIDERS.map((provider) => (
                        <optgroup key={provider} label={provider}>
                          {SUPPORTED_MODELS.filter((m) => m.provider === provider).map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Persona / Preset Selector */}
                  <div className="group relative inline-flex items-center">
                    <div className="flex items-center gap-1 rounded px-1.5 py-0.5 font-sans text-[11px] font-normal text-muted-foreground group-hover:text-foreground group-hover:bg-muted/70 transition-colors pointer-events-none select-none">
                      <span className="max-w-[120px] truncate">{currentPresetName}</span>
                      <ChevronDown className="size-3 text-muted-foreground/70 shrink-0" />
                    </div>
                    <select
                      value={selectedPreset}
                      onChange={(e) => setSelectedPreset(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer font-sans text-xs text-foreground"
                      aria-label="Select Persona"
                    >
                      <option value="">Default Persona</option>
                      {BUILTIN_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <ComposerPrimitive.Send
                  type="button"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                >
                  <ArrowUp className="size-3.5 shrink-0 text-white dark:text-neutral-900" strokeWidth={2.5} />
                </ComposerPrimitive.Send>
              </div>
            </ComposerPrimitive.Root>

            <p className="text-center text-[10px] text-muted-foreground/60">
              TeleGenie AI can make mistakes. Verify important info.
            </p>
          </div>
        </ThreadPrimitive.Root>

        {/* Configuration Modal Dialog */}
        <GenieConfigDialog
          open={isConfigDialogOpen}
          onOpenChange={setIsConfigDialogOpen}
          activeProvider={getModelProvider(selectedModel)}
          activeModel={selectedModel}
        />
      </div>
    </AssistantRuntimeProvider>
  );
});

function AssistantMessageItem({ text, thought }: { text: string; thought?: string }) {
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2 max-w-[95%] min-w-0">
      {/* Collapsible Thinking Step */}
      {thought && (
        <button
          type="button"
          onClick={() => setIsReasoningOpen(!isReasoningOpen)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start cursor-pointer"
        >
          {isReasoningOpen ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          <span>Thought process</span>
        </button>
      )}

      {isReasoningOpen && thought && (
        <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono break-words [overflow-wrap:anywhere]">
          {thought}
        </div>
      )}

      {/* Assistant Text Bubble */}
      <div className="group relative rounded-2xl bg-muted/60 border border-border/40 px-3.5 py-2.5 text-xs leading-relaxed text-foreground shadow-sm min-w-0">
        <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{text || 'Thinking...'}</div>
        {text && (
          <button
            type="button"
            onClick={handleCopy}
            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
            title="Copy message"
          >
            {isCopied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
          </button>
        )}
      </div>
    </div>
  );
}

export default GenieCopilotPanel;
