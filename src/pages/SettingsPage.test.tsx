import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const uploadPanelMock = vi.hoisted(() => vi.fn());

vi.mock('@/components/settings/UploadPanel', () => ({
  UploadPanel: (props: Record<string, unknown>) => {
    uploadPanelMock(props);
    return <div>Upload panel</div>;
  },
}));
vi.mock('@/components/settings/DataManagement', () => ({
  DataManagement: () => <div>Data management</div>,
}));
vi.mock('@/components/settings/CategoryManagement', () => ({
  CategoryManagement: () => <div>Category management</div>,
}));
vi.mock('@/components/settings/ModelComparisonPanel', () => ({
  ModelComparisonPanel: () => <div>Model comparison</div>,
}));
vi.mock('@/components/settings/CalibrationPanel', () => ({
  CalibrationPanel: () => <div>Calibration workspace</div>,
}));
vi.mock('@/components/settings/PdfUploadPanel', () => ({
  PdfUploadPanel: () => <div>PDF files</div>,
}));
vi.mock('@/components/settings/SharedLinksPanel', () => ({
  SharedLinksPanel: () => <div>Shared links workspace</div>,
}));
vi.mock('@/components/settings/FavoritesPanel', () => ({
  FavoritesPanel: () => <div>Favorites workspace</div>,
}));
vi.mock('@/components/settings/AnalysisOverview', () => ({
  AnalysisOverview: () => <div>Analysis overview</div>,
}));
vi.mock('@/components/settings/ApiConfigPanel', () => ({
  ApiConfigPanel: () => <div>API configuration</div>,
}));
vi.mock('@/components/settings/PasswordGate', () => ({
  PasswordGate: ({ children }: { children: React.ReactNode }) => children,
}));

vi.stubGlobal('__APP_VERSION__', 'test');

import { SettingsPage } from '@/pages/SettingsPage';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current location">{location.search}</output>;
}

function renderSettings(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/settings"
          element={
            <>
              <SettingsPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Settings deep links', () => {
  it('opens the complete Intake desk by default', () => {
    renderSettings('/settings');

    expect(screen.getByText('Upload panel')).toBeInTheDocument();
    expect(uploadPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({ presentation: 'intake', initialModel: 'hybrid' }),
    );
    expect(screen.getByRole('heading', { name: 'Workflow' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Intelligence' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'System' })).toBeInTheDocument();
  });

  it('keeps the legacy Upload deep link as an Intake alias', () => {
    renderSettings('/settings?tab=upload');

    expect(screen.getByText('Upload panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Intake' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens the calibration workspace from a Producer Take link', () => {
    renderSettings('/settings?tab=calibration');

    expect(screen.getByText('Calibration workspace')).toBeInTheDocument();
    expect(screen.queryByText('Upload panel')).not.toBeInTheDocument();
  });

  it('keeps the selected settings tab in the URL', async () => {
    const user = userEvent.setup();
    renderSettings('/settings?tab=calibration');

    await user.click(screen.getByRole('button', { name: 'Data & Sharing' }));

    expect(screen.getByText('Shared links workspace')).toBeInTheDocument();
    expect(screen.getByLabelText('Current location')).toHaveTextContent('?tab=data');
  });
});
