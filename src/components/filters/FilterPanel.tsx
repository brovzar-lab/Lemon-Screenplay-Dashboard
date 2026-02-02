/**
 * FilterPanel Component
 * Main filtering sidebar with range sliders and multi-selects
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { useFilterStore } from '@/stores/filterStore';
import { RangeSlider } from './RangeSlider';
import { MultiSelect } from './MultiSelect';

// Hardcoded genres and themes (extracted from screenplay data)
const AVAILABLE_GENRES = [
  'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Family', 'Fantasy', 'Film-Noir', 'History',
  'Horror', 'Musical', 'Mystery', 'Romance', 'Sci-Fi', 'Sport',
  'Thriller', 'War', 'Western',
];

const AVAILABLE_THEMES = [
  'Coming of Age', 'Redemption', 'Love', 'Revenge', 'Survival',
  'Identity', 'Family', 'Betrayal', 'Justice', 'Power', 'Freedom',
  'Sacrifice', 'Ambition', 'Friendship', 'Loss', 'Hope', 'Fear',
  'Corruption', 'Faith', 'Transformation',
];

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FilterPanel({ isOpen, onClose }: FilterPanelProps) {
  const [activeSection, setActiveSection] = useState<string | null>('scores');

  // Get filter state and actions
  const {
    // Genres & Themes
    genres,
    setGenres,
    themes,
    setThemes,
    // Score Ranges
    weightedScoreRange,
    setWeightedScoreRange,
    cvsRange,
    setCvsRange,
    conceptRange,
    setConceptRange,
    structureRange,
    setStructureRange,
    protagonistRange,
    setProtagonistRange,
    supportingCastRange,
    setSupportingCastRange,
    dialogueRange,
    setDialogueRange,
    genreExecutionRange,
    setGenreExecutionRange,
    originalityRange,
    setOriginalityRange,
    // Producer Metrics
    marketPotentialRange,
    setMarketPotentialRange,
    starVehiclePotentialRange,
    setStarVehiclePotentialRange,
    festivalAppealRange,
    setFestivalAppealRange,
    roiIndicatorRange,
    setRoiIndicatorRange,
    // Actions
    resetFilters,
  } = useFilterStore();

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  // Count active filters
  const activeFilterCount = [
    genres.length > 0,
    themes.length > 0,
    weightedScoreRange.enabled,
    cvsRange.enabled,
    conceptRange.enabled,
    structureRange.enabled,
    protagonistRange.enabled,
    supportingCastRange.enabled,
    dialogueRange.enabled,
    genreExecutionRange.enabled,
    originalityRange.enabled,
    marketPotentialRange.enabled,
    starVehiclePotentialRange.enabled,
    festivalAppealRange.enabled,
    roiIndicatorRange.enabled,
  ].filter(Boolean).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black-950/80 backdrop-blur-sm" onClick={onClose} />

      {/* Panel - Slide from right */}
      <div className="relative ml-auto w-full max-w-md h-full glass border-l border-gold-500/20 overflow-hidden animate-slide-in-right flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-black-700">
          <div>
            <h3 className="text-lg font-display text-gold-200">Advanced Filters</h3>
            {activeFilterCount > 0 && (
              <p className="text-xs text-gold-500">{activeFilterCount} filters active</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-black-700 text-black-400 hover:text-gold-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {/* Genre & Theme Section */}
          <Section
            title="Genre & Theme"
            isOpen={activeSection === 'genre'}
            onToggle={() => toggleSection('genre')}
            badge={genres.length + themes.length > 0 ? `${genres.length + themes.length}` : undefined}
          >
            <div className="space-y-4">
              <MultiSelect
                label="Genres"
                options={AVAILABLE_GENRES}
                selected={genres}
                onChange={setGenres}
                placeholder="Select genres..."
              />
              <MultiSelect
                label="Themes"
                options={AVAILABLE_THEMES}
                selected={themes}
                onChange={setThemes}
                placeholder="Select themes..."
              />
            </div>
          </Section>

          {/* Core Scores Section */}
          <Section
            title="Core Scores"
            isOpen={activeSection === 'scores'}
            onToggle={() => toggleSection('scores')}
            badge={[weightedScoreRange.enabled, cvsRange.enabled].filter(Boolean).length > 0
              ? `${[weightedScoreRange.enabled, cvsRange.enabled].filter(Boolean).length}`
              : undefined}
          >
            <div className="space-y-3">
              <RangeSlider
                label="Weighted Score"
                min={0}
                max={10}
                step={0.5}
                value={[weightedScoreRange.min, weightedScoreRange.max]}
                onChange={([min, max]) => setWeightedScoreRange({ min, max })}
                enabled={weightedScoreRange.enabled}
                onEnabledChange={(enabled) => setWeightedScoreRange({ enabled })}
              />
              <RangeSlider
                label="CVS Total"
                min={0}
                max={18}
                step={1}
                value={[cvsRange.min, cvsRange.max]}
                onChange={([min, max]) => setCvsRange({ min, max })}
                enabled={cvsRange.enabled}
                onEnabledChange={(enabled) => setCvsRange({ enabled })}
                formatValue={(v) => v.toFixed(0)}
              />
            </div>
          </Section>

          {/* Dimension Scores Section */}
          <Section
            title="Dimension Scores"
            isOpen={activeSection === 'dimensions'}
            onToggle={() => toggleSection('dimensions')}
            badge={[
              conceptRange.enabled,
              structureRange.enabled,
              protagonistRange.enabled,
              supportingCastRange.enabled,
              dialogueRange.enabled,
              genreExecutionRange.enabled,
              originalityRange.enabled,
            ].filter(Boolean).length > 0
              ? `${[conceptRange.enabled, structureRange.enabled, protagonistRange.enabled, supportingCastRange.enabled, dialogueRange.enabled, genreExecutionRange.enabled, originalityRange.enabled].filter(Boolean).length}`
              : undefined}
          >
            <div className="space-y-3">
              <RangeSlider
                label="Concept"
                min={0}
                max={10}
                step={0.5}
                value={[conceptRange.min, conceptRange.max]}
                onChange={([min, max]) => setConceptRange({ min, max })}
                enabled={conceptRange.enabled}
                onEnabledChange={(enabled) => setConceptRange({ enabled })}
              />
              <RangeSlider
                label="Structure"
                min={0}
                max={10}
                step={0.5}
                value={[structureRange.min, structureRange.max]}
                onChange={([min, max]) => setStructureRange({ min, max })}
                enabled={structureRange.enabled}
                onEnabledChange={(enabled) => setStructureRange({ enabled })}
              />
              <RangeSlider
                label="Protagonist"
                min={0}
                max={10}
                step={0.5}
                value={[protagonistRange.min, protagonistRange.max]}
                onChange={([min, max]) => setProtagonistRange({ min, max })}
                enabled={protagonistRange.enabled}
                onEnabledChange={(enabled) => setProtagonistRange({ enabled })}
              />
              <RangeSlider
                label="Supporting Cast"
                min={0}
                max={10}
                step={0.5}
                value={[supportingCastRange.min, supportingCastRange.max]}
                onChange={([min, max]) => setSupportingCastRange({ min, max })}
                enabled={supportingCastRange.enabled}
                onEnabledChange={(enabled) => setSupportingCastRange({ enabled })}
              />
              <RangeSlider
                label="Dialogue"
                min={0}
                max={10}
                step={0.5}
                value={[dialogueRange.min, dialogueRange.max]}
                onChange={([min, max]) => setDialogueRange({ min, max })}
                enabled={dialogueRange.enabled}
                onEnabledChange={(enabled) => setDialogueRange({ enabled })}
              />
              <RangeSlider
                label="Genre Execution"
                min={0}
                max={10}
                step={0.5}
                value={[genreExecutionRange.min, genreExecutionRange.max]}
                onChange={([min, max]) => setGenreExecutionRange({ min, max })}
                enabled={genreExecutionRange.enabled}
                onEnabledChange={(enabled) => setGenreExecutionRange({ enabled })}
              />
              <RangeSlider
                label="Originality"
                min={0}
                max={10}
                step={0.5}
                value={[originalityRange.min, originalityRange.max]}
                onChange={([min, max]) => setOriginalityRange({ min, max })}
                enabled={originalityRange.enabled}
                onEnabledChange={(enabled) => setOriginalityRange({ enabled })}
              />
            </div>
          </Section>

          {/* Producer Metrics Section */}
          <Section
            title="Producer Metrics"
            isOpen={activeSection === 'producer'}
            onToggle={() => toggleSection('producer')}
            badge={[
              marketPotentialRange.enabled,
              starVehiclePotentialRange.enabled,
              festivalAppealRange.enabled,
              roiIndicatorRange.enabled,
            ].filter(Boolean).length > 0
              ? `${[marketPotentialRange.enabled, starVehiclePotentialRange.enabled, festivalAppealRange.enabled, roiIndicatorRange.enabled].filter(Boolean).length}`
              : undefined}
          >
            <div className="space-y-3">
              <RangeSlider
                label="Market Potential"
                min={0}
                max={10}
                step={0.5}
                value={[marketPotentialRange.min, marketPotentialRange.max]}
                onChange={([min, max]) => setMarketPotentialRange({ min, max })}
                enabled={marketPotentialRange.enabled}
                onEnabledChange={(enabled) => setMarketPotentialRange({ enabled })}
              />
              <RangeSlider
                label="Star Vehicle Potential"
                min={0}
                max={10}
                step={0.5}
                value={[starVehiclePotentialRange.min, starVehiclePotentialRange.max]}
                onChange={([min, max]) => setStarVehiclePotentialRange({ min, max })}
                enabled={starVehiclePotentialRange.enabled}
                onEnabledChange={(enabled) => setStarVehiclePotentialRange({ enabled })}
              />
              <RangeSlider
                label="Festival Appeal"
                min={0}
                max={10}
                step={0.5}
                value={[festivalAppealRange.min, festivalAppealRange.max]}
                onChange={([min, max]) => setFestivalAppealRange({ min, max })}
                enabled={festivalAppealRange.enabled}
                onEnabledChange={(enabled) => setFestivalAppealRange({ enabled })}
              />
              <RangeSlider
                label="ROI Indicator"
                min={1}
                max={5}
                step={0.5}
                value={[roiIndicatorRange.min, roiIndicatorRange.max]}
                onChange={([min, max]) => setRoiIndicatorRange({ min, max })}
                enabled={roiIndicatorRange.enabled}
                onEnabledChange={(enabled) => setRoiIndicatorRange({ enabled })}
              />
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-black-700 bg-black-900/30">
          <button
            onClick={resetFilters}
            className="btn btn-ghost text-sm"
          >
            Reset All
          </button>
          <button
            onClick={onClose}
            className="btn btn-primary"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

// Collapsible Section Component
interface SectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}

function Section({ title, isOpen, onToggle, badge, children }: SectionProps) {
  return (
    <div className="border border-black-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-black-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gold-200">{title}</span>
          {badge && (
            <span className="px-1.5 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-xs font-bold">
              {badge}
            </span>
          )}
        </div>
        <svg
          className={clsx('w-4 h-4 text-black-400 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="p-3 pt-0 border-t border-black-700">
          {children}
        </div>
      )}
    </div>
  );
}

export default FilterPanel;
