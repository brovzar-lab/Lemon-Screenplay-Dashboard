/**
 * API Configuration Panel
 * Settings for backend API connection and budget controls
 */

import { clsx } from 'clsx';
import { useApiConfigStore } from '@/stores/apiConfigStore';

export function ApiConfigPanel() {
  const {
    apiEndpoint,
    monthlyBudgetLimit,
    dailyRequestLimit,
    currentMonthSpend,
    currentDayRequests,
    setMonthlyBudgetLimit,
    setDailyRequestLimit,
    resetDailyCount,
    resetMonthlySpend,
    getBudgetRemaining,
    getDailyRequestsRemaining,
  } = useApiConfigStore();

  const budgetUsedPercent = monthlyBudgetLimit > 0
    ? Math.min(100, (currentMonthSpend / monthlyBudgetLimit) * 100)
    : 0;

  const dailyUsedPercent = dailyRequestLimit > 0
    ? Math.min(100, (currentDayRequests / dailyRequestLimit) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* API Connection Section */}
      <div>
        <h3 className="text-lg font-display text-gold-200 mb-4">API Connection</h3>

        {/* Pre-configured Status */}
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-300">API Pre-configured</p>
              <p className="text-xs text-emerald-400/70">Anthropic API key is already set up and ready to use</p>
            </div>
          </div>
        </div>

        {/* API Endpoint (read-only display) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-black-300 mb-2">
            API Endpoint
          </label>
          <div className="px-4 py-3 rounded-lg bg-black-800/50 border border-black-700 text-sm text-black-300 font-mono">
            {apiEndpoint}
          </div>
        </div>
      </div>

      {/* Budget Controls Section */}
      <div className="border-t border-black-700 pt-6">
        <h3 className="text-lg font-display text-gold-200 mb-4">Budget Controls</h3>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Monthly Budget Limit */}
          <div>
            <label className="block text-sm font-medium text-black-300 mb-2">
              Monthly Budget Limit ($)
            </label>
            <input
              type="number"
              min="0"
              step="5"
              value={monthlyBudgetLimit}
              onChange={(e) => setMonthlyBudgetLimit(Number(e.target.value))}
              className="input"
            />
          </div>

          {/* Daily Request Limit */}
          <div>
            <label className="block text-sm font-medium text-black-300 mb-2">
              Daily Request Limit
            </label>
            <input
              type="number"
              min="0"
              step="10"
              value={dailyRequestLimit}
              onChange={(e) => setDailyRequestLimit(Number(e.target.value))}
              className="input"
            />
          </div>
        </div>

        {/* Usage Stats */}
        <div className="space-y-4 p-4 bg-black-900/50 rounded-lg">
          {/* Monthly Spend */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-black-300">Monthly Spend</span>
              <span className="text-sm font-mono text-gold-400">
                ${currentMonthSpend.toFixed(2)} / ${monthlyBudgetLimit.toFixed(2)}
              </span>
            </div>
            <div className="h-2 bg-black-800 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full transition-all duration-300 rounded-full',
                  budgetUsedPercent >= 90 ? 'bg-red-500' :
                  budgetUsedPercent >= 70 ? 'bg-amber-500' :
                  'bg-gold-500'
                )}
                style={{ width: `${budgetUsedPercent}%` }}
              />
            </div>
            <p className="text-xs text-black-500 mt-1">
              ${getBudgetRemaining().toFixed(2)} remaining
            </p>
          </div>

          {/* Daily Requests */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-black-300">Daily Requests</span>
              <span className="text-sm font-mono text-gold-400">
                {currentDayRequests} / {dailyRequestLimit}
              </span>
            </div>
            <div className="h-2 bg-black-800 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full transition-all duration-300 rounded-full',
                  dailyUsedPercent >= 90 ? 'bg-red-500' :
                  dailyUsedPercent >= 70 ? 'bg-amber-500' :
                  'bg-emerald-500'
                )}
                style={{ width: `${dailyUsedPercent}%` }}
              />
            </div>
            <p className="text-xs text-black-500 mt-1">
              {getDailyRequestsRemaining()} requests remaining today
            </p>
          </div>
        </div>

        {/* Reset Buttons */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={resetDailyCount}
            className="btn btn-ghost text-sm"
          >
            Reset Daily Count
          </button>
          <button
            onClick={resetMonthlySpend}
            className="btn btn-ghost text-sm text-amber-400 hover:text-amber-300"
          >
            Reset Monthly Spend
          </button>
        </div>
      </div>

      {/* Warning Note */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm text-amber-200 font-medium">Security Note</p>
            <p className="text-xs text-amber-300/70 mt-1">
              API keys are stored in your browser's local storage. For production use,
              consider using environment variables and a backend proxy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApiConfigPanel;
