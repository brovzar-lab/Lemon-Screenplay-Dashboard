export function ActiveSlatePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Active Slate</h1>
        <p className="text-sm text-gray-500 mt-0.5">All projects — platform, status, key dates</p>
      </div>
      <div className="bg-surface-2 border border-border rounded-xl p-12 flex flex-col items-center gap-3">
        <span className="text-4xl opacity-30">▦</span>
        <p className="text-sm font-medium text-gray-400">Slate view coming soon</p>
        <p className="text-xs text-gray-600 text-center max-w-xs">
          All active titles with platform, status chips, key dates, and owner — in a scannable table.
        </p>
      </div>
    </div>
  )
}
