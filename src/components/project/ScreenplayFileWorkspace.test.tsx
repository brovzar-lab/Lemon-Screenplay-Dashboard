import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import type { Screenplay } from '@/types';

const state = vi.hoisted(() => ({ isAdmin: true, favorites: [] as string[], toggleFavorite: vi.fn() }));

vi.mock('@/stores/authStore', () => ({ useIsAdmin: () => state.isAdmin }));
vi.mock('@/stores/themeStore', () => ({ useThemeStore: (selector: (value: { isDark: boolean }) => unknown) => selector({ isDark: false }) }));
vi.mock('@/stores/favoritesStore', () => ({ useFavoritesStore: (selector: (value: Record<string, unknown>) => unknown) => selector({ quickFavorites: state.favorites, toggleQuickFavorite: state.toggleFavorite }) }));
vi.mock('@/hooks/useProducerAssessments', () => ({ useProducerAssessmentHeads: () => ({ data: [], isLoading: false, error: null }) }));
vi.mock('@/components/auth', () => ({ UserMenu: () => <button>User menu</button> }));
vi.mock('@/components/layout/SyncStatusIndicator', () => ({ SyncStatusIndicator: () => <span>Synced</span> }));
vi.mock('@/components/ui/ThemeToggle', () => ({ ThemeToggle: () => <button>Toggle theme</button> }));
vi.mock('@/components/discover/screenplay/BlueSpineScript', () => ({ BlueSpineScript: ({ screenplay }: { screenplay: Screenplay }) => <div>Complete paper script for {screenplay.title}</div> }));
vi.mock('@/components/discover/DiscoveryShareStatus', () => ({ DiscoveryShareStatus: () => <span>Private</span> }));
vi.mock('@/components/discover/DiscoveryExportActions', () => ({ DiscoveryExportActions: () => <button>Pitch-deck PDF</button> }));
vi.mock('@/components/screenplay/modal/ScreenplayPdfButton', () => ({ ScreenplayPdfButton: () => <button>Open screenplay</button> }));
vi.mock('@/components/screenplay/modal', () => ({
  AnalysisWarnings: () => <span>No analysis warnings</span>,
  ContentDetails: ({ screenplay }: { screenplay: Screenplay }) => <div>Story X-Ray for {screenplay.title}</div>,
  NotesSection: ({ screenplayId }: { screenplayId: string }) => <div>Notes for {screenplayId}</div>,
  ProducerTake: ({ screenplay }: { screenplay: Screenplay }) => <div>Producer Take for {screenplay.title}</div>,
  ScoresPanel: ({ screenplay }: { screenplay: Screenplay }) => <div>Real scores for {screenplay.title}</div>,
  ShareButton: () => <button>Share</button>,
}));
vi.mock('@/components/project/ReaderRoom', () => ({ ReaderRoom: ({ screenplay }: { screenplay: Screenplay }) => <div>Reader Room for {screenplay.title}</div> }));

import { ScreenplayFileWorkspace } from '@/components/project/ScreenplayFileWorkspace';

function project(): Screenplay {
  return createTestScreenplay({
    id: 'atlas', projectId: 'atlas-project', title: 'Atlas Fall', author: 'Maya Stone',
    weightedScore: 8.4, recommendation: 'recommend', sourceFile: 'atlas.pdf',
    latestVersionId: 'v2', versionCount: 2,
    verdictStatement: 'Atlas Fall is a contained survival drama with a clear emotional engine, but the second act repeats the same pressure without materially changing the protagonist’s choices. The project remains worth developing because the central relationship and final reversal are both specific and producible.',
    analysisQuality: { status: 'complete', completedReaders: 5, expectedReaders: 5, failedReaders: [] },
    producerProjection: {
      rawScore: 8.4, finalScore: 8.4, scoreSource: 'adjusted', penaltyApplied: 0,
      reportedPenalty: 0, finalVerdict: 'recommend', verdictAdjustments: [], gates: [],
      warnings: [], rankable: true, trustStatus: 'verified',
      boundary: { checked: true, runCount: 2, failedRunCount: 0, scoreSpread: .1, verdicts: ['recommend'], stable: true },
      readerDisagreementCount: 1,
    },
  });
}

function WorkspaceHarness() {
  const [activeTab, setActiveTab] = useState<import('@/components/project/ScreenplayFileWorkspace').ScreenplayFileTab>('overview');
  return <ScreenplayFileWorkspace screenplay={project()} activeTab={activeTab} onSelectTab={setActiveTab} onBack={vi.fn()} />;
}

describe('ScreenplayFileWorkspace', () => {
  beforeEach(() => { state.isAdmin = true; state.favorites = []; state.toggleFavorite.mockClear(); });

  it('presents one focused project file with truthful evidence and existing actions', () => {
    render(<ScreenplayFileWorkspace screenplay={project()} activeTab="overview" onSelectTab={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByTestId('screenplay-file-workspace')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Atlas Fall' })).toBeInTheDocument();
    expect(screen.getByText('5/5 complete')).toBeInTheDocument();
    expect(screen.getByText('2 stored')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pitch-deck PDF' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete|reanalyze/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Why this landed at Recommend' })).toBeInTheDocument();
    const executiveCopy = screen.getByText(/Atlas Fall is a contained survival drama/);
    expect(executiveCopy.tagName).toBe('P');
    expect(executiveCopy).toHaveClass('screenplay-file__executive-copy');
  });

  it('keeps content in separate deep-linkable tabs and hides admin work from readers', async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();
    state.isAdmin = false;
    render(<ScreenplayFileWorkspace screenplay={project()} activeTab="scores" onSelectTab={onSelectTab} onBack={vi.fn()} />);
    expect(screen.getByText('Real scores for Atlas Fall')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Producer Take' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Producer take/i)).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Scores' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Scores' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Reader Room' }));
    expect(onSelectTab).toHaveBeenCalledWith('reader-room');
  });

  it('keeps every major project surface in a separate navigable tab', async () => {
    const user = userEvent.setup();
    render(<WorkspaceHarness />);

    await user.click(screen.getByRole('tab', { name: 'Scores' }));
    expect(screen.getByText('Real scores for Atlas Fall')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Reader Room' }));
    expect(screen.getByText('Reader Room for Atlas Fall')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Story X-Ray' }));
    expect(screen.getByText('Story X-Ray for Atlas Fall')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Producer Take' }));
    expect(screen.getByText('Producer Take for Atlas Fall')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Notes' }));
    expect(screen.getByText('These notes stay on this browser and are not shared with the team.')).toBeInTheDocument();
    expect(screen.getByText('Notes for atlas-project')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Pitch-deck PDF' })).toHaveLength(1);
  });

  it('supports arrow-key navigation between project sections', async () => {
    const user = userEvent.setup();
    render(<WorkspaceHarness />);
    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    overviewTab.focus();

    await user.keyboard('{ArrowRight}');

    const scoresTab = screen.getByRole('tab', { name: 'Scores' });
    expect(scoresTab).toHaveFocus();
    expect(scoresTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Scores' })).toBeInTheDocument();
  });
});
