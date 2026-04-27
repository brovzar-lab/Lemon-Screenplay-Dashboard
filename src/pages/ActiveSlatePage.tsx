export function ActiveSlatePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Active Slate</h1>
        <p className="text-sm text-gray-500 mt-0.5">All projects — platform, status, key dates</p>
      </div>
      <div className="bg-surface-2 border border-border rounded-xl p-8 text-center">
        <p className="text-sm text-gray-600">Full implementation in <span className="text-lemon-400">LEMA-685</span></p>
      </div>
    </div>
  )
}
