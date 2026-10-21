import type { Memory, Commitment, Entity } from '../memory/db/memory-db.types';
import type { DialogPreset } from '../agent-db/agent-db.types';
import type { AgentMessageRecord } from '../types/agent-message-record';

export type RetrievalContext = {
  memories: Memory[];
  commitments: Commitment[];
  messages: AgentMessageRecord[];
  entities: Entity[];
  dialogPreset?: DialogPreset;
};

/**
 * Assembles a concise, LLM-ready context string from retrieval results.
 * The output is inserted as a system message before the user's question.
 */
export class ContextBuilder {
  build(context: RetrievalContext): string {
    const parts: string[] = [];

    if (context.dialogPreset) {
      parts.push('## Dialog Background & User Directives');
      if (context.dialogPreset.background) {
        parts.push(`- Background: ${context.dialogPreset.background}`);
      }
      if (context.dialogPreset.tone) {
        parts.push(`- Required Tone: ${context.dialogPreset.tone}`);
      }
      if (context.dialogPreset.customInstructions) {
        parts.push(`- Custom Directives: ${context.dialogPreset.customInstructions}`);
      }
      parts.push('');
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

    if (context.commitments.length > 0) {
      parts.push('\n## Commitments & Promises');
      for (const commitment of context.commitments) {
        const due = commitment.dueAt
          ? ` — due ${new Date(commitment.dueAt).toLocaleDateString()}`
          : '';
        const status = `[${commitment.status}]`;
        parts.push(
          `- ${status} ${commitment.action}${commitment.object ? ` ${commitment.object}` : ''}${due}`,
        );
      }
    }

    if (context.messages.length > 0) {
      parts.push('\n## Relevant Messages');
      for (const msg of context.messages.slice(0, 10)) {
        const date = new Date(msg.date * 1000).toLocaleString();
        const sender = msg.out ? 'Me' : (msg.fromId ?? 'Them');
        parts.push(`- [${date}] ${sender}: "${msg.message}"`);
      }
    }

    return parts.join('\n');
  }
}
