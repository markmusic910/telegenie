'use client';

import { Button } from '@/lib/components/ui/button';
import {
  AlarmClock,
  Bot,
  MessageSquare,
  PanelLeftClose,
  Search,
  Settings,
  SquarePen,
} from 'lucide-react';

export type GenieSidebarTab = 'NEW_CHAT' | 'SEARCH_CHAT' | 'SCHEDULED';

export interface GenieSidebarProps {
  activeTab: GenieSidebarTab;
  onTabChange: (tab: GenieSidebarTab) => void;
  historySessions?: Array<{ id: string; title: string }>;
  activeSessionId?: string;
  onSelectSession?: (id: string) => void;
  onClose?: () => void;
  onOpenSettings?: () => void;
}

export function GenieSidebar({
  activeTab,
  onTabChange,
  historySessions = [],
  activeSessionId,
  onSelectSession,
  onClose,
  onOpenSettings,
}: GenieSidebarProps) {
  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-card/60 select-none">
      {/* Top Header */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-4" />
          </div>
          <span className="font-semibold text-sm tracking-tight">Genie</span>
        </div>

        {onClose && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            title="Exit Global View"
          >
            <PanelLeftClose className="size-4" />
          </Button>
        )}
      </div>

      {/* Main Navigation (only keep New Chat, Search Chat, Scheduled) */}
      <div className="flex flex-col gap-1 p-3">
        <button
          type="button"
          onClick={() => onTabChange('NEW_CHAT')}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'NEW_CHAT' && !activeSessionId
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <SquarePen className="size-4" />
          <span>New Chat</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('SEARCH_CHAT')}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'SEARCH_CHAT'
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Search className="size-4" />
          <span>Search Chat</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('SCHEDULED')}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'SCHEDULED'
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <AlarmClock className="size-4" />
          <span>Scheduled</span>
        </button>
      </div>

      {/* Chat History List */}
      <div className="flex flex-1 flex-col min-h-0 px-3 pt-2">
        <div className="px-3 pb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Chats
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {historySessions.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground/50 text-center">
              No chats yet
            </div>
          ) : (
            historySessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelectSession?.(session.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-left transition-colors truncate ${
                  activeSessionId === session.id
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                <MessageSquare className="size-3.5 shrink-0 opacity-70" />
                <span className="truncate">{session.title}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Footer Settings: aligned with bottom navigation bar height (h-16), Starter removed */}
      <div className="flex h-16 shrink-0 items-center border-t border-border px-3 bg-card">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Settings className="size-4" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}

export default GenieSidebar;
