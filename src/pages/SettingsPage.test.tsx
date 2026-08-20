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
vi.mock('@/components/settings/SystemStatusPanel', () => ({
  SystemStatusPanel: () => <div>System status workspace</div>,
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

    expect(screen.getByTestId('application-header')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Screenplay Upload System' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('opens the calibration workspace from a Producer Take link', () => {
    renderSettings('/settings?tab=calibration');

    expect(screen.getByText('Calibration workspace')).toBeInTheDocument();
    expect(screen.queryByText('Upload panel')).not.toBeInTheDocument();
  });

  it('orders Intelligence before Workflow, keeps Intake first in Workflow, and leaves Calibration last', () => {
    renderSettings('/settings?tab=intake');

    const sectionButtons = screen.getAllByRole('button').filter((button) =>
      ['Screenplay Upload System', 'Featured Project', 'Analysis Health', 'Model Comparison', 'Screenplays', 'Data & Sharing', 'System Status', 'Calibration'].includes(
        button.getAttribute('aria-label') ?? '',
      ),
    );
    expect(sectionButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Analysis Health',
      'Model Comparison',
      'Screenplay Upload System',
      'Featured Project',
      'Screenplays',
      'Data & Sharing',
      'System Status',
      'Calibration',
    ]);
    expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'System' })).toBeInTheDocument();
  });

  it.each([
    ['/settings?tab=pdf_files', 'PDF files'],
    ['/settings?tab=api-settings', 'System status workspace'],
    ['/settings?tab=taste-calibration', 'Calibration workspace'],
  ])('preserves the legacy settings alias %s', (entry, expected) => {
    renderSettings(entry);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('keeps the selected settings tab in the URL', async () => {
    const user = userEvent.setup();
    renderSettings('/settings?tab=calibration');

    await user.click(screen.getByRole('button', { name: 'Data & Sharing' }));

    expect(screen.getByText('Shared links workspace')).toBeInTheDocument();
    expect(screen.getByLabelText('Current location')).toHaveTextContent('?tab=data');
  });
});
