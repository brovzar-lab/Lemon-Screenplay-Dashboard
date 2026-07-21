import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCollection, mockGetDocs, mockLimit, mockQuery, mockWhere } = vi.hoisted(() => ({
  mockCollection: vi.fn(() => 'collection-ref'),
  mockGetDocs: vi.fn(),
  mockLimit: vi.fn(() => 'limit-constraint'),
  mockQuery: vi.fn(() => 'query-ref'),
  mockWhere: vi.fn(() => 'where-constraint'),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  getDocs: mockGetDocs,
  limit: mockLimit,
  query: mockQuery,
  where: mockWhere,
}));

vi.mock('@/lib/firebase', () => ({ db: 'database' }));

import { findAnalysisByContentHash } from './analysisLookup';

const CONTENT_HASH = 'cd'.repeat(32);

describe('findAnalysisByContentHash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds an uploaded analysis after writers persist its content hash', async () => {
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [
        {
          id: 'matched-doc',
          data: () => ({
            source_file: 'Fallback.pdf',
            analysis: { title: 'Matched Screenplay' },
          }),
        },
      ],
    });

    await expect(findAnalysisByContentHash(CONTENT_HASH)).resolves.toBe(
      'Matched Screenplay',
    );
    expect(mockWhere).toHaveBeenCalledWith('content_hash', '==', CONTENT_HASH);
    expect(mockLimit).toHaveBeenCalledWith(1);
    expect(mockGetDocs).toHaveBeenCalledWith('query-ref');
  });
});
