import { useParams, Link } from 'react-router-dom'

export function TitleDetailPage() {
  const { id } = useParams()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/" className="hover:text-gray-300 transition-colors">Overview</Link>
        <span>›</span>
        <span className="text-gray-300">Title Detail</span>
      </div>
      <div className="bg-surface-2 border border-border rounded-xl p-8 text-center">
        <p className="text-sm text-gray-400 mb-1">Title ID: <code className="text-lemon-400">{id}</code></p>
        <p className="text-sm text-gray-600">Full drill-down implementation in <span className="text-lemon-400">LEMA-689</span></p>
      </div>
    </div>
  )
}
