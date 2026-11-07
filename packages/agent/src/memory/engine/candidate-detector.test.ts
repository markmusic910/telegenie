import { isMemoryCandidate } from './candidate-detector';
import type { AgentMessageRecord } from '../../types/agent-message-record';

function createMessage(text: string, out = false): AgentMessageRecord {
  return {
    id: 'msg_1',
    peerId: 'peer_123',
    message: text,
    date: Math.floor(Date.now() / 1000),
    out,
  };
}

describe('candidate-detector: isMemoryCandidate (Layer 1)', () => {
  describe('positive candidates (should trigger extraction)', () => {
    it('detects preference statements', () => {
      expect(isMemoryCandidate(createMessage('I prefer working in dark mode always.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('I hate noisy notifications when focusing.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('My favorite programming language is TypeScript.'))).toBe(true);
    });

    it('detects personal and workplace facts', () => {
      expect(isMemoryCandidate(createMessage('I work at Google on distributed systems.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('She works as a product manager.'))).toBe(true);
      expect(isMemoryCandidate(createMessage("I moved to New York last month."))).toBe(true);
      expect(isMemoryCandidate(createMessage("I'm an engineer specializing in AI."))).toBe(true);
    });

    it('detects relationship mentions', () => {
      expect(isMemoryCandidate(createMessage('My manager asked for the quarterly metrics.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('We worked together on the payment gateway.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('Met with my colleague Alex this afternoon.'))).toBe(true);
    });

    it('detects time references, events, and deadlines', () => {
      expect(isMemoryCandidate(createMessage('We should sync next week regarding the launch.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('The PR needs to be merged by friday.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('Meeting scheduled for tomorrow at 3pm.'))).toBe(true);
    });

    it('detects agreements, decisions, and projects', () => {
      expect(isMemoryCandidate(createMessage("We decided to migrate to Postgres."))).toBe(true);
      expect(isMemoryCandidate(createMessage("It is confirmed for the next release milestone."))).toBe(true);
      expect(isMemoryCandidate(createMessage("Current sprint deadline is approaching fast."))).toBe(true);
    });
  });

  describe('negative candidates (should suppress extraction)', () => {
    it('rejects empty or very short messages', () => {
      expect(isMemoryCandidate(createMessage(''))).toBe(false);
      expect(isMemoryCandidate(createMessage('ok'))).toBe(false);
      expect(isMemoryCandidate(createMessage('thanks!'))).toBe(false);
      expect(isMemoryCandidate(createMessage('👍'))).toBe(false);
      expect(isMemoryCandidate(createMessage('cool bro'))).toBe(false);
    });

    it('rejects trivial chit-chat and greetings without triggers', () => {
      expect(isMemoryCandidate(createMessage('Good morning everyone, how are you?'))).toBe(false);
      expect(isMemoryCandidate(createMessage('Can you send me that link please?'))).toBe(false);
      expect(isMemoryCandidate(createMessage('See you all later tonight.'))).toBe(false);
    });
  });
});
