import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: [] }),
}));

vi.mock('@/lib/analysisService', () => ({
  analyzeScreenplay: vi.fn(),
}));

import { ModelComparisonPanel } from './ModelComparisonPanel';

describe('ModelComparisonPanel model catalog', () => {
  it('uses the same current model names and per-script estimates as Intake', () => {
    render(<ModelComparisonPanel />);

    expect(screen.getByText('Haiku 4.5')).toBeInTheDocument();
    expect(screen.getByText('Sonnet 4.6')).toBeInTheDocument();
    expect(screen.getByText('Opus 4.7')).toBeInTheDocument();
    expect(screen.getByText(/~\$0\.06\/script/)).toBeInTheDocument();
    expect(screen.getByText(/~\$0\.22\/script/)).toBeInTheDocument();
    expect(screen.getByText(/~\$0\.30\/script/)).toBeInTheDocument();
    expect(screen.queryByText('Sonnet 4.5')).not.toBeInTheDocument();
    expect(screen.queryByText('Opus 4.6')).not.toBeInTheDocument();
    expect(screen.queryByText('Opus 4')).not.toBeInTheDocument();
    expect(screen.queryByText('~$3.00')).not.toBeInTheDocument();
  });
});
