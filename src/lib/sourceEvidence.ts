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
export const CITATION_EVIDENCE_VERSION = 'lemon-citation-evidence-v2';
export const CITATION_MATCH_POLICY_VERSION = 'lemon-citation-match-revision-safe-v1';
export const TITLE_PAGE_AUTHOR_EVIDENCE_VERSION = 'lemon-title-page-author-v1';
export const AUTHOR_NOT_FOUND = 'Not found on title page';
export const MIN_CITATION_EXCERPT_WORDS = 3;

const MIN_PAGE_WORDS = 3;
const MIN_PAGE_COVERAGE_RATIO = 0.8;
const MIN_EDGE_COVERAGE_RATIO = 0.7;
const EDGE_WINDOW_PAGES = 10;
const CONSERVATIVE_CHARACTERS_PER_TOKEN = 3;
const PAGE_MARKER_LINE = /^\[PAGE [1-9][0-9]*\][ \t]*$/m;

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
  normalizedPages.forEach((page, index) => {
    if (PAGE_MARKER_LINE.test(page)) {
      throw new SourceEvidenceError(
        `Physical page ${index + 1} contains reserved page-marker text.`,
      );
    }
  });
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

function normalizeEvidenceText(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeRevisionSafeEvidenceText(value: string): string {
  const lines = value.normalize('NFKC')
    .replace(/[\u2018\u2019\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e]/g, '"')
    .split(/\r\n?|\n/);
  const trailingRevisionMark = (line: string): boolean => (
    line.lastIndexOf('*') >= 50 && /[ \t]+\*[ \t]*$/.test(line)
  );
  const hasRevisionLayout = (
    lines.filter((line) => line.trim() === '*').length >= 2
    && lines.some(trailingRevisionMark)
  );
  const normalized = hasRevisionLayout
    ? lines.map((line) => (
      line.trim() === '*'
        ? ''
        : trailingRevisionMark(line)
          ? line.replace(/[ \t]+\*[ \t]*$/, '')
          : line
    ))
    : lines;
  return normalized.join('\n').toLowerCase().replace(/\s+/g, ' ').trim();
}

function evidenceWords(value: string): string[] {
  return normalizeEvidenceText(value).match(/[\p{L}\p{N}_]+/gu) ?? [];
}

function containsNormalizedExcerpt(normalizedPage: string, normalizedExcerpt: string): boolean {
  const wordCharacter = /[\p{L}\p{N}_]/u;
  let start = 0;
  while (start <= normalizedPage.length - normalizedExcerpt.length) {
    const index = normalizedPage.indexOf(normalizedExcerpt, start);
    if (index < 0) return false;
    const end = index + normalizedExcerpt.length;
    const before = normalizedPage[index - 1] ?? '';
    const after = normalizedPage[end] ?? '';
    if (!wordCharacter.test(before) && !wordCharacter.test(after)) return true;
    start = index + 1;
  }
  return false;
}

function evidenceExcerptMatchKind(
  pageText: string,
  excerpt: string,
): 'exact' | 'revision_safe' | null {
  if (evidenceWords(excerpt).length < MIN_CITATION_EXCERPT_WORDS) return null;
  if (containsNormalizedExcerpt(
    normalizeEvidenceText(pageText),
    normalizeEvidenceText(excerpt),
  )) return 'exact';
  if (containsNormalizedExcerpt(
    normalizeRevisionSafeEvidenceText(pageText),
    normalizeRevisionSafeEvidenceText(excerpt),
  )) return 'revision_safe';
  return null;
}

function markedPageContents(text: string): Map<number, string> {
  const matches = [...text.matchAll(/^\[PAGE ([1-9][0-9]*)\][ \t]*$/gm)];
  if (matches.some((match, index) => Number(match[1]) !== index + 1)) {
    throw new SourceEvidenceError('Screenplay page markers are duplicated or out of sequence.');
  }
  return new Map(matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    return [Number(match[1]), text.slice(start, end).trim()];
  }));
}

export interface TitlePageAuthorEvidence {
  title_page_author_evidence_version: string;
  status: 'found' | 'not_found';
  author: string;
  page: 1;
  cue: string | null;
}

const AUTHOR_CUE = /(?:^|\s)(written(?:\s+and\s+directed)?\s+by|screenplay\s+by|script\s+by|gui[oó]n(?:\s+cinematogr[aá]fico)?\s+(?:de|por)|escrit[oa]\s+por|autor(?:a)?(?:es)?\s*:)\s*/iu;
const AUTHOR_STOP = /\b(?:based\s+on|contact|e-?mail|phone|tel(?:ephone|éfono)?|draft|revision|revised|copyright|all\s+rights\s+reserved)\b|©/iu;

function cleanAuthorCandidate(raw: string): string | null {
  const candidate = raw
    .split(AUTHOR_STOP, 1)[0]
    .replace(/^[\s:,&\-–—]+|[\s:,&\-–—]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const words = candidate.split(/\s+/).filter(Boolean);
  if (
    candidate.length === 0
    || candidate.length > 120
    || words.length > 12
    || !/[\p{L}]{2}/u.test(candidate)
    || /@|https?:|www\.|\d{3}/iu.test(candidate)
  ) {
    return null;
  }
  return candidate;
}

/** Conservatively extract only an explicit page-one screenplay byline. */
export function extractTitlePageAuthor(text: string): TitlePageAuthorEvidence {
  const lines = (markedPageContents(text).get(1) ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const cueMatch = line.match(AUTHOR_CUE);
    const isBareByline = /^by\s*:?$/i.test(line);
    if (!cueMatch && !isBareByline) continue;
    const rawCandidate = cueMatch
      ? line.slice((cueMatch.index ?? 0) + cueMatch[0].length)
      : '';
    const author = cleanAuthorCandidate(rawCandidate)
      ?? cleanAuthorCandidate(lines[index + 1] ?? '');
    if (author) {
      return {
        title_page_author_evidence_version: TITLE_PAGE_AUTHOR_EVIDENCE_VERSION,
        status: 'found',
        author,
        page: 1,
        cue: cueMatch?.[1] ?? 'by',
      };
    }
  }
  return {
    title_page_author_evidence_version: TITLE_PAGE_AUTHOR_EVIDENCE_VERSION,
    status: 'not_found',
    author: AUTHOR_NOT_FOUND,
    page: 1,
    cue: null,
  };
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
  const unsupportedCitations: RawCitationIssue[] = [];
  const verifiedPages = new Set<number>();
  const pageContents = markedPageContents(sourceEvidence.text);
  let totalCitations = 0;
  let highScoreItems = 0;
  let verifiedCitationCount = 0;
  let normalizedMatchCount = 0;

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
        const validPages: number[] = [];
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
          if (validPages.includes(citation)) {
            invalidCitations.push({
              path: path.join('.'),
              value: citation,
              reason: 'duplicate_page_citation',
            });
            return;
          }
          validPages.push(citation);
        });

        const declared = value.citation_evidence;
        const evidenceByPage = new Map<number, string>();
        if (!Array.isArray(declared)) {
          unsupportedCitations.push({
            path: path.join('.'),
            reason: 'citation_evidence_not_an_array',
          });
        } else {
          declared.forEach((item) => {
            if (!isRecord(item) || !Number.isInteger(item.page) || typeof item.excerpt !== 'string') {
              unsupportedCitations.push({
                path: path.join('.'),
                reason: 'invalid_citation_evidence',
              });
              return;
            }
            const page = item.page as number;
            const excerpt = item.excerpt;
            if (evidenceWords(excerpt).length < MIN_CITATION_EXCERPT_WORDS) {
              unsupportedCitations.push({
                path: path.join('.'),
                page,
                reason: 'evidence_excerpt_too_short',
              });
              return;
            }
            if (evidenceByPage.has(page)) {
              unsupportedCitations.push({
                path: path.join('.'),
                page,
                reason: 'duplicate_citation_evidence',
              });
              return;
            }
            evidenceByPage.set(page, excerpt);
          });
        }

        validPages.forEach((page) => {
          const excerpt = evidenceByPage.get(page);
          if (!excerpt) {
            unsupportedCitations.push({
              path: path.join('.'),
              page,
              reason: 'missing_evidence_excerpt',
            });
            return;
          }
          const matchKind = evidenceExcerptMatchKind(
            pageContents.get(page) ?? '',
            excerpt,
          );
          if (!matchKind) {
            unsupportedCitations.push({
              path: path.join('.'),
              page,
              reason: 'excerpt_not_found_on_cited_page',
            });
            return;
          }
          if (matchKind === 'revision_safe') normalizedMatchCount += 1;
          verifiedPages.add(page);
          verifiedCitationCount += 1;
        });
        evidenceByPage.forEach((_excerpt, page) => {
          if (!validPages.includes(page)) {
            unsupportedCitations.push({
              path: path.join('.'),
              page,
              reason: 'evidence_page_not_cited',
            });
          }
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
  if (unsupportedCitations.length > 0) issues.push('unsupported_page_citations');

  return {
    citation_evidence_version: CITATION_EVIDENCE_VERSION,
    status: issues.length === 0 ? 'verified' : 'needs_review',
    page_count: sourceEvidence.diagnostics.length,
    total_citations: totalCitations,
    valid_citations: verifiedCitationCount,
    verified_page_numbers: [...verifiedPages].sort((left, right) => left - right),
    high_score_items: highScoreItems,
    citation_match_policy_version: CITATION_MATCH_POLICY_VERSION,
    normalized_match_count: normalizedMatchCount,
    malformed_reader_metrics: [...malformedReaderMetrics].sort(),
    missing_required_citations: [...missingRequiredCitations].sort(),
    invalid_citations: invalidCitations,
    unverifiable_citations: unverifiableCitations,
    unsupported_citations: unsupportedCitations,
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
