import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
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

  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it.each([
    {
      language: 'en',
      sources: ['broken-item-en.pdf'],
      expected: '1 malformed analysis was quarantined. Review Settings > Data.',
    },
    {
      language: 'es',
      sources: ['broken-item-es-1.pdf', 'broken-item-es-2.pdf'],
      expected:
        'Se pusieron en cuarentena 2 análisis con formato incorrecto. Revísalos en Configuración > Datos.',
    },
  ])('quarantines malformed data and reports it in $language', async ({
    language,
    sources,
    expected,
  }) => {
    await i18n.changeLanguage(language);
    const result = await normalizeAnalyses(sources.map((source_file) => ({
      source_file,
      analysis_version: 'v9_archaeology',
    })));

    expect(result).toEqual([]);
    expect(mockQuarantineAnalysis).toHaveBeenCalledTimes(sources.length);
    expect(useToastStore.getState().toasts[0]).toEqual(
      expect.objectContaining({
        severity: 'warning',
        message: expected,
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
