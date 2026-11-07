import { MemoryExtractor, ExtractionCandidateSchema } from './memory-extractor';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AgentMessageRecord } from '../../types/agent-message-record';

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
});
