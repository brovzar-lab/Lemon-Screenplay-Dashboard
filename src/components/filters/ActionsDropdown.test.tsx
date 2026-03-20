import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionsDropdown } from './ActionsDropdown';

const defaultProps = {
  onGenerateShareLinks: vi.fn(),
  onReanalyze: vi.fn(),
  reanalyzeEligibleCount: 1,
  selectionCount: 3,
};

describe('ActionsDropdown', () => {
  it('renders an "Actions" button and dropdown is not visible initially', () => {
    render(<ActionsDropdown {...defaultProps} />);
    expect(screen.getByRole('button', { name: /actions/i })).toBeInTheDocument();
    expect(screen.queryByText(/generate share links/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/re-analyze selected/i)).not.toBeInTheDocument();
  });

  it('clicking the button opens the dropdown with both menu items', () => {
    render(<ActionsDropdown {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    expect(screen.getByText(/generate share links/i)).toBeInTheDocument();
    expect(screen.getByText(/re-analyze selected/i)).toBeInTheDocument();
  });

  it('clicking outside the dropdown closes it', () => {
    render(<ActionsDropdown {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    expect(screen.getByText(/generate share links/i)).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByText(/generate share links/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/re-analyze selected/i)).not.toBeInTheDocument();
  });

  it('"Re-analyze Selected" is disabled when reanalyzeEligibleCount === 0', () => {
    render(<ActionsDropdown {...defaultProps} reanalyzeEligibleCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));

    const reanalyzeItem = screen.getByText(/re-analyze selected/i).closest('[role="menuitem"], button, [aria-disabled]');
    expect(
      reanalyzeItem?.hasAttribute('disabled') ||
      reanalyzeItem?.getAttribute('aria-disabled') === 'true'
    ).toBe(true);

    // Check title contains "No eligible screenplays"
    const titleAttr = reanalyzeItem?.getAttribute('title') ?? '';
    expect(titleAttr).toMatch(/no eligible screenplays/i);
  });

  it('clicking "Generate Share Links" calls onGenerateShareLinks and closes dropdown', () => {
    const onGenerateShareLinks = vi.fn();
    render(<ActionsDropdown {...defaultProps} onGenerateShareLinks={onGenerateShareLinks} />);
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    fireEvent.click(screen.getByText(/generate share links/i));

    expect(onGenerateShareLinks).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/generate share links/i)).not.toBeInTheDocument();
  });

  it('clicking "Re-analyze Selected" (when enabled) calls onReanalyze and closes dropdown', () => {
    const onReanalyze = vi.fn();
    render(<ActionsDropdown {...defaultProps} onReanalyze={onReanalyze} reanalyzeEligibleCount={2} />);
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    fireEvent.click(screen.getByText(/re-analyze selected/i));

    expect(onReanalyze).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/re-analyze selected/i)).not.toBeInTheDocument();
  });
});
