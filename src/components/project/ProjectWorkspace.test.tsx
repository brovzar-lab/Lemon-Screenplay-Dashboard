import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import type { ProducerAssessmentHead, Screenplay } from '@/types';

const testState = vi.hoisted(() => ({
  isAdmin: true,
  assessmentHeads: [] as ProducerAssessmentHead[],
  favorites: [] as string[],
  toggleFavorite: vi.fn(),
}));

vi.mock('@/stores/authStore', () => ({
  useIsAdmin: () => testState.isAdmin,
}));

vi.mock('@/stores/favoritesStore', () => ({
  useFavoritesStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    quickFavorites: testState.favorites,
    toggleQuickFavorite: testState.toggleFavorite,
  }),
}));

vi.mock('@/hooks/useProducerAssessments', () => ({
  useProducerAssessmentHeads: () => ({
    data: testState.assessmentHeads,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/components/discover/DiscoverAppHeader', () => ({
  DiscoverAppHeader: () => <header>Discovery chrome</header>,
}));

vi.mock('@/components/discover/ScriptCover', () => ({
  ScriptCover: ({ title }: { title: string }) => <div>Paper cover for {title}</div>,
}));

vi.mock('@/components/discover/DiscoveryShareStatus', () => ({
  DiscoveryShareStatus: () => <span>Private</span>,
}));

vi.mock('@/components/discover/DiscoveryExportActions', () => ({
  DiscoveryExportActions: () => (
    <div><button>Coverage PDF</button><button>Pitch-deck PDF</button></div>
  ),
}));

vi.mock('@/components/screenplay/modal/ScreenplayPdfButton', () => ({
  ScreenplayPdfButton: ({ screenplay }: { screenplay: Screenplay }) => (
    <button>Open source screenplay for {screenplay.title}</button>
  ),
}));

vi.mock('@/components/screenplay/modal', () => ({
  AnalysisWarnings: ({ screenplay }: { screenplay: Screenplay }) => <div>Warnings for {screenplay.title}</div>,
  ContentDetails: ({ screenplay }: { screenplay: Screenplay }) => <div>Characters for {screenplay.title}</div>,
  DeferredReaderEvidence: ({ screenplay }: { screenplay: Screenplay }) => <div>Five readers for {screenplay.title}</div>,
  NotesSection: ({ screenplayId }: { screenplayId: string }) => <button>Add note to {screenplayId}</button>,
  ProducerTake: ({ screenplay }: { screenplay: Screenplay }) => <div>Producer Take for {screenplay.title}</div>,
  ScoresPanel: ({ screenplay }: { screenplay: Screenplay }) => <div>Score lineage {screenplay.weightedScore}</div>,
  ShareButton: () => <button>Share</button>,
}));

import { ProjectWorkspace } from '@/components/project/ProjectWorkspace';

function project(): Screenplay {
  return createTestScreenplay({
    id: 'atlas-file',
    projectId: 'atlas-project',
    title: 'Atlas Fall',
    author: 'Maya Stone',
    sourceFile: 'atlas.pdf',
    analysisVersion: 'v9_archaeology',
    analysisModel: 'claude-opus-4-6',
    latestVersionId: 'version-2',
    versionCount: 2,
    weightedScore: 8.4,
    recommendation: 'recommend',
    analysisQuality: {
      status: 'complete',
      completedReaders: 5,
      expectedReaders: 5,
      failedReaders: [],
    },
    producerProjection: {
      rawScore: 8.6,
      finalScore: 8.4,
      scoreSource: 'adjusted',
      penaltyApplied: 0.2,
      reportedPenalty: 0.2,
      finalVerdict: 'recommend',
      verdictAdjustments: [],
      gates: [],
      warnings: [],
      rankable: true,
      trustStatus: 'verified',
      trustManifestVersion: 'v4',
      boundary: {
        checked: true,
        runCount: 2,
        failedRunCount: 0,
        scoreSpread: 0.1,
        verdicts: ['recommend', 'recommend'],
        stable: true,
      },
      readerDisagreementCount: 1,
    },
    readerDisagreements: [{
      topic: 'Ending agency',
      readerA: 'character',
      readerAPosition: 'Strong',
      readerB: 'structure',
      readerBPosition: 'Late',
      resolution: 'Recommend with a targeted ending pass.',
    }],
  });
}

const stats = { total: 27, avgWeightedScore: 6.1, filmNowCount: 0 };

describe('ProjectWorkspace', () => {
  beforeEach(() => {
    testState.isAdmin = true;
    testState.assessmentHeads = [];
    testState.favorites = [];
    testState.toggleFavorite.mockClear();
  });

  it('presents the complete real-analysis workspace as a studio dossier', () => {
    render(<ProjectWorkspace screenplay={project()} stats={stats} onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Atlas Fall' })).toBeInTheDocument();
    expect(screen.getByText('Decision docket')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Project dossier' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reader Room' })).toHaveAttribute('href', '#project-readers');
    expect(screen.getAllByText('Verified analysis')).not.toHaveLength(0);
    expect(screen.getAllByText('5/5 readers complete')).not.toHaveLength(0);
    expect(screen.getByText('Score lineage 8.4')).toBeInTheDocument();
    expect(screen.getByText('Five readers for Atlas Fall')).toBeInTheDocument();
    expect(screen.getByText('Characters for Atlas Fall')).toBeInTheDocument();
    expect(screen.getByText('Producer Take for Atlas Fall')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open source screenplay/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reanalyze/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /chat/i })).not.toBeInTheDocument();
  });

  it('keeps Producer Take admin-only while preserving the analysis for readers', () => {
    testState.isAdmin = false;
    render(<ProjectWorkspace screenplay={project()} stats={stats} onBack={vi.fn()} />);

    expect(screen.getByText('Five readers for Atlas Fall')).toBeInTheDocument();
    expect(screen.queryByText('Producer Take for Atlas Fall')).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('Project decision docket')).queryByText('Producer Take')).not.toBeInTheDocument();
  });

  it('uses the existing favorite control and returns through the supplied navigation', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<ProjectWorkspace screenplay={project()} stats={stats} onBack={onBack} />);

    await user.click(screen.getByRole('button', { name: 'Favorite' }));
    expect(testState.toggleFavorite).toHaveBeenCalledWith('atlas-file');

    await user.click(screen.getByRole('button', { name: 'Back to Discovery' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
