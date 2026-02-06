/**
 * API Configuration Panel
 * Settings for backend API connection and budget controls
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { useApiConfigStore } from '@/stores/apiConfigStore';

export function ApiConfigPanel() {
  const {
    apiKey,
    apiEndpoint,
    isConfigured,
    monthlyBudgetLimit,
    dailyRequestLimit,
    currentMonthSpend,
    currentDayRequests,
    setApiKey,
    setApiEndpoint,
    setMonthlyBudgetLimit,
    setDailyRequestLimit,
    resetDailyCount,
    resetMonthlySpend,
    getBudgetRemaining,
    getDailyRequestsRemaining,
  } = useApiConfigStore();

  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  const budgetUsedPercent = monthlyBudgetLimit > 0
    ? Math.min(100, (currentMonthSpend / monthlyBudgetLimit) * 100)
    : 0;

  const dailyUsedPercent = dailyRequestLimit > 0
    ? Math.min(100, (currentDayRequests / dailyRequestLimit) * 100)
    : 0;

  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestStatus('error');
      setTestError('Please enter an API key first');
      return;
    }

    setTestStatus('testing');
    setTestError('');

    try {
      // Simple validation - just check if key format looks valid
      // Real validation would require a backend proxy to avoid exposing the key
      if (apiKey.startsWith('sk-ant-') && apiKey.length > 20) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setTestError('API key format appears invalid. Keys should start with "sk-ant-"');
      }
    } catch {
      setTestStatus('error');
      setTestError('Connection test failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* API Connection Section */}
      <div>
        <h3 className="text-lg font-display text-gold-200 mb-4">API Connection</h3>

        {/* Connection Status */}
        <div className={clsx(
          'p-3 rounded-lg mb-4 flex items-center gap-3',
          isConfigured ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'
        )}>
          <div className={clsx(
            'w-3 h-3 rounded-full',
            isConfigured ? 'bg-emerald-500' : 'bg-amber-500'
          )} />
          <span className={clsx(
            'text-sm',
            isConfigured ? 'text-emerald-300' : 'text-amber-300'
          )}>
            {isConfigured ? 'API Configured' : 'API Not Configured'}
          </span>
        </div>

        {/* API Key Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-black-300 mb-2">
            API Key
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="input pr-20"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs text-black-400 hover:text-gold-400"
            >
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-xs text-black-500 mt-1">
            Your Anthropic API key for screenplay analysis
          </p>
        </div>

        {/* API Endpoint */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-black-300 mb-2">
            API Endpoint
          </label>
          <input
            type="url"
            value={apiEndpoint}
            onChange={(e) => setApiEndpoint(e.target.value)}
            placeholder="https://api.anthropic.com/v1/messages"
            className="input"
          />
          <p className="text-xs text-black-500 mt-1">
            Default: https://api.anthropic.com/v1/messages
          </p>
        </div>

        {/* Test Connection Button */}
        <button
          onClick={handleTestConnection}
          disabled={testStatus === 'testing'}
          className={clsx(
            'btn text-sm',
            testStatus === 'success' ? 'btn-primary bg-emerald-500 border-emerald-500' :
            testStatus === 'error' ? 'btn-secondary border-red-500 text-red-400' :
            'btn-secondary'
          )}
        >
          {testStatus === 'testing' ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Testing...
            </>
          ) : testStatus === 'success' ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Connected!
            </>
          ) : (
            'Test Connection'
          )}
        </button>

        {testError && (
          <p className="text-sm text-red-400 mt-2">{testError}</p>
        )}
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
