/**
 * Tests for code-side verdict derivation (deriveVerdict / computeFailurePenalty).
 * Mirrors execution/test_verdict.py — the two implementations must agree.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import i18n from '@/i18n';
import { useToastStore } from '@/stores/toastStore';
import {
  attachPriorQualityEvidence,
  analyzeV9,
  callClaude,
  applyCanonicalReaderPillars,
  computeFailurePenalty,
  computeWeightedScoreFromSynthesis,
  deriveVerdict,
  QualityStageExhaustedError,
  ReaderPanelIncompleteError,
  notifyIncompleteReaderPanel,
  requireCompleteReaderPanel,
  runQualityStageWithRecovery,
  UnusableQualityOutputError,
  validateBrowserReaderReport,
  validateBrowserSynthesis,
  validateBrowserTriage,
} from './multiPassAnalysis';
import {
  attachVerifiedBrowserCitationQuality,
  buildBrowserPageEvidence,
} from './sourceEvidence';
import {
  READER_METRICS,
  type ReaderName,
} from './promptClient.v9';
import { validateBrowserGenreDetection } from './v9GenreContract';

const completeTrapEvaluation = [
  ['character_vacuum', 'fundamental', 1.0],
  ['complexity_theater', 'fundamental', 1.0],
  ['genre_confusion', 'fundamental', 1.0],
  ['ending_mirage', 'fundamental', 1.0],
  ['premise_execution_gap', 'addressable', 0.5],
  ['first_act_illusion', 'addressable', 0.5],
  ['originality_inflation', 'addressable', 0.5],
  ['dialogue_disguise', 'addressable', 0.5],
  ['tonal_whiplash', 'addressable', 0.5],
  ['sympathy_substitution', 'addressable', 0.5],
  ['second_lead_syndrome', 'warning', 0.0],
].map(([name, tier, weight]) => ({
  name,
  tier,
  weight,
  triggered: false,
  evidence: `${name} was checked against the reader reports.`,
}));

const readers = Object.keys(READER_METRICS) as ReaderName[];
const genreDetection = {
  external_genre: 'Society',
  is_comedy: false,
  comedy_paired_genre: null,
  comedy_subgenre: null,
  comedic_tone: false,
  internal_genre: 'Maturation',
  confidence: 'high' as const,
  one_line_why: 'The family conflict tests maturity on the page.',
};

describe('strict browser genre routing', () => {
  it('rejects non-enum primary and comedy-pairing labels', () => {
    for (const external_genre of ['Drama', 'Sci-Fi']) {
      expect(() => validateBrowserGenreDetection({
        ...genreDetection,
        external_genre,
      })).toThrow(/unknown external genre/i);
    }
    for (const comedy_paired_genre of ['Drama', 'Sci-Fi']) {
      expect(() => validateBrowserGenreDetection({
        ...genreDetection,
        external_genre: 'Comedy',
        is_comedy: true,
        comedy_paired_genre,
        comedy_subgenre: 'Rom-Com',
      })).toThrow(/paired genre/i);
    }
  });
});
const identifiedCharacters = {
  protagonist: 'Ana',
  protagonist_evidence: {
    kind: 'person',
    page_citations: [1],
    citation_evidence: [{ page: 1, excerpt: 'ANA enters the quiet house' }],
  },
  antagonist: 'Luis',
  antagonist_evidence: {
    kind: 'person',
    page_citations: [1],
    citation_evidence: [{ page: 1, excerpt: 'LUIS waits beside the window' }],
  },
  supporting: [],
  supporting_evidence: [],
};

function completeReaderReports(
  overrides: Partial<Record<string, number>> = {},
): Record<ReaderName, Record<string, unknown>> {
  return Object.fromEntries(readers.map((reader) => {
    const subScores = Object.fromEntries(READER_METRICS[reader].map((metric) => [
      metric,
      {
        score: overrides[`${reader}.${metric}`] ?? 7,
        justification: 'Evidence on page one.',
        page_citations: [1],
        citation_evidence: [{ page: 1, excerpt: 'INT. HOUSE - DAY' }],
      },
    ]));
    const scores = Object.values(subScores).map((metric) => metric.score);
    return [reader, {
      reader,
      sub_scores: subScores,
      pillar_score: Math.round(
        (scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100,
      ) / 100,
      ...(reader === 'character' ? {
        story_vs_situation: {
          human_condition: true,
          tests_character: true,
          twists_reveal_character: true,
          emotional_shift: true,
          moral_component_driven: true,
          evidence: Object.fromEntries([
            'human_condition',
            'tests_character',
            'twists_reveal_character',
            'emotional_shift',
            'moral_component_driven',
          ].map((field) => [field, {
            page_citations: [1],
            citation_evidence: [{ page: 1, excerpt: 'INT. HOUSE - DAY' }],
          }])),
          total: 5,
          verdict: 'story',
        },
      } : {}),
    }];
  })) as Record<ReaderName, Record<string, unknown>>;
}

function validateSynthesis(
  synthesis: Record<string, unknown>,
  readerReports = completeReaderReports(),
): void {
  validateBrowserSynthesis(
    synthesis,
    readerReports,
    'Complete Draft',
    'Writer',
    genreDetection,
  );
}

describe('partial reader notification', () => {
  beforeEach(() => {
    useToastStore.getState().clearToasts();
  });

  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it.each([
    {
      language: 'en',
      completed: 4,
      missing: ['emotional_resonance'] as const,
      expected:
        'Analysis needs review: 4 of 5 readers completed. No score or verdict was produced. Missing: emotional_resonance.',
    },
    {
      language: 'es',
      completed: 3,
      missing: ['craft_scene', 'concept'] as const,
      expected:
        'El análisis requiere revisión: terminaron 3 de 5 lectores. No se generó una calificación ni un veredicto. Faltan: craft_scene, concept.',
    },
  ])('preserves reader identifiers in $language', async ({
    language,
    completed,
    missing,
    expected,
  }) => {
    await i18n.changeLanguage(language);

    notifyIncompleteReaderPanel(completed, missing);

    expect(useToastStore.getState().toasts[0]?.message).toBe(expected);
  });
});

describe('Q3 five-reader reliability', () => {
  it('does not retry an ambiguous browser transport failure', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockRejectedValue(
      new TypeError('connection dropped after dispatch'),
    );
    globalThis.fetch = fetchMock;
    try {
      await expect(callClaude('system', 'screenplay', 'sonnet', 100, 3))
        .rejects.toThrow(/network error connecting to ai proxy/i);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects partial or extra browser reader metric sets', () => {
    const reports = completeReaderReports();
    const structure = reports.structure;
    const subScores = structure.sub_scores as Record<string, unknown>;
    delete subScores.middle_build;
    expect(() => validateBrowserReaderReport('structure', structure)).toThrow(
      /incomplete metric set/i,
    );

    const extra = completeReaderReports().structure;
    (extra.sub_scores as Record<string, unknown>).invented_metric = {
      score: 7,
      page_citations: [],
      citation_evidence: [],
    };
    expect(() => validateBrowserReaderReport('structure', extra)).toThrow(
      /incomplete metric set/i,
    );
  });

  it('derives the story-vs-situation gate from five booleans', () => {
    const character = completeReaderReports().character;
    const originalStory = character.story_vs_situation as Record<string, unknown>;
    character.story_vs_situation = {
      human_condition: true,
      tests_character: true,
      twists_reveal_character: false,
      emotional_shift: false,
      moral_component_driven: false,
      evidence: originalStory.evidence,
      total: 5,
      verdict: 'story',
    };

    validateBrowserReaderReport('character', character);

    expect(character.story_vs_situation).toMatchObject({
      total: 2,
      verdict: 'situation',
    });
  });

  it('accepts an exact three-word excerpt through final physical validation', () => {
    const reports = completeReaderReports();
    const structure = reports.structure.sub_scores as Record<string, Record<string, unknown>>;
    structure.first_ten_pages.citation_evidence = [{
      page: 1,
      excerpt: 'ANA enters quietly',
    }];

    validateBrowserReaderReport('structure', reports.structure);
    const analysis: Record<string, unknown> = { reader_reports: reports };
    const sourceEvidence = buildBrowserPageEvidence([
      'ANA enters quietly. INT. HOUSE - DAY. LUIS waits beside the window.',
    ]);

    expect(attachVerifiedBrowserCitationQuality(analysis, sourceEvidence).status)
      .toBe('verified');
  });

  it('rejects a semantically empty browser genre read', () => {
    expect(() => validateBrowserTriage({
      triage_score: 6,
      verdict: 'CONSIDER',
      genre: '',
      genre_detection: { ...genreDetection, external_genre: 'BANANA' },
      logline: 'A family confronts a buried secret.',
      should_deep_analyze: true,
    })).toThrow(/genre/i);
    const valid = {
      triage_score: 6,
      verdict: 'consider',
      genre: 'Drama',
      genre_detection: genreDetection,
      logline: 'A family confronts a buried secret.',
      should_deep_analyze: false,
    };
    expect(() => validateBrowserTriage(valid)).not.toThrow();
    expect(valid).toMatchObject({
      verdict: 'CONSIDER',
      should_deep_analyze: true,
    });
    expect(() => validateBrowserTriage({
      ...valid,
      verdict: 'BANANA',
    })).toThrow(/verdict/i);
    expect(() => validateBrowserTriage({
      ...valid,
      genre_detection: { ...genreDetection, is_comedy: true },
    })).toThrow(/comedy flag/i);
    expect(() => validateBrowserTriage({
      ...valid,
      genre_detection: {
        ...genreDetection,
        external_genre: 'Comedy',
        is_comedy: false,
      },
    })).toThrow(/comedy flag/i);
  });

  it('binds the cold read and every full-panel call to exact stage provenance', async () => {
    const page = 'INT. HOUSE - DAY ANA enters the quiet house. LUIS waits beside the window.';
    const sourceEvidence = buildBrowserPageEvidence([page]);
    const readerReports = completeReaderReports();
    const synthesis = {
      analysis_version: 'v9_archaeology',
      title: 'Complete Draft',
      author: 'Not found on title page',
      genre: 'Drama',
      subgenres: [],
      themes: ['Trust', 'Family'],
      tone: 'Grounded',
      logline: 'A family confronts a buried secret.',
      pillar_scores: Object.fromEntries(readers.map((reader) => [reader, { score: 7 }])),
      weighted_score: 7,
      verdict: 'CONSIDER',
      verdict_before_adjustments: 'CONSIDER',
      critical_failures: [],
      critical_failure_total_penalty: 0,
      story_vs_situation: { score: 5, verdict: 'story', gate_applied: false },
      false_positive_check: {
        traps_evaluated: completeTrapEvaluation,
        weighted_trap_score: 0,
        verdict_adjustment: 'none',
      },
      strengths: ['One', 'Two', 'Three', 'Four'],
      weaknesses: ['A repairable weakness.'],
      executive_summary: 'A complete decision summary.',
      comparable_films: {
        tone: { title: 'Film A', structural_match: 'Tone.', key_divergence: 'Scale.' },
        structure: { title: 'Film B', structural_match: 'Build.', key_divergence: 'Ending.' },
        market: { title: 'Film C', structural_match: 'Audience.', key_divergence: 'Budget.' },
      },
      characters: structuredClone(identifiedCharacters),
    };
    const triage = {
      triage_score: 7,
      verdict: 'CONSIDER',
      genre_detection: genreDetection,
      logline: 'A family confronts a buried secret.',
      should_deep_analyze: true,
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ content: string }>;
      };
      const prompt = body.messages.map((message) => message.content).join('\n');
      const reader = readers.find((name) => prompt.includes(`"reader": "${name}"`));
      const isSynthesis = prompt.includes('SYNTHESIS INSTRUCTIONS');
      const output = body.model.includes('haiku')
        ? triage
        : isSynthesis
          ? synthesis
          : reader
            ? readerReports[reader]
            : null;
      if (!output) throw new Error('Unexpected V9 test prompt.');
      const responseId = body.model.includes('haiku')
        ? 'msg_triage'
        : isSynthesis
          ? 'msg_synthesis'
          : `msg_${reader}`;
      return new Response(JSON.stringify({
        text: JSON.stringify(output),
        response_id: responseId,
        model: body.model,
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          actual_cost_microusd: 10,
          actual_cost_usd: 0.00001,
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      const result = await analyzeV9({
        title: 'Complete Draft',
        text: sourceEvidence.text,
        pageCount: 1,
        wordCount: sourceEvidence.diagnostics[0].words,
        truncated: false,
        sourceEvidence,
      }, { mode: 'full', model: 'sonnet', lenses: [] });
      if (!('analysis' in result)) throw new Error('Expected a complete V9 result.');

      expect(result.analysis._cold_read).toEqual({
        used_in_synthesis: true,
        evidence: {
          triage_score: 7,
          verdict: 'consider',
          genre: 'Society',
          logline: 'A family confronts a buried secret.',
          model_route: 'haiku',
        },
        response_ids: ['msg_triage'],
      });
      expect(result.provenance).toHaveLength(7);
      expect(result.provenance[0]).toMatchObject({
        responseId: 'msg_triage',
        stage: 'triage',
        reader_name: null,
        attempt: 1,
        disposition: 'used',
      });
      expect(result.provenance.filter((call) => call.stage === 'reader')).toEqual(
        expect.arrayContaining(readers.map((reader) => expect.objectContaining({
          responseId: `msg_${reader}`,
          reader_name: reader,
          attempt: 1,
          disposition: 'used',
        }))),
      );
      expect(result.provenance.at(-1)).toMatchObject({
        responseId: 'msg_synthesis',
        stage: 'synthesis',
        reader_name: null,
        attempt: 1,
        disposition: 'used',
      });
      expect(result.totalUsage).toMatchObject({
        input_tokens: 70,
        output_tokens: 35,
        actual_cost_microusd: 70,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('retries only the failed quality stage and returns the recovered result', async () => {
    let attempt = 0;
    const result = await runQualityStageWithRecovery(
      'character reader',
      async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new UnusableQualityOutputError(
            'malformed report',
            { input_tokens: 100, output_tokens: 20, actual_cost_microusd: 700 },
            {
              responseId: 'msg_discarded',
              requestedModel: 'claude-sonnet-4-6',
              returnedModel: 'claude-sonnet-4-6',
              stopReason: 'end_turn',
              stage: 'reader',
              reader_name: 'character',
              attempt: 1,
              disposition: 'discarded_unusable',
              usage: { input_tokens: 100, output_tokens: 20, actual_cost_microusd: 700 },
            },
          );
        }
        return {
          value: 'complete',
          usage: { input_tokens: 110, output_tokens: 25, actual_cost_microusd: 800 },
        };
      },
      { delay: async () => undefined },
    );

    expect(result.value).toBe('complete');
    expect(result.attempts).toBe(2);
    expect(result.failures).toEqual(['malformed report']);
    expect(result.usage).toEqual({
      input_tokens: 210,
      output_tokens: 45,
      actual_cost_microusd: 1500,
    });
    expect(result.discardedProvenance).toEqual([
      expect.objectContaining({
        responseId: 'msg_discarded',
        disposition: 'discarded_unusable',
        usage: expect.objectContaining({ actual_cost_microusd: 700 }),
      }),
    ]);
    expect(result.successfulUsage).toEqual(expect.objectContaining({
      actual_cost_microusd: 800,
    }));
  });

  it('fails closed after three unusable results', async () => {
    const run = runQualityStageWithRecovery(
      'concept reader',
      async () => {
        throw new UnusableQualityOutputError(
          'missing structured report',
          { input_tokens: 10, output_tokens: 1 },
        );
      },
      { delay: async () => undefined },
    );

    await expect(run).rejects.toMatchObject({
      name: 'QualityStageExhaustedError',
      stage: 'concept reader',
      attempts: 3,
      failures: [
        'missing structured report',
        'missing structured report',
        'missing structured report',
      ],
      usage: { input_tokens: 30, output_tokens: 3 },
    } satisfies Partial<QualityStageExhaustedError>);
  });

  it('does not repeat a transport, authentication, or budget error', async () => {
    let attempts = 0;
    const run = runQualityStageWithRecovery(
      'structure reader',
      async () => {
        attempts += 1;
        throw new Error('Rate limited');
      },
      { delay: async () => undefined },
    );

    await expect(run).rejects.toThrow('Rate limited');
    expect(attempts).toBe(1);
  });

  it('preserves earlier paid unusable output when a later attempt fails in transport', async () => {
    let attempt = 0;
    const transportError = new Error('Budget ledger unavailable') as Error & {
      usage?: { input_tokens: number; output_tokens: number; actual_cost_microusd?: number };
      provenance?: Array<{ responseId: string; disposition: string }>;
      qualityAttempts?: number;
    };
    const run = runQualityStageWithRecovery(
      'structure reader',
      async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new UnusableQualityOutputError(
            'malformed report',
            { input_tokens: 100, output_tokens: 20, actual_cost_microusd: 700 },
            {
              responseId: 'msg_paid_unusable',
              requestedModel: 'claude-sonnet-4-6',
              returnedModel: 'claude-sonnet-4-6',
              stopReason: 'end_turn',
              stage: 'reader',
              reader_name: 'structure',
              attempt: 1,
              disposition: 'discarded_unusable',
              usage: { input_tokens: 100, output_tokens: 20, actual_cost_microusd: 700 },
            },
          );
        }
        throw transportError;
      },
      { delay: async () => undefined },
    );

    await expect(run).rejects.toBe(transportError);
    expect(transportError.usage).toEqual(expect.objectContaining({
      input_tokens: 100,
      output_tokens: 20,
      actual_cost_microusd: 700,
    }));
    expect(transportError.provenance).toEqual([
      expect.objectContaining({
        responseId: 'msg_paid_unusable',
        disposition: 'discarded_unusable',
      }),
    ]);
    expect(transportError.qualityAttempts).toBe(2);
  });

  it('attaches all five paid reader calls when the citation gate fails', () => {
    const citationError = new Error('Citation evidence does not match source');
    const provenance = Array.from({ length: 5 }, (_, index) => ({
      responseId: `msg_reader_${index + 1}`,
      requestedModel: 'claude-sonnet-4-6',
      returnedModel: 'claude-sonnet-4-6',
      stopReason: 'end_turn',
      stage: 'reader' as const,
      reader_name: readers[index],
      attempt: 1,
      disposition: 'used' as const,
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        actual_cost_microusd: 700,
      },
    }));

    attachPriorQualityEvidence(
      citationError,
      { input_tokens: 500, output_tokens: 100, actual_cost_microusd: 3_500 },
      provenance,
    );

    expect(citationError).toMatchObject({
      usage: {
        input_tokens: 500,
        output_tokens: 100,
        actual_cost_microusd: 3_500,
      },
      provenance,
    });
  });

  it('does not allow synthesis from fewer than all five canonical readers', () => {
    const run = () => requireCompleteReaderPanel(
      [
        'structure',
        'character',
        'craft_scene',
        'concept',
      ],
      {
        emotional_resonance: {
          attempts: 3,
          failures: ['missing structured report'],
        },
      },
      { input_tokens: 300, output_tokens: 60 },
    );

    expect(run).toThrow(/5\/5 readers/i);
    try {
      run();
    } catch (error) {
      expect(error).toMatchObject({
        name: 'ReaderPanelIncompleteError',
        completedReaders: [
          'structure',
          'character',
          'craft_scene',
          'concept',
        ],
        failedReaders: ['emotional_resonance'],
        usage: { input_tokens: 300, output_tokens: 60 },
      } satisfies Partial<ReaderPanelIncompleteError>);
    }

    expect(() => requireCompleteReaderPanel([
      'structure',
      'character',
      'craft_scene',
      'concept',
      'emotional_resonance',
    ])).not.toThrow();
  });

  it('requires the critical-failure and story gate inputs before synthesis', () => {
    const synthesis = {
      analysis_version: 'v9_archaeology',
      title: 'Complete Draft',
      author: 'Writer',
      genre: 'Drama',
      subgenres: [],
      themes: ['Trust', 'Family'],
      tone: 'Grounded',
      logline: 'A family confronts a buried secret.',
      pillar_scores: {
        structure: { score: 8 },
        character: { score: 7 },
        craft_scene: { score: 7 },
        concept: { score: 8 },
        emotional_resonance: { score: 7 },
      },
      weighted_score: 7.45,
      verdict: 'CONSIDER',
      verdict_before_adjustments: 'CONSIDER',
      critical_failures: [],
      critical_failure_total_penalty: 0,
      story_vs_situation: { score: 4, verdict: 'story', gate_applied: false },
      false_positive_check: {
        traps_evaluated: completeTrapEvaluation,
        weighted_trap_score: 0,
        verdict_adjustment: 'none',
      },
      strengths: ['One', 'Two', 'Three', 'Four'],
      weaknesses: ['A repairable weakness.'],
      executive_summary: 'A complete decision summary.',
      comparable_films: {
        tone: { title: 'Film A', structural_match: 'Tone.', key_divergence: 'Scale.' },
        structure: { title: 'Film B', structural_match: 'Build.', key_divergence: 'Ending.' },
        market: { title: 'Film C', structural_match: 'Audience.', key_divergence: 'Budget.' },
      },
      characters: structuredClone(identifiedCharacters),
    };

    expect(() => validateSynthesis(synthesis)).not.toThrow();
    const fabricatedIdentity = {
      ...synthesis,
      title: 'Different Screenplay',
      author: 'Invented Writer',
      verdict_before_adjustments: 'PASS',
    };
    validateSynthesis(fabricatedIdentity);
    expect(fabricatedIdentity.title).toBe('Complete Draft');
    expect(fabricatedIdentity.author).toBe('Writer');
    expect(fabricatedIdentity.verdict_before_adjustments).toBe('CONSIDER');
    expect(() => validateSynthesis({
      ...synthesis,
      critical_failures: undefined,
    })).toThrow(/critical failures/i);
    expect(() => validateSynthesis({
      ...synthesis,
      story_vs_situation: { verdict: 'unknown' },
    })).toThrow(/story-vs-situation verdict/i);
    expect(() => validateBrowserSynthesis(
      { ...synthesis },
      completeReaderReports(),
      'Complete Draft',
      'Writer',
      undefined as unknown as typeof genreDetection,
    )).toThrow(/genre detection/i);

    expect(() => validateSynthesis({
      ...synthesis,
      themes: ['', ' '],
    })).toThrow(/themes/i);
    expect(() => validateSynthesis({
      ...synthesis,
      strengths: ['', ' ', '\t', '\n'],
    })).toThrow(/strengths/i);
    expect(() => validateSynthesis({
      ...synthesis,
      weaknesses: [],
    })).toThrow(/weaknesses/i);
    expect(() => validateSynthesis({
      ...synthesis,
      false_positive_check: {
        traps_evaluated: [],
        weighted_trap_score: 0,
        verdict_adjustment: 'none',
      },
    })).toThrow(/false-positive traps/i);

    const inventedCharacter = structuredClone(synthesis);
    (inventedCharacter.characters as Record<string, unknown>).protagonist = 'Invented Person';
    expect(() => validateSynthesis(inventedCharacter)).toThrow(/absent from its evidence/i);
  });

  it('recomputes trap and failure penalties from validated evidence', () => {
    const synthesis = {
      analysis_version: 'v9_archaeology',
      title: 'Complete Draft',
      author: 'Writer',
      genre: 'Drama',
      subgenres: [],
      themes: ['Trust', 'Family'],
      tone: 'Grounded',
      logline: 'A family confronts a buried secret.',
      pillar_scores: {
        structure: { score: 8 },
        character: { score: 7 },
        craft_scene: { score: 7 },
        concept: { score: 8 },
        emotional_resonance: { score: 7 },
      },
      weighted_score: 7.45,
      verdict: 'CONSIDER',
      verdict_before_adjustments: 'CONSIDER',
      critical_failures: [{
        weakness_index: 0,
        reader: 'structure',
        metric: 'beat_timing',
        description: 'Act three breaks causality.',
        severity: 'major',
        penalty: 99,
      }],
      critical_failure_total_penalty: 99,
      story_vs_situation: { score: 4, verdict: 'story', gate_applied: true },
      false_positive_check: {
        traps_evaluated: completeTrapEvaluation.map((trap, index) => ({
          ...trap,
          triggered: index === 0 || index === 4,
        })),
        weighted_trap_score: 99,
        verdict_adjustment: 'cap_consider',
      },
      strengths: ['One', 'Two', 'Three', 'Four'],
      weaknesses: ['Act three breaks causality.', 'The midpoint turn arrives late.'],
      executive_summary: 'A complete decision summary.',
      comparable_films: {
        tone: { title: 'Film A', structural_match: 'Tone.', key_divergence: 'Scale.' },
        structure: { title: 'Film B', structural_match: 'Build.', key_divergence: 'Ending.' },
        market: { title: 'Film C', structural_match: 'Audience.', key_divergence: 'Budget.' },
      },
      characters: structuredClone(identifiedCharacters),
    };

    const conceptOverrides = Object.fromEntries(
      READER_METRICS.concept.map((metric) => [`concept.${metric}`, 9]),
    );
    const readerReports = completeReaderReports({
      ...conceptOverrides,
      'structure.beat_timing': 2,
      'character.star_role_potential': 4,
      'character.supporting_cast_function': 4,
    });
    validateSynthesis(synthesis, readerReports);

    expect(synthesis.false_positive_check.weighted_trap_score).toBe(1.5);
    expect(synthesis.false_positive_check.verdict_adjustment).toBe('none');
    expect(synthesis.story_vs_situation.gate_applied).toBe(false);
    expect(synthesis.critical_failures[0].penalty).toBe(0.8);
    expect(synthesis.critical_failure_total_penalty).toBe(0.8);

    const equalSet = structuredClone(synthesis);
    equalSet.weaknesses = ['Act three breaks causality.'];
    expect(() => validateSynthesis(equalSet, readerReports)).toThrow(/strict subset/i);

    synthesis.critical_failures[0].description = 'Invented fatal issue.';
    expect(() => validateSynthesis(synthesis, readerReports)).toThrow(/linked to a unique weakness/i);
  });
});

describe('complete-panel score integrity', () => {
  it('replaces fabricated synthesis pillars with validated reader scores', () => {
    const synthesis = {
      pillar_scores: Object.fromEntries(readers.map((reader) => [
        reader,
        { score: 10, weight: 0 },
      ])),
    };
    const readerReports = completeReaderReports(
      Object.fromEntries(readers.flatMap((reader) => (
        READER_METRICS[reader].map((metric) => [`${reader}.${metric}`, 4])
      ))),
    );

    applyCanonicalReaderPillars(synthesis, readerReports);

    expect(computeWeightedScoreFromSynthesis(synthesis)).toBe(4);
    expect(synthesis.pillar_scores).toEqual({
      structure: { score: 4, weight: 0.3 },
      character: { score: 4, weight: 0.3 },
      craft_scene: { score: 4, weight: 0.15 },
      concept: { score: 4, weight: 0.15 },
      emotional_resonance: { score: 4, weight: 0.1 },
    });
  });

  it('computes the canonical score only across all five readers', () => {
    const synthesis = {
      pillar_scores: {
        structure: { score: 8 },
        character: { score: 6 },
        craft_scene: { score: 7 },
        concept: { score: 9 },
        emotional_resonance: { score: 5 },
      },
    };

    expect(computeWeightedScoreFromSynthesis(synthesis)).toBe(7.1);
  });

  it('rejects missing reader scores instead of reweighting a partial panel', () => {
    expect(() => computeWeightedScoreFromSynthesis({
      pillar_scores: {
        structure: { score: 8 },
        character: { score: 6 },
        craft_scene: { score: 7 },
        concept: { score: 9 },
      },
    })).toThrow(/emotional_resonance/);
  });
});

function failures(...severities: string[]) {
  return severities.map((s) => ({ description: 'x', severity: s, penalty: 0 }));
}

describe('computeFailurePenalty', () => {
  it('returns 0 for empty or malformed input', () => {
    expect(computeFailurePenalty(null)).toBe(0);
    expect(computeFailurePenalty([])).toBe(0);
    expect(computeFailurePenalty('nope')).toBe(0);
    expect(computeFailurePenalty(['not-an-object', 42])).toBe(0);
  });

  it('maps severities to prompt penalties', () => {
    expect(computeFailurePenalty(failures('minor'))).toBe(0.3);
    expect(computeFailurePenalty(failures('moderate'))).toBe(0.5);
    expect(computeFailurePenalty(failures('major'))).toBe(0.8);
    expect(computeFailurePenalty(failures('critical'))).toBe(1.2);
    expect(computeFailurePenalty(failures('CRITICAL'))).toBe(1.2);
  });

  it('sums and caps at 3.0', () => {
    expect(computeFailurePenalty(failures('critical', 'major'))).toBe(2.0);
    expect(computeFailurePenalty(failures('critical', 'critical', 'critical'))).toBe(3.0);
  });

  it('ignores unknown severities', () => {
    expect(computeFailurePenalty(failures('catastrophic'))).toBe(0);
  });
});

describe('deriveVerdict thresholds', () => {
  const tier = (score: number) => deriveVerdict({ weightedScore: score }).verdict;

  it('applies the synthesis-prompt boundaries', () => {
    expect(tier(5.49)).toBe('PASS');
    expect(tier(5.5)).toBe('CONSIDER');
    expect(tier(7.49)).toBe('CONSIDER');
    expect(tier(7.5)).toBe('RECOMMEND');
    expect(tier(8.49)).toBe('RECOMMEND');
    expect(tier(8.5)).toBe('FILM_NOW');
    expect(tier(0)).toBe('PASS');
  });
});

describe('deriveVerdict — the penalty-restored bug', () => {
  it('a critical failure pulls a borderline RECOMMEND down to CONSIDER', () => {
    const result = deriveVerdict({
      weightedScore: 7.5,
      criticalFailures: failures('critical'),
    });
    expect(result.adjustedScore).toBe(6.3);
    expect(result.verdict).toBe('CONSIDER');
    expect(result.penalty).toBe(1.2);
    expect(result.adjustments.some((a) => a.includes('critical_failure_penalty'))).toBe(true);
  });

  it('no failures leaves the score untouched', () => {
    const result = deriveVerdict({ weightedScore: 7.5 });
    expect(result.adjustedScore).toBe(7.5);
    expect(result.verdict).toBe('RECOMMEND');
    expect(result.adjustments).toEqual([]);
  });
});

describe('deriveVerdict gates', () => {
  it('situation verdict caps at CONSIDER', () => {
    const result = deriveVerdict({ weightedScore: 9.0, situationVerdict: 'situation' });
    expect(result.verdict).toBe('CONSIDER');
    expect(result.verdictBeforeGates).toBe('FILM_NOW');
  });

  it('situation never raises a PASS', () => {
    expect(deriveVerdict({ weightedScore: 4.0, situationVerdict: 'situation' }).verdict).toBe('PASS');
  });

  it('story verdict applies no gate', () => {
    expect(deriveVerdict({ weightedScore: 9.0, situationVerdict: 'story' }).verdict).toBe('FILM_NOW');
  });

  it('trap score >= 2.0 downgrades one tier', () => {
    expect(deriveVerdict({ weightedScore: 9.0, weightedTrapScore: 2.0 }).verdict).toBe('RECOMMEND');
    expect(deriveVerdict({ weightedScore: 7.6, weightedTrapScore: 2.5 }).verdict).toBe('CONSIDER');
    expect(deriveVerdict({ weightedScore: 4.0, weightedTrapScore: 2.0 }).verdict).toBe('PASS');
  });

  it('trap score >= 3.0 caps at CONSIDER', () => {
    expect(deriveVerdict({ weightedScore: 9.0, weightedTrapScore: 3.0 }).verdict).toBe('CONSIDER');
    expect(deriveVerdict({ weightedScore: 9.0, weightedTrapScore: 3.5 }).verdict).toBe('CONSIDER');
  });

  it('truncation caps at CONSIDER — never promote an unread Act 3', () => {
    const result = deriveVerdict({ weightedScore: 9.0, truncated: true });
    expect(result.verdict).toBe('CONSIDER');
    expect(result.adjustments.some((a) => a.includes('truncated'))).toBe(true);
  });

  it('truncation leaves a PASS alone', () => {
    const result = deriveVerdict({ weightedScore: 4.0, truncated: true });
    expect(result.verdict).toBe('PASS');
    expect(result.adjustments).toEqual([]);
  });
});

describe('deriveVerdict combined', () => {
  it('penalty applies before gates', () => {
    // 8.6 - 0.8 (major) = 7.8 RECOMMEND, then trap 2.0 downgrades → CONSIDER
    const result = deriveVerdict({
      weightedScore: 8.6,
      criticalFailures: failures('major'),
      weightedTrapScore: 2.0,
    });
    expect(result.adjustedScore).toBe(7.8);
    expect(result.verdict).toBe('CONSIDER');
    expect(result.adjustments).toHaveLength(2);
  });
});
