import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/settings/UploadPanel', () => ({
  UploadPanel: () => <div>Upload panel</div>,
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
  it('opens the calibration workspace from a Producer Take link', () => {
    renderSettings('/settings?tab=calibration');

    expect(screen.getByText('Calibration workspace')).toBeInTheDocument();
    expect(screen.queryByText('Upload panel')).not.toBeInTheDocument();
  });

  it('keeps the selected settings tab in the URL', async () => {
    const user = userEvent.setup();
    renderSettings('/settings?tab=calibration');

    await user.click(screen.getByRole('button', { name: 'Data' }));

    expect(screen.getByText('Shared links workspace')).toBeInTheDocument();
    expect(screen.getByLabelText('Current location')).toHaveTextContent('?tab=data');
  });
});
