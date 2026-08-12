import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect, Suspense, lazy } from 'react'
import { useAuthStore } from './store/authStore'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { PageSkeleton } from './components/Skeleton'

const LoginPage            = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))
const LasAzulesPage        = lazy(() => import('./pages/LasAzulesPage').then(m => ({ default: m.LasAzulesPage })))
const CommandCenterPage    = lazy(() => import('./pages/CommandCenterPage').then(m => ({ default: m.CommandCenterPage })))
const ActiveSlatePage      = lazy(() => import('./pages/ActiveSlatePage').then(m => ({ default: m.ActiveSlatePage })))
const FilmDevelopmentPage  = lazy(() => import('./pages/FilmDevelopmentPage').then(m => ({ default: m.FilmDevelopmentPage })))
const TVDevelopmentPage    = lazy(() => import('./pages/TVDevelopmentPage').then(m => ({ default: m.TVDevelopmentPage })))
const PipelinePage         = lazy(() => import('./pages/PipelinePage').then(m => ({ default: m.PipelinePage })))
const CoveragePage         = lazy(() => import('./pages/CoveragePage').then(m => ({ default: m.CoveragePage })))
const MarketIntelPage      = lazy(() => import('./pages/MarketIntelPage').then(m => ({ default: m.MarketIntelPage })))
const TitleDetailPage      = lazy(() => import('./pages/TitleDetailPage').then(m => ({ default: m.TitleDetailPage })))

function PageFallback() {
  return (
    <div className="p-6">
      <PageSkeleton />
    </div>
  )
}

export default function App() {
  const init = useAuthStore(s => s.init)

  useEffect(() => {
    const unsubscribe = init()
    return unsubscribe
  }, [init])

  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/las-azules" element={<LasAzulesPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<CommandCenterPage />} />
            <Route path="slate"      element={<ActiveSlatePage />} />
            <Route path="film-dev"   element={<FilmDevelopmentPage />} />
            <Route path="tv-dev"     element={<TVDevelopmentPage />} />
            <Route path="pipeline"   element={<PipelinePage />} />
            <Route path="coverage"   element={<CoveragePage />} />
            <Route path="market"     element={<MarketIntelPage />} />
            <Route path="titles/:id" element={<TitleDetailPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
