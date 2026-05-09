/**
 * BillysTake — Lightweight verdict capture for the Obsidian Brain.
 *
 * One click records Billy's real take vs the AI verdict.
 * That delta is the learning signal that flows into the Brain's
 * script-level taste profile.
 *
 * Writes to Firestore: brain_verdicts/{screenplayId}
 * Synced to Obsidian Brain by: raw/notes/screenplay-sync.py (daily cron)
 */

import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import type { RecommendationTier } from '@/types/screenplay';
import { SectionHeader } from './SectionHeader';
import { saveBrainVerdict, loadBrainVerdict } from '@/lib/feedbackStore';

interface BillysTakeProps {
  screenplay: Screenplay;
}

const VERDICTS: { tier: RecommendationTier; label: string; color: string }[] = [
  { tier: 'pass',      label: 'Pass',      color: 'border-red-500/60 text-red-400 hover:bg-red-500/10 data-[active=true]:bg-red-500/20 data-[active=true]:border-red-400 data-[active=true]:text-red-300' },
  { tier: 'consider',  label: 'Consider',  color: 'border-amber-500/60 text-amber-400 hover:bg-amber-500/10 data-[active=true]:bg-amber-500/20 data-[active=true]:border-amber-400 data-[active=true]:text-amber-300' },
  { tier: 'recommend', label: 'Recommend', color: 'border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10 data-[active=true]:bg-emerald-500/20 data-[active=true]:border-emerald-400 data-[active=true]:text-emerald-300' },
  { tier: 'film_now',  label: 'Film Now',  color: 'border-gold-500/60 text-gold-400 hover:bg-gold-500/10 data-[active=true]:bg-gold-500/20 data-[active=true]:border-gold-400 data-[active=true]:text-gold-300' },
];

export function BillysTake({ screenplay }: BillysTakeProps) {
  const [selected, setSelected]   = useState<RecommendationTier | null>(null);
  const [note, setNote]           = useState('');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [loaded, setLoaded]       = useState(false);

  // Load existing verdict on open
  useEffect(() => {
    let cancelled = false;
    loadBrainVerdict(screenplay.id).then((existing) => {
      if (cancelled) return;
      if (existing) {
        setSelected(existing.billyVerdict);
        setNote(existing.note ?? '');
      }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [screenplay.id]);

  const handleSelect = useCallback(async (tier: RecommendationTier) => {
    setSelected(tier);
    setSaved(false);
    setSaving(true);
    await saveBrainVerdict({
      screenplayId:    screenplay.id,
      screenplayTitle: screenplay.title,
      billyVerdict:    tier,
      aiVerdict:       screenplay.recommendation,
      note,
      genre:           screenplay.genre ?? '',
      subgenres:       screenplay.subgenres ?? [],
      weightedScore:   screenplay.weightedScore ?? 0,
      source:          'screenplay-dashboard',
    });
    setSaving(false);
    setSaved(true);
  }, [screenplay, note]);

  const handleNoteBlur = useCallback(async () => {
    if (!selected || !note) return;
    setSaving(true);
    await saveBrainVerdict({
      screenplayId:    screenplay.id,
      screenplayTitle: screenplay.title,
      billyVerdict:    selected,
      aiVerdict:       screenplay.recommendation,
      note,
      genre:           screenplay.genre ?? '',
      subgenres:       screenplay.subgenres ?? [],
      weightedScore:   screenplay.weightedScore ?? 0,
      source:          'screenplay-dashboard',
    });
    setSaving(false);
    setSaved(true);
  }, [screenplay, selected, note]);

  const aiVerdict = screenplay.recommendation;
  const delta = selected && selected !== aiVerdict;

  if (!loaded) return null;

  return (
    <div className="space-y-3">
      <SectionHeader icon="🧠">Billy's Take</SectionHeader>

      {/* AI verdict reference */}
      <p className="text-xs text-black-400">
        AI verdict: <span className="text-black-300 font-medium capitalize">{aiVerdict.replace('_', ' ')}</span>
        {delta && (
          <span className="ml-2 text-gold-400/70">← you disagree</span>
        )}
      </p>

      {/* Verdict buttons */}
      <div className="flex gap-2 flex-wrap">
        {VERDICTS.map(({ tier, label, color }) => (
          <button
            key={tier}
            data-active={selected === tier}
            onClick={() => handleSelect(tier)}
            disabled={saving}
            className={clsx(
              'px-4 py-1.5 rounded-lg border text-sm font-medium transition-all duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              color
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Optional note — shown once a verdict is selected */}
      {selected && (
        <input
          type="text"
          value={note}
          onChange={(e) => { setNote(e.target.value); setSaved(false); }}
          onBlur={handleNoteBlur}
          placeholder="Quick note — what moved you or killed it? (optional)"
          className={clsx(
            'w-full px-3 py-2 rounded-lg text-sm',
            'bg-black-900/60 border border-black-700/60',
            'text-black-200 placeholder-black-600',
            'focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/20',
            'transition-colors duration-150'
          )}
        />
      )}

      {/* Save status */}
      {(saving || saved) && (
        <p className="text-xs text-black-500">
          {saving ? 'Saving…' : '✓ Saved to Brain'}
        </p>
      )}
    </div>
  );
}
