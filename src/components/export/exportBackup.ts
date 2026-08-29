import { isDecisionReady } from '@/lib/producerProjection';
import type { Screenplay } from '@/types';

export function buildRawScreenplayBackup(screenplays: Screenplay[]) {
  const verifiedCount = screenplays.filter(isDecisionReady).length;
  return {
    exportedAt: new Date().toISOString(),
    version: '7.0',
    exportKind: 'raw_backup_not_decision_report',
    trustNotice: 'Only records with exportTrust.decisionReady=true are validated for decisions.',
    verifiedCount,
    unverifiedCount: screenplays.length - verifiedCount,
    screenplays: screenplays.map((screenplay) => ({
      ...screenplay,
      exportTrust: {
        decisionReady: isDecisionReady(screenplay),
        rankable: screenplay.producerProjection?.rankable === true,
        trustStatus: screenplay.producerProjection?.trustStatus ?? 'unverified',
        trustManifestVersion: screenplay.producerProjection?.trustManifestVersion ?? null,
        analysisVersion: screenplay.analysisVersion,
        analysisModel: screenplay.analysisModel,
        projectId: screenplay.projectId ?? null,
        versionId: screenplay.latestVersionId ?? null,
      },
    })),
  };
}
