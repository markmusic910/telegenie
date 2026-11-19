import type { AgentMessageRecord } from '../../types/agent-message-record';

/**
 * Keyword/pattern pre-filter for memory extraction candidates.
 *
 * Avoids sending every Telegram message to a strong LLM.
 * Only messages that pass this filter are forwarded to MemoryExtractor.
 *
 * Aligned with the Grafeo Knowledge Graph schema:
 * - MemoryType: FACT, PREFERENCE, RELATIONSHIP, EVENT, DECISION, COMMITMENT, PROJECT, TOPIC
 * - EntityType: PERSON, ORGANIZATION, PLACE, PROJECT, TOPIC, THING
 *
 * Intentionally has false positives (better to over-extract and let the LLM filter)
 * while minimizing false negatives across all 8 memory categories.
 */

const TRIGGER_PATTERNS: RegExp[] = [
  // 1. PREFERENCE (likes, dislikes, habits, tool/style choices, communication rules)
  /\b(prefer|prefers|preferred|like|likes|love|loves|hate|hates|dislike|dislikes|enjoy|enjoys|can't stand|favorite|favourite)\b/i,
  /\b(i (always|never|usually) (use|write|drink|eat|work|take))\b/i,
  /\b(instead of|rather than|over (tea|coffee|spaces|tabs))\b/i,
  /\b(please (do not|don't) (call|message|ping|disturb))\b/i,

  // 2. FACT (PERSON / ORGANIZATION / PLACE / THING attributes: work, location, education, language, address, tech stack, roles)
  /\b(i work|i worked|work|works|worked|working) (at|for|on|with|in|as)\b/i,
  /\b(i live|i moved|i'm moving|i'm living|live|lives|lived|living|based|located|moved|move|moving|relocated|relocate) (in|at|to|from)\b/i,
  /\b(i('m| am)|he('s| is)|she('s| is)|they('re| are)) (a|an|the|currently)\b/i,
  /\b(he|she|they) (works?|lives?|moved|is|completed|graduated|speaks?)\b/i,
  /\b(completed|graduated|studied|degree|phd|master'?s|bachelor'?s|university|college|stanford|mit)\b/i,
  /\b(speaks?|fluent in)\b/i,
  /\b(address|street|suite|avenue|blvd|road|apartment|office|headquarters|hq)\b/i,
  /\b(maintainer|author|creator|owner|founder|architect|engineer|developer|designer|lead|director|vp|ceo|cto)\b/i,
  /\b(runs? on|hosted on|deployed on|powered by|database|postgresql|postgres|mysql|redis|aws|gcp|production|staging|server|cluster|password|wifi|wi-fi)\b/i,

  // 3. RELATIONSHIP (reporting lines, family, coworkers, clients, intros, mentorship, co-founders)
  /\b(my|our|his|her|their) (direct )?(boss|manager|supervisor|colleague|coworker|teammate|friend|partner|wife|husband|sister|brother|mother|father|parent|client|mentor|mentee|contractor|intern|lead|contact|point of contact)\b/i,
  /\b(we (met|work|worked) (together|at|on))\b/i,
  /\b(introduced|reports? to|under .+[’']s supervision|supervises?|mentors?|mentor|co-?founded)\b/i,
  /\b(joined (our|the) (team|company|group|lab|org))\b/i,

  // 4. EVENT (schedules, meetings, flights, conferences, deadlines, offsites, demos, retrospectives, dates/times)
  /\b(next (week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|tomorrow|this (week|weekend|morning|afternoon|evening))\b/i,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2}(st|nd|rd|th)?\b/i,
  /\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/,
  /\b\d{1,2}(:\d{2})?\s*(am|pm|est|pst|utc|cet|gmt)\b/i,
  /\bby (end of|eod|eow|friday|monday|tomorrow)\b/i,
  /\b(meeting|sync|standup|standups|retrospective|retro|offsite|conference|summit|flight|departs?|arrives?|presentation|demo|audit|review|registration|scheduled|confirmed)\b/i,

  // 5. DECISION (choices, architecture/tool adoption, migrations, confirmations)
  /\b(we decided|we agreed|we('ve| have) confirmed|it('s| is) (decided|confirmed|settled))\b/i,
  /\b(decided|agreed|settled|approved|chosen|chose|selected|adopted|adopt|switched to|migrating to|migrate)\b/i,

  // 6. COMMITMENT (promises, action items, follow-ups, deliverables, obligations)
  /\b(i('ll| will)|we('ll| will)) (finish|complete|send|deliver|review|prepare|submit|deploy|fix|update|handle|take care of|follow up)\b/i,
  /\b(promised|committed|assigned to|action item|todo|to-do|deliverable|responsible for|owes?)\b/i,

  // 7. PROJECT & 8. TOPIC (initiatives, milestones, sprints, releases, technical/domain discussion themes)
  /\b(project|sprint|milestone|deadline|release|launch|initiative|roadmap|rewrite|redesign|redesigning|migration|onboarding|beta|testflight|release candidate)\b/i,
  /\b(discussion on|implementing|architecture|gateway|authentication|passkeys?|webauthn|graphql|tailwind|indexeddb|vector search|leader election|web locks)\b/i,
];

/**
 * Build the combined inspection text from the message body, replied-to message quote,
 * and media summary/filename so concise replies to factual questions are not skipped.
 */
function buildCandidateInspectionText(message: AgentMessageRecord): string {
  const parts: string[] = [];
  if (message.message?.trim()) {
    parts.push(message.message.trim());
  }
  if (message.replyTo?.quoteText?.trim()) {
    parts.push(message.replyTo.quoteText.trim());
  }
  if (message.media?.summary?.trim()) {
    parts.push(message.media.summary.trim());
  }
  if (message.media?.fileName?.trim()) {
    parts.push(message.media.fileName.trim());
  }
  return parts.join('\n');
}

/**
 * Returns true if the message (or its reply/media context) likely contains extractable memory candidates.
 * Callers should still pass it to MemoryExtractor for confirmation and structuring.
 */
export function isMemoryCandidate(message: AgentMessageRecord): boolean {
  const text = buildCandidateInspectionText(message);
  if (!text) return false;
  return TRIGGER_PATTERNS.some((pattern) => pattern.test(text));
}
