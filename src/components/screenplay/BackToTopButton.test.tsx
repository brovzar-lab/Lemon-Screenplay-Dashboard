import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BackToTopButton } from './BackToTopButton';

// Mock selection store -- default: no selection
let mockHasSelection = false;

vi.mock('@/stores/selectionStore', () => ({
  useHasSelection: () => mockHasSelection,
}));

describe('BackToTopButton', () => {
  it('renders with "Scroll to top" aria-label', () => {
    render(<BackToTopButton visible={true} onClick={vi.fn()} />);
    expect(screen.getByLabelText('Scroll to top')).toBeInTheDocument();
  });

  it('is visible when visible prop is true', () => {
    render(<BackToTopButton visible={true} onClick={vi.fn()} />);
    const btn = screen.getByLabelText('Scroll to top');
    expect(btn.className).toContain('opacity-100');
    expect(btn.className).not.toContain('pointer-events-none');
  });

  it('is hidden when visible prop is false', () => {
    render(<BackToTopButton visible={false} onClick={vi.fn()} />);
    const btn = screen.getByLabelText('Scroll to top');
    expect(btn.className).toContain('opacity-0');
    expect(btn.className).toContain('pointer-events-none');
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<BackToTopButton visible={true} onClick={handleClick} />);
    fireEvent.click(screen.getByLabelText('Scroll to top'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('displays "Top" text', () => {
    render(<BackToTopButton visible={true} onClick={vi.fn()} />);
    expect(screen.getByText('Top')).toBeInTheDocument();
  });

  it('uses bottom-6 when no selection', () => {
    mockHasSelection = false;
    render(<BackToTopButton visible={true} onClick={vi.fn()} />);
    const btn = screen.getByLabelText('Scroll to top');
    expect(btn.className).toContain('bottom-6');
    expect(btn.className).not.toContain('bottom-20');
  });

  it('uses bottom-20 when selection active', () => {
    mockHasSelection = true;
    render(<BackToTopButton visible={true} onClick={vi.fn()} />);
    const btn = screen.getByLabelText('Scroll to top');
    expect(btn.className).toContain('bottom-20');
    expect(btn.className).not.toContain('bottom-6');
  });
});
