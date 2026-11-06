'use client';

import { getInstalledSkills } from '@/components/genie/genie-skills.storage';
import TeleGenieTabsNav from '@/components/settings/telegenie-tabs.nav';
import { Button } from '@/lib/components/ui/button';
import type { GenieSkill } from '@telegenie/agent';
import { ChevronRight, Plus, Sparkles, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function TeleGenieSkillsListDetail() {
  const router = useRouter();
  const [skills, setSkills] = useState<GenieSkill[]>([]);

  useEffect(() => {
    setSkills(getInstalledSkills());
  }, []);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Skills</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Installed skills provide modular capabilities and domain instructions that dialog agents can use.
        </p>
      </div>

      <TeleGenieTabsNav activeTab="skills" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Installed Skills
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {skills.length}
          </span>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push('/settings/telegenie/skills/new')}
          className="h-8 gap-1.5 text-xs cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>New Skill</span>
        </Button>
      </div>

      {skills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 p-8 text-center space-y-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">No Skills Configured</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create custom prompt skills to tailor agent behavior in specific chats.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => router.push('/settings/telegenie/skills/new')}
            className="text-xs gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Create First Skill</span>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card/40 overflow-hidden">
          {skills.map((skill) => (
            <li key={skill.id}>
              <button
                type="button"
                onClick={() => router.push(`/settings/telegenie/skills/${encodeURIComponent(skill.id)}`)}
                className="flex w-full items-center justify-between p-4 text-left hover:bg-accent/60 transition-colors cursor-pointer group"
              >
                <div className="flex items-start gap-3 min-w-0 pr-4">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5 group-hover:bg-primary/20 transition-colors">
                    <Wand2 className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {skill.title}
                    </span>
                    <span className="block text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                      {skill.description || skill.content}
                    </span>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

