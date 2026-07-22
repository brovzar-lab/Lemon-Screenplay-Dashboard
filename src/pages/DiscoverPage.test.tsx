import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockOnSnapshot, mockUnsubscribe } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
  mockUnsubscribe: vi.fn(),
}));

let emitSnapshot:
  | ((snapshot: { docs: Array<{ data: () => Record<string, unknown> }> }) => void)
  | undefined;

vi.mock('@/lib/firebase', () => ({
  authReady: Promise.resolve(),
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'uploaded-analyses'),
  query: vi.fn((reference: unknown) => reference),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  doc: vi.fn(),
  setDoc: vi.fn(),
  runTransaction: vi.fn(),
  Timestamp: { fromMillis: vi.fn() },
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  deleteField: vi.fn(),
  where: vi.fn(),
  getCountFromServer: vi.fn(),
}));

import DiscoverPage from '@/pages/DiscoverPage';

function rawAnalysis(title: string, score: number, sourceFile: string, verdict = 'RECOMMEND') {
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
      verdict,
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
      <MemoryRouter initialEntries={['/discover']}>
        <DiscoverPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DiscoverPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      'lemon-local-analyses',
      JSON.stringify([rawAnalysis('Cactus Season', 7.4, 'Cactus Season.pdf')]),
    );

    emitSnapshot = undefined;
    mockUnsubscribe.mockReset();
    mockOnSnapshot.mockReset().mockImplementation((_query, onChange) => {
      emitSnapshot = onChange;
      return mockUnsubscribe;
    });
  });

  it('replaces normalized startup data with the live Firestore snapshot', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Cactus Season' })).toBeInTheDocument();
    expect(mockOnSnapshot).toHaveBeenCalledOnce();

    act(() => {
      emitSnapshot?.({
        docs: [
          {
            data: () => rawAnalysis('Midnight Orchard', 8.8, 'Midnight Orchard.pdf', 'FILM_NOW'),
          },
        ],
      });
    });

    expect(await screen.findByRole('heading', { name: 'Midnight Orchard' })).toBeInTheDocument();
    expect(screen.getAllByText('8.8').length).toBeGreaterThan(0);
    expect(
      within(screen.getByTestId('discovery-featured')).getByText('FILM NOW'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Cactus Season')).not.toBeInTheDocument();
  });
});
