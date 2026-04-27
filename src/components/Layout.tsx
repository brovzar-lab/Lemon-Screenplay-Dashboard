import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { KpiBar } from './KpiBar'
import { useTitleStore } from '../store/titleStore'
import { useEffect, useState } from 'react'

export function Layout() {
  const load = useTitleStore(s => s.load)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    load()
  }, [load])

  // Close sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-gray-200">
      <Sidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main content — offset by sidebar width on md+ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden md:ml-0">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-2 md:hidden">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="text-gray-400 hover:text-gray-100 transition-colors text-xl leading-none"
            aria-label="Open navigation"
          >
            ☰
          </button>
          <span className="text-lemon-400 font-semibold text-sm">🍋 Lemon Studio</span>
        </div>

        <KpiBar />

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
