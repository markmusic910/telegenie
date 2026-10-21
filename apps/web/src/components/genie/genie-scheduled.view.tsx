'use client';

import { AlarmClock, Calendar, Clock, Plus, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';

export function GenieScheduledView() {
  const [activeTab, setActiveTab] = useState<'TASKS' | 'HISTORY'>('TASKS');
  const [searchQuery, setSearchQuery] = useState('');

  const suggestions = [
    {
      title: 'Summarize Unread Messages',
      schedule: 'Every day at 09:00',
      description: 'Catch up on important unread messages without reading everything.',
    },
    {
      title: 'Find Product Feedback',
      schedule: 'Fridays at 09:00',
      description: 'Discover what users want next.',
    },
    {
      title: 'Weekly Community Report',
      schedule: 'Mondays at 09:00',
      description: 'Analyze Telegram communities from the previous week.',
    },
  ];

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto px-8 py-6 max-w-4xl mx-auto w-full">
      {/* Title & Subtitle */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Scheduled</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Ask Genie to schedule tasks, set reminders, or monitor for updates
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search scheduled tasks"
          className="w-full rounded-xl border border-border bg-background/80 py-2.5 pl-10 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors shadow-sm"
        />
      </div>

      {/* Tabs and New Task button */}
      <div className="flex items-center justify-between border-b border-border pb-3 mb-8">
        <div className="flex items-center gap-6 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('TASKS')}
            className={`pb-3 relative transition-colors ${
              activeTab === 'TASKS'
                ? 'text-foreground font-semibold border-b-2 border-primary -mb-[13px]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tasks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`pb-3 relative transition-colors ${
              activeTab === 'HISTORY'
                ? 'text-foreground font-semibold border-b-2 border-primary -mb-[13px]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            History
          </button>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="size-3.5" />
          <span>New Task</span>
        </button>
      </div>

      {/* Empty State Illustration (from Screenshot 1) */}
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-4 shadow-sm border border-border/50">
          <AlarmClock className="size-8 opacity-70" />
        </div>
        <h3 className="font-semibold text-sm text-foreground">No scheduled tasks</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Create scheduled tasks to automate AI execution on a schedule
        </p>
      </div>

      {/* Suggestions Section */}
      <div className="mt-8 pt-6 border-t border-border/60">
        <div className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-primary" />
          <span>Suggestions</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {suggestions.map((item) => (
            <div
              key={item.title}
              className="flex flex-col rounded-xl border border-border bg-card/60 p-3.5 hover:bg-muted/40 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                <Clock className="size-3 text-muted-foreground" />
                <span className="truncate">{item.title}</span>
              </div>
              <div className="text-[11px] font-medium text-primary mt-1">
                {item.schedule}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GenieScheduledView;
