import { z } from 'zod';
import type { ChatOpenAI } from '@langchain/openai';
import type { AgentMessageRecord } from '../../types/agent-message-record';

// ---------------------------------------------------------------------------
// Output schema (Zod — validated before writing to IDB)
// ---------------------------------------------------------------------------

export const ExtractionCandidateSchema = z.object({
  type: z.enum(['FACT', 'PREFERENCE', 'RELATIONSHIP', 'COMMITMENT', 'EVENT', 'PROJECT', 'TOPIC']),
  subject: z.string().describe('Name of the primary person or entity this memory is about'),
  predicate: z
    .string()
    .optional()
    .describe('Semantic relationship verb, e.g. "works_at", "prefers", "will_send"'),
  object: z
    .string()
    .optional()
    .describe('Name of the secondary entity or plain-text value'),
  /** ISO date string or unix ms. Optional. */
  dueAt: z.number().optional().describe('Unix ms deadline for commitments'),
  action: z.string().optional().describe('Action verb for COMMITMENT type'),
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

const EXTRACTION_SYSTEM = `You are a memory extraction assistant. Given a Telegram message, extract all semantically meaningful facts, preferences, commitments, relationships, events, projects, and recurring topics.

Output ONLY a JSON object with a "candidates" array. Each candidate must have:
- type: one of FACT, PREFERENCE, RELATIONSHIP, COMMITMENT, EVENT, PROJECT, TOPIC
- subject: name of the primary person or entity
- predicate: optional semantic relationship (e.g. "works_at", "prefers", "will_send")
- object: optional secondary entity or plain value
- action: only for COMMITMENT — the action verb (e.g. "send", "call")
- dueAt: only for COMMITMENT with a deadline — unix milliseconds
- confidence: 0.0 to 1.0
- importance: 0.0 to 1.0 (how useful for future reference)
- content: human-readable one-sentence summary
- sourceStart/sourceEnd: character offsets within the message text

Skip trivial content (greetings, reactions, "ok", "thanks", etc).
If nothing is extractable, return { "candidates": [] }.`;

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

/**
 * Uses ChatOpenAI to extract structured memory candidates from a single message.
 *
 * Important: this function only PROPOSES candidates — it never writes to IDB.
 * The MemoryConsolidator decides what to persist after validation + dedup.
 */
export class MemoryExtractor {
  constructor(private readonly model: ChatOpenAI) {}

  async extract(message: AgentMessageRecord): Promise<ExtractionCandidate[]> {
    const userPrompt = `Message (from ${message.out ? 'me' : `user ${message.fromId ?? 'unknown'}`}, date ${new Date(message.date * 1000).toISOString()}):\n\n"${message.message}"`;

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
