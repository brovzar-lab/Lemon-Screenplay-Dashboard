/**
 * Appendix Page — Page 4 of the Coverage PDF
 *
 * Characters, comparable films, target audience, standout scenes, producer notes.
 */

import { Page, Text, View } from '@react-pdf/renderer';
import type { Screenplay } from '@/types';
import type { Note } from '@/types/filters';
import { s, C, boLabel, fmtDate, hasSceneData, hasFilmData } from './shared';
import { Footer, IntHeader } from './SharedComponents';

interface AppendixPageProps {
  screenplay: Screenplay;
  notes: Note[];
}

export function AppendixPage({ screenplay, notes }: AppendixPageProps) {
  const comps = (screenplay.comparableFilms ?? []).filter((f) => hasFilmData(f));
  const scenes = (screenplay.standoutScenes ?? []).filter((sc) => hasSceneData(sc));

  return (
    <Page size="A4" style={s.page} wrap>
      <IntHeader title={screenplay.title} />

      {/* Characters */}
      <View style={s.section}>
        <Text style={s.heading}>Characters</Text>
        <View style={s.charBlock} wrap={false}>
          <Text style={s.charRole}>Protagonist</Text>
          <Text style={s.charDesc}>{screenplay.characters.protagonist || '—'}</Text>
        </View>
        <View style={s.charBlock} wrap={false}>
          <Text style={s.charRole}>Antagonist</Text>
          <Text style={s.charDesc}>{screenplay.characters.antagonist || '—'}</Text>
        </View>
        {(screenplay.characters.supporting?.length ?? 0) > 0 && (
          <View style={s.charBlock}>
            <Text style={s.charRole}>Supporting Cast</Text>
            {screenplay.characters.supporting.map((ch, i) => (
              <View key={i} style={s.li} wrap={false}>
                <Text style={[s.bullet, { color: C.grey500 }]}>-</Text>
                <Text style={s.liText}>{ch}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Comparable Films — only if any have real data */}
      {comps.length > 0 && (
        <View style={s.section}>
          <Text style={s.heading}>Comparable Films</Text>
          {comps.map((film, i) => {
            const bo = boLabel(film.boxOfficeRelevance);
            return (
              <View key={i} style={s.compRow} wrap={false}>
                <View style={s.compInfo}>
                  <Text style={s.compTitle}>{film.title}</Text>
                  {film.similarity ? <Text style={s.compSim}>{film.similarity}</Text> : null}
                  {film.keyDivergence ? (
                    <Text style={[s.compSim, { fontStyle: 'italic', marginTop: 2 }]}>
                      Key Divergence: {film.keyDivergence}
                    </Text>
                  ) : null}
                </View>
                <Text style={[s.compBadge, { color: bo.color, backgroundColor: bo.bg }]}>
                  {bo.text}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Target Audience */}
      <View style={s.section}>
        <Text style={s.heading}>Target Audience</Text>
        <View style={s.audGrid}>
          <View style={s.audItem}>
            <Text style={s.audLabel}>Primary Demographic</Text>
            <Text style={s.audValue}>
              {screenplay.targetAudience.primaryDemographic || 'Not specified'}
            </Text>
          </View>
          <View style={s.audItem}>
            <Text style={s.audLabel}>Gender Skew</Text>
            <Text style={s.audValue}>{screenplay.targetAudience.genderSkew}</Text>
          </View>
        </View>
        {(screenplay.targetAudience.interests?.length ?? 0) > 0 && (
          <View>
            <Text style={s.audLabel}>Interests</Text>
            <Text style={s.audValue}>{screenplay.targetAudience.interests.join(', ')}</Text>
          </View>
        )}
      </View>

      {/* Standout Scenes — only if any have real data */}
      {scenes.length > 0 && (
        <View style={s.section}>
          <Text style={s.heading}>Standout Scenes</Text>
          {scenes.map((sc, i) => {
            const label = [sc.scene, sc.why].filter(Boolean).join(' — ');
            return (
              <View key={i} style={s.li} wrap={false}>
                <Text style={[s.bullet, { color: C.gold }]}>*</Text>
                <Text style={s.liText}>{label}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Producer Notes */}
      {notes.length > 0 && (
        <View style={s.section}>
          <Text style={s.heading}>Producer Notes</Text>
          {notes.map((note) => (
            <View key={note.id} style={s.noteCard} wrap={false}>
              <Text style={s.noteText}>{note.content}</Text>
              <Text style={s.noteDate}>{fmtDate(note.createdAt)}</Text>
            </View>
          ))}
        </View>
      )}

      <Footer />
    </Page>
  );
}
