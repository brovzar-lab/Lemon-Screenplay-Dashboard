/**
 * API Config Toggle
 * Collapsible section that shows API configuration status and embeds ApiConfigPanel
 */

import { clsx } from 'clsx';
import { ApiConfigPanel } from '../ApiConfigPanel';

interface ApiConfigToggleProps {
  isConfigured: boolean;
  showApiConfig: boolean;
  onToggle: () => void;
}

export function ApiConfigToggle({ isConfigured, showApiConfig, onToggle }: ApiConfigToggleProps) {
  return (
    <div className="border border-black-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-black-800/50 hover:bg-black-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div className="text-left">
            <span className="font-medium text-gold-200">API Configuration</span>
            <span className={clsx(
              'ml-2 text-xs px-2 py-0.5 rounded-full',
              isConfigured ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            )}>
              {isConfigured ? 'Configured' : 'Not Configured'}
            </span>
          </div>
        </div>
        <svg
          className={clsx('w-5 h-5 text-black-400 transition-transform', showApiConfig && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {showApiConfig && (
        <div className="p-4 border-t border-black-700">
          <ApiConfigPanel />
        </div>
      )}
    </div>
  );
}
