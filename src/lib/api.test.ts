import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastStore } from '@/stores/toastStore';

const mockQuarantineAnalysis = vi.fn(() => Promise.resolve());

vi.mock('./analysisStore', () => ({
  loadAllAnalyses: vi.fn(() => Promise.resolve([])),
  quarantineAnalysis: (...args: unknown[]) => mockQuarantineAnalysis(...args),
}));

import { normalizeAnalyses } from './api';

describe('normalizeAnalyses quarantine visibility', () => {
  beforeEach(() => {
    mockQuarantineAnalysis.mockClear();
    useToastStore.getState().clearToasts();
  });

  it('quarantines malformed data and tells the user where to review it', async () => {
    const result = await normalizeAnalyses([
      { source_file: 'broken-item-7.pdf', analysis_version: 'v9_archaeology' },
    ]);

    expect(result).toEqual([]);
    expect(mockQuarantineAnalysis).toHaveBeenCalledOnce();
    expect(useToastStore.getState().toasts[0]).toEqual(
      expect.objectContaining({
        severity: 'warning',
        message: expect.stringContaining('Review Settings > Data'),
      }),
    );
  });

  it('keeps same-title screenplays visible when they belong to different projects', async () => {
    const archaeologyDoc = (projectId: string, sourceFile: string) => ({
      project_id: projectId,
      source_file: sourceFile,
      analysis_version: 'v9_archaeology',
      collection: 'LEMON',
      analysis: {
        title: 'Shared Title',
        verdict: 'CONSIDER',
        weighted_score: 7,
        pillar_scores: {
          structure: { score: 7, evidence: 'evidence' },
          character: { score: 7, evidence: 'evidence' },
          craft_scene: { score: 7, evidence: 'evidence' },
          concept: { score: 7, evidence: 'evidence' },
          emotional_resonance: { score: 7, evidence: 'evidence' },
        },
      },
    });

    const result = await normalizeAnalyses([
      archaeologyDoc('shared-title-original', 'Shared Title.pdf'),
      archaeologyDoc('shared-title-separate', 'Shared Title (Separate).pdf'),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((screenplay) => screenplay.projectId)).toEqual([
      'shared-title-original',
      'shared-title-separate',
    ]);
  });

  it('keeps a renamed revision under one project card', async () => {
    const archaeologyDoc = (sourceFile: string, title: string) => ({
      project_id: 'original-project',
      source_file: sourceFile,
      analysis_version: 'v9_archaeology',
      collection: 'LEMON',
      analysis: {
        title,
        verdict: 'CONSIDER',
        weighted_score: 7,
        pillar_scores: {
          structure: { score: 7, evidence: 'evidence' },
          character: { score: 7, evidence: 'evidence' },
          craft_scene: { score: 7, evidence: 'evidence' },
          concept: { score: 7, evidence: 'evidence' },
          emotional_resonance: { score: 7, evidence: 'evidence' },
        },
      },
    });

    const result = await normalizeAnalyses([
      archaeologyDoc('Original Draft.pdf', 'Original Draft'),
      archaeologyDoc('Completely Renamed Draft.pdf', 'Completely Renamed Draft'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      projectId: 'original-project',
      sourceFile: 'Completely Renamed Draft.pdf',
      title: 'Completely Renamed Draft',
    }));
  });
});
