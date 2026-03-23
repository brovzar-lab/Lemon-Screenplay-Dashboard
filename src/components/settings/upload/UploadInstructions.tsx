/**
 * Upload Instructions
 * "How It Works" section with step-by-step guide and pro tip
 */

export function UploadInstructions() {
  return (
    <div className="p-4 rounded-lg bg-black-800/50 border border-black-700">
      <h4 className="text-sm font-medium text-gold-300 mb-2">How It Works</h4>
      <ol className="text-sm text-black-400 space-y-1 list-decimal list-inside">
        <li>Configure your Anthropic API key above</li>
        <li>Choose your analysis model (Haiku for bulk, Sonnet for depth)</li>
        <li>Drop PDF screenplays into the upload zone</li>
        <li>Click &quot;Start Analysis&quot; — results appear automatically</li>
      </ol>
      <div className="mt-3 p-3 rounded-lg bg-black-900/60 border border-black-700/50">
        <p className="text-xs text-gold-400/80 font-medium mb-1">💡 Pro Tip: Hybrid Strategy</p>
        <p className="text-xs text-black-400">
          For large batches, scan everything with <strong className="text-emerald-400">Haiku</strong> first (~$0.06/script),
          then re-analyze your top picks with <strong className="text-gold-400">Sonnet</strong> for deeper insights.
          This gives you the best of both worlds at a fraction of the cost.
        </p>
      </div>
    </div>
  );
}
