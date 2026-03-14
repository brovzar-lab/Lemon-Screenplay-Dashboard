/**
 * Tests for CoverageDocument PDF component
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// Mock @react-pdf/renderer with basic React component stubs
// We strip style/fixed/wrap/render/size/src props to avoid jsdom CSSStyleDeclaration errors
vi.mock('@react-pdf/renderer', () => {
  const createStub = (name: string) => {
    const Stub = ({ children }: { children?: React.ReactNode; [key: string]: unknown }) =>
      React.createElement('mock-' + name, { 'data-testid': name }, children);
    Stub.displayName = name;
    return Stub;
  };

  return {
    Document: createStub('Document'),
    Page: createStub('Page'),
    View: createStub('View'),
    Text: createStub('Text'),
    Image: createStub('Image'),
    StyleSheet: { create: (s: Record<string, unknown>) => s },
    Font: { register: vi.fn() },
  };
});

vi.mock('@/lib/dimensionDisplay', () => ({
  getDimensionDisplay: () => [
    { key: 'concept', label: 'Concept', score: 8, weight: 0.2, justification: 'Good concept' },
    { key: 'structure', label: 'Structure', score: 7, weight: 0.15, justification: 'Solid structure' },
  ],
}));

import { render } from '@testing-library/react';
import { CoverageDocument } from './CoverageDocument';
import type { Screenplay } from '@/types';
import type { Note } from '@/types/filters';

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
      targetAudience: { score: 2, note: 'Broad appeal' },
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

function createMockNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    screenplayId: 'test-1',
    content: 'Great screenplay, consider for development.',
    author: 'Producer',
    createdAt: '2026-03-14T10:00:00Z',
    updatedAt: '2026-03-14T10:00:00Z',
    ...overrides,
  };
}

describe('CoverageDocument', () => {
  it('renders without crashing given a valid Screenplay and empty notes', () => {
    const screenplay = createMockScreenplay();
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={[]} />
    );
    expect(container).toBeTruthy();
  });

  it('renders without crashing given a valid Screenplay and non-empty notes', () => {
    const screenplay = createMockScreenplay();
    const notes = [createMockNote()];
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={notes} />
    );
    expect(container).toBeTruthy();
  });

  it('omits the notes section when notes array is empty', () => {
    const screenplay = createMockScreenplay();
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={[]} />
    );
    expect(container.textContent).not.toContain('Producer Notes');
  });

  it('includes the notes section when notes have entries', () => {
    const screenplay = createMockScreenplay();
    const notes = [createMockNote()];
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={notes} />
    );
    expect(container.textContent).toContain('Producer Notes');
    expect(container.textContent).toContain('Great screenplay, consider for development.');
  });

  it('shows CVS table when cvsAssessed is true', () => {
    const screenplay = createMockScreenplay();
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={[]} />
    );
    expect(container.textContent).toContain('Commercial Viability');
    expect(container.textContent).toContain('Total');
  });

  it('shows not-assessed message when cvsAssessed is false', () => {
    const screenplay = createMockScreenplay({
      commercialViability: {
        targetAudience: { score: 0, note: '' },
        highConcept: { score: 0, note: '' },
        castAttachability: { score: 0, note: '' },
        marketingHook: { score: 0, note: '' },
        budgetReturnRatio: { score: 0, note: '' },
        comparableSuccess: { score: 0, note: '' },
        cvsTotal: 0,
        cvsAssessed: false,
      },
    });
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={[]} />
    );
    expect(container.textContent).toContain('not applied');
    expect(container.textContent).not.toContain('Total');
  });

  it('renders supporting cast as individual items', () => {
    const screenplay = createMockScreenplay({
      characters: { protagonist: 'Maya', antagonist: 'Time', supporting: ['Sam', 'Alex', 'Jordan'] },
    });
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={[]} />
    );
    expect(container.textContent).toContain('Sam');
    expect(container.textContent).toContain('Alex');
    expect(container.textContent).toContain('Jordan');
  });

  it('shows fallback for empty primaryDemographic', () => {
    const screenplay = createMockScreenplay({
      targetAudience: { primaryDemographic: '', genderSkew: 'neutral', interests: [] },
    });
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={[]} />
    );
    expect(container.textContent).toContain('Not specified');
  });

  it('renders critical failures when present', () => {
    const screenplay = createMockScreenplay({
      criticalFailures: ['Logic hole in Act 3'],
    });
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={[]} />
    );
    expect(container.textContent).toContain('Critical Failures');
    expect(container.textContent).toContain('Logic hole in Act 3');
  });

  it('renders standout scenes', () => {
    const screenplay = createMockScreenplay();
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={[]} />
    );
    expect(container.textContent).toContain('Standout Scenes');
    expect(container.textContent).toContain('Beach scene');
  });

  it('renders dimension justifications', () => {
    const screenplay = createMockScreenplay();
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={[]} />
    );
    // From the mocked getDimensionDisplay
    expect(container.textContent).toContain('Good concept');
    expect(container.textContent).toContain('Solid structure');
  });

  it('includes metadata grid with genre, tone, budget', () => {
    const screenplay = createMockScreenplay();
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={[]} />
    );
    expect(container.textContent).toContain('Drama');
    expect(container.textContent).toContain('Hopeful');
    expect(container.textContent).toContain('Low');
  });

  it('renders comparable films with title and similarity', () => {
    const screenplay = createMockScreenplay();
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={[]} />
    );
    expect(container.textContent).toContain('Lady Bird');
    expect(container.textContent).toContain('Coming of age drama');
    expect(container.textContent).toContain('Hit');
  });

  it('omits comparable films section when all films have empty data', () => {
    const screenplay = createMockScreenplay({
      comparableFilms: [
        { title: '', similarity: '', boxOfficeRelevance: 'mixed' },
        { title: '', similarity: '', boxOfficeRelevance: 'success' },
      ],
    });
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={[]} />
    );
    expect(container.textContent).not.toContain('Comparable Films');
  });

  it('omits standout scenes section when all scenes have empty data', () => {
    const screenplay = createMockScreenplay({
      standoutScenes: [
        { scene: '', why: '' },
        { scene: '—', why: '—' },
      ],
    });
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={[]} />
    );
    expect(container.textContent).not.toContain('Standout Scenes');
  });

  it('truncates very long verdict on cover page', () => {
    const longVerdict = 'A '.repeat(500); // 1000 chars
    const screenplay = createMockScreenplay({ verdictStatement: longVerdict });
    const { container } = render(
      <CoverageDocument screenplay={screenplay} notes={[]} />
    );
    // Should contain truncation ellipsis
    expect(container.textContent).toContain('...');
  });
});
