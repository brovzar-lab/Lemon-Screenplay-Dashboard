import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGate } from '@/components/auth';

const mockInitialize = vi.fn();
let mockState: Record<string, unknown>;

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mockState),
}));

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/intake']}>
      <Routes>
        <Route
          path="/intake"
          element={
            <AuthGate requireAdmin>
              <Navigate to="/settings?tab=intake" replace />
            </AuthGate>
          }
        />
        <Route path="/settings" element={<div>Settings Intake experience</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('/intake authorization', () => {
  beforeEach(() => {
    mockInitialize.mockClear();
    mockState = {
      initialize: mockInitialize,
      status: 'ready',
      profile: { role: 'admin' },
    };
  });

  it('uses the lazy, error-bounded, admin-only route pattern', () => {
    const mainSource = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');

    expect(mainSource).toContain('path="/intake"');
    expect(mainSource).toContain('areaName="Intake"');
    expect(mainSource).toContain('<Navigate to="/settings?tab=intake" replace />');
  });

  it('allows the Lemon admin into Intake', () => {
    renderRoute();
    expect(screen.getByText('Settings Intake experience')).toBeInTheDocument();
  });

  it('keeps reader accounts out of paid intake controls', () => {
    mockState.profile = { role: 'reader' };
    renderRoute();

    expect(screen.getByRole('heading', { name: 'Admin access required' })).toBeInTheDocument();
    expect(screen.queryByText('Settings Intake experience')).not.toBeInTheDocument();
  });
});
