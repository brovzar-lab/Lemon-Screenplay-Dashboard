/**
 * Unit tests for the coverage_v1 normalizer.
 * Fixture mirrors the report assembled by execution/coverage_v1.py
 * (run_coverage_v1) and the valid_coverage() fixture in
 * execution/test_coverage_v1.py.
 */

import { describe, it, expect } from 'vitest';
import {
  isCoverageV1Analysis,
  normalizeCoverageV1Screenplay,
  resolveCoverageV1Report,
} from '@/lib/normalizers/normalizeCoverageV1';

// ─── Fixture ────────────────────────────────────────────────

function coveragePayload(): Record<string, unknown> {
  return {
    language: 'es-MX',
    genre: { primary: 'sports drama', secondary: 'family', tone: 'warm, redemptive' },
    logline:
      'Un portero retirado y enfermo entrena al equipo infantil de Tepito para salvar la cancha del barrio.',
    story_spine: {
      protagonist: 'Diego Salas, un portero legendario retirado de 58 años',
      want: 'Salvar la cancha del barrio ganando el torneo',
      need: 'Volver a creer que su vida sirve para algo fuera de la cancha',
      opposition: 'Román Vega, el patrocinador que amenaza con quitar la cancha',
      stakes: 'El barrio pierde su cancha y Diego arriesga su corazón enfermo',
      setting: 'Tepito, Ciudad de México, en el presente',
      major_turns: [
        { turn: 'Lucía desafía a Diego y él detiene el penal', page: 2 },
        { turn: 'El médico le prohíbe jugar; Diego decide jugar la final', page: 5 },
        { turn: 'Diego detiene el último penal y se desploma', page: 6 },
      ],
      climax: 'Diego detiene el último penal de la final y se desploma en el pasto',
      ending: 'Los niños ganan el torneo, la cancha se salva y Diego se queda como entrenador',
    },
    synopsis:
      'Diego Salas, portero legendario venido a menos, jura no volver a pisar una cancha. ' +
      'Los niños de Tepito, encabezados por Lucía, lo arrastran de regreso al fútbol llanero. ' +
      'Cuando el patrocinador Román Vega amenaza con quitarle la cancha al barrio, Diego acepta ' +
      'entrenar al equipo para el torneo, desafiando el diagnóstico de su corazón enfermo, ' +
      'hasta detener el último penal de la final.',
    lens_notes: [
      {
        lens: 'structure',
        grade: 'solid',
        analysis: 'El guion sostiene su promesa central con progresión clara.',
        citations: [{ page: 2, excerpt: 'detiene el penal con una sola mano', verified: true }],
      },
      {
        lens: 'character',
        grade: 'strong',
        analysis: 'Diego carga cada escena con un costo físico legible.',
        citations: [{ page: 5, excerpt: 'su corazón no soporta otro partido', verified: true }],
      },
      {
        lens: 'craft',
        grade: 'weak',
        analysis: 'El segundo acto repite beats de entrenamiento.',
        citations: [{ page: 4, excerpt: 'pierde su primer partido', verified: true }],
      },
    ],
    genre_contract: {
      contract: 'Drama deportivo: la final debe ganarse con costo emocional real en la cancha',
      met: true,
      evidence: [
        {
          point: 'La final se gana en la cancha con costo físico real',
          citations: [{ page: 6, excerpt: 'detiene el último penal y se desploma' }],
        },
      ],
      failures: [],
    },
    strengths: [
      {
        point: 'El desafío de Lucía en Tepito ancla la premisa con imagen y acción',
        citations: [{ page: 2, excerpt: 'lo reconoce y lo desafía a parar un penal' }],
      },
      {
        point: 'El diagnóstico médico convierte la final en una decisión de vida o muerte',
        citations: [{ page: 5, excerpt: 'su corazón no soporta otro partido' }],
      },
      {
        point: 'El clímax paga la promesa del deporte y del personaje a la vez',
        citations: [{ page: 6, excerpt: 'Lucía anota el gol del empate' }],
      },
    ],
    concerns: [
      {
        point: 'El antagonista Román Vega es funcional pero unidimensional',
        citations: [{ page: 4, excerpt: 'amenaza con quitar la cancha' }],
      },
      {
        point: 'El montaje de entrenamiento comprime demasiado la derrota 5-0',
        citations: [{ page: 4, excerpt: 'pierde su primer partido' }],
      },
      {
        point: 'La subtrama médica se resuelve fuera de pantalla',
        citations: [{ page: 5, excerpt: 'el médico revisa los estudios' }],
      },
    ],
    development_priorities: [
      {
        priority: 'Darle a Román Vega una razón personal',
        why: 'El antagonista es unidimensional',
        how: 'Una escena donde Vega revele qué perdió él en esa cancha',
      },
      {
        priority: 'Expandir la derrota 5-0',
        why: 'El costo del fracaso se comprime en montaje',
        how: 'Dramatizar el vestidor después de la goleada',
      },
      {
        priority: 'Resolver la subtrama médica en pantalla',
        why: 'El riesgo cardiaco pierde peso si se resuelve en diálogo',
        how: 'Mostrar la decisión de Diego frente al médico',
      },
    ],
    verdict: 'CONSIDER',
    confidence: 'high',
    champion_reason: 'Un drama deportivo con corazón de barrio y clímax ganado.',
    pass_reason: 'El antagonista y el segundo acto necesitan trabajo antes de avanzar.',
    uncertainties: ['La edad exacta de Lucía no queda clara'],
    commercial_hypothesis: 'Familias mexicanas; comparable a Rudo y Cursi en tono local.',
  };
}

function coverageV1Report(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    analysis_version: 'coverage_v1',
    engine_version: 'coverage-v1.0',
    status: 'sealed',
    title: 'La Cancha',
    format: 'feature',
    page_count: 98,
    word_count: 21000,
    content_sha256: 'a'.repeat(64),
    parser_version: 'parse-v2',
    lens_stack: ['structure', 'character', 'craft'],
    models: { coverage: 'claude-opus-4-6', audit: 'claude-sonnet-4-5' },
    coverage: coveragePayload(),
    citation_verification: { total: 12, verified: 12, unverified: 0, failures: [] },
    fact_audit: {
      claims: 14,
      verdicts: [],
      support_rate: 1.0,
      central_failures: [],
      central_partials: [],
    },
    verdict: 'CONSIDER',
    verdict_adjustments: [],
    confidence: 'high',
    film_now_nominated: false,
    human_review_recommended: false,
    review_reasons: [],
    cost: {
      charged_usd: 1.42,
      settled_usd: 1.42,
      uncertain_usd: 0,
      call_count: 2,
      repair_calls_used: 0,
    },
    ...overrides,
  };
}

// ─── Dispatch / detection ───────────────────────────────────

describe('isCoverageV1Analysis', () => {
  it('accepts a bare coverage_v1 report', () => {
    expect(isCoverageV1Analysis(coverageV1Report())).toBe(true);
  });

  it('accepts a Firestore staging doc wrapping the report as report_json', () => {
    const staging = {
      source_file: 'La_Cancha.pdf',
      report_json: JSON.stringify(coverageV1Report()),
    };
    expect(isCoverageV1Analysis(staging)).toBe(true);
  });

  it('rejects invalid JSON in report_json without throwing', () => {
    expect(isCoverageV1Analysis({ report_json: '{not valid json' })).toBe(false);
  });

  it('rejects report_json that parses to a non-coverage document', () => {
    expect(isCoverageV1Analysis({ report_json: JSON.stringify({ analysis_version: 'v9_archaeology' }) })).toBe(false);
    expect(isCoverageV1Analysis({ report_json: JSON.stringify('just a string') })).toBe(false);
  });

  it('rejects V9 documents so V9 routing is untouched', () => {
    expect(isCoverageV1Analysis({ analysis_version: 'v9_archaeology', analysis: { title: 'X' } })).toBe(false);
  });

  it('rejects structurally broken coverage reports', () => {
    expect(isCoverageV1Analysis(coverageV1Report({ title: '' }))).toBe(false);
    expect(isCoverageV1Analysis(coverageV1Report({ verdict: '' }))).toBe(false);
    expect(isCoverageV1Analysis(coverageV1Report({ coverage: null }))).toBe(false);
    expect(isCoverageV1Analysis(null)).toBe(false);
    expect(isCoverageV1Analysis('coverage_v1')).toBe(false);
  });
});

describe('resolveCoverageV1Report', () => {
  it('returns the inner report for a staging doc', () => {
    const report = coverageV1Report();
    const resolved = resolveCoverageV1Report({ report_json: JSON.stringify(report) });
    expect(resolved?.title).toBe('La Cancha');
    expect(resolved?.analysis_version).toBe('coverage_v1');
  });
});

// ─── Normalization ──────────────────────────────────────────

describe('normalizeCoverageV1Screenplay', () => {
  it('populates developmentNotes from development_priorities', () => {
    const result = normalizeCoverageV1Screenplay(coverageV1Report(), 'Analysis');
    expect(result.developmentNotes).toHaveLength(3);
    expect(result.developmentNotes[0]).toBe(
      'Darle a Román Vega una razón personal — El antagonista es unidimensional — Una escena donde Vega revele qué perdió él en esa cancha',
    );
    expect(result.developmentNotes[1]).toContain('Expandir la derrota 5-0');
  });

  it.each([
    ['PASS', 'pass'],
    ['CONSIDER', 'consider'],
    ['RECOMMEND', 'recommend'],
  ] as const)('maps verdict %s to tier %s', (verdict, tier) => {
    const result = normalizeCoverageV1Screenplay(coverageV1Report({ verdict }), 'Analysis');
    expect(result.recommendation).toBe(tier);
    expect(result.producerProjection?.finalVerdict).toBe(tier);
  });

  it('keeps a FILM_NOW nomination on RECOMMEND and never claims the protected tier', () => {
    const result = normalizeCoverageV1Screenplay(
      coverageV1Report({
        verdict: 'RECOMMEND',
        film_now_nominated: true,
        verdict_adjustments: [
          'FILM_NOW is a protected human-confirmed label; recorded as a nomination on a RECOMMEND verdict',
        ],
      }),
      'Analysis',
    );
    expect(result.recommendation).toBe('recommend');
    expect(result.isFilmNow).toBe(false);
    expect(result.filmNowAssessment).toBeNull();
    expect(result.filmNowNominated).toBe(true);
    expect(result.producerProjection?.verdictAdjustments).toHaveLength(1);
    const codes = result.producerProjection?.warnings.map((w) => w.code) ?? [];
    expect(codes).toContain('film_now_nominated');
  });

  it('caps a raw FILM_NOW verdict string defensively', () => {
    const result = normalizeCoverageV1Screenplay(
      coverageV1Report({ verdict: 'FILM_NOW' }),
      'Analysis',
    );
    expect(result.recommendation).toBe('recommend');
    expect(result.isFilmNow).toBe(false);
    expect(result.filmNowNominated).toBe(true);
  });

  it('never fabricates a numeric score and stays out of rankings', () => {
    const result = normalizeCoverageV1Screenplay(coverageV1Report(), 'Analysis');
    expect(result.weightedScore).toBe(0);
    expect(result.pillarScores).toBeUndefined();
    expect(result.producerProjection?.rankable).toBe(false);
    expect(result.producerProjection?.finalScore).toBe(0);
    expect(result.producerProjection?.scoreSource).toBe('coverage_unscored');
    const codes = result.producerProjection?.warnings.map((w) => w.code) ?? [];
    expect(codes).toContain('coverage_unscored');
  });

  it('keeps lens grades verbatim instead of converting them to scores', () => {
    const result = normalizeCoverageV1Screenplay(coverageV1Report(), 'Analysis');
    expect(result.lensGrades).toEqual([
      { lens: 'structure', grade: 'solid', note: expect.stringContaining('promesa central') },
      { lens: 'character', grade: 'strong', note: expect.stringContaining('costo físico') },
      { lens: 'craft', grade: 'weak', note: expect.stringContaining('repite beats') },
    ]);
  });

  it('surfaces needs_review as a blocking warning with the review reasons', () => {
    const result = normalizeCoverageV1Screenplay(
      coverageV1Report({
        status: 'needs_review',
        human_review_recommended: true,
        review_reasons: ['central facts not supported: climax', 'repair budget already spent'],
      }),
      'Analysis',
    );
    expect(result.humanReviewRecommended).toBe(true);
    expect(result.reviewReasons).toHaveLength(2);
    expect(result.producerProjection?.trustStatus).toBe('incomplete');
    const blocking = result.producerProjection?.warnings.find(
      (w) => w.code === 'coverage_needs_review',
    );
    expect(blocking?.severity).toBe('blocking');
    expect(blocking?.detail).toContain('central facts not supported: climax');
  });

  it('surfaces low confidence as a human-review warning on a sealed report', () => {
    const result = normalizeCoverageV1Screenplay(
      coverageV1Report({
        confidence: 'low',
        human_review_recommended: true,
        review_reasons: ['reader confidence is low'],
      }),
      'Analysis',
    );
    const warning = result.producerProjection?.warnings.find(
      (w) => w.code === 'human_review_recommended',
    );
    expect(warning?.severity).toBe('warning');
    expect(warning?.detail).toContain('reader confidence is low');
    const codes = result.producerProjection?.warnings.map((w) => w.code) ?? [];
    expect(codes).not.toContain('coverage_needs_review');
  });

  it('escalates the evidence audit when citations or central facts fail', () => {
    const result = normalizeCoverageV1Screenplay(
      coverageV1Report({
        citation_verification: { total: 12, verified: 10, unverified: 2, failures: [] },
        fact_audit: {
          claims: 14,
          verdicts: [],
          support_rate: 0.8571,
          central_failures: ['climax'],
          central_partials: [],
        },
      }),
      'Analysis',
    );
    const audit = result.producerProjection?.warnings.find(
      (w) => w.code === 'coverage_evidence_audit',
    );
    expect(audit?.severity).toBe('warning');
    expect(audit?.detail).toContain('10 of 12');
    expect(audit?.detail).toContain('86%');
    expect(audit?.detail).toContain('climax');
  });

  it('reports a clean evidence audit as information only', () => {
    const result = normalizeCoverageV1Screenplay(coverageV1Report(), 'Analysis');
    const audit = result.producerProjection?.warnings.find(
      (w) => w.code === 'coverage_evidence_audit',
    );
    expect(audit?.severity).toBe('information');
  });

  it('normalizes a staging doc wrapping report_json and keeps wrapper identity', () => {
    const staging = {
      source_file: 'La_Cancha (3ra Version).pdf',
      collection_id: 'SUBMISSION',
      project_id: 'proj-123',
      storage_path: 'gs://bucket/la-cancha.pdf',
      report_json: JSON.stringify(coverageV1Report()),
    };
    const result = normalizeCoverageV1Screenplay(staging, 'Analysis');
    expect(result.title).toBe('La Cancha');
    expect(result.sourceFile).toBe('La_Cancha (3ra Version).pdf');
    expect(result.projectId).toBe('proj-123');
    expect(result.hasPdf).toBe(true);
    expect(result.storagePath).toBe('gs://bucket/la-cancha.pdf');
    expect(result.developmentNotes).toHaveLength(3);
  });

  it('throws on a document that is not a valid coverage_v1 report', () => {
    expect(() =>
      normalizeCoverageV1Screenplay({ report_json: '{broken' }, 'Analysis'),
    ).toThrow();
    expect(() =>
      normalizeCoverageV1Screenplay({ analysis_version: 'v9_archaeology' }, 'Analysis'),
    ).toThrow();
  });

  it('fills every field the grid and workspace need without crashing', () => {
    const result = normalizeCoverageV1Screenplay(coverageV1Report(), 'Analysis');
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.title).toBe('La Cancha');
    expect(result.analysisVersion).toBe('coverage_v1');
    expect(result.analysisModel).toBe('claude-opus-4-6');
    expect(result.collection).toBe('Analysis');
    expect(result.genre).toBe('sports drama');
    expect(result.subgenres).toEqual(['family']);
    expect(result.tone).toBe('warm, redemptive');
    expect(result.language).toBe('es-MX');
    expect(result.logline).toContain('portero retirado');
    expect(result.recommendationRationale).toContain(result.logline);
    expect(result.recommendationRationale).toContain('Diego Salas');
    expect(result.verdictStatement.length).toBeGreaterThan(0);
    expect(result.strengths).toHaveLength(3);
    expect(result.weaknesses).toHaveLength(3);
    expect(result.majorWeaknesses).toHaveLength(3);
    expect(result.criticalFailures).toEqual([]);
    expect(result.criticalFailureDetails).toEqual([]);
    expect(result.characters.protagonist).toContain('Diego Salas');
    expect(result.characters.antagonist).toContain('Román Vega');
    expect(result.structureAnalysis.actBreaks).toContain('p.2:');
    expect(result.metadata.pageCount).toBe(98);
    expect(result.metadata.wordCount).toBe(21000);
    expect(result.commercialViability.cvsAssessed).toBe(false);
    expect(result.dimensionScores.weightedScore).toBe(0);
    expect(result.producerMetrics.marketPotential).toBeNull();
    expect(result.tmdbStatus).toBeNull();
    expect(result.uncertainties).toEqual(['La edad exacta de Lucía no queda clara']);
  });

  it('canonicalizes genre variants through the shared genre map', () => {
    const report = coverageV1Report();
    (report.coverage as Record<string, unknown>).genre = {
      primary: 'Science Fiction',
      secondary: '',
      tone: 'cold',
    };
    const result = normalizeCoverageV1Screenplay(report, 'Analysis');
    expect(result.genre).toBe('sci-fi');
    expect(result.subgenres).toEqual([]);
  });
});
