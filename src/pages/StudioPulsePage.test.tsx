import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { createTestScreenplay } from '@/test/factories';
import type { ProducerProjection, Screenplay } from '@/types';
import { INTELLIGENCE_BRIEFING_RESULT } from '@/lib/studioPulse';
import { buildDemoBriefing } from '@/data/intelligenceBriefingDemo';

const state = vi.hoisted(() => ({
  screenplays: [] as Screenplay[] | undefined,
  isLoading: false,
  error: null as unknown,
}));

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: state.screenplays, isLoading: state.isLoading, error: state.error }),
  useLiveScreenplaySync: vi.fn(),
}));

vi.mock('@/components/layout/ApplicationHeader', () => ({
  ApplicationHeader: () => <header>Application header</header>,
}));

import StudioPulsePage, { IntelligenceBriefing, UnavailableBriefing } from '@/pages/StudioPulsePage';

function projection(overrides: Partial<ProducerProjection> = {}): ProducerProjection {
  return {
    rawScore: 8.2,
    finalScore: 8,
    scoreSource: 'adjusted',
    penaltyApplied: 0.2,
    reportedPenalty: 0.2,
    finalVerdict: 'consider',
    verdictAdjustments: [],
    gates: [],
    warnings: [],
    rankable: true,
    trustStatus: 'verified',
    boundary: {
      checked: true,
      runCount: 1,
      failedRunCount: 0,
      scoreSpread: 0,
      verdicts: ['consider'],
      stable: true,
    },
    readerDisagreementCount: 0,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <StudioPulsePage />
    </MemoryRouter>,
  );
}

describe('Intelligence Briefing page', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    state.isLoading = false;
    state.error = null;
    state.screenplays = [
      createTestScreenplay({
        id: 'private-romance',
        title: 'Synthetic Private Romance',
        genre: 'Romántico',
        producerProjection: projection({ finalScore: 8.1 }),
      }),
      createTestScreenplay({
        id: 'private-unmatched',
        title: 'Synthetic Private Family Film',
        genre: 'Family',
        producerProjection: projection({ finalScore: 7.4 }),
      }),
      createTestScreenplay({
        id: 'private-legacy',
        title: 'Synthetic Private Legacy',
        genre: 'Crime',
        weightedScore: 9.8,
        producerProjection: projection({ rankable: false, trustStatus: 'legacy_unverified' }),
      }),
      createTestScreenplay({
        id: 'private-pass',
        title: 'Synthetic Private Pass',
        genre: 'Romance',
        producerProjection: projection({ finalVerdict: 'pass' }),
      }),
    ];
  });

  it('replaces the homepage with the Mexico-first briefing and only supported decision cards', () => {
    const { container } = renderPage();

    expect(screen.getByRole('heading', { name: 'Intelligence Briefing' })).toBeInTheDocument();
    expect(screen.getByText(/August 19, 2026/)).toBeInTheDocument();
    expect(screen.getByText('Situation')).toBeInTheDocument();
    expect(screen.getByText('Three Moves')).toBeInTheDocument();
    expect(screen.getByText('Mexico Now')).toBeInTheDocument();
    expect(screen.getByText('Zeitgeist + Context')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Opportunity')).toBeInTheDocument();
    expect(screen.getByText('Evidence Health')).toBeInTheDocument();
    expect(screen.getByText('Decision & Prediction Ledger')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Ranked decisions supported by this issue' })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'What we know, and what we do not' })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'Open buyer doors' })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'Conversation beside verified evidence' })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'Creative quality beside market timing' })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'Seven separate checks, no confidence score' })).toHaveLength(1);
    expect(container.querySelectorAll('.studio-pulse__move-list > li')).toHaveLength(2);
    expect(screen.getByText('Do not infer a social zeitgeist move')).toBeInTheDocument();
    expect(screen.queryByText('Demand score')).not.toBeInTheDocument();
    expect(screen.queryByText('Studio Pulse')).not.toBeInTheDocument();
  });

  it('shows a clearly labeled, fully populated demo without changing live slate data', () => {
    const base = INTELLIGENCE_BRIEFING_RESULT.snapshot!;
    render(
      <MemoryRouter>
        <IntelligenceBriefing snapshot={buildDemoBriefing(base)} demo />
      </MemoryRouter>,
    );

    expect(screen.getByText('DEMO DATA')).toBeInTheDocument();
    expect(screen.getByText('El Último Metro')).toBeInTheDocument();
    expect(screen.getByText('Festival de Ceniza')).toBeInTheDocument();
    expect(screen.getAllByText('Starting over is becoming a useful emotional frame')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Prediction accountability' })).toBeInTheDocument();
    expect(screen.getByText('Reviewed edition')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Signals in this edition' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Open buyer doors' })).toBeInTheDocument();
    expect(screen.getByText(/No reviewed comparison exists yet/)).toBeInTheDocument();
  });

  it('shows all three compact moves while supporting evidence and research begin collapsed', async () => {
    const user = userEvent.setup();
    const base = INTELLIGENCE_BRIEFING_RESULT.snapshot!;
    const { container } = render(
      <MemoryRouter>
        <IntelligenceBriefing snapshot={buildDemoBriefing(base)} demo />
      </MemoryRouter>,
    );

    expect(container.querySelectorAll('.studio-pulse__move-list > li')).toHaveLength(3);
    expect(screen.getAllByText('Reverse when')).toHaveLength(3);
    expect(screen.getAllByText('View supporting evidence')).toHaveLength(3);
    expect(screen.getAllByText('strong inference').length).toBeGreaterThan(0);
    expect(screen.getAllByText('speculation').length).toBeGreaterThan(0);

    const evidenceSummary = screen.getAllByText('View supporting evidence')[0];
    const evidenceDetails = evidenceSummary.closest('details');
    expect(evidenceDetails).not.toHaveAttribute('open');
    await user.click(evidenceSummary);
    expect(evidenceDetails).toHaveAttribute('open');
    expect(
      screen
        .getAllByRole('link', { name: /Forbes/ })
        .every((link) => link.getAttribute('rel') === 'noopener noreferrer'),
    ).toBe(true);

    expect(container.querySelectorAll('.studio-pulse__buyer-board > li')).toHaveLength(3);
    expect(screen.getAllByRole('link', { name: /Netflix/ }).length).toBeGreaterThan(0);
  });

  it('renders variable action counts and an honest zero-action explanation', () => {
    const oneAction = structuredClone(INTELLIGENCE_BRIEFING_RESULT.snapshot!);
    oneAction.actions = oneAction.actions.slice(0, 1);
    const { container, unmount } = render(
      <MemoryRouter><IntelligenceBriefing snapshot={oneAction} /></MemoryRouter>,
    );
    expect(container.querySelectorAll('.studio-pulse__move-list > li')).toHaveLength(1);
    unmount();

    const zeroActions = structuredClone(INTELLIGENCE_BRIEFING_RESULT.snapshot!);
    zeroActions.actions = [];
    render(<MemoryRouter><IntelligenceBriefing snapshot={zeroActions} /></MemoryRouter>);
    expect(screen.getByText(/No ranked market move is supported by this issue/)).toBeInTheDocument();
  });

  it('keeps conversation, verified context, outcomes, receipts, and uncertainty distinct', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('heading', { name: 'Conversation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Verified context' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Observed outcomes' })).toBeInTheDocument();
    expect(screen.getByText('Unavailable. No volume or sentiment was fabricated.')).toBeInTheDocument();
    expect(screen.getByText(/Alternative explanations/)).toBeInTheDocument();
    expect(screen.getByText(/Trade press, Official buyer press, Industry reporting/)).toBeInTheDocument();
    expect(screen.getByText(/Territory: MX/)).toBeInTheDocument();
    expect(screen.getByText('Contradictions:')).toBeInTheDocument();
    await user.click(screen.getByText('Source receipts and methodology'));
    expect(screen.getByRole('link', { name: /Variety: Netflix Commits/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('renders available conversation claims instead of a generic availability label', () => {
    const snapshot = structuredClone(INTELLIGENCE_BRIEFING_RESULT.snapshot!);
    const conversationClaim = snapshot.claims.find(({ id }) => id === 'claim-global-netflix-spend')!;
    conversationClaim.kind = 'conversation';
    snapshot.zeitgeistStories[0].state = 'available';
    snapshot.zeitgeistStories[0].signalClass = 'conversation';
    snapshot.zeitgeistStories[0].conversationClaimIds = [conversationClaim.id];
    snapshot.zeitgeistStories[0].contextClaimIds = ['claim-mexico-incentive'];

    render(<MemoryRouter><IntelligenceBriefing snapshot={snapshot} /></MemoryRouter>);

    expect(screen.getByText(conversationClaim.statement.en)).toBeInTheDocument();
  });

  it('renders only authorized local titles and verified score rules in the synchronized table', () => {
    renderPage();

    expect(screen.getByRole('table', { name: 'Authorized portfolio opportunity table' })).toBeInTheDocument();
    expect(screen.getByText('Synthetic Private Romance')).toBeInTheDocument();
    expect(screen.getByText('Synthetic Private Family Film')).toBeInTheDocument();
    expect(screen.getByText('Synthetic Private Legacy')).toBeInTheDocument();
    expect(screen.queryByText('Synthetic Private Pass')).not.toBeInTheDocument();
    expect(screen.getByText('8.1')).toBeInTheDocument();
    expect(screen.getByText('Unrankable')).toBeInTheDocument();
    expect(screen.getByText('Approximate text match')).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-chart')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('rowgroup', { name: 'Matched projects' })).toBeInTheDocument();
    expect(screen.getByRole('rowgroup', { name: 'Unmatched projects' })).toBeInTheDocument();
    expect(screen.getByRole('rowgroup', { name: 'Unrankable projects' })).toBeInTheDocument();
  });

  it('separates loading, authorization, data error, and successful empty slate states', () => {
    state.screenplays = undefined;
    state.isLoading = true;
    const { unmount } = renderPage();
    expect(screen.getByText('Loading authorized portfolio…')).toBeInTheDocument();
    expect(screen.queryByText('Acquisition gaps')).not.toBeInTheDocument();
    unmount();

    state.isLoading = false;
    state.error = { code: 'permission-denied' };
    renderPage();
    expect(screen.getByText('Portfolio authorization failed. No slate decision is shown.')).toBeInTheDocument();
    expect(screen.queryByText('Acquisition gaps')).not.toBeInTheDocument();
  });

  it('shows acquisition gaps only after a successful empty query', () => {
    state.screenplays = [];
    renderPage();

    expect(screen.getByText('The authorized slate query succeeded and returned no projects.')).toBeInTheDocument();
    expect(screen.getByText('Acquisition gaps')).toBeInTheDocument();
    expect(screen.getAllByText(/romance-led project with a specific Mexican engine/i)).toHaveLength(2);
  });

  it('renders strict bilingual artifact copy without an English fallback', async () => {
    await i18n.changeLanguage('es');
    renderPage();

    expect(screen.getByRole('heading', { name: 'Briefing de Inteligencia' })).toBeInTheDocument();
    expect(screen.getByText('Tres movimientos')).toBeInTheDocument();
    expect(screen.getByText('México ahora')).toBeInTheDocument();
    expect(screen.getAllByText('Investigar la vía de romance local')).toHaveLength(2);
    expect(screen.getByText(/Prensa especializada, Comunicados oficiales de compradores, Reportes de la industria/)).toBeInTheDocument();
    expect(screen.queryByText('Investigate the local romance lane')).not.toBeInTheDocument();
    expect(screen.queryByText(/Trade press, Official buyer press, Industry reporting/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No hay historial suficiente' })).toBeInTheDocument();
  });

  it('renders an honest unavailable state with only the stable public validation code', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <MemoryRouter>
        <UnavailableBriefing code="invalid_object" snapshotId="synthetic-invalid" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Briefing unavailable' })).toBeInTheDocument();
    expect(screen.getByText('invalid_object')).toBeInTheDocument();
    expect(error).toHaveBeenCalledWith('[Intelligence Briefing] snapshot=synthetic-invalid code=invalid_object');
    error.mockRestore();
  });

  it('shows an empty ledger without invented forecasts or accuracy statistics', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Not enough history' })).toBeInTheDocument();
    expect(screen.getByText(/No sample forecasts ship/i)).toBeInTheDocument();
    expect(screen.getByText(/no accuracy is calculated/i)).toBeInTheDocument();
    expect(screen.queryByText(/accuracy: \d/i)).not.toBeInTheDocument();
  });

  it('surfaces stale sources, unresolved contradictions, and missing connectors separately', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Stale sources' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Unresolved contradictions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Missing connectors' })).toBeInTheDocument();
    expect(screen.getByText(/Commercial permission was not confirmed/)).toBeInTheDocument();
  });
});
