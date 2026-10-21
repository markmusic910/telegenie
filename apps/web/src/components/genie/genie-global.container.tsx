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
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import {
  MODEL_PROVIDERS,
  SUPPORTED_MODELS,
} from '@/components/genie/genie-models.constants';
import { useGenieRuntime } from '@/components/genie/genie-runtime.adapter';
import GenieScheduledView from '@/components/genie/genie-scheduled.view';
import GenieSearchView from '@/components/genie/genie-search.view';
import GenieSidebar, { type GenieSidebarTab } from '@/components/genie/genie-sidebar';
import { useDialogPeer, useStore } from '@/lib/contexts/sdk.context';
import { fallbackPeerDisplay } from '@telegenie/sdk';

export interface GenieGlobalContainerProps {
  onClose?: () => void;
}

/**
 * GenieGlobalContainer is the 2-column full AI workspace taking over
 * the middle and right columns (Screenshots 1, 2, 3).
 */
export const GenieGlobalContainer = observer(function GenieGlobalContainer({
  onClose,
}: GenieGlobalContainerProps) {
  const [activeTab, setActiveTab] = useState<GenieSidebarTab>('NEW_CHAT');
  const [selectedModel, setSelectedModel] = useState('Gemini 2.5 Flash');
  const [selectedPreset, setSelectedPreset] = useState('Default');

  // Reactively track currently selected dialog from left column
  const globalStore = useStore('global');
  const selectedDialogId = globalStore.nav.selectedDialogId;
  const [clearedPeerId, setClearedPeerId] = useState<string | null>(null);

  const activePeerId = clearedPeerId === selectedDialogId ? undefined : selectedDialogId;
  const peer = useDialogPeer(activePeerId);
  const peerName =
    peer?.display?.name ||
    (activePeerId ? fallbackPeerDisplay(activePeerId).name : undefined);

  const runtime = useGenieRuntime({ peerId: activePeerId });

  const quickPromptChips = [
    { label: 'Combot Starter', icon: '📊' },
    { label: 'Rose Starter', icon: '🌹' },
    { label: 'Draft email from chat', icon: '✉️' },
    { label: 'Write a group introduction', icon: '✍️' },
    { label: 'Identify and create reminders', icon: '⏰' },
    { label: 'Smart Chat Organizer', icon: '📁' },
    { label: 'Daily work group summary', icon: '📝' },
    { label: 'Ask what the group is discussing', icon: '💬' },
  ];

  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
      {/* Left Column: Genie Sidebar */}
      <GenieSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={onClose}
      />

      {/* Right Column: Main Content Area */}
      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden bg-background/50">
        {activeTab === 'SCHEDULED' ? (
          <GenieScheduledView />
        ) : activeTab === 'SEARCH_CHAT' ? (
          <GenieSearchView onSelectChat={() => setActiveTab('NEW_CHAT')} />
        ) : (
          <AssistantRuntimeProvider runtime={runtime}>
            <ThreadPrimitive.Root className="flex h-full flex-col overflow-hidden">
              <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-6 py-8">
                <ThreadPrimitive.Empty>
                  {/* Screenshot 2 Welcome Screen */}
                  <div className="flex flex-col items-center justify-center min-h-[480px] max-w-2xl mx-auto w-full text-center my-auto">
                    {/* Centered Logo */}
                    <div className="flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-primary mb-4 shadow-sm border border-border/50">
                      <Bot className="size-10" />
                    </div>

                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      Genie
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1 mb-8">
                      The AI Copilot for Your Telegram Universe.
                    </p>

                    {/* Context Pill (Reflects currently selected dialog) */}
                    {activePeerId && (
                      <div className="flex items-center gap-1.5 mb-3 self-start ml-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/80 px-2.5 py-1 text-xs text-foreground shadow-sm">
                          <span className="flex size-3.5 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-500">
                            {peerName?.[0]?.toUpperCase() || 'C'}
                          </span>
                          <span className="max-w-[140px] truncate">{peerName}</span>
                          <button
                            type="button"
                            onClick={() => setClearedPeerId(selectedDialogId ?? null)}
                            className="ml-0.5 rounded-full hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Remove context"
                          >
                            <X className="size-2.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Composer Card */}
                    <ComposerPrimitive.Root className="w-full flex flex-col rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-primary/50 transition-colors mb-6">
                      <ComposerPrimitive.Input
                        placeholder="Ask anything..."
                        rows={3}
                        className="w-full resize-none bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />

                      <div className="flex items-center justify-between border-t border-border/40 px-2 pt-2 mt-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="flex size-6 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            <Plus className="size-3.5" />
                          </button>

                          {/* All supported LLM models */}
                          <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="h-6 rounded bg-transparent px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
                          >
                            {MODEL_PROVIDERS.map((provider) => (
                              <optgroup key={provider} label={provider}>
                                {SUPPORTED_MODELS.filter((m) => m.provider === provider).map(
                                  (m) => (
                                    <option key={m.id} value={m.name}>
                                      {m.name}
                                    </option>
                                  ),
                                )}
                              </optgroup>
                            ))}
                          </select>

                          <select
                            value={selectedPreset}
                            onChange={(e) => setSelectedPreset(e.target.value)}
                            className="h-6 rounded bg-transparent px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
                          >
                            <option value="Default">Default</option>
                            <option value="Concise">Concise</option>
                            <option value="Formal">Formal</option>
                            <option value="Technical">Technical</option>
                          </select>
                        </div>

                        {/* Send button with guaranteed icon visibility */}
                        <ComposerPrimitive.Send
                          type="button"
                          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                        >
                          <ArrowUp className="size-4 shrink-0 text-white dark:text-neutral-900" strokeWidth={2.5} />
                        </ComposerPrimitive.Send>
                      </div>
                    </ComposerPrimitive.Root>

                    {/* Quick suggestion prompt chips */}
                    <div className="w-full text-center">
                      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mb-3">
                        <span>Not sure where to start? Try these</span>
                        <RefreshCw className="size-3 opacity-60" />
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {quickPromptChips.map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            className="flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shadow-xs cursor-pointer"
                          >
                            <span className="text-xs">{chip.icon}</span>
                            <span>{chip.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
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
                        <div key={message.id} className="flex justify-end mb-4">
                          <div className="max-w-[70%] rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground text-xs leading-relaxed shadow-sm">
                            {text}
                          </div>
                        </div>
                      );
                    }

                    return <GlobalAssistantMessageItem key={message.id} text={text} />;
                  }}
                </ThreadPrimitive.Messages>
              </ThreadPrimitive.Viewport>

              {/* Bottom Composer only appears when conversation is active */}
              <ThreadPrimitive.If empty={false}>
                <div className="shrink-0 border-t border-border p-4 bg-background max-w-3xl mx-auto w-full">
                  <ComposerPrimitive.Root className="flex flex-col rounded-xl border border-border bg-card p-2 focus-within:border-primary/50 transition-colors shadow-sm">
                    <ComposerPrimitive.Input
                      placeholder="Continue the conversation..."
                      rows={2}
                      className="w-full resize-none bg-transparent px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    <div className="flex items-center justify-between border-t border-border/40 px-2 pt-1.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex size-6 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <Plus className="size-3.5" />
                        </button>
                        <span className="text-[11px] text-muted-foreground">{selectedModel}</span>
                      </div>

                      <ComposerPrimitive.Send
                        type="button"
                        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                      >
                        <ArrowUp className="size-3.5 shrink-0 text-white dark:text-neutral-900" strokeWidth={2.5} />
                      </ComposerPrimitive.Send>
                    </div>
                  </ComposerPrimitive.Root>
                </div>
              </ThreadPrimitive.If>
            </ThreadPrimitive.Root>
          </AssistantRuntimeProvider>
        )}
      </div>
    </div>
  );
});

function GlobalAssistantMessageItem({ text }: { text: string }) {
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2 max-w-[80%] mb-4">
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

      {isReasoningOpen && (
        <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground leading-relaxed">
          Retrieved dialogue context and analyzed message semantics.
        </div>
      )}

      <div className="group relative rounded-2xl bg-muted/60 border border-border/40 px-4 py-3 text-xs leading-relaxed text-foreground shadow-sm">
        <div className="whitespace-pre-wrap">{text || 'Thinking...'}</div>
        <button
          type="button"
          onClick={handleCopy}
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
          title="Copy message"
        >
          {isCopied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
        </button>
      </div>
    </div>
  );
}

export default GenieGlobalContainer;
