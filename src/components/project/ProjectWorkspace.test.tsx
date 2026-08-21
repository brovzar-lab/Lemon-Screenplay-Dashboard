import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import i18n from '@/i18n';
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
  useFavoritesStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
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

vi.mock('@/components/layout/ApplicationHeader', () => ({
  ApplicationHeader: () => <header>Application chrome</header>,
}));

vi.mock('@/components/discover/ScriptCover', () => ({
  ScriptCover: ({ title }: { title: string }) => <div>Paper cover for {title}</div>,
}));

vi.mock('@/components/discover/DiscoveryShareStatus', () => ({
  DiscoveryShareStatus: () => <span>Private</span>,
}));

vi.mock('@/components/discover/DiscoveryExportActions', () => ({
  DiscoveryExportActions: () => (
    <div>
      <button>Coverage PDF</button>
      <button>Pitch-deck PDF</button>
    </div>
  ),
}));

vi.mock('@/components/screenplay/modal/ScreenplayPdfButton', () => ({
  ScreenplayPdfButton: ({ screenplay }: { screenplay: Screenplay }) => (
    <button>Open source screenplay for {screenplay.title}</button>
  ),
}));

vi.mock('@/components/screenplay/modal', () => ({
  AnalysisWarnings: ({ screenplay }: { screenplay: Screenplay }) => (
    <div>Warnings for {screenplay.title}</div>
  ),
  ContentDetails: ({ screenplay }: { screenplay: Screenplay }) => (
    <div>Characters for {screenplay.title}</div>
  ),
  DeferredReaderEvidence: ({ screenplay }: { screenplay: Screenplay }) => (
    <div>Five readers for {screenplay.title}</div>
  ),
  NotesSection: ({ screenplayId }: { screenplayId: string }) => (
    <button>Add note to {screenplayId}</button>
  ),
  ProducerTake: ({ screenplay }: { screenplay: Screenplay }) => (
    <div>Producer Take for {screenplay.title}</div>
  ),
  ScoresPanel: ({ screenplay }: { screenplay: Screenplay }) => (
    <div>Score lineage {screenplay.weightedScore}</div>
  ),
  ShareButton: () => <button>Share</button>,
}));

vi.mock('@/components/project/ReaderRoom', () => ({
  ReaderRoom: ({ screenplay }: { screenplay: Screenplay }) => (
    <div>Five readers for {screenplay.title}</div>
  ),
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
    readerDisagreements: [
      {
        topic: 'Ending agency',
        readerA: 'character',
        readerAPosition: 'Strong',
        readerB: 'structure',
        readerBPosition: 'Late',
        resolution: 'Recommend with a targeted ending pass.',
      },
    ],
  });
}

const stats = { total: 27, avgWeightedScore: 6.1, filmNowCount: 0 };

describe('ProjectWorkspace', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    testState.isAdmin = true;
    testState.assessmentHeads = [];
    testState.favorites = [];
    testState.toggleFavorite.mockClear();
  });

  it('presents the complete real-analysis workspace as a studio dossier', () => {
    render(
      <ProjectWorkspace
        screenplay={project()}
        stats={stats}
        activeTab="overview"
        onSelectTab={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Atlas Fall' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Project workspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reader Room' })).toBeInTheDocument();
    expect(screen.getAllByText('Verified analysis')).not.toHaveLength(0);
    expect(screen.getAllByText('5/5 readers complete')).not.toHaveLength(0);
    expect(screen.getByText('Score lineage 8.4')).toBeInTheDocument();
    expect(screen.queryByText('Five readers for Atlas Fall')).not.toBeInTheDocument();
    expect(screen.queryByText('Characters for Atlas Fall')).not.toBeInTheDocument();
    expect(screen.queryByText('Producer Take for Atlas Fall')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open source screenplay/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reanalyze/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('project-tab-overview')).toBeInTheDocument();
  });

  it('keeps Producer Take admin-only while preserving the analysis for readers', () => {
    testState.isAdmin = false;
    render(
      <ProjectWorkspace
        screenplay={project()}
        stats={stats}
        activeTab="overview"
        onSelectTab={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Reader Room' })).toBeInTheDocument();
    expect(screen.queryByText('Producer Take for Atlas Fall')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Producer Take' })).not.toBeInTheDocument();
  });

  it('uses the existing favorite control and returns through the supplied navigation', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <ProjectWorkspace
        screenplay={project()}
        stats={stats}
        activeTab="overview"
        onSelectTab={vi.fn()}
        onBack={onBack}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Favorite' }));
    expect(testState.toggleFavorite).toHaveBeenCalledWith('atlas-file');

    await user.click(screen.getByRole('button', { name: 'Back to Discovery' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows only the active replacement page and asks the route owner to switch tabs', async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();
    render(
      <ProjectWorkspace
        screenplay={project()}
        stats={stats}
        activeTab="reader-room"
        onSelectTab={onSelectTab}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText('Five readers for Atlas Fall')).toBeInTheDocument();
    expect(screen.queryByText('Score lineage 8.4')).not.toBeInTheDocument();
    expect(screen.queryByText('Characters for Atlas Fall')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Story X-Ray' }));
    expect(onSelectTab).toHaveBeenCalledWith('story-x-ray');
  });

  it('does not mix original English analysis into the Spanish project workspace', async () => {
    await i18n.changeLanguage('es');
    const screenplay = project();
    screenplay.logline = 'Original English logline.';

    render(
      <ProjectWorkspace
        screenplay={screenplay}
        stats={stats}
        activeTab="overview"
        onSelectTab={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Análisis disponible en inglés').length).toBeGreaterThan(0);
    expect(screen.queryByText('Original English logline.')).not.toBeInTheDocument();
    expect(screen.queryByText('Score lineage 8.4')).not.toBeInTheDocument();
  });
});
