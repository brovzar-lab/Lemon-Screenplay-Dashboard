import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary, LoadingFallback } from '@/components/ui';
import { AuthGate } from '@/components/auth';
import './index.css';
import App from './App';

// Lazy-loaded routes — loaded on demand for code splitting
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SharedViewPage = lazy(() => import('./pages/SharedViewPage'));

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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<AuthGate><App /></AuthGate>} />
              <Route path="/settings" element={<AuthGate requireAdmin><SettingsPage /></AuthGate>} />
              <Route path="/share/:token" element={<SharedViewPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
