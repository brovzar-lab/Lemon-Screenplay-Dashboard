import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DiscoverDrawer } from '@/components/discover/DiscoverDrawer';
import { createCoverageTestScreenplay } from '@/test/factories';

vi.mock('@/stores/authStore', () => ({ useIsAdmin: () => false }));
vi.mock('@/components/discover/DiscoveryShareStatus', () => ({
  DiscoveryShareStatus: () => null,
}));
vi.mock('@/components/discover/DiscoveryExportActions', () => ({
  DiscoveryExportActions: () => null,
}));
vi.mock('@/components/project/AnalysisLanguageNotice', () => ({
  AnalysisLanguageNotice: () => <div>V9 language notice</div>,
}));
vi.mock('@/components/project/CoverageReportPanel', () => ({
  CoverageReportPanel: () => <div>Qualitative Coverage report</div>,
}));
vi.mock('@/components/screenplay/modal', () => ({
  AnalysisWarnings: () => <div>V9 warnings</div>,
  ContentDetails: () => <div>V9 content</div>,
  DeferredReaderEvidence: () => <div>V9 reader evidence</div>,
  ModalHeader: ({ titleId }: { titleId: string }) => <h2 id={titleId}>Matadero</h2>,
  NotesSection: () => <div>Notes</div>,
  ProducerTake: () => null,
  ScoresPanel: () => <div>V9 scores</div>,
  ShareButton: () => null,
}));

describe('DiscoverDrawer Coverage V1', () => {
  it('shows the qualitative report without V9 score or reader panels', () => {
    render(<DiscoverDrawer screenplay={createCoverageTestScreenplay()} onClose={vi.fn()} />);

    expect(screen.getByTestId('discovery-coverage-report')).toHaveTextContent(
      'Qualitative Coverage report',
    );
    expect(screen.queryByText('V9 scores')).not.toBeInTheDocument();
    expect(screen.queryByText('V9 reader evidence')).not.toBeInTheDocument();
    expect(screen.queryByText('V9 language notice')).not.toBeInTheDocument();
  });
});
