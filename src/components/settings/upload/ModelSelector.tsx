/**
 * Model Selector
 * Displays available AI models as selection cards with cost/speed/quality stats
 */

import { clsx } from 'clsx';
import { MODEL_OPTIONS } from './upload.constants';
import type { ModelOption } from './upload.types';

interface ModelSelectorProps {
  selectedModel: ModelOption;
  onSelectModel: (model: ModelOption) => void;
  pendingCount: number;
  batchCostEstimate: string | null;
}

export function ModelSelector({ selectedModel, onSelectModel, pendingCount, batchCostEstimate }: ModelSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gold-300 mb-3">
        Analysis Model
      </label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {MODEL_OPTIONS.map((model) => (
          <button
            key={model.id}
            onClick={() => onSelectModel(model.id)}
            className={clsx(
              'relative p-4 rounded-xl border text-left transition-all',
              selectedModel === model.id
                ? 'border-gold-500/60 bg-gold-500/10 ring-1 ring-gold-500/30'
                : 'border-black-700 bg-black-800/50 hover:border-gold-500/30 hover:bg-black-800'
            )}
          >
            {/* Badge */}
            <span className={clsx(
              'absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider',
              model.badgeColor
            )}>
              {model.badge}
            </span>

            {/* Model Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{model.icon}</span>
              <div>
                <p className={clsx(
                  'font-semibold text-sm',
                  selectedModel === model.id ? 'text-gold-200' : 'text-black-200'
                )}>
                  {model.name}
                </p>
                <p className="text-xs text-black-400">{model.subtitle}</p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mt-3 mb-3">
              <div className="text-center">
                <p className="text-xs text-black-500 mb-0.5">Cost</p>
                <p className={clsx(
                  'text-sm font-mono font-bold',
                  model.id === 'haiku' ? 'text-emerald-400' :
                    model.id === 'sonnet' ? 'text-gold-400' : 'text-purple-400'
                )}>
                  {model.costPerScript}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-black-500 mb-0.5">Speed</p>
                <p className="text-sm font-mono text-black-300">{model.speed}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-black-500 mb-0.5">Quality</p>
                <p className="text-sm font-mono text-black-300">{model.quality}</p>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-black-400 leading-relaxed">
              {model.description}
            </p>

            {/* Selection Indicator */}
            {selectedModel === model.id && (
              <div className="absolute top-3 left-3">
                <div className="w-4 h-4 rounded-full bg-gold-500 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Batch cost estimate */}
      {pendingCount > 0 && batchCostEstimate && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-black-400">
            Estimated batch cost for {pendingCount} files with {MODEL_OPTIONS.find(m => m.id === selectedModel)!.name}: {' '}
            <span className="font-mono text-gold-300">{batchCostEstimate}</span>
          </span>
        </div>
      )}
    </div>
  );
}
