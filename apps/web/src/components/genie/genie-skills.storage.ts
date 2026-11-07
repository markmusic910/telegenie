import type { GenieSkill } from '@telegenie/agent';

const STORAGE_KEY = 'telegenie_skills_v1';

export const DEFAULT_SKILLS: GenieSkill[] = [
  {
    id: 'meeting-summarizer',
    title: 'Meeting Summarizer',
    description: 'Extract action items, key decisions, follow-ups, and open questions from conversation history.',
    content: `When asked to summarize or recap:
- Extract all key decisions made.
- List concrete action items with assignees (if mentioned).
- Note deadlines, deliverables, and open follow-up questions.
- Keep the summary structured with bullet points.`,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'code-reviewer',
    title: 'Code Reviewer',
    description: 'Analyze code snippets, spot bugs or security risks, and recommend clean refactorings.',
    content: `When reviewing or writing code:
- Check for correctness, edge cases, and performance pitfalls.
- Spot potential security vulnerabilities.
- Suggest idiomatic and clean refactoring options.
- Keep code snippets concise and ready to use.`,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'translator-proofreader',
    title: 'Translator & Proofreader',
    description: 'Accurately translate text, refine tone, and correct grammar while preserving technical terms.',
    content: `When translating or polishing text:
- Preserve technical terms, usernames, markdown, and code blocks without modification.
- Match the intended tone (e.g. professional or conversational).
- Fix grammatical errors and natural phrasing without altering core meaning.`,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'task-extractor',
    title: 'Task & Action Item Extractor',
    description: 'Identify action items, deliverables, and deadlines mentioned in the chat.',
    content: `Scan the dialogue for actionable tasks:
- Identify who is responsible for what.
- Highlight explicit and implicit deadlines.
- Format each item as: [Who] will [Do What] by [When].`,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
];

export function getInstalledSkills(): GenieSkill[] {
  if (typeof window === 'undefined') return DEFAULT_SKILLS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed default skills on first load
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SKILLS));
      return DEFAULT_SKILLS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_SKILLS;
  } catch (e) {
    console.warn('Failed to parse installed skills from localStorage:', e);
    return DEFAULT_SKILLS;
  }
}

export function getSkillById(id: string): GenieSkill | undefined {
  const skills = getInstalledSkills();
  return skills.find((s) => s.id === id);
}

export function saveSkill(skill: GenieSkill): void {
  if (typeof window === 'undefined') return;
  const current = getInstalledSkills();
  const existingIdx = current.findIndex((s) => s.id === skill.id);
  const updatedSkill: GenieSkill = {
    ...skill,
    updatedAt: Date.now(),
  };

  let next: GenieSkill[];
  if (existingIdx >= 0) {
    next = [...current];
    next[existingIdx] = updatedSkill;
  } else {
    next = [...current, updatedSkill];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function deleteSkill(id: string): void {
  if (typeof window === 'undefined') return;
  const current = getInstalledSkills();
  const next = current.filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

