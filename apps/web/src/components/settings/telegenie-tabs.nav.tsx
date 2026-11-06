'use client';

import { cn } from '@/lib/utils';
import { Bot, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

export interface TeleGenieTabsNavProps {
  activeTab: 'general' | 'skills';
}

export default function TeleGenieTabsNav({ activeTab }: TeleGenieTabsNavProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/70 mb-6 w-full max-w-sm">
      <button
        type="button"
        onClick={() => router.push('/settings/telegenie')}
        className={cn(
          'flex flex-1 items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none',
          activeTab === 'general'
            ? 'bg-background text-foreground shadow-xs font-semibold'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/40',
        )}
      >
        <Bot className="size-3.5" />
        <span>AI & Cloud</span>
      </button>

      <button
        type="button"
        onClick={() => router.push('/settings/telegenie/skills')}
        className={cn(
          'flex flex-1 items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none',
          activeTab === 'skills'
            ? 'bg-background text-foreground shadow-xs font-semibold'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/40',
        )}
      >
        <Sparkles className="size-3.5" />
        <span>Skills</span>
      </button>
    </div>
  );
}

