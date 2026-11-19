import { isMemoryCandidate } from './candidate-detector';
import type { AgentMessageRecord } from '../../types/agent-message-record';

function createMessage(
  text: string,
  overrides: Partial<AgentMessageRecord> = {},
): AgentMessageRecord {
  return {
    id: 'msg_1',
    peerId: 'peer_123',
    message: text,
    date: Math.floor(Date.now() / 1000),
    out: false,
    ...overrides,
  };
}

describe('candidate-detector: isMemoryCandidate (Layer 1)', () => {
  describe('positive candidates (should trigger extraction)', () => {
    it('detects preference statements', () => {
      expect(isMemoryCandidate(createMessage('I prefer working in dark mode always.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('I hate noisy notifications when focusing.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('My favorite programming language is TypeScript.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('I always use tabs instead of spaces.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('Please do not call me before 10 AM.'))).toBe(true);
    });

    it('detects personal and workplace facts', () => {
      expect(isMemoryCandidate(createMessage('I work at Google on distributed systems.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('She works as a product manager.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('I moved to New York last month.'))).toBe(true);
      expect(isMemoryCandidate(createMessage("I'm an engineer specializing in AI."))).toBe(true);
      expect(isMemoryCandidate(createMessage('Dave is currently based in Zurich, Switzerland.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('Sarah completed her PhD in Computer Science at Stanford.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('Elena speaks fluent French, German, and Russian.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('The office address is 500 Howard Street, Suite 400.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('Marcus is the maintainer of libteleproto.'))).toBe(true);
    });

    it('detects relationship mentions', () => {
      expect(isMemoryCandidate(createMessage('My manager asked for the quarterly metrics.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('We worked together on the payment gateway.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('Met with my colleague Alex this afternoon.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('Chloe is my sister and she works as a developer.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('Michael introduced me to Dr. Henderson.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('Rachel and Tom co-founded the AI lab.'))).toBe(true);
    });

    it('detects time references, events, and deadlines', () => {
      expect(isMemoryCandidate(createMessage('We should sync next week regarding the launch.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('The PR needs to be merged by friday.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('Meeting scheduled for tomorrow at 3pm.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('My flight to Tokyo departs on December 3rd from SFO.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('Our company annual offsite takes place in Lisbon from October 15 to 19.'))).toBe(true);
    });

    it('detects agreements, decisions, commitments, and projects', () => {
      expect(isMemoryCandidate(createMessage('We decided to migrate to Postgres.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('It is confirmed for the next release milestone.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('Current sprint deadline is approaching fast.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('I will finish the contract review by Friday.'))).toBe(true);
      expect(isMemoryCandidate(createMessage('We are redesigning the onboarding flow.'))).toBe(true);
    });

    it('detects concise replies when replyTo.quoteText carries the trigger context', () => {
      expect(
        isMemoryCandidate(
          createMessage('Yes, Berlin.', {
            replyTo: {
              messageId: '100',
              fromId: 'user_alice',
              quoteText: 'Where did you move to?',
            },
          }),
        ),
      ).toBe(true);

      expect(
        isMemoryCandidate(
          createMessage('Ghostty', {
            replyTo: {
              messageId: '101',
              fromId: 'user_alice',
              quoteText: 'What is your favorite terminal?',
            },
          }),
        ),
      ).toBe(true);
    });
  });

  describe('negative candidates (should suppress extraction)', () => {
    it('rejects empty messages and trivial acknowledgements without triggers', () => {
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
