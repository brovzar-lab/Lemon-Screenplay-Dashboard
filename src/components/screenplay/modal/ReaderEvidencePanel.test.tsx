import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createTestScreenplay } from '@/test/factories';
import { ReaderEvidencePanel } from '@/components/screenplay/modal/ReaderEvidencePanel';

const fetchReaderReports = vi.fn();

vi.mock('@/lib/readerReportService', () => ({
  fetchReaderReports: (...args: unknown[]) => fetchReaderReports(...args),
}));

function renderPanel(presentation: 'default' | 'workspace' = 'default') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ReaderEvidencePanel
        presentation={presentation}
        screenplay={createTestScreenplay({
          projectId: 'project-1',
          latestVersionId: 'version-2',
        })}
      />
    </QueryClientProvider>,
  );
}

describe('ReaderEvidencePanel', () => {
  it('loads and displays exact specialist evidence only when mounted', async () => {
    expect(fetchReaderReports).not.toHaveBeenCalled();
    fetchReaderReports.mockResolvedValueOnce([
      {
        reader: 'structure',
        label: 'Structure',
        pillarScore: 7.2,
        oneSentenceVerdict: 'The middle escalates cleanly.',
        redFlags: [],
        subScores: [
          {
            key: 'scene_necessity',
            label: 'Scene Necessity',
            score: 7,
            justification: 'Each reversal changes the next choice.',
            pageCitations: [38],
          },
        ],
      },
    ]);

    renderPanel();

    expect(await screen.findByText('Structure Reader')).toBeInTheDocument();
    expect(fetchReaderReports).toHaveBeenCalledOnce();
    expect(screen.getByText('The middle escalates cleanly.')).toBeInTheDocument();
    expect(screen.getByText('Scene Necessity')).toBeInTheDocument();
    expect(screen.getByText(/Pages 38/)).toBeInTheDocument();
  });

  it('uses the dossier heading in workspace presentation without changing reader data', async () => {
    fetchReaderReports.mockResolvedValueOnce([]);

    renderPanel('workspace');

    expect(await screen.findByText('Specialist evidence')).toBeInTheDocument();
    expect(screen.queryByText('Specialist Reader Evidence')).not.toBeInTheDocument();
  });
});
