import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

let shouldThrow = false;

function TestArea() {
  if (shouldThrow) throw new Error('private implementation detail');
  return <p>Area loaded</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = false;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children while the area is healthy', () => {
    render(<ErrorBoundary><TestArea /></ErrorBoundary>);
    expect(screen.getByText('Area loaded')).toBeDefined();
  });

  it('shows safe recovery controls without exposing technical details', () => {
    shouldThrow = true;
    render(<ErrorBoundary areaName="Filters"><TestArea /></ErrorBoundary>);

    expect(screen.getByText('Filters could not load')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Retry Section' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reload App' })).toBeDefined();
    expect(screen.queryByText('private implementation detail')).toBeNull();
    expect(screen.queryByText('Component Stack')).toBeNull();
  });

  it('can retry a recovered section without reloading the whole app', () => {
    shouldThrow = true;
    render(<ErrorBoundary><TestArea /></ErrorBoundary>);
    shouldThrow = false;

    fireEvent.click(screen.getByRole('button', { name: 'Retry Section' }));

    expect(screen.getByText('Area loaded')).toBeDefined();
  });

  it('uses the provided reload action', () => {
    const onReload = vi.fn();
    shouldThrow = true;
    render(<ErrorBoundary onReload={onReload}><TestArea /></ErrorBoundary>);

    fireEvent.click(screen.getByRole('button', { name: 'Reload App' }));

    expect(onReload).toHaveBeenCalledOnce();
  });
});
