'use client';

import {
  deleteSkill,
  getInstalledSkills,
  getSkillById,
  saveSkill,
} from '@/components/genie/genie-skills.storage';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { Textarea } from '@/lib/components/ui/textarea';
import { useSDK } from '@/lib/contexts/sdk.context';
import type { GenieSkill } from '@telegenie/agent';
import { ArrowLeft, Check, Trash2, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export interface TeleGenieSkillEditorDetailProps {
  skillId: string;
}

export default function TeleGenieSkillEditorDetail({ skillId }: TeleGenieSkillEditorDetailProps) {
  const router = useRouter();
  const sdk = useSDK();
  const isNew = skillId === 'new';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (isNew) {
      setTitle('');
      setDescription('');
      setContent('');
      setNotFound(false);
      return;
    }

    const existing = getSkillById(skillId);
    if (!existing) {
      setNotFound(true);
      return;
    }

    setTitle(existing.title);
    setDescription(existing.description || '');
    setContent(existing.content);
    setNotFound(false);
  }, [skillId, isNew]);

  const handleSave = async () => {
    if (!title.trim()) return;

    const id = isNew
      ? title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `skill-${Date.now()}`
      : skillId;

    const skill: GenieSkill = {
      id,
      title: title.trim(),
      description: description.trim() || undefined,
      content: content.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveSkill(skill);

    // Sync updated skills list to agent worker
    try {
      await sdk.agent.configureSkills(getInstalledSkills());
    } catch (e) {
      console.warn('Failed to sync skills to agent worker:', e);
    }

    setIsSaved(true);
    setTimeout(() => {
      router.push('/settings/telegenie/skills');
    }, 400);
  };

  const handleDelete = async () => {
    if (isNew) return;
    deleteSkill(skillId);
    try {
      await sdk.agent.configureSkills(getInstalledSkills());
    } catch (e) {
      console.warn('Failed to sync skills to agent worker:', e);
    }
    router.push('/settings/telegenie/skills');
  };

  if (notFound) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h2 className="text-base font-semibold text-foreground">Skill Not Found</h2>
        <p className="text-xs text-muted-foreground">The requested skill does not exist or was deleted.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push('/settings/telegenie/skills')}
          className="gap-1.5"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Skills</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-8">
      {/* Header with back navigation */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <button
          type="button"
          onClick={() => router.push('/settings/telegenie/skills')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Skills</span>
        </button>

        {!isNew && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2.5 gap-1.5 cursor-pointer"
          >
            <Trash2 className="size-3.5" />
            <span>Delete</span>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Wand2 className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {isNew ? 'Create New Skill' : title || 'Edit Skill'}
          </h1>
          <p className="text-xs text-muted-foreground">
            Configure prompt directives and instructions for this skill.
          </p>
        </div>
      </div>

      {/* Editor Form */}
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="skill-title" className="text-xs font-medium">
            Skill Title
          </Label>
          <Input
            id="skill-title"
            placeholder="e.g. Code Reviewer, Meeting Summarizer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-sm font-sans"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="skill-description" className="text-xs font-medium">
            Short Description <span className="text-muted-foreground font-normal">(Optional)</span>
          </Label>
          <Input
            id="skill-description"
            placeholder="Brief 1-sentence summary of what this skill does"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-xs font-sans"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="skill-content" className="text-xs font-medium">
            Skill Directives & Prompt Content
          </Label>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Detailed instructions injected into the agent when this skill is selected for a conversation.
          </p>
          <Textarea
            id="skill-content"
            placeholder="Write clear instructions for the agent, e.g.:&#10;- Extract action items with assignees&#10;- Format output as markdown bullet points"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="text-xs font-mono resize-y leading-relaxed"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push('/settings/telegenie/skills')}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!title.trim()}
          className="gap-1.5 min-w-[80px]"
        >
          {isSaved ? (
            <>
              <Check className="size-3.5 text-emerald-500" />
              <span>Saved</span>
            </>
          ) : (
            <span>Save Skill</span>
          )}
        </Button>
      </div>
    </div>
  );
}

