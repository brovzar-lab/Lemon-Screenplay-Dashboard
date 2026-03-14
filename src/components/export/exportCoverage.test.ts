/**
 * Tests for exportCoverage download service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @react-pdf/renderer before importing the module under test
vi.mock('@react-pdf/renderer', () => ({
  pdf: vi.fn(() => ({
    toBlob: vi.fn(() => Promise.resolve(new Blob(['test'], { type: 'application/pdf' }))),
  })),
  Document: ({ children }: { children: React.ReactNode }) => children,
  Page: ({ children }: { children: React.ReactNode }) => children,
  View: ({ children }: { children: React.ReactNode }) => children,
  Text: ({ children }: { children: React.ReactNode }) => children,
  Image: () => null,
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  Font: { register: vi.fn() },
}));

// Mock notesStore
vi.mock('@/stores/notesStore', () => ({
  useNotesStore: {
    getState: () => ({
      getNotesForScreenplay: () => [],
    }),
  },
}));

import { downloadCoveragePdf, sanitizeFilename } from './exportCoverage';
import type { Screenplay } from '@/types';

function createMockScreenplay(overrides: Partial<Screenplay> = {}): Screenplay {
  return {
    id: 'test-1',
    title: 'The Last Summer',
    author: 'Jane Smith',
    collection: 'V6 Analysis',
    sourceFile: 'test.pdf',
    analysisModel: 'claude-3',
    analysisVersion: 'v6',
    posterUrl: undefined,
    weightedScore: 7.5,
    cvsTotal: 12,
    genre: 'Drama',
    subgenres: ['Coming of Age'],
    themes: ['Identity'],
    logline: 'A young woman discovers herself.',
    tone: 'Hopeful',
    recommendation: 'recommend',
    recommendationRationale: 'Strong story',
    verdictStatement: 'A compelling drama.',
    isFilmNow: false,
    filmNowAssessment: null,
    dimensionScores: {
      concept: 8, structure: 7, protagonist: 8, supportingCast: 6,
      dialogue: 7, genreExecution: 7, originality: 8, weightedScore: 7.5,
    },
    dimensionJustifications: {
      concept: '', structure: '', protagonist: '', supportingCast: '',
      dialogue: '', genreExecution: '', originality: '',
    },
    commercialViability: {
      targetAudience: { score: 2, note: '' },
      highConcept: { score: 2, note: '' },
      castAttachability: { score: 2, note: '' },
      marketingHook: { score: 2, note: '' },
      budgetReturnRatio: { score: 2, note: '' },
      comparableSuccess: { score: 2, note: '' },
      cvsTotal: 12,
      cvsAssessed: true,
    },
    criticalFailures: [],
    criticalFailureDetails: [],
    criticalFailureTotalPenalty: 0,
    majorWeaknesses: [],
    strengths: ['Great dialogue', 'Strong protagonist'],
    weaknesses: ['Pacing issues'],
    developmentNotes: ['Consider tightening Act 2'],
    marketability: 'medium',
    budgetCategory: 'low',
    budgetJustification: 'Limited locations',
    characters: { protagonist: 'Maya', antagonist: 'Time', supporting: ['Sam'] },
    structureAnalysis: { formatQuality: 'professional', actBreaks: 'Standard', pacing: 'Good' },
    comparableFilms: [{ title: 'Lady Bird', similarity: 'Coming of age drama', boxOfficeRelevance: 'success' }],
    standoutScenes: [{ scene: 'Beach scene', why: 'Emotional climax' }],
    targetAudience: { primaryDemographic: '18-34', genderSkew: 'female', interests: ['Drama'] },
    metadata: { filename: 'test.pdf', pageCount: 120, wordCount: 25000 },
    producerMetrics: { marketPotential: 7, marketPotentialRationale: '', uspStrength: 'Strong', uspStrengthRationale: '' },
    tmdbStatus: null,
    ...overrides,
  } as Screenplay;
}

describe('sanitizeFilename', () => {
  it('converts spaces to hyphens', () => {
    expect(sanitizeFilename('The Last Summer')).toBe('The-Last-Summer');
  });

  it('strips slashes and special characters', () => {
    expect(sanitizeFilename('Hello/World?')).toBe('HelloWorld');
  });

  it('strips quotes and unicode', () => {
    expect(sanitizeFilename('Test "Movie" \u2014 Name')).toBe('Test-Movie--Name');
  });

  it('returns Untitled for empty string', () => {
    expect(sanitizeFilename('')).toBe('Untitled');
  });

  it('returns Untitled for whitespace-only string', () => {
    expect(sanitizeFilename('   ')).toBe('Untitled');
  });
});

describe('downloadCoveragePdf', () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let mockLink: { href: string; download: string; click: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockLink = { href: '', download: '', click: vi.fn() };
    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockReturnValue(null as unknown as Node);
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockReturnValue(null as unknown as Node);
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls pdf().toBlob() and triggers anchor click download', async () => {
    const { pdf } = await import('@react-pdf/renderer');
    const screenplay = createMockScreenplay();

    await downloadCoveragePdf(screenplay);

    expect(pdf).toHaveBeenCalled();
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(appendChildSpy).toHaveBeenCalled();
    expect(mockLink.click).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url');
  });

  it('sanitizes the filename to {Title}-Coverage.pdf', async () => {
    const screenplay = createMockScreenplay({ title: 'The Last Summer' });

    await downloadCoveragePdf(screenplay);

    expect(mockLink.download).toBe('The-Last-Summer-Coverage.pdf');
  });

  it('handles empty title with fallback filename', async () => {
    const screenplay = createMockScreenplay({ title: '' });

    await downloadCoveragePdf(screenplay);

    expect(mockLink.download).toBe('Untitled-Coverage.pdf');
  });

  it('strips special characters from filename', async () => {
    const screenplay = createMockScreenplay({ title: 'Hello/World?' });

    await downloadCoveragePdf(screenplay);

    expect(mockLink.download).toBe('HelloWorld-Coverage.pdf');
  });
});
