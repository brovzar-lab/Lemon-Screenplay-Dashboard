/**
 * API Configuration Panel
 * Settings for backend API connection and budget controls
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { useApiConfigStore } from '@/stores/apiConfigStore';

type KeyStatus = 'idle' | 'testing' | 'valid' | 'invalid';

async function testAnthropicKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    // Minimal request — 1 token output, just validates auth
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    if (res.ok) return { ok: true, message: 'API key is valid' };

    const json = await res.json().catch(() => ({}));
    const errMsg = (json as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;

    if (res.status === 401) return { ok: false, message: `Invalid API key — ${errMsg}` };
    if (res.status === 403) return { ok: false, message: `Access denied — ${errMsg}` };
    if (res.status === 429) return { ok: true, message: 'Key valid (rate limited — try later)' };
    return { ok: false, message: `Error: ${errMsg}` };
  } catch (err) {
    return { ok: false, message: `Network error: ${err instanceof Error ? err.message : 'Unknown'}` };
  }
}

export function ApiConfigPanel() {
  const {
    apiKey,
    apiEndpoint,
    googleApiKey,
    isGoogleConfigured,
    setApiKey,
    setGoogleApiKey,
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

  const [showApiKey, setShowApiKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>(apiKey.length > 0 ? 'idle' : 'idle');
  const [keyMessage, setKeyMessage] = useState('');

  const handleTestKey = async () => {
    if (!apiKey) return;
    setKeyStatus('testing');
    setKeyMessage('');
    const result = await testAnthropicKey(apiKey);
    setKeyStatus(result.ok ? 'valid' : 'invalid');
    setKeyMessage(result.message);
  };

  const handleKeyChange = (val: string) => {
    setApiKey(val);
    setKeyStatus('idle');
    setKeyMessage('');
  };

  const budgetUsedPercent = monthlyBudgetLimit > 0
    ? Math.min(100, (currentMonthSpend / monthlyBudgetLimit) * 100)
    : 0;

  const dailyUsedPercent = dailyRequestLimit > 0
    ? Math.min(100, (currentDayRequests / dailyRequestLimit) * 100)
    : 0;

  // Status display config
  const statusConfig = {
    idle: {
      bg: apiKey ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30',
      icon: apiKey
        ? <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        : <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
      label: apiKey ? 'API Key Entered — Not Tested' : 'No API Key',
      sublabel: apiKey ? 'Click "Test Key" to verify it works' : 'Enter your Anthropic API key below',
      labelColor: apiKey ? 'text-amber-300' : 'text-red-300',
      sublabelColor: apiKey ? 'text-amber-400/70' : 'text-red-400/70',
    },
    testing: {
      bg: 'bg-blue-500/10 border-blue-500/30',
      icon: <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />,
      label: 'Testing API Key...',
      sublabel: 'Sending a test request to Anthropic',
      labelColor: 'text-blue-300',
      sublabelColor: 'text-blue-400/70',
    },
    valid: {
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      icon: <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
      label: 'API Key Valid ✓',
      sublabel: keyMessage,
      labelColor: 'text-emerald-300',
      sublabelColor: 'text-emerald-400/70',
    },
    invalid: {
      bg: 'bg-red-500/10 border-red-500/30',
      icon: <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
      label: 'API Key Invalid ✗',
      sublabel: keyMessage,
      labelColor: 'text-red-300',
      sublabelColor: 'text-red-400/70',
    },
  };

  const s = statusConfig[keyStatus];

  return (
    <div className="space-y-6">
      {/* API Connection Section */}
      <div>
        <h3 className="text-lg font-display text-gold-200 mb-4">API Connection</h3>

        {/* Status badge */}
        <div className={clsx('p-4 rounded-lg border mb-4', s.bg)}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center">
              {s.icon}
            </div>
            <div>
              <p className={clsx('text-sm font-medium', s.labelColor)}>{s.label}</p>
              <p className={clsx('text-xs', s.sublabelColor)}>{s.sublabel}</p>
            </div>
          </div>
        </div>

        {/* Anthropic API Key Input */}
        <div className="space-y-3 mb-4">
          <label className="block text-sm font-medium text-black-300">
            Anthropic API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder="sk-ant-..."
                className="input w-full pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black-400 hover:text-gold-400 transition-colors"
              >
                {showApiKey ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <button
              onClick={handleTestKey}
              disabled={!apiKey || keyStatus === 'testing'}
              className={clsx(
                'btn text-sm whitespace-nowrap',
                keyStatus === 'valid' ? 'btn-ghost text-emerald-400' : 'btn-secondary',
                (!apiKey || keyStatus === 'testing') && 'opacity-50 cursor-not-allowed'
              )}
            >
              {keyStatus === 'testing' ? 'Testing...' : keyStatus === 'valid' ? '✓ Re-test' : 'Test Key'}
            </button>
          </div>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gold-400 hover:text-gold-300 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Get an API key from Anthropic Console
          </a>
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

      {/* Google API Key Section */}
      <div className="border-t border-black-700 pt-6">
        <h3 className="text-lg font-display text-gold-200 mb-1">Google AI (Poster Generation)</h3>
        <p className="text-xs text-black-400 mb-4">
          Required for AI movie poster generation using Gemini.
        </p>

        <div className={clsx(
          'p-4 rounded-lg border mb-4',
          isGoogleConfigured
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        )}>
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-10 h-10 rounded-full flex items-center justify-center',
              isGoogleConfigured ? 'bg-emerald-500/20' : 'bg-amber-500/20'
            )}>
              {isGoogleConfigured ? (
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            <div>
              <p className={clsx('text-sm font-medium', isGoogleConfigured ? 'text-emerald-300' : 'text-amber-300')}>
                {isGoogleConfigured ? 'Google API Key Configured' : 'Google API Key Not Set'}
              </p>
              <p className={clsx('text-xs', isGoogleConfigured ? 'text-emerald-400/70' : 'text-amber-400/70')}>
                {isGoogleConfigured ? 'Poster generation with Gemini is enabled' : 'Add a key to enable AI poster generation'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-black-300">
            Google API Key
          </label>
          <div className="relative">
            <input
              type={showGoogleKey ? 'text' : 'password'}
              value={googleApiKey}
              onChange={(e) => setGoogleApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="input w-full pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowGoogleKey(!showGoogleKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-black-400 hover:text-gold-400 transition-colors"
            >
              {showGoogleKey ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gold-400 hover:text-gold-300 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Get a free API key from Google AI Studio
          </a>
        </div>
      </div>

      {/* Budget Controls Section */}
      <div className="border-t border-black-700 pt-6">
        <h3 className="text-lg font-display text-gold-200 mb-4">Budget Controls</h3>

        <div className="grid grid-cols-2 gap-4 mb-6">
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
            <p className="text-xs text-black-500 mt-1">${getBudgetRemaining().toFixed(2)} remaining</p>
          </div>

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
            <p className="text-xs text-black-500 mt-1">{getDailyRequestsRemaining()} requests remaining today</p>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={resetDailyCount} className="btn btn-ghost text-sm">
            Reset Daily Count
          </button>
          <button onClick={resetMonthlySpend} className="btn btn-ghost text-sm text-amber-400 hover:text-amber-300">
            Reset Monthly Spend
          </button>
        </div>
      </div>

      {/* Security Note */}
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
