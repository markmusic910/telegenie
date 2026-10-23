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
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/lib/components/ui/button';
import { observer } from 'mobx-react-lite';
import { useState, useEffect, useCallback, useRef } from 'react';

import {
  DEFAULT_MODEL_ID,
  MODEL_PROVIDERS,
  SUPPORTED_MODELS,
  getModelProvider,
} from '@/components/genie/genie-models.constants';
import {
  getAllStoredApiKeys,
  hasApiKeyForProvider,
  getEffectiveLangSmithConfig,
} from '@/components/genie/genie-api-keys';
import { useGenieRuntime } from '@/components/genie/genie-runtime.adapter';
import GenieScheduledView from '@/components/genie/genie-scheduled.view';
import GenieSearchView from '@/components/genie/genie-search.view';
import GenieSidebar, { type GenieSidebarTab } from '@/components/genie/genie-sidebar';
import GenieConfigDialog from '@/components/genie/genie-config.dialog';
import { useDialogPeer, useSDK, useStore } from '@/lib/contexts/sdk.context';
import { fallbackPeerDisplay } from '@telegenie/sdk';
import type { AgentMessage, AgentPreset } from '@telegenie/agent/worker';

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

export interface GenieGlobalContainerProps {
  onClose?: () => void;
}

const DEFAULT_PRESETS: AgentPreset[] = [
  {
    id: 'group-intro',
    name: 'Write a group introduction',
    description: 'Compose an engaging community introduction, group guidelines, and mission statement.',
    icon: '✍️',
    prompt:
      'You are an expert community manager. Based on the group context and history, compose a welcoming, inspiring, and concise group introduction. Include: 1) What this community is about, 2) Core community guidelines, and 3) Next steps or helpful resources for new members.',
    model: DEFAULT_MODEL_ID,
    tone: 'friendly',
    isBuiltin: true,
  },
  {
    id: 'chat-organizer',
    name: 'Smart Chat Organizer',
    description: 'Categorize discussions, identify recurring themes, and highlight key decisions.',
    icon: '📁',
    prompt:
      'You are an executive knowledge organizer. Analyze the recent conversation history and organize it into clear topical sections: 1) Active discussion topics and key arguments, 2) Decisions finalized, 3) Open questions and pending action items.',
    model: DEFAULT_MODEL_ID,
    tone: 'technical',
    isBuiltin: true,
  },
  {
    id: 'daily-summary',
    name: 'Daily work group summary',
    description: 'Create an executive digest recapping daily updates, deliverables, and blockers.',
    icon: '📝',
    prompt:
      'Generate a structured executive daily summary from the group messages. Format with bullet points covering: 1) Executive Highlights, 2) Completed Deliverables, 3) Active Blockers & Risks, 4) Assigned Action Items with owners where identifiable.',
    model: DEFAULT_MODEL_ID,
    tone: 'concise',
    isBuiltin: true,
  },
  {
    id: 'group-topics',
    name: 'Ask what the group is discussing',
    description: 'Quick conversational rundown of current debates and hottest chat topics.',
    icon: '💬',
    prompt:
      'Review the latest dialogue in this group and provide a lively, direct 2-3 sentence overview of what the members are currently discussing or debating right now.',
    model: DEFAULT_MODEL_ID,
    tone: 'casual',
    isBuiltin: true,
  },
];

/**
 * GenieGlobalContainer is the 2-column full AI workspace taking over
 * the middle and right columns.
 */
export const GenieGlobalContainer = observer(function GenieGlobalContainer({
  onClose,
}: GenieGlobalContainerProps) {
  const sdk = useSDK();
  const [activeTab, setActiveTab] = useState<GenieSidebarTab>('NEW_CHAT');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
  const currentModelOption =
    SUPPORTED_MODELS.find((m) => m.name === selectedModel || m.id === selectedModel) ||
    SUPPORTED_MODELS[0];
  const [selectedPresetId, setSelectedPresetId] = useState<string>('default');
  const [presets, setPresets] = useState<AgentPreset[]>(DEFAULT_PRESETS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // IDB conversation history
  const [historySessions, setHistorySessions] = useState<Array<{ id: string; title: string }>>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [sessionMessages, setSessionMessages] = useState<AgentMessage[] | null>(null);
  const [sessionInput, setSessionInput] = useState('');
  const [isSendingInSession, setIsSendingInSession] = useState(false);
  const sessionEndRef = useRef<HTMLDivElement | null>(null);

  // Title editing & AI generation state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

  const currentSession = historySessions.find((s) => s.id === activeSessionId);
  const displayTitle = activeSessionId
    ? currentSession?.title || 'Chat'
    : 'Genie AI Workspace';

  const scrollToBottom = () => {
    sessionEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch recent conversation runs from IndexedDB
  const refreshHistory = useCallback(async () => {
    try {
      const runs = await sdk.agent.getRecentRuns(30);
      setHistorySessions(
        runs.map((r) => ({
          id: r.id,
          title: r.title || (r.userMessage.length > 35 ? `${r.userMessage.slice(0, 35)}...` : r.userMessage),
        })),
      );
    } catch (err) {
      console.warn('Failed to fetch recent agent runs:', err);
    }
  }, [sdk]);

  const handleSaveTitle = async () => {
    const trimmed = editTitleValue.trim();
    if (!trimmed || !activeSessionId) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await sdk.agent.updateRunTitle(activeSessionId, trimmed);
      setIsEditingTitle(false);
      await refreshHistory();
    } catch (err) {
      console.warn('Failed to update run title:', err);
      setIsEditingTitle(false);
    }
  };

  const handleGenerateTitle = async () => {
    if (!activeSessionId || isGeneratingTitle) return;
    setIsGeneratingTitle(true);
    try {
      const apiKeys = getAllStoredApiKeys();
      const provider = getModelProvider(currentModelOption.id);
      await sdk.agent.configureModel({
        provider,
        model: currentModelOption.id,
        apiKeys,
        langsmith: getEffectiveLangSmithConfig(),
      });
      await sdk.agent.generateRunTitle(activeSessionId, {
        apiKeys,
        model: currentModelOption.id,
      });
      await refreshHistory();
    } catch (err) {
      console.warn('Failed to generate run title:', err);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  // Eagerly sync API keys, LangSmith config, and active model to agent worker on mount & model switch
  useEffect(() => {
    const apiKeys = getAllStoredApiKeys();
    const provider = getModelProvider(currentModelOption.id);
    void sdk.agent
      .configureModel({
        provider,
        model: currentModelOption.id,
        apiKeys,
        langsmith: getEffectiveLangSmithConfig(),
      })
      .catch((err) => {
        console.warn('Failed to configure agent model on mount:', err);
      });
  }, [sdk, currentModelOption.id]);

  // Load presets on mount
  useEffect(() => {
    void refreshHistory();
    sdk.agent
      .getPresets()
      .then((loaded) => {
        if (loaded && loaded.length > 0) {
          setPresets(loaded);
        }
      })
      .catch(() => {
        // Fallback to DEFAULT_PRESETS
      });
  }, [sdk, refreshHistory]);

  // Reactively track currently selected dialog from left column
  const globalStore = useStore('global');
  const selectedDialogId = globalStore.nav.selectedDialogId;
  const [clearedPeerId, setClearedPeerId] = useState<string | null>(null);

  const activePeerId = clearedPeerId === selectedDialogId ? undefined : selectedDialogId;
  const peer = useDialogPeer(activePeerId);
  const peerName =
    peer?.display?.name ||
    (activePeerId ? fallbackPeerDisplay(activePeerId).name : undefined);

  const runtime = useGenieRuntime({
    peerId: activePeerId,
    model: currentModelOption.id,
    presetId: selectedPresetId !== 'default' ? selectedPresetId : undefined,
    onRunCompleted: refreshHistory,
  });

  const handleSelectSession = async (runId: string) => {
    setActiveSessionId(runId);
    setActiveTab('NEW_CHAT');
    setSessionInput('');
    setIsEditingTitle(false);
    try {
      const msgs = await sdk.agent.getRunMessages(runId);
      setSessionMessages(msgs);
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      console.warn('Failed to load session messages:', err);
    }
  };

  const handleNewChat = () => {
    setActiveTab('NEW_CHAT');
    setActiveSessionId(undefined);
    setSessionMessages(null);
    setSessionInput('');
    setIsEditingTitle(false);
  };

  const handleSendInSession = async () => {
    const text = sessionInput.trim();
    if (!text || isSendingInSession || !activeSessionId) return;

    setSessionInput('');
    setIsSendingInSession(true);

    const tempUserId = `user_${Date.now()}`;
    const tempAstId = `ast_${Date.now()}`;

    const userMsg: AgentMessage = {
      id: tempUserId,
      runId: activeSessionId,
      role: 'USER',
      content: text,
      createdAt: Date.now(),
    };

    const astMsg: AgentMessage = {
      id: tempAstId,
      runId: activeSessionId,
      role: 'ASSISTANT',
      content: '',
      thought: 'Thinking...',
      createdAt: Date.now() + 1,
    };

    setSessionMessages((prev) => (prev ? [...prev, userMsg, astMsg] : [userMsg, astMsg]));
    setTimeout(scrollToBottom, 50);

    try {
      const provider = getModelProvider(currentModelOption.id);
      if (hasApiKeyForProvider(provider)) {
        await sdk.agent.configureModel({
          provider,
          model: currentModelOption.id,
          apiKeys: getAllStoredApiKeys(),
          langsmith: getEffectiveLangSmithConfig(),
        });
      }

      const unsubscribe = sdk.agent.onStreamToken((_runId, token) => {
        const tokenStr =
          typeof token === 'string'
            ? token
            : token && typeof token === 'object' && 'text' in (token as Record<string, unknown>)
              ? String((token as Record<string, unknown>).text)
              : '';
        if (tokenStr) {
          setSessionMessages((prev) => {
            if (!prev) return prev;
            return prev.map((m) =>
              m.id === tempAstId ? { ...m, content: m.content + tokenStr } : m,
            );
          });
        }
      });

      await sdk.agent.chat(text, {
        runId: activeSessionId,
        peerId: activePeerId,
        model: currentModelOption.id,
        presetId: selectedPresetId !== 'default' ? selectedPresetId : undefined,
      });

      unsubscribe();
      await refreshHistory();
      const freshMsgs = await sdk.agent.getRunMessages(activeSessionId);
      setSessionMessages(freshMsgs);
    } catch (err) {
      console.error('Failed to continue past session:', err);
      setSessionMessages((prev) => {
        if (!prev) return prev;
        return prev.map((m) =>
          m.id === tempAstId
            ? { ...m, content: `Error: ${err instanceof Error ? err.message : String(err)}` }
            : m,
        );
      });
    } finally {
      setIsSendingInSession(false);
      setTimeout(scrollToBottom, 50);
    }
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = presets.find((p) => p.id === presetId);
    if (preset?.model) {
      const modelOpt = SUPPORTED_MODELS.find((m) => m.id === preset.model);
      if (modelOpt) {
        setSelectedModel(modelOpt.name);
      }
    }
  };

  const activeProvider = getModelProvider(currentModelOption.id);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
      {/* Left Column: Genie Sidebar */}
      <GenieSidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'NEW_CHAT') handleNewChat();
          else setActiveTab(tab);
        }}
        historySessions={historySessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onClose={onClose}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Right Column: Main Content Area */}
      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden bg-background/50">
        {/* Top Header Bar with Exit Button to return to right column view */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 bg-card/20 select-none">
          <div className="flex items-center gap-2 min-w-0">
            {isEditingTitle && activeSessionId ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSaveTitle();
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={editTitleValue}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  autoFocus
                  className="h-7 w-48 sm:w-64 md:w-80 rounded-md border border-input bg-background px-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-emerald-500 hover:text-emerald-400 cursor-pointer"
                  title="Save title"
                >
                  <Check className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditingTitle(false)}
                  className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Cancel"
                >
                  <X className="size-3.5" />
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="text-xs font-semibold text-foreground truncate max-w-[180px] sm:max-w-[280px] md:max-w-[380px]"
                  title={displayTitle}
                >
                  {displayTitle}
                </span>

                {activeSessionId && (
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditTitleValue(displayTitle);
                        setIsEditingTitle(true);
                      }}
                      className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Edit chat title"
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleGenerateTitle}
                      disabled={isGeneratingTitle}
                      className="size-6 text-muted-foreground hover:text-primary cursor-pointer disabled:opacity-50"
                      title="AI generate chat title"
                    >
                      <Sparkles className={`size-3 ${isGeneratingTitle ? 'animate-spin text-primary' : ''}`} />
                    </Button>
                  </div>
                )}
              </div>
            )}

            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {currentModelOption.name}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Exit / Return to right column view button */}
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Close Genie (Return to chat view)"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {activeTab === 'SCHEDULED' ? (
          <GenieScheduledView />
        ) : activeTab === 'SEARCH_CHAT' ? (
          <GenieSearchView onSelectChat={handleNewChat} />
        ) : sessionMessages && sessionMessages.length > 0 ? (
          /* Past Session View from IDB */
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-6 space-y-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sessionMessages.map((msg) => {
                if (msg.role === 'USER') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[70%] rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground text-xs leading-relaxed shadow-sm break-words [overflow-wrap:anywhere]">
                        {msg.content}
                      </div>
                    </div>
                  );
                }
                return <GlobalAssistantMessageItem key={msg.id} text={msg.content} thought={msg.thought} />;
              })}
              <div ref={sessionEndRef} />
            </div>

            {/* Bottom Input Bar: Perfectly aligned with sidebar h-16 footer (h-16 shrink-0 border-t border-border px-6 bg-card) */}
            <div className="flex h-16 shrink-0 items-center border-t border-border px-6 bg-card gap-3">
              <div className="flex-1 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 focus-within:border-primary/50 shadow-sm transition-colors">
                <input
                  type="text"
                  value={sessionInput}
                  onChange={(e) => setSessionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendInSession();
                    }
                  }}
                  placeholder="Ask TeleGenie..."
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                  disabled={isSendingInSession}
                />

                <button
                  type="button"
                  onClick={() => void handleSendInSession()}
                  disabled={!sessionInput.trim() || isSendingInSession}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                  title="Send message"
                >
                  <ArrowUp className="size-3.5 shrink-0 text-white dark:text-neutral-900" strokeWidth={2.5} />
                </button>
              </div>

              {/* Model Switcher */}
              <div className="group relative inline-flex items-center shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-2.5 text-xs font-normal text-muted-foreground hover:text-foreground cursor-pointer pointer-events-none border-border bg-card shadow-sm"
                >
                  <Bot className="size-3.5 text-primary" />
                  <span>{currentModelOption.name}</span>
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer font-sans text-xs text-foreground"
                  aria-label="Switch Model"
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
              </div>
            </div>
          </div>
        ) : (
          <AssistantRuntimeProvider runtime={runtime}>
            <ThreadPrimitive.Root className="flex h-full flex-col overflow-hidden">
              <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <ThreadPrimitive.Empty>
                  {/* Welcome Screen */}
                  <div className="flex flex-col items-center justify-center min-h-[480px] max-w-2xl mx-auto w-full text-center my-auto">
                    {/* Centered Logo */}
                    <div className="flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-primary mb-4 shadow-sm border border-border/50">
                      <Bot className="size-10" />
                    </div>

                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      Genie
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1 mb-8">
                      Ask TeleGenie anything in your Telegram Universe.
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
                        placeholder="Ask TeleGenie..."
                        rows={3}
                        className="w-full resize-none bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />

                      <div className="flex items-center justify-between border-t border-border/40 px-2 pt-2 mt-1">
                        <div className="flex items-center gap-1 font-sans">
                          {/* LLM Model Switcher */}
                          <div className="group relative inline-flex items-center">
                            <div className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground group-hover:text-foreground group-hover:bg-muted/70 transition-colors pointer-events-none select-none">
                              <span>{currentModelOption.name}</span>
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
                          </div>

                          {/* Presets Switcher */}
                          <div className="group relative inline-flex items-center">
                            <div className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground group-hover:text-foreground group-hover:bg-muted/70 transition-colors pointer-events-none select-none">
                              <span className="max-w-[120px] truncate">
                                {presets.find((p) => p.id === selectedPresetId)?.name ?? 'Default Preset'}
                              </span>
                              <ChevronDown className="size-3 text-muted-foreground/70 shrink-0" />
                            </div>
                            <select
                              value={selectedPresetId}
                              onChange={(e) => handlePresetChange(e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer font-sans text-xs text-foreground"
                              aria-label="Select Preset"
                            >
                              <option value="default">Default Preset</option>
                              {presets.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Send button */}
                        <ComposerPrimitive.Send
                          type="button"
                          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                        >
                          <ArrowUp className="size-4 shrink-0 text-white dark:text-neutral-900" strokeWidth={2.5} />
                        </ComposerPrimitive.Send>
                      </div>
                    </ComposerPrimitive.Root>

                    {/* Quick suggestion prompt chips (extracted from presets) */}
                    <div className="w-full text-center">
                      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mb-3">
                        <span>Not sure where to start? Try these</span>
                        <RefreshCw className="size-3 opacity-60" />
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {presets.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handlePresetChange(preset.id)}
                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] transition-colors shadow-xs cursor-pointer ${
                              selectedPresetId === preset.id
                                ? 'border-primary/60 bg-primary/10 text-primary font-medium'
                                : 'border-border bg-card/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                          >
                            <span className="text-xs">{preset.icon}</span>
                            <span>{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </ThreadPrimitive.Empty>

                <ThreadPrimitive.Messages>
                  {({ message }) => {
                    const isUser = message.role === 'user';
                    const text = safeExtractContentText(message.content);
                    const thought = safeExtractReasoningText(message.content);

                    if (isUser) {
                      return (
                        <div key={message.id} className="flex justify-end mb-4">
                          <div className="max-w-[70%] rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground text-xs leading-relaxed shadow-sm break-words [overflow-wrap:anywhere]">
                            {text}
                          </div>
                        </div>
                      );
                    }

                    return <GlobalAssistantMessageItem key={message.id} text={text} thought={thought} />;
                  }}
                </ThreadPrimitive.Messages>
              </ThreadPrimitive.Viewport>

              {/* Bottom Composer only appears when conversation is active */}
              <ThreadPrimitive.If empty={false}>
                <div className="shrink-0 border-t border-border p-4 bg-background max-w-3xl mx-auto w-full">
                  <ComposerPrimitive.Root className="flex flex-col rounded-xl border border-border bg-card p-2 focus-within:border-primary/50 transition-colors shadow-sm">
                    <ComposerPrimitive.Input
                      placeholder="Ask TeleGenie..."
                      rows={2}
                      className="w-full resize-none bg-transparent px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    <div className="flex items-center justify-between border-t border-border/40 px-2 pt-1.5">
                      <div className="flex items-center gap-1.5 font-sans">
                        <span className="text-[11px] text-muted-foreground font-normal">
                          {selectedModel}
                        </span>
                        {selectedPresetId !== 'default' && (
                          <span className="text-[10px] text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">
                            {presets.find((p) => p.id === selectedPresetId)?.name}
                          </span>
                        )}
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

      {/* Configuration Modal */}
      <GenieConfigDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        activeProvider={activeProvider}
        activeModel={currentModelOption.id}
      />
    </div>
  );
});

function GlobalAssistantMessageItem({ text, thought }: { text: string; thought?: string }) {
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2 max-w-[80%] mb-4 min-w-0">
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

      <div className="group relative rounded-2xl bg-muted/60 border border-border/40 px-4 py-3 text-xs leading-relaxed text-foreground shadow-sm min-w-0">
        <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{text || 'Thinking...'}</div>
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
