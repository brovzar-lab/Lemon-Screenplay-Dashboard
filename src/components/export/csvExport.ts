/**
 * CSV Export Utility
 * Exports screenplay data to CSV format
 */

import Papa from 'papaparse';
import type { Screenplay } from '@/types';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import i18n, { currentUiLanguage } from '@/i18n';
import { analysisIsEnglishFallback, localizedScreenplay } from '@/lib/localizedAnalysis';

/**
 * Convert screenplays to CSV and trigger download
 */
export function exportToCSV(screenplays: Screenplay[], filename: string = 'screenplays') {
  const language = currentUiLanguage();
  const t = i18n.getFixedT(language);
  // Flatten screenplay data for CSV
  const rows = screenplays.map((original) => {
    const sp = localizedScreenplay(original, language);
    const fallback = analysisIsEnglishFallback(original, language);
    return {
      // Basic Info
      [t('Title')]: sp.title,
      [t('Author')]: sp.author,
      [t('Collection')]: sp.collection,
      [t('Genre')]: t(sp.genre),
      [t('Subgenres')]: fallback ? '' : sp.subgenres.join('; '),
      [t('Themes')]: fallback ? '' : sp.themes.join('; '),
      [t('Logline')]: fallback ? '' : sp.logline,
      [t('Tone')]: fallback ? '' : sp.tone,
      [t('Analysis language')]: fallback
        ? t('English')
        : t(language === 'es' ? 'Spanish' : 'English'),

      // Recommendation
      [t('Recommendation')]: sp.recommendation.toUpperCase().replace('_', ' '),
      [t('Is Film Now')]: sp.isFilmNow ? t('Yes') : t('No'),
      [t('Verdict Statement')]: fallback ? '' : sp.verdictStatement,

      // Core Scores
      [t('Final Score')]: sp.weightedScore.toFixed(2),
      [t('Raw Five-Pillar Score')]: sp.producerProjection?.rawScore.toFixed(2) ?? '',
      [t('Critical-Failure Deduction')]: sp.producerProjection?.penaltyApplied.toFixed(2) ?? '',
      [t('CVS Total')]: sp.cvsTotal,

      // Dimension Scores (version-appropriate labels)
      ...Object.fromEntries(
        getDimensionDisplay(sp).map((dim) => [
          t('{{label}} Score', { label: t(dim.label) }),
          dim.score,
        ]),
      ),

      // CVS Factors
      [t('CVS Assessed')]: sp.commercialViability.cvsAssessed !== false ? t('Yes') : t('No'),
      [t('Target Audience (CVS)')]:
        sp.commercialViability.cvsAssessed !== false
          ? sp.commercialViability.targetAudience.score
          : '',
      [t('High Concept (CVS)')]:
        sp.commercialViability.cvsAssessed !== false
          ? sp.commercialViability.highConcept.score
          : '',
      [t('Cast Attachability (CVS)')]:
        sp.commercialViability.cvsAssessed !== false
          ? sp.commercialViability.castAttachability.score
          : '',
      [t('Marketing Hook (CVS)')]:
        sp.commercialViability.cvsAssessed !== false
          ? sp.commercialViability.marketingHook.score
          : '',
      [t('Budget Return Ratio (CVS)')]:
        sp.commercialViability.cvsAssessed !== false
          ? sp.commercialViability.budgetReturnRatio.score
          : '',
      [t('Comparable Success (CVS)')]:
        sp.commercialViability.cvsAssessed !== false
          ? sp.commercialViability.comparableSuccess.score
          : '',

      // Producer Metrics
      [t('Market Potential')]: fallback ? '' : (sp.producerMetrics.marketPotential ?? t('N/A')),
      [t('USP Strength')]: fallback ? '' : (sp.producerMetrics.uspStrength ?? t('N/A')),

      // Production Details
      [t('Budget Category')]: t(sp.budgetCategory),
      [t('Marketability')]: fallback ? '' : sp.marketability,

      // Characters
      [t('Protagonist')]: fallback ? '' : sp.characters.protagonist,
      [t('Antagonist')]: fallback ? '' : sp.characters.antagonist,
      [t('Supporting Characters')]: fallback ? '' : sp.characters.supporting.join('; '),

      // Comparable Films
      [t('Comparable Films')]: sp.comparableFilms.map((f) => f.title).join('; '),

      // Assessment
      [t('Strengths')]: fallback ? '' : sp.strengths.join('; '),
      [t('Weaknesses')]: fallback ? '' : sp.weaknesses.join('; '),
      [t('Development Notes')]: fallback ? '' : sp.developmentNotes.join('; '),
      [t('Critical Failures')]: fallback ? '' : sp.criticalFailures.join('; '),
      [t('Major Weaknesses')]: fallback ? '' : sp.majorWeaknesses.join('; '),

      // File Metadata
      [t('Page Count')]: sp.metadata.pageCount,
      [t('Word Count')]: sp.metadata.wordCount,
    };
  });

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
  const filename = `comparison_${screenplays.map((sp) => sp.title.slice(0, 10).replace(/\s+/g, '_')).join('_vs_')}`;
  exportToCSV(screenplays, filename);
}
