'use client';

import { MessageSquare, Search } from 'lucide-react';
import { useState } from 'react';

export interface GenieSearchViewProps {
  onSelectChat?: (title: string) => void;
}

export function GenieSearchView({ onSelectChat }: GenieSearchViewProps) {
  const [query, setQuery] = useState('');

  const recentChats = [
    { id: '1', title: 'Reply This Message' },
    { id: '2', title: "what's this chat?" },
  ];

  const filteredChats = recentChats.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto px-8 py-6 max-w-4xl mx-auto w-full">
      {/* Title */}
      <h1 className="text-xl font-bold text-foreground mb-6">Search Chat</h1>

      {/* Search Input Box */}
      <div className="relative mb-8">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          autoFocus
          className="w-full rounded-xl border border-primary/50 bg-background/80 py-2.5 pl-10 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
        />
      </div>

      {/* Recent Chats Section */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-3">
          Recent chats
        </div>

        <div className="space-y-1">
          {filteredChats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => onSelectChat?.(chat.title)}
              className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs text-left text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors group"
            >
              <MessageSquare className="size-4 shrink-0 opacity-70 group-hover:text-primary transition-colors" />
              <span className="truncate">{chat.title}</span>
            </button>
          ))}

          {filteredChats.length === 0 && (
            <div className="text-xs text-muted-foreground py-6 text-center">
              No matching conversations found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GenieSearchView;
