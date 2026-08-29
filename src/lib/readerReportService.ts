import { doc, getDoc } from 'firebase/firestore';

import type { ReaderReportEvidence, Screenplay } from '@/types';
import { bindAuthoritativeVersion, toDocId } from '@/lib/analysisStore';
import { authReady, db } from '@/lib/firebase';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined;
}

function labelFromKey(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function finiteScore(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function parseReaderReports(raw: unknown): ReaderReportEvidence[] {
  const reportMap = asRecord(raw);
  if (!reportMap) return [];

  return Object.entries(reportMap).flatMap(([readerKey, value]) => {
    const report = asRecord(value);
    if (!report) return [];
    const subScoreMap = asRecord(report.sub_scores) ?? {};
    const reader = String(report.reader || readerKey);
    return [{
      reader,
      label: labelFromKey(reader),
      pillarScore: finiteScore(report.pillar_score),
      oneSentenceVerdict: String(report.one_sentence_verdict || ''),
      redFlags: Array.isArray(report.red_flags)
        ? report.red_flags.map(String)
        : [],
      subScores: Object.entries(subScoreMap).flatMap(([key, subScoreValue]) => {
        const subScore = asRecord(subScoreValue);
        if (!subScore) return [];
        return [{
          key,
          label: labelFromKey(key),
          score: finiteScore(subScore.score),
          justification: String(
            subScore.justification || subScore.evidence || subScore.note || '',
          ),
          pageCitations: Array.isArray(subScore.page_citations)
            ? subScore.page_citations.filter(
                (page): page is number =>
                  typeof page === 'number' && Number.isFinite(page),
              )
            : [],
        }];
      }),
    }];
  });
}

export async function fetchReaderReports(
  screenplay: Screenplay,
): Promise<ReaderReportEvidence[]> {
  await authReady;

  if (!screenplay.latestVersionId) return [];
  const projectId = screenplay.projectId || toDocId(screenplay.sourceFile);
  const [versionSnapshot, authoritySnapshot] = await Promise.all([
    getDoc(doc(
      db,
      'uploaded_analyses',
      projectId,
      'versions',
      screenplay.latestVersionId,
    )),
    getDoc(doc(
      db,
      'uploaded_analyses',
      projectId,
      'version_authorities',
      screenplay.latestVersionId,
    )),
  ]);
  if (!versionSnapshot.exists() || !authoritySnapshot.exists()) return [];

  const data = bindAuthoritativeVersion(
    { project_id: projectId, latest_version_id: screenplay.latestVersionId },
    versionSnapshot.data() as UnknownRecord,
    authoritySnapshot.data() as UnknownRecord,
  );
  if (data._trust_authority !== 'immutable_server') return [];
  const analysis = asRecord(data.analysis);
  return parseReaderReports(analysis?.reader_reports);
}
