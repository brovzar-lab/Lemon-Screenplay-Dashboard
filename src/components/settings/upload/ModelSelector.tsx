/**
 * Model Selector
 * Displays available AI models as selection cards with cost/speed/quality stats
 */

import { clsx } from 'clsx';
import modelCatalog from '@/config/anthropic-model-catalog.json';
import { MODEL_OPTIONS } from './upload.constants';
import type { ModelOption, UploadPresentation } from '@/components/settings/upload/upload.types';

interface ModelSelectorProps {
  selectedModel: ModelOption;
  onSelectModel: (model: ModelOption) => void;
  pendingCount: number;
  batchCostEstimate: string | null;
  presentation?: UploadPresentation;
}

export function ModelSelector({
  selectedModel,
  onSelectModel,
  pendingCount,
  batchCostEstimate,
  presentation = 'settings',
}: ModelSelectorProps) {
  const isIntake = presentation === 'intake';
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={clsx(
            'block text-sm font-medium',
            isIntake ? 'text-[var(--dsc-ink)]' : 'text-gold-300',
          )}>
            Analysis Model
          </p>
          <p className={clsx('mt-1 text-xs', isIntake ? 'text-[var(--dsc-ink-3)]' : 'text-black-400')}>
            Approved routes verified {new Date(`${modelCatalog.verifiedAt}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. New releases require benchmark approval before scoring changes.
          </p>
        </div>
        <span className={clsx('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]', isIntake ? 'bg-[var(--dsc-accent-soft)] text-[var(--dsc-accent)]' : 'bg-black-700 text-black-300')}>
          Version-pinned
        </span>
      </div>
      <div className={clsx('mb-3 rounded-lg border px-3 py-2 text-xs leading-relaxed', isIntake ? 'border-[var(--dsc-line)] bg-[var(--dsc-surface-2)] text-[var(--dsc-ink-2)]' : 'border-black-700 bg-black-800/50 text-black-300')}>
        <strong className={isIntake ? 'text-[var(--dsc-ink)]' : 'text-black-100'}>Catalog watch:</strong>{' '}
        Anthropic currently lists <code>{modelCatalog.latestObserved.sonnet}</code> and{' '}
        <code>{modelCatalog.latestObserved.opus}</code>. Analysis remains pinned to{' '}
        <code>{modelCatalog.analysisRoutes.sonnet.modelId}</code> and{' '}
        <code>{modelCatalog.analysisRoutes.opus.modelId}</code> until newer routes pass Lemon&apos;s
        sealed screenplay benchmark.
      </div>
      <div className={clsx('grid grid-cols-1 gap-3 md:grid-cols-2', isIntake && '2xl:grid-cols-4')}>
        {MODEL_OPTIONS.map((model) => (
          <button
            type="button"
            key={model.id}
            onClick={() => onSelectModel(model.id)}
            aria-pressed={selectedModel === model.id}
            className={clsx(
              'relative p-4 rounded-xl border text-left transition-all',
              isIntake
                ? selectedModel === model.id
                  ? 'border-[var(--dsc-accent)] bg-[var(--dsc-accent-soft)] shadow-[inset_0_0_0_1px_var(--dsc-accent)]'
                  : 'border-[var(--dsc-line)] bg-[var(--dsc-surface-2)] hover:border-[var(--dsc-accent)]'
                : selectedModel === model.id
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
                  isIntake
                    ? 'text-[var(--dsc-ink)]'
                    : selectedModel === model.id ? 'text-gold-200' : 'text-black-200'
                )}>
                  {model.name}
                </p>
                <p className={clsx('text-xs', isIntake ? 'text-[var(--dsc-ink-3)]' : 'text-black-400')}>{model.subtitle}</p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mt-3 mb-3">
              <div className="text-center">
                <p className={clsx('mb-0.5 text-xs', isIntake ? 'text-[var(--dsc-ink-3)]' : 'text-black-500')}>Cost</p>
                <p className={clsx(
                  'text-sm font-bold',
                  model.id === 'haiku' ? 'text-emerald-400' :
                    model.id === 'sonnet' ? 'text-gold-400' : 'text-purple-400'
                )}>
                  {model.costPerScript}
                </p>
              </div>
              <div className="text-center">
                <p className={clsx('mb-0.5 text-xs', isIntake ? 'text-[var(--dsc-ink-3)]' : 'text-black-500')}>Speed</p>
                <p className={clsx('text-sm', isIntake ? 'text-[var(--dsc-ink-2)]' : 'text-black-300')}>{model.speed}</p>
              </div>
              <div className="text-center">
                <p className={clsx('mb-0.5 text-xs', isIntake ? 'text-[var(--dsc-ink-3)]' : 'text-black-500')}>Quality</p>
                <p className={clsx('text-sm', isIntake ? 'text-[var(--dsc-ink-2)]' : 'text-black-300')}>{model.quality}</p>
              </div>
            </div>

            {/* Description */}
            <p className={clsx('text-xs leading-relaxed', isIntake ? 'text-[var(--dsc-ink-2)]' : 'text-black-400')}>
              {model.description}
            </p>
            <p className={clsx('mt-3 border-t pt-2 font-mono text-[10px] leading-relaxed', isIntake ? 'border-[var(--dsc-line)] text-[var(--dsc-ink-3)]' : 'border-black-700 text-black-500')}>
              <span className="font-sans font-bold uppercase tracking-[0.08em]">{model.routeLabel}</span>
              <br />
              {model.modelId}
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
          <span className={isIntake ? 'text-[var(--dsc-ink-2)]' : 'text-black-400'}>
            Estimated batch cost for {pendingCount} files with {MODEL_OPTIONS.find(m => m.id === selectedModel)!.name}: {' '}
            <span className="font-semibold tabular-nums text-[var(--sp-accent)]">{batchCostEstimate}</span>
          </span>
        </div>
      )}
    </div>
  );
}
