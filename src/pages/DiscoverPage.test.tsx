import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLoadAllAnalyses, mockSubscribeToAnalyses, mockFlushPendingWrites } = vi.hoisted(() => ({
  mockLoadAllAnalyses: vi.fn(),
  mockSubscribeToAnalyses: vi.fn(),
  mockFlushPendingWrites: vi.fn(),
}));

vi.mock('@/lib/analysisStore', () => ({
  loadAllAnalyses: (...args: unknown[]) => mockLoadAllAnalyses(...args),
  subscribeToAnalyses: (...args: unknown[]) => mockSubscribeToAnalyses(...args),
  flushPendingWrites: (...args: unknown[]) => mockFlushPendingWrites(...args),
  quarantineAnalysis: vi.fn(() => Promise.resolve()),
  removeAnalysis: vi.fn(),
  removeMultipleAnalyses: vi.fn(),
  getDeletedAnalyses: vi.fn(() => []),
  restoreAnalysis: vi.fn(),
}));

import DiscoverPage from './DiscoverPage';

function rawAnalysis(title: string, score: number, sourceFile: string) {
  return {
    project_id: sourceFile.replace('.pdf', '').toLowerCase(),
    source_file: sourceFile,
    analysis_model: 'claude-sonnet-4',
    analysis_version: 'v9_archaeology',
    collection: 'LEMON',
    metadata: {
      filename: sourceFile,
      page_count: 104,
      word_count: 18_000,
    },
    analysis: {
      title,
      author: 'A. Writer',
      genre: 'Drama',
      subgenres: ['Mystery'],
      themes: ['Identity'],
      logline: `${title} comes from the Firestore analysis collection.`,
      tone: 'Tense',
      verdict: 'RECOMMEND',
      weighted_score: score,
      pillar_scores: {
        structure: { score, evidence: 'Strong structure.' },
        character: { score, evidence: 'Strong characters.' },
        craft_scene: { score, evidence: 'Strong craft.' },
        concept: { score, evidence: 'Strong concept.' },
        emotional_resonance: { score, evidence: 'Strong emotion.' },
      },
      strengths: ['Distinct voice'],
      weaknesses: [],
      development_notes: [],
      critical_failures: [],
      red_flags: [],
    },
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DiscoverPage />
    </QueryClientProvider>,
  );
}

describe('DiscoverPage', () => {
  beforeEach(() => {
    const analyses = [
      rawAnalysis('Cactus Season', 7.4, 'Cactus Season.pdf'),
      rawAnalysis('Midnight Orchard', 8.8, 'Midnight Orchard.pdf'),
    ];

    mockLoadAllAnalyses.mockReset().mockResolvedValue(analyses);
    mockFlushPendingWrites.mockReset().mockResolvedValue(undefined);
    mockSubscribeToAnalyses.mockReset().mockImplementation((onChange) => {
      onChange(analyses);
      return vi.fn();
    });
  });

  it('renders normalized screenplay titles and scores from the existing data spine', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Midnight Orchard' })).toBeInTheDocument();
    expect(screen.getAllByText('8.8').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cactus Season').length).toBeGreaterThan(0);
    expect(mockLoadAllAnalyses).toHaveBeenCalledOnce();
    expect(mockSubscribeToAnalyses).toHaveBeenCalledOnce();
  });
});
