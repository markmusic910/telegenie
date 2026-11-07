/**
 * Layer 3 Evaluation Benchmark: Vector Distance & Information Retrieval (IR) Math
 *
 * This test runs completely offline in Node.js (0 external API calls) and evaluates:
 * 1. Vector cosine similarity invariants
 * 2. Information Retrieval (IR) ranking metrics: HitRate@K and MRR (Mean Reciprocal Rank)
 */

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

export function computeHitRateAtK(retrievedIds: string[], targetId: string, k: number): number {
  const topK = retrievedIds.slice(0, k);
  return topK.includes(targetId) ? 1 : 0;
}

export function computeReciprocalRank(retrievedIds: string[], targetId: string): number {
  const index = retrievedIds.indexOf(targetId);
  return index >= 0 ? 1 / (index + 1) : 0;
}

describe('Layer 3: Heuristic & Vector Distance Evals (IR Math & Geometry)', () => {
  describe('Cosine Similarity Invariants', () => {
    it('calculates 1.0 for identical vectors', () => {
      const v = [0.1, 0.5, 0.8, -0.2];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
    });

    it('calculates 0.0 for orthogonal vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [0, 1, 0];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.0, 5);
    });

    it('calculates -1.0 for opposite vectors', () => {
      const v1 = [0.2, 0.4, 0.6];
      const v2 = [-0.2, -0.4, -0.6];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1.0, 5);
    });

    it('correctly distinguishes high vs low semantic similarity', () => {
      // Synthetic embeddings representing:
      // A: "User prefers dark mode"
      // B: "Likes dark theme" (near A)
      // C: "Flight to Tokyo departs at 3pm" (far from A)
      const embA = [0.85, 0.12, 0.04, 0.51];
      const embB = [0.81, 0.15, 0.08, 0.49];
      const embC = [-0.10, 0.72, 0.68, -0.05];

      const simAB = cosineSimilarity(embA, embB);
      const simAC = cosineSimilarity(embA, embC);

      expect(simAB).toBeGreaterThan(0.95);
      expect(simAC).toBeLessThan(0.3);
    });
  });

  describe('Retrieval Ranking Benchmark (HitRate@3 and MRR)', () => {
    interface MemoryRecord {
      id: string;
      content: string;
      tags: string[];
    }

    const memoryCorpus: MemoryRecord[] = [
      { id: 'mem_01', content: 'User prefers dark mode in VSCode', tags: ['preference', 'dark mode', 'vscode'] },
      { id: 'mem_02', content: 'Office Wi-Fi password is SecretRocket2026', tags: ['fact', 'wifi', 'office'] },
      { id: 'mem_03', content: 'Flight to Tokyo departs on Dec 3rd from SFO', tags: ['event', 'flight', 'tokyo'] },
      { id: 'mem_04', content: 'Alice is the lead frontend engineer', tags: ['relationship', 'alice', 'role'] },
      { id: 'mem_05', content: 'Project Titan milestone 2 deadline is Nov 20', tags: ['project', 'titan', 'deadline'] },
      { id: 'mem_06', content: 'Staging PostgreSQL database runs on port 5432', tags: ['fact', 'postgres', 'staging'] },
      { id: 'mem_07', content: 'User prefers async communication in the morning', tags: ['preference', 'async', 'morning'] },
      { id: 'mem_08', content: 'Offsite in Lisbon is scheduled for October', tags: ['event', 'offsite', 'lisbon'] },
    ];

    // Naive text score ranker mimicking in-memory token retrieval
    function searchCorpus(query: string): string[] {
      const qTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
      const scored = memoryCorpus.map((m) => {
        let score = 0;
        const text = (m.content + ' ' + m.tags.join(' ')).toLowerCase();
        for (const token of qTokens) {
          if (text.includes(token)) score += 1;
        }
        return { id: m.id, score };
      });

      return scored.sort((a, b) => b.score - a.score).map((s) => s.id);
    }

    const testQueries = [
      { query: 'what is the wifi password', expectedId: 'mem_02' },
      { query: 'dark mode setting in vscode', expectedId: 'mem_01' },
      { query: 'when is my flight to tokyo', expectedId: 'mem_03' },
      { query: 'alice frontend engineer role', expectedId: 'mem_04' },
      { query: 'project titan milestone deadline', expectedId: 'mem_05' },
      { query: 'lisbon offsite trip date', expectedId: 'mem_08' },
      { query: 'postgres staging port', expectedId: 'mem_06' },
      { query: 'async communication preferences', expectedId: 'mem_07' },
    ];

    it('achieves 100% HitRate@3 across all benchmark queries', () => {
      let hits = 0;
      for (const t of testQueries) {
        const retrieved = searchCorpus(t.query);
        hits += computeHitRateAtK(retrieved, t.expectedId, 3);
      }
      const hitRate = hits / testQueries.length;
      expect(hitRate).toBe(1.0);
    });

    it('achieves MRR (Mean Reciprocal Rank) >= 0.90', () => {
      let sumRR = 0;
      for (const t of testQueries) {
        const retrieved = searchCorpus(t.query);
        sumRR += computeReciprocalRank(retrieved, t.expectedId);
      }
      const mrr = sumRR / testQueries.length;
      expect(mrr).toBeGreaterThanOrEqual(0.90);
    });
  });
});

