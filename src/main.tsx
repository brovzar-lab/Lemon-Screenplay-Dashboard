import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary, LoadingFallback, ToastContainer } from '@/components/ui';
import { AuthGate } from '@/components/auth';
import './index.css';
import App from './App';
import { importWithReload } from '@/lib/lazyWithReload';

// Lazy-loaded routes — loaded on demand for code splitting
const SettingsPage = lazy(() => importWithReload('settings', () => import('./pages/SettingsPage')));
const SharedViewPage = lazy(() => importWithReload('shared-view', () => import('./pages/SharedViewPage')));

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
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route
                path="/"
                element={
                  <ErrorBoundary fullPage areaName="Dashboard">
                    <AuthGate><App /></AuthGate>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/settings"
                element={
                  <ErrorBoundary fullPage areaName="Settings">
                    <AuthGate requireAdmin><SettingsPage /></AuthGate>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/share/:token"
                element={
                  <ErrorBoundary fullPage areaName="Shared screenplay">
                    <SharedViewPage />
                  </ErrorBoundary>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <ToastContainer />
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
