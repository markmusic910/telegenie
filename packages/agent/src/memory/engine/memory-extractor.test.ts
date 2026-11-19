import {
  MemoryExtractor,
  ExtractionCandidateSchema,
  buildExtractionUserPrompt,
} from './memory-extractor';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type {
  AgentMessageRecord,
  DialogMemoryContext,
} from '../../types/agent-message-record';

function createMockModel(output: string): BaseChatModel {
  return {
    invoke: jest.fn().mockResolvedValue({ content: output }),
  } as unknown as BaseChatModel;
}

const dummyMessage: AgentMessageRecord = {
  id: 'msg_101',
  peerId: 'peer_456',
  message: 'I prefer to use TypeScript and work remotely from Tokyo.',
  date: 1700000000,
  out: false,
};

describe('MemoryExtractor (Layer 1 Schema & Robustness)', () => {
  it('extracts candidates from valid raw JSON', async () => {
    const jsonOutput = JSON.stringify({
      candidates: [
        {
          type: 'PREFERENCE',
          subject: 'user',
          predicate: 'prefers',
          object: 'TypeScript',
          confidence: 0.95,
          importance: 0.8,
          content: 'User prefers to use TypeScript for development.',
        },
      ],
    });

    const extractor = new MemoryExtractor(createMockModel(jsonOutput));
    const candidates = await extractor.extract(dummyMessage);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].type).toBe('PREFERENCE');
    expect(candidates[0].subject).toBe('user');
    expect(candidates[0].confidence).toBe(0.95);
  });

  it('handles markdown code fences around JSON (```json ... ```)', async () => {
    const raw = `\`\`\`json
{
  "candidates": [
    {
      "type": "FACT",
      "subject": "user",
      "predicate": "lives_in",
      "object": "Tokyo",
      "confidence": 0.9,
      "importance": 0.7,
      "content": "User works remotely from Tokyo."
    }
  ]
}
\`\`\``;

    const extractor = new MemoryExtractor(createMockModel(raw));
    const candidates = await extractor.extract(dummyMessage);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].type).toBe('FACT');
    expect(candidates[0].object).toBe('Tokyo');
  });

  it('gracefully returns empty array on non-JSON response', async () => {
    const extractor = new MemoryExtractor(createMockModel('I could not find any memories in this message.'));
    const candidates = await extractor.extract(dummyMessage);
    expect(candidates).toEqual([]);
  });

  it('rejects candidates with invalid bounds on confidence (> 1)', async () => {
    const invalidPayload = JSON.stringify({
      candidates: [
        {
          type: 'PREFERENCE',
          subject: 'user',
          confidence: 1.5, // Invalid: max is 1
          importance: 0.5,
          content: 'Invalid confidence candidate',
        },
      ],
    });

    const extractor = new MemoryExtractor(createMockModel(invalidPayload));
    const candidates = await extractor.extract(dummyMessage);
    // safeParse fails -> returns []
    expect(candidates).toEqual([]);
  });

  it('rejects candidates missing required fields (e.g. missing content)', async () => {
    const missingFieldPayload = JSON.stringify({
      candidates: [
        {
          type: 'FACT',
          subject: 'user',
          confidence: 0.8,
          importance: 0.5,
          // content is missing
        },
      ],
    });

    const extractor = new MemoryExtractor(createMockModel(missingFieldPayload));
    const candidates = await extractor.extract(dummyMessage);
    expect(candidates).toEqual([]);
  });

  it('rejects unknown memory types', async () => {
    const invalidTypePayload = JSON.stringify({
      candidates: [
        {
          type: 'UNKNOWN_TYPE',
          subject: 'user',
          confidence: 0.8,
          importance: 0.5,
          content: 'Some memory',
        },
      ],
    });

    const extractor = new MemoryExtractor(createMockModel(invalidTypePayload));
    const candidates = await extractor.extract(dummyMessage);
    expect(candidates).toEqual([]);
  });

  it('includes dialogContext, sender username, replyTo, mentions, fwdFrom, and media in user prompt', () => {
    const dialogContext: DialogMemoryContext = {
      peerId: '-100777',
      peerName: 'Platform Engineering',
      peerType: 'channel',
      topics: {
        '42': { title: 'Database Migration' },
      },
      peers: {
        '1001': {
          id: '1001',
          name: 'Alice Chen',
          username: 'alice_c',
          type: 'user',
        },
        '1002': {
          id: '1002',
          name: 'Bob Vance',
          username: 'bob_dev',
          type: 'user',
        },
      },
    };

    const enrichedMessage: AgentMessageRecord = {
      id: '-100777:555',
      peerId: '-100777',
      fromId: '1001',
      date: 1700000000,
      threadId: '42',
      replyTo: {
        messageId: '550',
        fromId: '1002',
        quoteText: 'Who is owning the Postgres 16 cutover?',
      },
      mentions: [
        {
          peerId: '1002',
          username: 'bob_dev',
          text: '@bob_dev',
        },
      ],
      media: {
        type: 'document',
        fileName: 'postgres-cutover-plan.pdf',
      },
      message: '@bob_dev and I will run the cutover on Friday.',
    };

    const prompt = buildExtractionUserPrompt(enrichedMessage, dialogContext);

    expect(prompt).toContain('Dialog: "Platform Engineering" (type: channel, id: -100777)');
    expect(prompt).toContain('Topic / Thread: "Database Migration" (id: 42)');
    expect(prompt).toContain('Message ID: -100777:555');
    expect(prompt).toContain('Sender: Alice Chen (@alice_c) [id: 1001]');
    expect(prompt).toContain(
      'Replying to message 550 from Bob Vance (@bob_dev) [id: 1002]: "Who is owning the Postgres 16 cutover?"',
    );
    expect(prompt).toContain('Mentions: @bob_dev -> Bob Vance [id: 1002]');
    expect(prompt).toContain('Attachment: [document, file: "postgres-cutover-plan.pdf"]');
  });
});
