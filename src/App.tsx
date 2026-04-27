import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { OverviewPage } from './pages/OverviewPage'
import { ActiveSlatePage } from './pages/ActiveSlatePage'
import { PipelinePage } from './pages/PipelinePage'
import { CoveragePage } from './pages/CoveragePage'
import { MarketIntelPage } from './pages/MarketIntelPage'
import { TitleDetailPage } from './pages/TitleDetailPage'

export default function App() {
  const init = useAuthStore(s => s.init)

  useEffect(() => {
    const unsubscribe = init()
    return unsubscribe
  }, [init])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="slate" element={<ActiveSlatePage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="coverage" element={<CoveragePage />} />
          <Route path="market" element={<MarketIntelPage />} />
          <Route path="titles/:id" element={<TitleDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
