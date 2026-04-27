import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { KpiBar } from './KpiBar'
import { useTitleStore } from '../store/titleStore'
import { useEffect } from 'react'

export function Layout() {
  const load = useTitleStore(s => s.load)

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-gray-200">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <KpiBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
