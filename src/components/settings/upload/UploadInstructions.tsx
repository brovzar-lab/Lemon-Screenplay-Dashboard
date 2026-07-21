/**
 * Upload Instructions
 * "How It Works" section with step-by-step guide and pro tip
 */

export function UploadInstructions() {
  return (
    <div className="p-4 rounded-lg bg-black-800/50 border border-black-700">
      <h4 className="text-sm font-medium text-gold-300 mb-2">How It Works</h4>
      <ol className="text-sm text-black-400 space-y-1 list-decimal list-inside">
        <li>Choose your analysis model</li>
        <li>Drop PDF screenplays into the upload zone</li>
        <li>Click &quot;Start Analysis&quot; — the secure analysis engine handles the rest</li>
      </ol>
      <div className="mt-3 p-3 rounded-lg bg-black-900/60 border border-black-700/50">
        <p className="text-xs text-gold-400/80 font-medium mb-1">💡 Pro Tip: Hybrid Strategy</p>
        <p className="text-xs text-black-400">
          Use Sonnet for routine coverage and Opus when a project needs the deepest review.
        </p>
      </div>
    </div>
  );
}
