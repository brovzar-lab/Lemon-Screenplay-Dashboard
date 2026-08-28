import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary, ToastContainer } from '@/components/ui';
import { AuthGate } from '@/components/auth';
import {
  ApplicationRouteFallback,
  SharedRouteFallback,
} from '@/components/layout/ApplicationRouteFallback';
import './index.css';
import { importWithReload } from '@/lib/lazyWithReload';
import '@/i18n';

// Lazy-loaded routes — loaded on demand for code splitting
const SettingsPage = lazy(() => importWithReload('settings', () => import('./pages/SettingsPage')));
const StudioPulsePage = lazy(() =>
  importWithReload('studio-pulse', () => import('./pages/StudioPulsePage')),
);
const DiscoverPage = lazy(() => importWithReload('discover', () => import('./pages/DiscoverPage')));
const ProjectWorkspacePage = lazy(() =>
  importWithReload('project-workspace', () => import('@/pages/ProjectWorkspacePage')),
);
const SharedViewPage = lazy(() =>
  importWithReload('shared-view', () => import('./pages/SharedViewPage')),
);

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 30, // 30 minutes
      gcTime: 1000 * 60 * 60, // 1 hour
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fullPage areaName="Application">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
              <Route
                path="/"
                element={
                  <ErrorBoundary fullPage areaName="Intelligence Briefing">
                    <Suspense fallback={<ApplicationRouteFallback />}>
                      <AuthGate>
                        <StudioPulsePage />
                      </AuthGate>
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/dashboard-classic"
                element={<Navigate to="/discover" replace />}
              />
              <Route
                path="/settings"
                element={
                  <ErrorBoundary fullPage areaName="Settings">
                    <Suspense fallback={<ApplicationRouteFallback />}>
                      <AuthGate requireAdmin>
                        <SettingsPage />
                      </AuthGate>
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/discover/:projectId?"
                element={
                  <ErrorBoundary fullPage areaName="Discovery">
                    <Suspense fallback={<ApplicationRouteFallback />}>
                      <AuthGate>
                        <DiscoverPage />
                      </AuthGate>
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/intake"
                element={
                  <ErrorBoundary fullPage areaName="Intake">
                    <Suspense fallback={<ApplicationRouteFallback />}>
                      <AuthGate requireAdmin>
                        <Navigate to="/settings?tab=intake" replace />
                      </AuthGate>
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/projects/:projectId/:section?"
                element={
                  <ErrorBoundary fullPage areaName="Project Workspace">
                    <Suspense fallback={<ApplicationRouteFallback />}>
                      <AuthGate>
                        <ProjectWorkspacePage />
                      </AuthGate>
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/share/:token"
                element={
                  <ErrorBoundary fullPage areaName="Shared screenplay">
                    <Suspense fallback={<SharedRouteFallback />}>
                      <SharedViewPage />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ToastContainer />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
