/**
 * API Configuration Panel
 * Settings for backend API connection and budget controls
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { useApiConfigStore } from '@/stores/apiConfigStore';
import { testProxyConnection } from '@/lib/proxyClient';
import { testTmdbKey } from '@/lib/tmdbService';

type KeyStatus = 'idle' | 'testing' | 'valid' | 'invalid';

export function ApiConfigPanel() {
  const {
    googleApiKey,
    isGoogleConfigured,
    setGoogleApiKey,
    tmdbApiKey,
    isTmdbConfigured,
    setTmdbApiKey,
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

  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showTmdbKey, setShowTmdbKey] = useState(false);
  const [proxyStatus, setProxyStatus] = useState<KeyStatus>('idle');
  const [proxyMessage, setProxyMessage] = useState('');
  const [tmdbTestStatus, setTmdbTestStatus] = useState<KeyStatus>('idle');
  const [tmdbTestMessage, setTmdbTestMessage] = useState('');

  const handleTestProxy = async () => {
    setProxyStatus('testing');
    setProxyMessage('');
    const result = await testProxyConnection();
    setProxyStatus(result.ok ? 'valid' : 'invalid');
    setProxyMessage(result.message);
  };

  const handleTestTmdb = async () => {
    setTmdbTestStatus('testing');
    setTmdbTestMessage('');
    const result = await testTmdbKey(tmdbApiKey);
    setTmdbTestStatus(result.ok ? 'valid' : 'invalid');
    setTmdbTestMessage(result.message);
  };

  const budgetUsedPercent = monthlyBudgetLimit > 0
    ? Math.min(100, (currentMonthSpend / monthlyBudgetLimit) * 100)
    : 0;

  const dailyUsedPercent = dailyRequestLimit > 0
    ? Math.min(100, (currentDayRequests / dailyRequestLimit) * 100)
    : 0;

  // Proxy status display config
  const statusConfig = {
    idle: {
      bg: 'bg-amber-500/10 border-amber-500/30',
      icon: <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
      label: 'AI Proxy — Not Tested',
      sublabel: 'Click "Test Connection" to verify the AI proxy is working',
      labelColor: 'text-amber-300',
      sublabelColor: 'text-amber-400/70',
    },
    testing: {
      bg: 'bg-blue-500/10 border-blue-500/30',
      icon: <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />,
      label: 'Testing Connection...',
      sublabel: 'Sending a test request through the proxy',
      labelColor: 'text-blue-300',
      sublabelColor: 'text-blue-400/70',
    },
    valid: {
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      icon: <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
      label: 'AI Proxy Connected',
      sublabel: proxyMessage,
      labelColor: 'text-emerald-300',
      sublabelColor: 'text-emerald-400/70',
    },
    invalid: {
      bg: 'bg-red-500/10 border-red-500/30',
      icon: <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
      label: 'AI Proxy Error',
      sublabel: proxyMessage,
      labelColor: 'text-red-300',
      sublabelColor: 'text-red-400/70',
    },
  };

  const s = statusConfig[proxyStatus];

  return (
    <div className="space-y-6">
      {/* AI Proxy Connection Section */}
      <div>
        <h3 className="text-lg font-display text-gold-200 mb-4">AI Connection</h3>

        {/* Proxy status badge */}
        <div className={clsx('p-4 rounded-lg border mb-4', s.bg)}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center">
              {s.icon}
            </div>
            <div className="flex-1">
              <p className={clsx('text-sm font-medium', s.labelColor)}>{s.label}</p>
              <p className={clsx('text-xs', s.sublabelColor)}>{s.sublabel}</p>
            </div>
            <button
              onClick={handleTestProxy}
              disabled={proxyStatus === 'testing'}
              className={clsx(
                'btn text-sm whitespace-nowrap',
                proxyStatus === 'valid' ? 'btn-ghost text-emerald-400' : 'btn-secondary',
                proxyStatus === 'testing' && 'opacity-50 cursor-not-allowed'
              )}
            >
              {proxyStatus === 'testing' ? 'Testing...' : proxyStatus === 'valid' ? 'Re-test' : 'Test Connection'}
            </button>
          </div>
        </div>

        <p className="text-xs text-black-500">
          AI analysis is routed through a secure server proxy. API keys are managed server-side.
        </p>
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

      {/* TMDB Section */}
      <div className="border-t border-black-700 pt-6">
        <h3 className="text-lg font-display text-gold-200 mb-1">TMDB (Production Status)</h3>
        <p className="text-xs text-black-400 mb-4">
          Required for automatic produced/unproduced checks after upload.
        </p>

        <div className={clsx(
          'p-4 rounded-lg border mb-4',
          isTmdbConfigured
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        )}>
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-10 h-10 rounded-full flex items-center justify-center',
              isTmdbConfigured ? 'bg-emerald-500/20' : 'bg-amber-500/20'
            )}>
              {isTmdbConfigured ? (
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
              )}
            </div>
            <div>
              <p className={clsx('text-sm font-medium', isTmdbConfigured ? 'text-emerald-300' : 'text-amber-300')}>
                {isTmdbConfigured ? 'TMDB Key Configured' : 'TMDB Key Not Set'}
              </p>
              <p className={clsx('text-xs', isTmdbConfigured ? 'text-emerald-400/70' : 'text-amber-400/70')}>
                {isTmdbConfigured
                  ? 'Production status checks enabled'
                  : 'Add a key to detect if screenplays have been produced'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-black-300">
            TMDB Key — paste either credential:
          </label>
          <p className="text-xs text-black-500 -mt-1">
            <span className="text-black-400">API Key (v3)</span> — short hex string &nbsp;·&nbsp;
            <span className="text-black-400">Read Access Token</span> — long JWT starting with <code className="font-mono">eyJ</code>
          </p>
          <div className="relative">
            <input
              id="tmdb-api-key-input"
              type={showTmdbKey ? 'text' : 'password'}
              value={tmdbApiKey}
              onChange={(e) => setTmdbApiKey(e.target.value)}
              placeholder="Paste API Key or Read Access Token…"
              className="input w-full pr-10 font-mono text-sm"
              autoComplete="off"
            />

            <button
              type="button"
              onClick={() => setShowTmdbKey(!showTmdbKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-black-400 hover:text-gold-400 transition-colors"
            >
              {showTmdbKey ? (
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

          <div className="flex items-center gap-3">
            <button
              id="tmdb-test-btn"
              onClick={handleTestTmdb}
              disabled={!isTmdbConfigured || tmdbTestStatus === 'testing'}
              className={clsx(
                'btn btn-secondary text-sm',
                (!isTmdbConfigured || tmdbTestStatus === 'testing') && 'opacity-50 cursor-not-allowed'
              )}
            >
              {tmdbTestStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
            {tmdbTestMessage && (
              <p className={clsx(
                'text-xs flex-1',
                tmdbTestStatus === 'valid' ? 'text-emerald-400' : 'text-red-400'
              )}>
                {tmdbTestMessage}
              </p>
            )}
          </div>

          <a
            href="https://www.themoviedb.org/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gold-400 hover:text-gold-300 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Get a free API key from TMDB
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
      <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div>
            <p className="text-sm text-emerald-200 font-medium">Secure Proxy</p>
            <p className="text-xs text-emerald-300/70 mt-1">
              AI analysis runs through a secure server-side proxy. Anthropic and Gemini API keys
              are stored on the server — they are never exposed in your browser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApiConfigPanel;
