import type { AgentPreset } from './preset.types';

export const BUILTIN_PRESETS: AgentPreset[] = [
  {
    id: 'group-intro',
    name: 'Write a group introduction',
    description: 'Compose an engaging community introduction, group guidelines, and mission statement.',
    icon: '✍️',
    prompt:
      'You are an expert community manager. Based on the group context and history, compose a welcoming, inspiring, and concise group introduction. Include: 1) What this community is about, 2) Core community guidelines, and 3) Next steps or helpful resources for new members.',
    model: 'gpt-4o',
    tone: 'friendly',
    context: {
      includeHistory: true,
      historyLimit: 30,
      includeMemories: true,
    },
    isBuiltin: true,
  },
  {
    id: 'chat-organizer',
    name: 'Smart Chat Organizer',
    description: 'Categorize discussions, identify recurring themes, and highlight key decisions.',
    icon: '📁',
    prompt:
      'You are an executive knowledge organizer. Analyze the recent conversation history and organize it into clear topical sections: 1) Active discussion topics and key arguments, 2) Decisions finalized, 3) Open questions and pending action items.',
    model: 'gpt-4o',
    tone: 'technical',
    context: {
      includeHistory: true,
      historyLimit: 50,
      includeMemories: false,
    },
    isBuiltin: true,
  },
  {
    id: 'daily-summary',
    name: 'Daily work group summary',
    description: 'Create an executive digest recapping daily updates, deliverables, and blockers.',
    icon: '📝',
    prompt:
      'Generate a structured executive daily summary from the group messages. Format with bullet points covering: 1) Executive Highlights, 2) Completed Deliverables, 3) Active Blockers & Risks, 4) Assigned Action Items with owners where identifiable.',
    model: 'gpt-4o',
    tone: 'concise',
    context: {
      includeHistory: true,
      historyLimit: 50,
      includeMemories: false,
    },
    isBuiltin: true,
  },
  {
    id: 'group-topics',
    name: 'Ask what the group is discussing',
    description: 'Quick conversational rundown of current debates and hottest chat topics.',
    icon: '💬',
    prompt:
      'Review the latest dialogue in this group and provide a lively, direct 2-3 sentence overview of what the members are currently discussing or debating right now.',
    model: 'gpt-4o',
    tone: 'casual',
    context: {
      includeHistory: true,
      historyLimit: 20,
      includeMemories: false,
    },
    isBuiltin: true,
  },
];
