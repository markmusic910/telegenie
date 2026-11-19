import { z } from 'zod';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type {
  AgentMessageRecord,
  DialogMemoryContext,
  DialogParticipantInfo,
} from '../../types/agent-message-record';

// ---------------------------------------------------------------------------
// Output schema (Zod — validated before writing to IDB)
// ---------------------------------------------------------------------------

export const ExtractionCandidateSchema = z.object({
  type: z.enum([
    'FACT',
    'PREFERENCE',
    'RELATIONSHIP',
    'EVENT',
    'DECISION',
    'COMMITMENT',
    'PROJECT',
    'TOPIC',
  ]),
  subject: z.string().describe('Name of the primary person or entity this memory is about'),
  predicate: z
    .string()
    .optional()
    .describe('Semantic relationship verb, e.g. "works_at", "prefers"'),
  object: z
    .string()
    .optional()
    .describe('Name of the secondary entity or plain-text value'),
  confidence: z.number().min(0).max(1),
  importance: z.number().min(0).max(1),
  content: z.string().describe('Human-readable summary of the memory'),
  sourceStart: z.number().optional(),
  sourceEnd: z.number().optional(),
});

export type ExtractionCandidate = z.infer<typeof ExtractionCandidateSchema>;

const ExtractionResultSchema = z.object({
  candidates: z.array(ExtractionCandidateSchema),
});

// ---------------------------------------------------------------------------
// Extraction prompt
// ---------------------------------------------------------------------------

const EXTRACTION_SYSTEM = `You are a memory extraction assistant. Given a Telegram message and its dialog/reply/mention context, extract all semantically meaningful facts, preferences, relationships, events, decisions, commitments, projects, and recurring topics.

Output ONLY a JSON object with a "candidates" array. Each candidate must have:
- type: one of FACT, PREFERENCE, RELATIONSHIP, EVENT, DECISION, COMMITMENT, PROJECT, TOPIC
- subject: name of the primary person or entity (prefer real participant display names or @usernames from the context instead of raw IDs or generic pronouns; use "me" only if the sender is the logged-in user and no real display name is provided)
- predicate: optional semantic relationship (e.g. "works_at", "prefers", "lives_in", "manages")
- object: optional secondary entity or plain value
- confidence: 0.0 to 1.0
- importance: 0.0 to 1.0 (how useful for future reference)
- content: human-readable one-sentence summary
- sourceStart/sourceEnd: character offsets within the message text

Guidelines:
- If the message is a reply, use the replied-to message context (sender and quoted text) to resolve pronouns, implicit subjects, or concise answers.
- If the message mentions users (e.g. @username), resolve them using the provided participant/mention context.
- Skip trivial content (greetings, reactions, "ok", "thanks", etc).
- If nothing is extractable, return { "candidates": [] }.`;

function formatParticipantLabel(
  peerId: string | undefined,
  dialogContext?: DialogMemoryContext,
  isOutgoing?: boolean,
): string {
  const peers = dialogContext?.peers;
  let participant: DialogParticipantInfo | undefined;

  if (peerId && peers?.[peerId]) {
    participant = peers[peerId];
  } else if (isOutgoing && peers) {
    participant = Object.values(peers).find((p) => p.isSelf);
  }

  if (participant) {
    const handle = participant.username ? ` (@${participant.username.replace(/^@/, '')})` : '';
    const selfTag = participant.isSelf || isOutgoing ? ' [me]' : '';
    const name = participant.name || participant.username || participant.id;
    return `${name}${handle} [id: ${participant.id}]${selfTag}`;
  }

  if (isOutgoing) {
    return peerId ? `me [id: ${peerId}]` : 'me';
  }
  return peerId ? `user ${peerId}` : 'unknown';
}

export function buildExtractionUserPrompt(
  message: AgentMessageRecord,
  dialogContext?: DialogMemoryContext,
): string {
  const lines: string[] = [];

  // 1. Dialog & Topic header
  if (dialogContext) {
    const titlePart = dialogContext.peerName ? `"${dialogContext.peerName}" ` : '';
    const typePart = dialogContext.peerType ? `type: ${dialogContext.peerType}, ` : '';
    lines.push(`Dialog: ${titlePart}(${typePart}id: ${dialogContext.peerId})`);
  } else {
    lines.push(`Dialog ID: ${message.peerId}`);
  }

  if (message.threadId) {
    const topicTitle = dialogContext?.topics?.[message.threadId]?.title;
    lines.push(
      topicTitle
        ? `Topic / Thread: "${topicTitle}" (id: ${message.threadId})`
        : `Thread ID: ${message.threadId}`,
    );
  }

  // 2. Message Metadata
  const senderLabel = formatParticipantLabel(message.fromId, dialogContext, message.out);
  const isoDate = new Date(message.date * 1000).toISOString();
  lines.push(`Message ID: ${message.id}`);
  lines.push(`Sender: ${senderLabel}`);
  lines.push(`Date: ${isoDate}`);

  // 3. Reply context
  if (message.replyTo) {
    const replySender = message.replyTo.fromId
      ? ` from ${formatParticipantLabel(message.replyTo.fromId, dialogContext)}`
      : '';
    const quote = message.replyTo.quoteText ? `: "${message.replyTo.quoteText}"` : '';
    lines.push(`Replying to message ${message.replyTo.messageId}${replySender}${quote}`);
  }

  // 4. Mentions context
  if (message.mentions && message.mentions.length > 0) {
    const formattedMentions = message.mentions.map((m) => {
      const peer = m.peerId ? dialogContext?.peers?.[m.peerId] : undefined;
      if (peer) {
        const handle = peer.username ? `@${peer.username.replace(/^@/, '')}` : m.text;
        return `${m.text} -> ${peer.name || handle} [id: ${peer.id}]`;
      }
      if (m.peerId) {
        return `${m.text} [id: ${m.peerId}]`;
      }
      if (m.username) {
        return `${m.text} (@${m.username.replace(/^@/, '')})`;
      }
      return m.text;
    });
    lines.push(`Mentions: ${formattedMentions.join(', ')}`);
  }

  // 5. Forwarded context
  if (message.fwdFrom) {
    const fwdAuthor =
      message.fwdFrom.fromName ||
      (message.fwdFrom.fromId
        ? formatParticipantLabel(message.fwdFrom.fromId, dialogContext)
        : 'unknown');
    lines.push(`Forwarded from: ${fwdAuthor}`);
  }

  // 6. Media attachment context
  if (message.media) {
    const filePart = message.media.fileName ? `, file: "${message.media.fileName}"` : '';
    const summaryPart = message.media.summary ? ` — ${message.media.summary}` : '';
    lines.push(`Attachment: [${message.media.type}${filePart}${summaryPart}]`);
  }

  // 7. Message body
  lines.push('');
  lines.push(`Message:\n"${message.message}"`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

/**
 * Uses BaseChatModel to extract structured memory candidates from a single message.
 *
 * Important: this function only PROPOSES candidates — it never writes to IDB.
 * The MemoryConsolidator decides what to persist after validation + dedup.
 */
export class MemoryExtractor {
  constructor(private readonly model: BaseChatModel) {}

  async extract(
    message: AgentMessageRecord,
    dialogContext?: DialogMemoryContext,
  ): Promise<ExtractionCandidate[]> {
    const userPrompt = buildExtractionUserPrompt(message, dialogContext);

    const response = await this.model.invoke([
      { role: 'system', content: EXTRACTION_SYSTEM },
      { role: 'user', content: userPrompt },
    ]);

    const raw = typeof response.content === 'string' ? response.content : '';

    // Strip markdown code fences if present
    const jsonStr = raw.replace(/```(?:json)?\n?/g, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Model returned non-JSON — treat as no candidates
      return [];
    }

    const result = ExtractionResultSchema.safeParse(parsed);
    if (!result.success) {
      return [];
    }

    return result.data.candidates;
  }
}
