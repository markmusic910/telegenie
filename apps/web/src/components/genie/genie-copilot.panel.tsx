'use client';

import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
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
  Plus,
  SquarePen,
  X,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import {
  MODEL_PROVIDERS,
  SUPPORTED_MODELS,
} from '@/components/genie/genie-models.constants';
import { useGenieRuntime } from '@/components/genie/genie-runtime.adapter';
import { Button } from '@/lib/components/ui/button';
import { useDialogPeer } from '@/lib/contexts/sdk.context';
import { fallbackPeerDisplay } from '@telegenie/sdk';

export interface GenieCopilotPanelProps {
  peerId?: string;
  onClose?: () => void;
  onExpandGlobal?: () => void;
}

export const GenieCopilotPanel = observer(function GenieCopilotPanel({
  peerId,
  onClose,
  onExpandGlobal,
}: GenieCopilotPanelProps) {
  // Reactively track dialog context
  const [clearedPeerId, setClearedPeerId] = useState<string | null>(null);
  const activePeerId = clearedPeerId === peerId ? undefined : peerId;

  const [selectedModel, setSelectedModel] = useState('Gemini 2.5 Flash');
  const [selectedPreset, setSelectedPreset] = useState('Default');

  // Look up dialog & peer display details for the context chip
  const peer = useDialogPeer(activePeerId);
  const peerName =
    peer?.display?.name ||
    (activePeerId ? fallbackPeerDisplay(activePeerId).name : undefined);

  const runtime = useGenieRuntime({ peerId: activePeerId });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-full w-full flex-col overflow-hidden bg-card text-card-foreground">
        {/* Top Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="size-4" />
            </div>
            <span className="font-semibold text-sm">Genie</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              title="New Chat"
              onClick={() => {
                // Starts fresh conversation
                window.location.reload();
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

            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                title="Close Copilot"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Messages Stream */}
        <ThreadPrimitive.Root className="flex flex-1 flex-col overflow-hidden">
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
                let text = '';
                if (typeof message.content === 'string') {
                  text = message.content;
                } else if (Array.isArray(message.content)) {
                  text = message.content
                    .map((p: any) => (p.type === 'text' ? p.text : ''))
                    .join('');
                }

                if (isUser) {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl bg-primary px-3.5 py-2 text-primary-foreground text-xs leading-relaxed shadow-sm">
                        {text}
                      </div>
                    </div>
                  );
                }

                return (
                  <AssistantMessageItem key={message.id} text={text} />
                );
              }}
            </ThreadPrimitive.Messages>
          </ThreadPrimitive.Viewport>

          {/* Bottom Composer Area */}
          <div className="shrink-0 border-t border-border p-3 space-y-2">
            {/* Context Pill (from Screenshot 4) */}
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
                placeholder="Continue the conversation..."
                rows={2}
                className="w-full resize-none bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />

              {/* Controls bar */}
              <div className="flex items-center justify-between border-t border-border/40 px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="flex size-6 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Attach or Tools"
                  >
                    <Plus className="size-3.5" />
                  </button>

                  {/* Model Selector */}
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="h-6 max-w-[120px] rounded bg-transparent px-1 text-[11px] font-medium text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer truncate"
                  >
                    {MODEL_PROVIDERS.map((provider) => (
                      <optgroup key={provider} label={provider}>
                        {SUPPORTED_MODELS.filter((m) => m.provider === provider).map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  {/* Persona / Preset Selector */}
                  <select
                    value={selectedPreset}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                    className="h-6 rounded bg-transparent px-1 text-[11px] font-medium text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="Default">Default</option>
                    <option value="Concise">Concise</option>
                    <option value="Formal">Formal</option>
                    <option value="Technical">Technical</option>
                  </select>
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
              Content generated by AI, for reference only.
            </p>
          </div>
        </ThreadPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  );
});

function AssistantMessageItem({ text }: { text: string }) {
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2 max-w-[95%]">
      {/* Collapsible Thinking Step (Matches screenshot) */}
      <button
        type="button"
        onClick={() => setIsReasoningOpen(!isReasoningOpen)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
      >
        {isReasoningOpen ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        <span>Thought process</span>
      </button>

      {isReasoningOpen && (
        <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground leading-relaxed">
          Retrieved dialogue context and analyzed message semantics.
        </div>
      )}

      {/* Assistant Text Bubble */}
      <div className="group relative rounded-2xl bg-muted/60 border border-border/40 px-3.5 py-2.5 text-xs leading-relaxed text-foreground shadow-sm">
        <div className="whitespace-pre-wrap">{text || 'Thinking...'}</div>
        <button
          type="button"
          onClick={handleCopy}
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground"
          title="Copy message"
        >
          {isCopied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
        </button>
      </div>
    </div>
  );
}

export default GenieCopilotPanel;
