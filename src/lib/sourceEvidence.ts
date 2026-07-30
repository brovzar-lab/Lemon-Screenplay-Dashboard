import type {
  BrowserContextPolicy,
  BrowserPageEvidence,
  EvidenceModel,
  PageDiagnostic,
  RawCitationIssue,
  RawCitationQuality,
} from '@/types';

export const PAGE_EVIDENCE_VERSION = 'lemon-page-evidence-v1';
export const CONTEXT_POLICY_VERSION = 'lemon-context-policy-v1';
export const CITATION_EVIDENCE_VERSION = 'lemon-citation-evidence-v1';

const MIN_PAGE_WORDS = 3;
const MIN_PAGE_COVERAGE_RATIO = 0.8;
const MIN_EDGE_COVERAGE_RATIO = 0.7;
const EDGE_WINDOW_PAGES = 10;
const CONSERVATIVE_CHARACTERS_PER_TOKEN = 3;

const MODEL_CONTEXT_TOKENS = {
  haiku: 200_000,
  sonnet: 1_000_000,
  opus: 1_000_000,
} as const;

const MODEL_SAFE_INPUT_TOKENS = {
  haiku: 150_000,
  sonnet: 800_000,
  opus: 800_000,
} as const;

export class SourceContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceContextError';
  }
}

export class SourceEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceEvidenceError';
  }
}

function ratio(readable: number, total: number): number {
  return Math.round((readable / total) * 10_000) / 10_000;
}

export function buildBrowserPageEvidence(pages: string[]): BrowserPageEvidence {
  if (pages.length === 0) {
    throw new Error('The PDF has no physical pages.');
  }

  const normalizedPages = pages.map((page) =>
    String(page ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim(),
  );
  const diagnostics = normalizedPages.map((page, index): PageDiagnostic => {
    const words = page.split(/\s+/).filter(Boolean).length;
    return {
      page: index + 1,
      status: words === 0 ? 'empty' : words < MIN_PAGE_WORDS ? 'sparse' : 'readable',
      characters: page.length,
      words,
    };
  });
  const readablePages = new Set(
    diagnostics.filter((page) => page.status === 'readable').map((page) => page.page),
  );
  const edgeSize = Math.min(EDGE_WINDOW_PAGES, pages.length);
  const openingReadable = Array.from({ length: edgeSize }, (_, index) => index + 1)
    .filter((page) => readablePages.has(page)).length;
  const endingReadable = Array.from(
    { length: edgeSize },
    (_, index) => pages.length - edgeSize + index + 1,
  ).filter((page) => readablePages.has(page)).length;
  const coverageRatio = ratio(readablePages.size, pages.length);
  const openingCoverageRatio = ratio(openingReadable, edgeSize);
  const endingCoverageRatio = ratio(endingReadable, edgeSize);
  const issues: string[] = [];
  if (coverageRatio < MIN_PAGE_COVERAGE_RATIO) issues.push('insufficient_overall_page_text');
  if (openingCoverageRatio < MIN_EDGE_COVERAGE_RATIO) {
    issues.push('insufficient_opening_page_text');
  }
  if (endingCoverageRatio < MIN_EDGE_COVERAGE_RATIO) {
    issues.push('insufficient_ending_page_text');
  }

  return {
    pageEvidenceVersion: PAGE_EVIDENCE_VERSION,
    text: normalizedPages
      .map((page, index) => `[PAGE ${index + 1}]\n${page}`)
      .join('\n\n'),
    diagnostics,
    publicationReady: issues.length === 0,
    issues,
    coverageRatio,
    openingCoverageRatio,
    endingCoverageRatio,
  };
}

export function buildBrowserContextPolicy(
  text: string,
  primaryModel: EvidenceModel,
): BrowserContextPolicy {
  const estimatedInputTokens = Math.max(
    1,
    Math.ceil(text.length / CONSERVATIVE_CHARACTERS_PER_TOKEN),
  );
  const safeInputTokens = MODEL_SAFE_INPUT_TOKENS[primaryModel];
  if (estimatedInputTokens > safeInputTokens) {
    throw new SourceContextError(
      `This screenplay needs about ${estimatedInputTokens.toLocaleString()} input tokens, ` +
      `above the safe ${safeInputTokens.toLocaleString()}-token limit for ${primaryModel}.`,
    );
  }
  return {
    contextPolicyVersion: CONTEXT_POLICY_VERSION,
    sourceTruncated: false,
    inputCharacters: text.length,
    estimatedInputTokens,
    primaryModel,
    safeInputTokens,
    modelContextTokens: MODEL_CONTEXT_TOKENS[primaryModel],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Verify that reader scores point to physical pages that were actually
 * extracted. Scores of 7 or above require at least one page citation.
 *
 * This mirrors execution/source_evidence.py. Keep both versioned contracts in
 * lockstep because browser comparisons and permanent daemon analyses must fail
 * closed under the same evidence rules.
 */
export function validateBrowserAnalysisCitations(
  analysis: Record<string, unknown>,
  sourceEvidence: BrowserPageEvidence,
): RawCitationQuality {
  const diagnosticByPage = new Map(
    sourceEvidence.diagnostics.map((diagnostic) => [diagnostic.page, diagnostic]),
  );
  const invalidCitations: RawCitationIssue[] = [];
  const unverifiableCitations: RawCitationIssue[] = [];
  const malformedReaderMetrics: string[] = [];
  const missingRequiredCitations: string[] = [];
  const verifiedPages = new Set<number>();
  let totalCitations = 0;
  let highScoreItems = 0;

  const walk = (value: unknown, path: string[]): void => {
    if (Array.isArray(value)) {
      value.forEach((nested, index) => walk(nested, [...path, String(index)]));
      return;
    }
    if (!isRecord(value)) return;
    if (path.at(-1) === '_citation_quality') return;

    const isReaderMetricPath = path.some(
      (segment, index) =>
        segment === 'reader_reports'
        && path[index + 2] === 'sub_scores'
        && path.length === index + 4,
    );
    const score = value.score;
    const citations = value.page_citations;
    const hasNumericScore = typeof score === 'number' && Number.isFinite(score);

    if (isReaderMetricPath) {
      if (
        !hasNumericScore
        || typeof value.justification !== 'string'
        || value.justification.trim().length === 0
      ) {
        malformedReaderMetrics.push(path.join('.'));
      }
      if (hasNumericScore && score >= 7) {
        highScoreItems += 1;
        if (!Array.isArray(citations) || citations.length === 0) {
          missingRequiredCitations.push(path.join('.'));
        }
      }
    }

    if ('page_citations' in value) {
      if (!Array.isArray(citations)) {
        invalidCitations.push({
          path: path.join('.'),
          value: citations,
          reason: 'not_an_array',
        });
      } else {
        citations.forEach((citation) => {
          totalCitations += 1;
          if (
            typeof citation !== 'number'
            || !Number.isInteger(citation)
            || citation < 1
            || citation > sourceEvidence.diagnostics.length
          ) {
            invalidCitations.push({
              path: path.join('.'),
              value: citation,
              reason: 'outside_physical_page_range',
            });
            return;
          }
          const diagnostic = diagnosticByPage.get(citation);
          if (!diagnostic || diagnostic.status === 'empty') {
            unverifiableCitations.push({
              path: path.join('.'),
              page: citation,
              reason: 'page_has_no_extracted_evidence',
            });
            return;
          }
          verifiedPages.add(citation);
        });
      }
    }

    Object.entries(value).forEach(([key, nested]) => {
      if (key !== '_citation_quality') walk(nested, [...path, key]);
    });
  };

  walk(analysis, []);

  const issues: string[] = [];
  if (invalidCitations.length > 0) issues.push('invalid_page_citations');
  if (unverifiableCitations.length > 0) issues.push('unverifiable_page_citations');
  if (malformedReaderMetrics.length > 0) issues.push('malformed_reader_metrics');
  if (missingRequiredCitations.length > 0) {
    issues.push('high_scores_missing_page_citations');
  }

  return {
    citation_evidence_version: CITATION_EVIDENCE_VERSION,
    status: issues.length === 0 ? 'verified' : 'needs_review',
    page_count: sourceEvidence.diagnostics.length,
    total_citations: totalCitations,
    valid_citations: Math.max(
      0,
      totalCitations - invalidCitations.length - unverifiableCitations.length,
    ),
    verified_page_numbers: [...verifiedPages].sort((left, right) => left - right),
    high_score_items: highScoreItems,
    malformed_reader_metrics: [...malformedReaderMetrics].sort(),
    missing_required_citations: [...missingRequiredCitations].sort(),
    invalid_citations: invalidCitations,
    unverifiable_citations: unverifiableCitations,
    issues,
  };
}

export function attachVerifiedBrowserCitationQuality(
  analysis: Record<string, unknown>,
  sourceEvidence: BrowserPageEvidence,
): RawCitationQuality {
  const quality = validateBrowserAnalysisCitations(analysis, sourceEvidence);
  analysis._citation_quality = quality;
  if (quality.status !== 'verified') {
    throw new SourceEvidenceError(
      `Analysis citations need review: ${quality.issues.join(', ')}`,
    );
  }
  return quality;
}
