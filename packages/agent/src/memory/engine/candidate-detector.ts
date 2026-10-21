import type { AgentMessageRecord } from '../../types/agent-message-record';

/**
 * Keyword/pattern pre-filter for memory extraction candidates.
 *
 * Avoids sending every Telegram message to a strong LLM.
 * Only messages that pass this filter are forwarded to MemoryExtractor.
 *
 * Phase 1: deterministic string matching. Intentionally has false positives
 * (better to over-extract and let the LLM filter) but not false negatives.
 */

const TRIGGER_PATTERNS: RegExp[] = [
  // Commitments / promises
  /\bi'?ll\b/i,
  /\bi will\b/i,
  /\bi promised?\b/i,
  /\bi'?m going to\b/i,
  /\bwe will\b/i,
  /\bwe'll\b/i,
  /\bwe need to\b/i,
  /\bdon't forget\b/i,
  /\bremember (to|that)\b/i,
  /\bI'll (send|call|email|update|check|deliver|finish|complete|share)\b/i,
  // Time references (suggests events or commitments)
  /\b(next week|next month|tomorrow|this (week|weekend))\b/i,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\bby (end of|eod|friday|monday)\b/i,
  /\b\d{1,2}[/-]\d{1,2}\b/, // date patterns
  // Facts about people
  /\b(i work|i worked|works at|working at)\b/i,
  /\b(i live|i moved|i'm moving|i'm living)\b/i,
  /\bi('m| am) (a|an)\b/i, // "I'm a developer"
  /\b(he|she|they) (works?|lives?|moved|is)\b/i,
  // Preferences
  /\bi (like|love|hate|prefer|dislike|enjoy|can't stand)\b/i,
  /\b(my favorite|favourite)\b/i,
  // Relationships
  /\b(my (boss|colleague|coworker|friend|partner|client|manager|teammate))\b/i,
  /\b(we (met|work|worked) (together|at)\b)\b/i,
  // Decisions / agreements
  /\bwe decided\b/i,
  /\bwe agreed\b/i,
  /\bit('s| is) (decided|confirmed|settled)\b/i,
  // Projects
  /\b(project|sprint|milestone|deadline|release|launch)\b/i,
];

/**
 * Returns true if the message likely contains extractable memory candidates.
 * Callers should still pass it to MemoryExtractor for confirmation and structuring.
 */
export function isMemoryCandidate(message: AgentMessageRecord): boolean {
  const text = message.message;
  if (!text || text.trim().length < 10) return false;
  return TRIGGER_PATTERNS.some((pattern) => pattern.test(text));
}
