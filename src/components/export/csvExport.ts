/**
 * CSV Export Utility
 * Exports screenplay data to CSV format
 */

import Papa from 'papaparse';
import type { Screenplay } from '@/types';

/**
 * Convert screenplays to CSV and trigger download
 */
export function exportToCSV(screenplays: Screenplay[], filename: string = 'screenplays') {
  // Flatten screenplay data for CSV
  const rows = screenplays.map((sp) => ({
    // Basic Info
    Title: sp.title,
    Author: sp.author,
    Collection: sp.collection,
    Genre: sp.genre,
    Subgenres: sp.subgenres.join('; '),
    Themes: sp.themes.join('; '),
    Logline: sp.logline,
    Tone: sp.tone,

    // Recommendation
    Recommendation: sp.recommendation.toUpperCase().replace('_', ' '),
    'Is Film Now': sp.isFilmNow ? 'Yes' : 'No',
    'Verdict Statement': sp.verdictStatement,

    // Core Scores
    'Weighted Score': sp.weightedScore.toFixed(2),
    'CVS Total': sp.cvsTotal,

    // Dimension Scores
    'Concept Score': sp.dimensionScores.concept,
    'Structure Score': sp.dimensionScores.structure,
    'Protagonist Score': sp.dimensionScores.protagonist,
    'Supporting Cast Score': sp.dimensionScores.supportingCast,
    'Dialogue Score': sp.dimensionScores.dialogue,
    'Genre Execution Score': sp.dimensionScores.genreExecution,
    'Originality Score': sp.dimensionScores.originality,

    // CVS Factors
    'CVS Assessed': sp.commercialViability.cvsAssessed !== false ? 'Yes' : 'No',
    'Target Audience (CVS)': sp.commercialViability.cvsAssessed !== false ? sp.commercialViability.targetAudience.score : '',
    'High Concept (CVS)': sp.commercialViability.cvsAssessed !== false ? sp.commercialViability.highConcept.score : '',
    'Cast Attachability (CVS)': sp.commercialViability.cvsAssessed !== false ? sp.commercialViability.castAttachability.score : '',
    'Marketing Hook (CVS)': sp.commercialViability.cvsAssessed !== false ? sp.commercialViability.marketingHook.score : '',
    'Budget Return Ratio (CVS)': sp.commercialViability.cvsAssessed !== false ? sp.commercialViability.budgetReturnRatio.score : '',
    'Comparable Success (CVS)': sp.commercialViability.cvsAssessed !== false ? sp.commercialViability.comparableSuccess.score : '',

    // Producer Metrics
    'Market Potential': sp.producerMetrics.marketPotential,
    'Production Risk': sp.producerMetrics.productionRisk,
    'Star Vehicle Potential': sp.producerMetrics.starVehiclePotential,
    'Festival Appeal': sp.producerMetrics.festivalAppeal,
    'ROI Indicator': sp.producerMetrics.roiIndicator,
    'USP Strength': sp.producerMetrics.uspStrength,

    // Production Details
    'Budget Category': sp.budgetCategory,
    Marketability: sp.marketability,

    // Characters
    Protagonist: sp.characters.protagonist,
    Antagonist: sp.characters.antagonist,
    'Supporting Characters': sp.characters.supporting.join('; '),

    // Comparable Films
    'Comparable Films': sp.comparableFilms.map((f) => f.title).join('; '),

    // Assessment
    Strengths: sp.strengths.join('; '),
    Weaknesses: sp.weaknesses.join('; '),
    'Development Notes': sp.developmentNotes.join('; '),
    'Critical Failures': sp.criticalFailures.join('; '),
    'Major Weaknesses': sp.majorWeaknesses.join('; '),

    // File Metadata
    'Page Count': sp.metadata.pageCount,
    'Word Count': sp.metadata.wordCount,
  }));

  // Convert to CSV
  const csv = Papa.unparse(rows);

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup
  URL.revokeObjectURL(url);
}

/**
 * Export comparison data to CSV
 */
export function exportComparisonToCSV(screenplays: Screenplay[]) {
  const filename = `comparison_${screenplays.map(sp => sp.title.slice(0, 10).replace(/\s+/g, '_')).join('_vs_')}`;
  exportToCSV(screenplays, filename);
}
