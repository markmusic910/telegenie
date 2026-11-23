import type { Memory, Entity } from '../memory/db/memory-db.types';
import type { DialogPreset, GenieSkill } from '../agent-db/agent-db.types';
import type { AgentMessageRecord, DialogMemoryContext } from '../types/agent-message-record';

export type RetrievalContext = {
  memories: Memory[];
  messages: AgentMessageRecord[];
  entities: Entity[];
  peerId?: string;
  dialogContext?: DialogMemoryContext;
  dialogPreset?: DialogPreset;
  activeSkills?: GenieSkill[];
  userIdentity?: string;
};

export const DEFAULT_TONE_PROMPTS: Record<string, string> = {
  default: 'Respond in a balanced, natural, helpful, and polite conversational tone.',
  professional: 'Respond in a formal, objective, and professional business tone. Be precise, articulate, and well-structured.',
  friendly: 'Adopt a warm, encouraging, conversational, and empathetic tone. Sound approachable and supportive.',
  concise: 'Be extremely concise, direct, and succinct. Eliminate fluff, filler words, and unnecessary pleasantries; state answers straight to the point.',
  humorous: 'Use a witty, engaging, lighthearted, and slightly playful tone while remaining helpful.',
};

/**
 * Resolves a full prompt directive for the given tone configuration.
 */
export function resolveTonePrompt(preset?: {
  tone?: string;
  tonePrompt?: string;
}): string | undefined {
  if (!preset) return undefined;
  if (preset.tonePrompt?.trim()) {
    return preset.tonePrompt.trim();
  }
  if (preset.tone) {
    const key = preset.tone.toLowerCase().trim();
    if (DEFAULT_TONE_PROMPTS[key]) {
      return DEFAULT_TONE_PROMPTS[key];
    }
    // If the tone string is already a descriptive prompt
    return preset.tone.trim();
  }
  return undefined;
}

/**
 * Assembles a concise, LLM-ready context string from retrieval results.
 * The output is inserted as a system message before the user's question.
 */
export class ContextBuilder {
  build(context: RetrievalContext): string {
    const parts: string[] = [];

    if (context.userIdentity?.trim()) {
      parts.push('## User Identity & Preferences (USER.md)');
      parts.push(context.userIdentity.trim());
      parts.push('');
    }

    const activePeerId = context.dialogContext?.peerId ?? context.peerId;
    if (activePeerId) {
      parts.push('## Active Dialog');
      if (context.dialogContext?.peerName) {
        parts.push(`- Name: ${context.dialogContext.peerName}`);
      }
      if (context.dialogContext?.peerType) {
        parts.push(`- Type: ${context.dialogContext.peerType}`);
      }
      parts.push(`- Peer ID: ${activePeerId}`);
      const participants = context.dialogContext?.peers
        ? Object.values(context.dialogContext.peers)
        : [];
      if (participants.length > 0) {
        const formatted = participants.map((p) => {
          const label = p.name || p.id;
          const handle = p.username ? ` (@${p.username})` : '';
          const selfTag = p.isSelf ? ' [Me]' : '';
          return `${label}${handle}${selfTag}`;
        });
        parts.push(`- Participants: ${formatted.join(', ')}`);
      }
      parts.push('');
    }

    if (context.dialogPreset) {
      parts.push('## Dialog Background & User Directives');
      if (context.dialogPreset.background) {
        parts.push(`- Background: ${context.dialogPreset.background}`);
      }
      const tonePrompt = resolveTonePrompt(context.dialogPreset);
      if (tonePrompt) {
        parts.push(`- Required Tone: ${tonePrompt}`);
      }
      if (context.dialogPreset.customInstructions) {
        parts.push(`- Custom Directives: ${context.dialogPreset.customInstructions}`);
      }
      parts.push('');
    }

    if (context.activeSkills && context.activeSkills.length > 0) {
      parts.push('## Active Dialog Skills');
      for (const skill of context.activeSkills) {
        parts.push(`### Skill: ${skill.title}\n${skill.content}\n`);
      }
    }

    if (context.entities.length > 0) {
      parts.push('## People / Entities');
      for (const entity of context.entities) {
        parts.push(`- ${entity.name} (${entity.type}, id: ${entity.id})`);
      }
    }

    if (context.memories.length > 0) {
      parts.push('\n## Known Facts & Preferences');
      for (const memory of context.memories) {
        const validity =
          memory.validFrom
            ? ` [since ${new Date(memory.validFrom).toLocaleDateString()}]`
            : '';
        parts.push(`- [${memory.type}] ${memory.content}${validity}`);
      }
    }

    if (context.messages.length > 0) {
      const heading = activePeerId ? '\n## Recent & Relevant Dialog Messages' : '\n## Relevant Messages';
      parts.push(heading);
      const displayed = [...context.messages]
        .slice(0, 25)
        .sort((a, b) => a.date - b.date);
      const peers = context.dialogContext?.peers;
      for (const msg of displayed) {
        const date = new Date(msg.date * 1000).toLocaleString();
        let sender: string;
        if (msg.out) {
          sender = 'Me';
        } else if (msg.fromId && peers?.[msg.fromId]) {
          const p = peers[msg.fromId];
          const label = p.name || msg.fromId;
          sender = p.username ? `${label} (@${p.username})` : label;
        } else {
          sender = msg.fromId ?? 'Them';
        }
        const mediaTag = msg.media
          ? `[${msg.media.type}${msg.media.fileName ? `: ${msg.media.fileName}` : ''}]`
          : '';
        const body = msg.message?.trim()
          ? `"${msg.message.trim()}"${mediaTag ? ` ${mediaTag}` : ''}`
          : mediaTag || '""';
        parts.push(`- [${date}] ${sender}: ${body}`);
      }
    }

    return parts.join('\n');
  }
}
