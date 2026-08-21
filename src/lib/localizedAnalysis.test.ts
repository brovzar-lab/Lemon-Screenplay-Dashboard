import { describe, expect, it } from 'vitest';

import {
  analysisIsEnglishFallback,
  localizedReaderReports,
  localizedScreenplay,
  localizedScreenplayPreview,
  savedLocalizedAnalysis,
} from '@/lib/localizedAnalysis';
import { normalizeLocalizedAnalysis } from '@/lib/normalizeLocalizedAnalysis';
import { createTestScreenplay } from '@/test/factories';
import type { ReaderReportEvidence } from '@/types';

function translatedProject() {
  return createTestScreenplay({
    latestVersionId: 'version-2',
    localizedAnalysis: {
      es: {
        sourceVersionId: 'version-2',
        generatedAt: '2026-08-20T12:00:00.000Z',
        model: 'translation-model',
        content: {
          logline: 'Una mujer descubre una verdad que cambia su familia.',
          verdictStatement: 'La ejecución necesita una decisión final más clara.',
          strengths: ['Voz específica'],
          dimensionJustifications: { structure: 'La segunda mitad pierde impulso.' },
          filmNowAssessment: { lightningTest: 'El concepto se entiende de inmediato.' },
          producerMetrics: { marketPotentialRationale: 'Tiene un público claro.' },
          readerReports: [{
            reader: 'structure',
            label: 'Estructura',
            oneSentenceVerdict: 'El punto medio funciona, pero el final llega tarde.',
            redFlags: ['El tercer acto comprime la decisión final.'],
            subScores: [{ label: 'Giros', justification: 'El punto medio cambia el plan.' }],
          }],
        },
      },
    },
  });
}

describe('saved localized analysis', () => {
  it('overlays Spanish narrative while preserving protected project facts', () => {
    const original = translatedProject();
    const localized = localizedScreenplay(original, 'es');

    expect(localized.logline).toBe('Una mujer descubre una verdad que cambia su familia.');
    expect(localized.verdictStatement).toBe(
      'La ejecución necesita una decisión final más clara.',
    );
    expect(localized.dimensionJustifications.structure).toBe(
      'La segunda mitad pierde impulso.',
    );
    expect(localized.producerMetrics.marketPotentialRationale).toBe(
      'Tiene un público claro.',
    );
    expect(localized.title).toBe(original.title);
    expect(localized.author).toBe(original.author);
    expect(localized.weightedScore).toBe(original.weightedScore);
    expect(localized.recommendation).toBe(original.recommendation);
    expect(localized.analysisModel).toBe(original.analysisModel);
    expect(localized.sourceFile).toBe(original.sourceFile);
    expect(localizedScreenplay(original, 'en')).toBe(original);
  });

  it('ignores a stale translation and shows the explicit Spanish fallback state', () => {
    const screenplay = translatedProject();
    screenplay.localizedAnalysis!.es!.sourceVersionId = 'version-1';

    expect(savedLocalizedAnalysis(screenplay, 'es')).toBeUndefined();
    expect(localizedScreenplay(screenplay, 'es')).toBe(screenplay);
    expect(analysisIsEnglishFallback(screenplay, 'es')).toBe(true);
    expect(analysisIsEnglishFallback(screenplay, 'en')).toBe(false);
  });

  it('never exposes original English narrative as a Spanish preview', () => {
    const untranslated = createTestScreenplay();
    const translated = translatedProject();

    expect(localizedScreenplayPreview(untranslated, 'es')).toBeUndefined();
    expect(localizedScreenplayPreview(untranslated, 'en')).toBe(untranslated);
    expect(localizedScreenplayPreview(translated, 'es')?.logline).toBe(
      'Una mujer descubre una verdad que cambia su familia.',
    );
  });

  it('overlays sealed reader narrative but keeps reader scores and citations original', () => {
    const original: ReaderReportEvidence[] = [{
      reader: 'structure',
      label: 'Structure',
      pillarScore: 7.8,
      oneSentenceVerdict: 'The midpoint works, but the ending arrives late.',
      redFlags: ['Act three compresses the final choice.'],
      subScores: [{
        key: 'turns',
        label: 'Turns',
        score: 8.1,
        justification: 'The midpoint changes the plan.',
        pageCitations: [48, 51],
      }],
    }];
    const localized = localizedReaderReports(
      original,
      translatedProject().localizedAnalysis?.es?.content,
    );

    expect(localized[0].label).toBe('Estructura');
    expect(localized[0].oneSentenceVerdict).toContain('final llega tarde');
    expect(localized[0].pillarScore).toBe(7.8);
    expect(localized[0].subScores[0].score).toBe(8.1);
    expect(localized[0].subScores[0].pageCitations).toEqual([48, 51]);
  });

  it('normalizes only a complete, versioned cached Spanish translation', () => {
    const normalized = normalizeLocalizedAnalysis({
      es: {
        sourceVersionId: 'version-2',
        generatedAt: '2026-08-20T12:00:00.000Z',
        model: 'translation-model',
        content: {
          verdictStatement: 'Veredicto traducido.',
          filmNowAssessment: { lightningTest: 'Concepto inmediato.' },
          producerMetrics: { marketPotentialRationale: 'Público claro.' },
        },
      },
    });

    expect(normalized?.es?.content.filmNowAssessment?.lightningTest).toBe(
      'Concepto inmediato.',
    );
    expect(normalized?.es?.content.producerMetrics?.marketPotentialRationale).toBe(
      'Público claro.',
    );
    expect(normalizeLocalizedAnalysis({ es: { content: {} } })).toBeUndefined();
  });
});
