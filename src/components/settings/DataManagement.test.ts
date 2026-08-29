import { describe, expect, it } from 'vitest';

import { buildRawScreenplayBackup } from '@/components/export/exportBackup';
import { createTestScreenplay } from '@/test/factories';

describe('buildRawScreenplayBackup', () => {
  it('labels raw records individually instead of exporting unverified data as decision evidence', () => {
    const backup = buildRawScreenplayBackup([
      createTestScreenplay({ title: 'Verified' }),
      createTestScreenplay({ title: 'Legacy', producerProjection: undefined }),
    ]);

    expect(backup).toMatchObject({
      exportKind: 'raw_backup_not_decision_report',
      verifiedCount: 1,
      unverifiedCount: 1,
    });
    expect(backup.screenplays.map((screenplay) => screenplay.exportTrust.decisionReady))
      .toEqual([true, false]);
  });
});
