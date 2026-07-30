import { describe, expect, it } from 'vitest';
import {
  buildBrowserContextPolicy,
  buildBrowserPageEvidence,
  SourceContextError,
  validateBrowserAnalysisCitations,
} from '@/lib/sourceEvidence';

describe('browser source evidence', () => {
  it('preserves every physical page with deterministic markers', () => {
    const evidence = buildBrowserPageEvidence([
      'TITLE PAGE screenplay by writer',
      'INT. HOUSE - DAY A complete scene unfolds.',
      'EXT. STREET - NIGHT The ending resolves.',
    ]);

    expect(evidence.publicationReady).toBe(true);
    expect(evidence.text).toContain('[PAGE 1]');
    expect(evidence.text).toContain('[PAGE 2]');
    expect(evidence.text).toContain('[PAGE 3]');
    expect(evidence.diagnostics.map((page) => page.page)).toEqual([1, 2, 3]);
  });

  it('blocks a source whose ending pages were not extracted', () => {
    const evidence = buildBrowserPageEvidence([
      'TITLE PAGE screenplay by writer',
      'INT. HOUSE - DAY A complete scene unfolds.',
      '',
    ]);

    expect(evidence.publicationReady).toBe(false);
    expect(evidence.issues).toContain('insufficient_ending_page_text');
  });

  it('keeps a screenplay above the old cutoff intact for Sonnet', () => {
    const policy = buildBrowserContextPolicy('x'.repeat(195_001), 'sonnet');

    expect(policy.sourceTruncated).toBe(false);
    expect(policy.inputCharacters).toBe(195_001);
  });

  it('fails closed when Haiku cannot safely hold the complete script', () => {
    expect(() =>
      buildBrowserContextPolicy('x'.repeat(500_000), 'haiku'),
    ).toThrow(SourceContextError);
  });

  it('verifies physical-page citations for reader scores', () => {
    const source = buildBrowserPageEvidence([
      'TITLE PAGE screenplay by writer',
      'INT. HOUSE - DAY A midpoint reversal unfolds.',
      'EXT. STREET - NIGHT The ending resolves.',
    ]);
    const quality = validateBrowserAnalysisCitations(
      {
        reader_reports: {
          structure: {
            sub_scores: {
              midpoint: {
                score: 8,
                justification: 'The reversal changes the protagonist.',
                page_citations: [2],
              },
            },
          },
        },
      },
      source,
    );

    expect(quality.status).toBe('verified');
    expect(quality.verified_page_numbers).toEqual([2]);
  });

  it('blocks high reader scores without physical-page citations', () => {
    const source = buildBrowserPageEvidence([
      'TITLE PAGE screenplay by writer',
      'INT. HOUSE - DAY A midpoint reversal unfolds.',
      'EXT. STREET - NIGHT The ending resolves.',
    ]);
    const quality = validateBrowserAnalysisCitations(
      {
        reader_reports: {
          structure: {
            sub_scores: {
              midpoint: {
                score: 8,
                justification: 'The reversal changes the protagonist.',
              },
            },
          },
        },
      },
      source,
    );

    expect(quality.status).toBe('needs_review');
    expect(quality.issues).toContain('high_scores_missing_page_citations');
  });

  it('blocks citations outside the extracted physical pages', () => {
    const source = buildBrowserPageEvidence([
      'TITLE PAGE screenplay by writer',
      'INT. HOUSE - DAY A midpoint reversal unfolds.',
      'EXT. STREET - NIGHT The ending resolves.',
    ]);
    const quality = validateBrowserAnalysisCitations(
      {
        reader_reports: {
          structure: {
            sub_scores: {
              midpoint: {
                score: 8,
                justification: 'The reversal changes the protagonist.',
                page_citations: [99],
              },
            },
          },
        },
      },
      source,
    );

    expect(quality.status).toBe('needs_review');
    expect(quality.issues).toContain('invalid_page_citations');
  });

  it('cannot bypass the citation gate with a malformed high-score record', () => {
    const source = buildBrowserPageEvidence([
      'TITLE PAGE screenplay by writer',
      'INT. HOUSE - DAY A midpoint reversal unfolds.',
      'EXT. STREET - NIGHT The ending resolves.',
    ]);
    const quality = validateBrowserAnalysisCitations(
      {
        reader_reports: {
          structure: {
            sub_scores: {
              midpoint: {
                score: 8,
                page_citations: [],
              },
            },
          },
        },
      },
      source,
    );

    expect(quality.status).toBe('needs_review');
    expect(quality.issues).toContain('malformed_reader_metrics');
    expect(quality.issues).toContain('high_scores_missing_page_citations');
  });

  it('validates nested hybrid and boundary reader evidence', () => {
    const source = buildBrowserPageEvidence([
      'TITLE PAGE screenplay by writer',
      'INT. HOUSE - DAY A midpoint reversal unfolds.',
      'EXT. STREET - NIGHT The ending resolves.',
    ]);
    const quality = validateBrowserAnalysisCitations(
      {
        _hybrid_mode: {
          sonnet_analysis_evidence: {
            reader_reports: {
              structure: {
                sub_scores: {
                  midpoint: {
                    score: 8,
                    justification: 'The reversal changes the protagonist.',
                    page_citations: [],
                  },
                },
              },
            },
          },
        },
      },
      source,
    );

    expect(quality.status).toBe('needs_review');
    expect(quality.issues).toContain('high_scores_missing_page_citations');
  });
});
