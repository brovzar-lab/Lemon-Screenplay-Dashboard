/**
 * Analysis Page — Page 3 of the Coverage PDF
 *
 * Strengths, weaknesses, critical failures, development notes, structure.
 */

import { Page, Text, View } from '@react-pdf/renderer';
import type { Screenplay } from '@/types';
import { getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
import { s, C } from './shared';
import { Footer, IntHeader } from './SharedComponents';
import i18n, { type UiLanguage } from '@/i18n';

interface AnalysisPageProps {
  screenplay: Screenplay;
  language?: UiLanguage;
}

export function AnalysisPage({ screenplay, language = 'en' }: AnalysisPageProps) {
  const t = i18n.getFixedT(language);
  return (
    <Page size="A4" style={s.page} wrap>
      <IntHeader title={getScreenplayDisplayTitle(screenplay.title).title} />

      {/* Strengths */}
      <View style={s.section}>
        <Text style={s.heading}>{t('Strengths')}</Text>
        {(screenplay.strengths ?? []).map((str, i) => (
          <View key={i} style={s.li} wrap={false}>
            <Text style={[s.bullet, { color: C.green }]}>+</Text>
            <Text style={s.liText}>{str}</Text>
          </View>
        ))}
      </View>

      {/* Weaknesses */}
      <View style={s.section}>
        <Text style={s.heading}>{t('Weaknesses')}</Text>
        {(screenplay.weaknesses ?? []).map((w, i) => (
          <View key={i} style={s.li} wrap={false}>
            <Text style={[s.bullet, { color: C.amber }]}>-</Text>
            <Text style={s.liText}>{w}</Text>
          </View>
        ))}
      </View>

      {/* Critical failures */}
      {(screenplay.criticalFailures?.length ?? 0) > 0 && (
        <View style={s.section}>
          <Text style={s.heading}>{t('Critical Failures')}</Text>
          {(screenplay.criticalFailures ?? []).map((cf, i) => (
            <View key={i} style={s.li} wrap={false}>
              <Text style={[s.bullet, { color: C.red }]}>!</Text>
              <Text style={s.liText}>{cf}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Dev notes */}
      {(screenplay.developmentNotes?.length ?? 0) > 0 && (
        <View style={s.section}>
          <Text style={s.heading}>{t('Development Notes')}</Text>
          {(screenplay.developmentNotes ?? []).map((dn, i) => (
            <View key={i} style={s.li} wrap={false}>
              <Text style={[s.bullet, { color: C.gold }]}>*</Text>
              <Text style={s.liText}>{dn}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Structure */}
      <View style={s.section}>
        <Text style={s.heading}>{t('Structure')}</Text>
        <View style={s.structRow}>
          <View style={s.structItem}>
            <Text style={s.structLabel}>{t('Format Quality')}</Text>
            <Text style={s.structValue}>{screenplay.structureAnalysis?.formatQuality ?? '—'}</Text>
          </View>
          <View style={s.structItem}>
            <Text style={s.structLabel}>{t('Pacing')}</Text>
            <Text style={s.structValue}>{screenplay.structureAnalysis?.pacing || '—'}</Text>
          </View>
        </View>
        {screenplay.structureAnalysis?.actBreaks ? (
          <Text style={s.structAct}>{screenplay.structureAnalysis.actBreaks}</Text>
        ) : null}
      </View>

      <Footer language={language} />
    </Page>
  );
}
