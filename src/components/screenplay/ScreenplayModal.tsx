/**
 * ScreenplayModal Component
 * Full detail view for a screenplay with all V3/V5/V6 analysis data
 */

import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { DIMENSION_CONFIG, CVS_CONFIG, RECOMMENDATION_CONFIG, BUDGET_TIERS } from '@/types';
import { getScoreColorClass, getScoreBarFillClass } from '@/lib/calculations';
import { useNotesStore } from '@/stores/notesStore';
import type { ScreenplayWithV6 } from '@/lib/normalize';

/**
 * Type guard to check if screenplay has V6 fields
 */
function hasV6Fields(screenplay: Screenplay): screenplay is Screenplay & ScreenplayWithV6 {
  return 'v6CoreQuality' in screenplay || 'falsePositiveRisk' in screenplay;
}

interface ScreenplayModalProps {
  screenplay: Screenplay | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Safely convert to number
 */
function toNum(value: unknown, defaultValue = 0): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * Score bar with label and value
 */
function ScoreBar({
  label,
  score,
  max = 10,
  showJustification,
  justification
}: {
  label: string;
  score: number;
  max?: number;
  showJustification?: boolean;
  justification?: string;
}) {
  const safeScore = toNum(score);
  const percentage = (safeScore / max) * 100;
  const colorClass = getScoreBarFillClass(safeScore, max);

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm text-black-300">{label}</span>
        <span className={clsx('text-sm font-mono font-bold', getScoreColorClass(safeScore, max))}>
          {safeScore.toFixed(1)}/{max}
        </span>
      </div>
      <div className="score-bar h-2">
        <div
          className={clsx('score-bar-fill', colorClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showJustification && justification && (
        <p className="text-xs text-black-500 mt-1 italic">{justification}</p>
      )}
    </div>
  );
}

/**
 * Recommendation badge with full styling
 */
function RecommendationBadge({ tier, large = false }: { tier: Screenplay['recommendation']; large?: boolean }) {
  const config = RECOMMENDATION_CONFIG[tier];

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center font-bold uppercase tracking-wider rounded-lg',
        large ? 'px-6 py-3 text-lg' : 'px-4 py-2 text-sm',
        tier === 'film_now' && 'badge-film-now animate-pulse-glow',
        tier === 'recommend' && 'badge-recommend',
        tier === 'consider' && 'badge-consider',
        tier === 'pass' && 'badge-pass'
      )}
    >
      {config.label}
    </span>
  );
}

/**
 * CVS Factor display
 */
function CVSFactor({ label, score, note }: { label: string; score: number; note: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-black-900/50">
      <div className={clsx(
        'w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-sm',
        score === 3 && 'bg-emerald-500/20 text-emerald-400',
        score === 2 && 'bg-gold-500/20 text-gold-400',
        score === 1 && 'bg-red-500/20 text-red-400'
      )}>
        {score}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-black-200">{label}</div>
        <div className="text-xs text-black-500">{note}</div>
      </div>
    </div>
  );
}

/**
 * Section header
 */
function SectionHeader({ children, icon }: { children: React.ReactNode; icon?: string }) {
  return (
    <h3 className="text-lg font-display text-gold-200 mb-4 flex items-center gap-2">
      {icon && <span>{icon}</span>}
      {children}
    </h3>
  );
}

/**
 * Notes section - Simple version without zustand hooks to avoid hydration issues
 */
function NotesSection({ screenplayId }: { screenplayId: string }) {
  // Skip rendering if no screenplayId
  if (!screenplayId) {
    return null;
  }

  // Use the store methods directly instead of hooks to avoid hydration issues
  const handleAddNote = () => {
    const content = prompt('Enter your note:');
    if (content?.trim()) {
      useNotesStore.getState().addNote(screenplayId, content.trim());
    }
  };

  const handleDeleteNote = (noteId: string) => {
    useNotesStore.getState().deleteNote(screenplayId, noteId);
  };

  // Get notes from store state
  const notes = useNotesStore.getState().notes[screenplayId] || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader icon="📝">Notes</SectionHeader>
        <button onClick={handleAddNote} className="btn btn-secondary text-sm">
          + Add Note
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-black-500 italic">No notes yet. Add one to track your thoughts.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="p-3 rounded-lg bg-black-900/50 group">
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm text-black-300">{note.content}</p>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="text-xs text-black-600 mt-1">
                {new Date(note.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScreenplayModal({ screenplay, isOpen, onClose }: ScreenplayModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on escape key and manage focus
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';

      // Focus the close button when modal opens
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Focus trap - keep focus within modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey);
    return () => modal.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  if (!isOpen || !screenplay) return null;

  const budgetInfo = BUDGET_TIERS[screenplay.budgetCategory];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black-950/80 backdrop-blur-sm" aria-hidden="true" />

      {/* Modal Content */}
      <div
        ref={modalRef}
        className={clsx(
          'relative w-full max-w-4xl my-8 rounded-2xl overflow-hidden animate-scale-in',
          'glass border',
          screenplay.isFilmNow ? 'border-gold-400 film-now-glow' : 'border-gold-500/20'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={clsx(
          'p-6 border-b',
          screenplay.isFilmNow
            ? 'bg-gradient-to-r from-gold-900/30 to-gold-800/20 border-gold-500/30'
            : 'bg-black-900/50 border-black-700'
        )}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2
                id="modal-title"
                className={clsx(
                  'text-2xl font-display mb-1',
                  screenplay.isFilmNow ? 'text-gradient-gold' : 'text-gold-100'
                )}
              >
                {screenplay.title}
              </h2>
              <p className="text-black-400">by {screenplay.author}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="chip" style={{ borderColor: 'var(--color-violet-500)', color: 'var(--color-violet-500)' }}>
                  {screenplay.genre}
                </span>
                <span className="chip" style={{ borderColor: 'var(--color-amber-500)', color: 'var(--color-amber-500)' }}>
                  {budgetInfo.label} ({budgetInfo.range})
                </span>
                <span className="chip">
                  {screenplay.collection}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3">
              <RecommendationBadge tier={screenplay.recommendation} large />
              <div className="flex items-center gap-2">
                {/* Download PDF Button */}
                <button
                  onClick={() => {
                    const filename = screenplay.sourceFile || `${screenplay.title}.pdf`;
                    // Firebase Storage URL pattern - update BUCKET_NAME with your actual bucket
                    // Format: https://firebasestorage.googleapis.com/v0/b/BUCKET_NAME/o/screenplays%2FFILENAME?alt=media
                    const bucketName = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'your-project.appspot.com';
                    const encodedFilename = encodeURIComponent(filename);
                    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/screenplays%2F${encodedFilename}?alt=media`;

                    // Open in new tab (allows browser to handle PDF or download)
                    window.open(downloadUrl, '_blank');
                  }}
                  className="btn btn-primary text-sm flex items-center gap-2"
                  title={`Download ${screenplay.sourceFile || screenplay.title}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  PDF
                </button>
                <button
                  ref={closeButtonRef}
                  onClick={onClose}
                  className="text-black-400 hover:text-gold-400 transition-colors p-2"
                  aria-label="Close modal"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* Verdict Statement */}
          <div className={clsx(
            'p-4 rounded-xl',
            screenplay.isFilmNow
              ? 'bg-gradient-to-r from-gold-900/20 to-gold-800/10 border border-gold-500/30'
              : 'bg-black-900/50'
          )}>
            <p className="text-black-200 leading-relaxed">{screenplay.verdictStatement}</p>
          </div>

          {/* V6 False Positive Warning */}
          {hasV6Fields(screenplay) && screenplay.trapsTriggered && screenplay.trapsTriggered > 0 && (
            <div className={clsx(
              'p-4 rounded-xl border',
              screenplay.trapsTriggered >= 3
                ? 'bg-red-500/10 border-red-500/30'
                : screenplay.trapsTriggered >= 2
                  ? 'bg-orange-500/10 border-orange-500/30'
                  : 'bg-yellow-500/10 border-yellow-500/30'
            )}>
              <h4 className={clsx(
                'font-bold mb-2',
                screenplay.trapsTriggered >= 3
                  ? 'text-red-400'
                  : screenplay.trapsTriggered >= 2
                    ? 'text-orange-400'
                    : 'text-yellow-400'
              )}>
                {screenplay.trapsTriggered >= 3
                  ? '🚨 High False Positive Risk'
                  : screenplay.trapsTriggered >= 2
                    ? '⚠️ Moderate False Positive Risk'
                    : '💡 False Positive Flag'}
                {' '}({screenplay.trapsTriggered} trap{screenplay.trapsTriggered > 1 ? 's' : ''} triggered)
              </h4>
              <p className={clsx(
                'text-sm',
                screenplay.trapsTriggered >= 3
                  ? 'text-red-300'
                  : screenplay.trapsTriggered >= 2
                    ? 'text-orange-300'
                    : 'text-yellow-300'
              )}>
                {screenplay.trapsTriggered >= 3
                  ? 'This script has characteristics that often lead to disappointing outcomes. The verdict has been capped at CONSIDER. Review execution quality carefully.'
                  : screenplay.trapsTriggered >= 2
                    ? 'This script has been downgraded one tier due to potential false positive indicators. Verify execution matches the premise quality.'
                    : 'A minor flag was detected. The core quality may be slightly inflated by attractive surface elements.'}
              </p>
              {hasV6Fields(screenplay) && screenplay.v6CoreQuality?.false_positive_check?.traps_evaluated && (
                <div className="mt-3 text-xs text-black-400">
                  <span className="font-medium">Triggered traps: </span>
                  {screenplay.v6CoreQuality.false_positive_check.traps_evaluated
                    .filter(trap => trap.triggered)
                    .map(trap => trap.name.replace(/_/g, ' '))
                    .join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Critical Failures Warning */}
          {screenplay.criticalFailures.length > 0 && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <h4 className="text-red-400 font-bold mb-2">⚠️ Critical Failures (Auto-PASS)</h4>
              <ul className="list-disc list-inside space-y-1">
                {screenplay.criticalFailures.map((failure, i) => (
                  <li key={i} className="text-red-300 text-sm">{failure}</li>
                ))}
              </ul>
            </div>
          )}

          {/* FILM NOW Assessment */}
          {screenplay.isFilmNow && screenplay.filmNowAssessment && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-gold-900/20 to-gold-800/10 border border-gold-500/30">
              <SectionHeader icon="⭐">FILM NOW Qualifiers</SectionHeader>
              <div className="space-y-4">
                <div>
                  <h5 className="text-gold-400 text-sm font-medium mb-1">Lightning Test</h5>
                  <p className="text-black-300 text-sm">{screenplay.filmNowAssessment.lightningTest}</p>
                </div>
                {screenplay.filmNowAssessment.goosebumpsMoments.length > 0 && (
                  <div>
                    <h5 className="text-gold-400 text-sm font-medium mb-1">Goosebumps Moments</h5>
                    <ul className="list-disc list-inside space-y-1">
                      {screenplay.filmNowAssessment.goosebumpsMoments.map((moment, i) => (
                        <li key={i} className="text-black-300 text-sm">{moment}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <h5 className="text-gold-400 text-sm font-medium mb-1">Career Risk Test</h5>
                  <p className="text-black-300 text-sm">{screenplay.filmNowAssessment.careerRiskTest}</p>
                </div>
                <div>
                  <h5 className="text-gold-400 text-sm font-medium mb-1">Legacy Potential</h5>
                  <p className="text-black-300 text-sm">{screenplay.filmNowAssessment.legacyPotential}</p>
                </div>
              </div>
            </div>
          )}

          {/* Logline */}
          <div>
            <SectionHeader icon="📄">Logline</SectionHeader>
            <p className="text-black-300 leading-relaxed">{screenplay.logline}</p>
          </div>

          {/* Core Scores */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Dimension Scores */}
            <div>
              <SectionHeader icon="📊">Dimension Scores</SectionHeader>
              <div className="space-y-4">
                {DIMENSION_CONFIG.map(({ key, label, weight }) => (
                  <ScoreBar
                    key={key}
                    label={`${label} (${Math.round(weight * 100)}%)`}
                    score={screenplay.dimensionScores[key]}
                    showJustification
                    justification={screenplay.dimensionJustifications[key]}
                  />
                ))}
                <div className="pt-4 border-t border-black-700">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium text-gold-200">Weighted Score</span>
                    <span className={clsx(
                      'text-2xl font-mono font-bold',
                      getScoreColorClass(toNum(screenplay.weightedScore))
                    )}>
                      {toNum(screenplay.weightedScore).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* CVS Breakdown */}
            <div>
              <SectionHeader icon="💰">Commercial Viability Score</SectionHeader>
              <div className="space-y-2">
                {CVS_CONFIG.map(({ key, label }) => (
                  <CVSFactor
                    key={key}
                    label={label}
                    score={screenplay.commercialViability[key].score}
                    note={screenplay.commercialViability[key].note}
                  />
                ))}
                <div className="pt-4 border-t border-black-700 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium text-gold-200">CVS Total</span>
                    <span className={clsx(
                      'text-2xl font-mono font-bold',
                      getScoreColorClass(toNum(screenplay.cvsTotal), 18)
                    )}>
                      {toNum(screenplay.cvsTotal)}/18
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Producer Metrics */}
          {screenplay.producerMetrics && (
            <div>
              <SectionHeader icon="🎬">Producer Metrics</SectionHeader>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-black-900/50 text-center">
                  <div className="text-xs text-black-500 mb-1">Market Potential</div>
                  <div className={clsx('text-2xl font-mono font-bold', getScoreColorClass(toNum(screenplay.producerMetrics.marketPotential)))}>
                    {toNum(screenplay.producerMetrics.marketPotential)}/10
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-black-900/50 text-center">
                  <div className="text-xs text-black-500 mb-1">Production Risk</div>
                  <div className={clsx(
                    'text-xl font-bold',
                    screenplay.producerMetrics.productionRisk === 'Low' && 'text-emerald-400',
                    screenplay.producerMetrics.productionRisk === 'Medium' && 'text-gold-400',
                    screenplay.producerMetrics.productionRisk === 'High' && 'text-red-400'
                  )}>
                    {screenplay.producerMetrics.productionRisk || 'N/A'}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-black-900/50 text-center">
                  <div className="text-xs text-black-500 mb-1">Star Vehicle</div>
                  <div className={clsx('text-2xl font-mono font-bold', getScoreColorClass(toNum(screenplay.producerMetrics.starVehiclePotential)))}>
                    {toNum(screenplay.producerMetrics.starVehiclePotential)}/10
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-black-900/50 text-center">
                  <div className="text-xs text-black-500 mb-1">Festival Appeal</div>
                  <div className={clsx('text-2xl font-mono font-bold', getScoreColorClass(toNum(screenplay.producerMetrics.festivalAppeal)))}>
                    {toNum(screenplay.producerMetrics.festivalAppeal)}/10
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-black-900/50 text-center">
                  <div className="text-xs text-black-500 mb-1">ROI Indicator</div>
                  <div className="text-xl text-gold-400">
                    {'★'.repeat(Math.min(5, Math.max(0, Math.floor(toNum(screenplay.producerMetrics.roiIndicator, 3)))))}
                    {'☆'.repeat(Math.max(0, 5 - Math.floor(toNum(screenplay.producerMetrics.roiIndicator, 3))))}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-black-900/50 text-center">
                  <div className="text-xs text-black-500 mb-1">USP Strength</div>
                  <div className={clsx(
                    'text-xl font-bold',
                    screenplay.producerMetrics.uspStrength === 'Strong' && 'text-emerald-400',
                    screenplay.producerMetrics.uspStrength === 'Moderate' && 'text-gold-400',
                    screenplay.producerMetrics.uspStrength === 'Weak' && 'text-red-400'
                  )}>
                    {screenplay.producerMetrics.uspStrength || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Characters */}
          <div>
            <SectionHeader icon="👥">Characters</SectionHeader>
            <div className="space-y-3">
              <div>
                <h5 className="text-sm font-medium text-gold-400 mb-1">Protagonist</h5>
                <p className="text-sm text-black-300">{screenplay.characters.protagonist}</p>
              </div>
              <div>
                <h5 className="text-sm font-medium text-gold-400 mb-1">Antagonist</h5>
                <p className="text-sm text-black-300">{screenplay.characters.antagonist}</p>
              </div>
              {screenplay.characters.supporting.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gold-400 mb-1">Supporting Cast</h5>
                  <ul className="list-disc list-inside space-y-1">
                    {screenplay.characters.supporting.map((char, i) => (
                      <li key={i} className="text-sm text-black-300">{char}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Comparable Films */}
          {screenplay.comparableFilms.length > 0 && (
            <div>
              <SectionHeader icon="🎥">Comparable Films</SectionHeader>
              <div className="grid md:grid-cols-2 gap-3">
                {screenplay.comparableFilms.map((film, i) => (
                  <div key={i} className="p-3 rounded-lg bg-black-900/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-black-200">{film.title}</span>
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded',
                        film.boxOfficeRelevance === 'success' && 'bg-emerald-500/20 text-emerald-400',
                        film.boxOfficeRelevance === 'mixed' && 'bg-gold-500/20 text-gold-400',
                        film.boxOfficeRelevance === 'failure' && 'bg-red-500/20 text-red-400'
                      )}>
                        {film.boxOfficeRelevance}
                      </span>
                    </div>
                    <p className="text-xs text-black-500">{film.similarity}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Standout Scenes */}
          {screenplay.standoutScenes.length > 0 && (
            <div>
              <SectionHeader icon="✨">Standout Scenes</SectionHeader>
              <div className="space-y-3">
                {screenplay.standoutScenes.map((scene, i) => (
                  <div key={i} className="p-3 rounded-lg bg-black-900/50">
                    <p className="text-sm text-black-200 mb-1">{scene.scene}</p>
                    <p className="text-xs text-black-500 italic">Why: {scene.why}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strengths & Weaknesses */}
          <div className="grid md:grid-cols-2 gap-6">
            {screenplay.strengths.length > 0 && (
              <div>
                <SectionHeader icon="💪">Strengths</SectionHeader>
                <ul className="space-y-2">
                  {screenplay.strengths.map((strength, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-black-300">
                      <span className="text-emerald-400 mt-0.5">✓</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(screenplay.weaknesses.length > 0 || screenplay.majorWeaknesses.length > 0) && (
              <div>
                <SectionHeader icon="⚠️">Weaknesses</SectionHeader>
                <ul className="space-y-2">
                  {screenplay.majorWeaknesses.map((weakness, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-300">
                      <span className="text-red-400 mt-0.5">✗</span>
                      <span className="font-medium">[Major] {weakness}</span>
                    </li>
                  ))}
                  {screenplay.weaknesses.map((weakness, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-black-300">
                      <span className="text-gold-400 mt-0.5">!</span>
                      {weakness}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Development Notes */}
          {screenplay.developmentNotes.length > 0 && (
            <div>
              <SectionHeader icon="📋">Development Notes</SectionHeader>
              <ul className="space-y-2">
                {screenplay.developmentNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-black-300">
                    <span className="text-gold-400 mt-0.5">→</span>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* User Notes */}
          <NotesSection screenplayId={screenplay.id} />

          {/* V6 Lenses Summary (if enabled) */}
          {hasV6Fields(screenplay) && screenplay.v6LensesEnabled && screenplay.v6LensesEnabled.length > 0 && (
            <div>
              <SectionHeader icon="🔍">Enabled Analysis Lenses</SectionHeader>
              <div className="flex flex-wrap gap-2">
                {screenplay.v6LensesEnabled.map((lens, i) => (
                  <span key={i} className="chip" style={{ borderColor: 'var(--color-violet-500)', color: 'var(--color-violet-500)' }}>
                    {lens}
                  </span>
                ))}
              </div>
              {screenplay.v6BudgetCeilingUsed && (
                <p className="text-xs text-black-500 mt-2">
                  Budget ceiling: ${(screenplay.v6BudgetCeilingUsed / 1000000).toFixed(0)}M
                </p>
              )}
            </div>
          )}

          {/* Metadata & Version Control */}
          <div className="pt-6 mt-6 border-t border-black-700">
            <div className="flex flex-wrap gap-4 text-xs text-black-500 mb-3">
              <span>Pages: {screenplay.metadata?.pageCount || 'N/A'}</span>
              <span>Words: {(screenplay.metadata?.wordCount || 0).toLocaleString()}</span>
              <span>Source: {screenplay.sourceFile || 'N/A'}</span>
            </div>
            {/* Version Control Label - Prominent gray text */}
            <div className="text-xs text-black-400 pt-2 border-t border-black-800">
              Analyzed with <span className="font-mono font-medium text-black-300">{screenplay.analysisVersion || 'Unknown'}</span>
              {screenplay.analysisModel && (
                <span> • Model: <span className="font-mono text-black-300">{screenplay.analysisModel}</span></span>
              )}
              {hasV6Fields(screenplay) && screenplay.v6CoreQuality && (
                <span> • Core Score: <span className="font-mono text-black-300">{screenplay.v6CoreQuality.weighted_score?.toFixed(2) || 'N/A'}</span></span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScreenplayModal;
